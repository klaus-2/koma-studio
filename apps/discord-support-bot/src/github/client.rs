use std::time::Duration;

use anyhow::{Context, Result};
use base64::Engine as _;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct ExistingIssue {
    pub number: u64,
    pub title: String,
    pub html_url: String,
    pub state: String,
    pub is_pr: bool,
}

#[derive(Debug, Clone)]
pub struct CreatedGitHubItem {
    pub number: u64,
    pub html_url: String,
    pub branch_name: Option<String>,
}

#[derive(Debug, Clone)]
pub struct GitHubClient {
    http: Client,
    owner: String,
    repo: String,
    base_branch: String,
    configured: bool,
}

#[derive(Deserialize)]
struct SearchIssuesResponse {
    items: Vec<SearchIssueItem>,
}

#[derive(Deserialize)]
struct SearchIssueItem {
    number: u64,
    title: String,
    html_url: String,
    state: String,
    pull_request: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct CreateIssueBody<'a> {
    title: &'a str,
    body: &'a str,
    labels: &'a [String],
}

#[derive(Deserialize)]
struct CreatedIssueResponse {
    number: u64,
    html_url: String,
}

#[derive(Deserialize)]
struct GitRefResponse {
    object: GitRefObject,
}

#[derive(Deserialize)]
struct GitRefObject {
    sha: String,
}

#[derive(Deserialize)]
struct ContentFileResponse {
    sha: String,
}

#[derive(Serialize)]
struct CreateRefBody<'a> {
    #[serde(rename = "ref")]
    ref_name: &'a str,
    sha: &'a str,
}

#[derive(Serialize)]
struct UpdateFileBody<'a> {
    message: &'a str,
    content: &'a str,
    branch: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    sha: Option<&'a str>,
}

#[derive(Serialize)]
struct CreatePullBody<'a> {
    title: &'a str,
    head: &'a str,
    base: &'a str,
    body: &'a str,
    draft: bool,
}

impl GitHubClient {
    pub fn new(
        token: Option<String>,
        owner: String,
        repo: String,
        base_branch: String,
    ) -> Result<Self> {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("koma-discord-support-bot/0.1"),
        );
        headers.insert(
            ACCEPT,
            HeaderValue::from_static("application/vnd.github+json"),
        );

        let configured = if let Some(tok) = token.as_ref().filter(|t| !t.trim().is_empty()) {
            let value = HeaderValue::from_str(&format!("Bearer {}", tok.trim()))
                .context("GITHUB_TOKEN contains invalid header characters")?;
            headers.insert(AUTHORIZATION, value);
            true
        } else {
            false
        };

        let http = Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(25))
            .build()
            .context("failed building GitHub HTTP client")?;

        Ok(Self {
            http,
            owner,
            repo,
            base_branch,
            configured,
        })
    }

    pub fn is_configured(&self) -> bool {
        self.configured
    }

    pub fn repo_slug(&self) -> String {
        format!("{}/{}", self.owner, self.repo)
    }

    pub async fn search_similar_issues(&self, query: &str) -> Result<Vec<ExistingIssue>> {
        let terms: Vec<&str> = query
            .split_whitespace()
            .filter(|w| w.len() >= 3)
            .take(6)
            .collect();
        if terms.is_empty() {
            return Ok(Vec::new());
        }

        let q = format!("{} repo:{}/{}", terms.join(" "), self.owner, self.repo);
        let url = url::Url::parse_with_params(
            "https://api.github.com/search/issues",
            &[("q", q.as_str()), ("per_page", "5")],
        )?;

        let resp = self.http.get(url).send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("GitHub search failed ({status}): {text}");
        }

        let parsed: SearchIssuesResponse = resp.json().await?;
        Ok(parsed
            .items
            .into_iter()
            .map(|item| ExistingIssue {
                number: item.number,
                title: item.title,
                html_url: item.html_url,
                state: item.state,
                is_pr: item.pull_request.is_some(),
            })
            .collect())
    }

    pub async fn create_issue(
        &self,
        title: &str,
        body: &str,
        labels: &[String],
    ) -> Result<CreatedGitHubItem> {
        if !self.configured {
            anyhow::bail!("GITHUB_TOKEN is not configured on the bot");
        }

        let endpoint = format!(
            "https://api.github.com/repos/{}/{}/issues",
            self.owner, self.repo
        );
        let payload = CreateIssueBody {
            title,
            body,
            labels,
        };

        let resp = self.http.post(&endpoint).json(&payload).send().await?;
        let status = resp.status();
        let text = resp.text().await?;
        if !status.is_success() {
            anyhow::bail!("GitHub issue creation failed ({status}): {text}");
        }

        let created: CreatedIssueResponse = serde_json::from_str(&text)?;
        Ok(CreatedGitHubItem {
            number: created.number,
            html_url: created.html_url,
            branch_name: None,
        })
    }

    pub async fn create_draft_pr(
        &self,
        proposal_id: &str,
        title: &str,
        body: &str,
        target_file: Option<&str>,
        file_content: Option<&str>,
    ) -> Result<CreatedGitHubItem> {
        if !self.configured {
            anyhow::bail!("GITHUB_TOKEN is not configured on the bot");
        }

        let base_ref_url = format!(
            "https://api.github.com/repos/{}/{}/git/ref/heads/{}",
            self.owner, self.repo, self.base_branch
        );
        let ref_resp = self.http.get(&base_ref_url).send().await?;
        let ref_status = ref_resp.status();
        let ref_text = ref_resp.text().await?;
        if !ref_status.is_success() {
            anyhow::bail!("failed fetching base branch ref ({ref_status}): {ref_text}");
        }
        let base_ref: GitRefResponse = serde_json::from_str(&ref_text)?;

        let short_id: String = proposal_id.chars().take(8).collect();
        let slug = slugify(title);
        let branch_name = format!("bot/{slug}-{short_id}");
        let create_ref_url = format!(
            "https://api.github.com/repos/{}/{}/git/refs",
            self.owner, self.repo
        );
        let full_ref = format!("refs/heads/{branch_name}");
        let ref_payload = CreateRefBody {
            ref_name: &full_ref,
            sha: &base_ref.object.sha,
        };
        let branch_resp = self
            .http
            .post(&create_ref_url)
            .json(&ref_payload)
            .send()
            .await?;
        let branch_status = branch_resp.status();
        if !branch_status.is_success() {
            let err_text = branch_resp.text().await.unwrap_or_default();
            anyhow::bail!("failed creating draft PR branch ({branch_status}): {err_text}");
        }

        let sanitized_target = target_file
            .map(|p| p.replace('\\', "/").trim_start_matches('/').to_string())
            .filter(|p| !p.is_empty() && !p.contains(".."));

        let (commit_path, commit_content) = match (sanitized_target, file_content) {
            (Some(path), Some(patch)) if !patch.trim().is_empty() => (path, patch.to_string()),
            _ => (
                format!("docs/proposals/{slug}-{short_id}.md"),
                format!("# {title}\n\n{body}\n"),
            ),
        };

        let existing_sha = self
            .fetch_file_sha(&commit_path, &branch_name)
            .await
            .unwrap_or(None);

        let contents_url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            self.owner, self.repo, commit_path
        );
        let encoded = base64::engine::general_purpose::STANDARD.encode(commit_content.as_bytes());
        let commit_msg = format!("docs(bot): draft proposal - {title}");
        let update_payload = UpdateFileBody {
            message: &commit_msg,
            content: &encoded,
            branch: &branch_name,
            sha: existing_sha.as_deref(),
        };

        let put_resp = self
            .http
            .put(&contents_url)
            .json(&update_payload)
            .send()
            .await?;
        if !put_resp.status().is_success() {
            let st = put_resp.status();
            let err_text = put_resp.text().await.unwrap_or_default();
            anyhow::bail!("failed committing proposal file on branch ({st}): {err_text}");
        }

        let pulls_url = format!(
            "https://api.github.com/repos/{}/{}/pulls",
            self.owner, self.repo
        );
        let pull_payload = CreatePullBody {
            title,
            head: &branch_name,
            base: &self.base_branch,
            body,
            draft: true,
        };

        let pr_resp = self
            .http
            .post(&pulls_url)
            .json(&pull_payload)
            .send()
            .await?;
        let pr_status = pr_resp.status();
        let pr_text = pr_resp.text().await?;
        if !pr_status.is_success() {
            anyhow::bail!("GitHub draft PR creation failed ({pr_status}): {pr_text}");
        }

        let created: CreatedIssueResponse = serde_json::from_str(&pr_text)?;
        Ok(CreatedGitHubItem {
            number: created.number,
            html_url: created.html_url,
            branch_name: Some(branch_name),
        })
    }

    async fn fetch_file_sha(&self, path: &str, branch: &str) -> Result<Option<String>> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}?ref={}",
            self.owner, self.repo, path, branch
        );
        let resp = self.http.get(&url).send().await?;
        if resp.status().is_success() {
            let parsed: ContentFileResponse = resp.json().await?;
            Ok(Some(parsed.sha))
        } else {
            Ok(None)
        }
    }
}

pub fn slugify(title: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in title.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
        if out.len() >= 36 {
            break;
        }
    }
    out.trim_matches('-').to_string()
}

#[cfg(test)]
mod tests {
    use super::slugify;

    #[test]
    fn generates_safe_branch_slugs() {
        assert_eq!(
            slugify("fix(ui): Noir accent RGB picker & scrollbar!"),
            "fix-ui-noir-accent-rgb-picker-scroll"
        );
    }
}
