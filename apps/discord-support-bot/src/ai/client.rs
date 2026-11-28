use std::time::Duration;

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{de::DeserializeOwned, Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: "system".to_string(),
            content: content.into(),
        }
    }

    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: "user".to_string(),
            content: content.into(),
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: "assistant".to_string(),
            content: content.into(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct AiHealthStatus {
    pub reachable: bool,
    pub models_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AiClient {
    http: Client,
    base_url: String,
    api_key: Option<String>,
    chat_model: String,
    embed_model: String,
}

#[derive(Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    temperature: f32,
    max_tokens: u32,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Deserialize)]
struct ChatChoiceMessage {
    content: Option<String>,
}

#[derive(Serialize)]
struct EmbeddingRequest<'a> {
    model: &'a str,
    input: &'a [String],
}

#[derive(Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingItem>,
}

#[derive(Deserialize)]
struct EmbeddingItem {
    index: usize,
    embedding: Vec<f32>,
}

#[derive(Deserialize)]
struct ModelsListResponse {
    data: Option<Vec<serde_json::Value>>,
}

impl AiClient {
    pub fn new(
        base_url: String,
        api_key: Option<String>,
        chat_model: String,
        embed_model: String,
        timeout_secs: u64,
    ) -> Result<Self> {
        let http = Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()
            .context("failed to build reqwest client for local AI")?;

        Ok(Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key,
            chat_model,
            embed_model,
        })
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn chat_model(&self) -> &str {
        &self.chat_model
    }

    pub fn embed_model(&self) -> &str {
        &self.embed_model
    }

    fn apply_auth(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        match &self.api_key {
            Some(key) if !key.is_empty() => req.bearer_auth(key),
            _ => req,
        }
    }

    pub async fn chat(
        &self,
        messages: &[ChatMessage],
        temperature: f32,
        max_tokens: u32,
    ) -> Result<String> {
        let endpoint = format!("{}/chat/completions", self.base_url);
        let body = ChatCompletionRequest {
            model: &self.chat_model,
            messages,
            temperature,
            max_tokens,
        };

        let resp = self
            .apply_auth(self.http.post(&endpoint).json(&body))
            .send()
            .await
            .with_context(|| format!("failed to contact chat endpoint {endpoint}"))?;

        let status = resp.status();
        let text = resp
            .text()
            .await
            .context("failed reading chat completion body")?;

        if !status.is_success() {
            anyhow::bail!("chat completion error HTTP {status}: {text}");
        }

        let parsed: ChatCompletionResponse = serde_json::from_str(&text)
            .with_context(|| format!("invalid chat completion JSON: {text}"))?;

        let content = parsed
            .choices
            .into_iter()
            .next()
            .and_then(|c| c.message.content)
            .unwrap_or_default()
            .trim()
            .to_string();

        if content.is_empty() {
            anyhow::bail!("AI chat model returned empty content");
        }

        Ok(content)
    }

    pub async fn chat_json<T: DeserializeOwned>(
        &self,
        messages: &[ChatMessage],
        temperature: f32,
        max_tokens: u32,
    ) -> Result<T> {
        let raw = self.chat(messages, temperature, max_tokens).await?;
        parse_json_fenced(&raw)
    }

    pub async fn embed_batch(&self, inputs: &[String]) -> Result<Vec<Vec<f32>>> {
        if inputs.is_empty() {
            return Ok(Vec::new());
        }

        let endpoint = format!("{}/embeddings", self.base_url);
        let body = EmbeddingRequest {
            model: &self.embed_model,
            input: inputs,
        };

        let resp = self
            .apply_auth(self.http.post(&endpoint).json(&body))
            .send()
            .await
            .with_context(|| format!("failed to contact embedding endpoint {endpoint}"))?;

        let status = resp.status();
        let text = resp.text().await.context("failed reading embedding body")?;

        if !status.is_success() {
            anyhow::bail!("embedding error HTTP {status}: {text}");
        }

        let parsed: EmbeddingResponse = serde_json::from_str(&text)
            .with_context(|| format!("invalid embedding response JSON: {text}"))?;

        let mut items = parsed.data;
        items.sort_by_key(|item| item.index);
        if items.len() != inputs.len() {
            anyhow::bail!(
                "embedding response count mismatch: expected {}, got {}",
                inputs.len(),
                items.len()
            );
        }

        Ok(items.into_iter().map(|i| i.embedding).collect())
    }

    pub async fn health_check(&self) -> AiHealthStatus {
        let endpoint = format!("{}/models", self.base_url);
        let req = self
            .apply_auth(self.http.get(&endpoint))
            .timeout(Duration::from_secs(5));

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                let count = resp
                    .json::<ModelsListResponse>()
                    .await
                    .ok()
                    .and_then(|m| m.data)
                    .map(|d| d.len())
                    .unwrap_or(0);
                AiHealthStatus {
                    reachable: true,
                    models_count: count,
                    error: None,
                }
            }
            Ok(resp) => AiHealthStatus {
                reachable: false,
                models_count: 0,
                error: Some(format!("HTTP {}", resp.status())),
            },
            Err(err) => AiHealthStatus {
                reachable: false,
                models_count: 0,
                error: Some(err.to_string()),
            },
        }
    }
}

pub fn parse_json_fenced<T: DeserializeOwned>(raw: &str) -> Result<T> {
    let trimmed = raw.trim();
    let stripped = if let Some(after_start) = trimmed.strip_prefix("```") {
        let body = after_start
            .strip_prefix("json")
            .or_else(|| after_start.strip_prefix("JSON"))
            .unwrap_or(after_start);
        body.trim().trim_end_matches("```").trim()
    } else {
        trimmed
    };

    if let Ok(parsed) = serde_json::from_str::<T>(stripped) {
        return Ok(parsed);
    }

    if let (Some(start), Some(end)) = (stripped.find('{'), stripped.rfind('}')) {
        if start < end {
            let slice = &stripped[start..=end];
            return serde_json::from_str::<T>(slice)
                .with_context(|| format!("failed parsing extracted JSON object: {slice}"));
        }
    }

    anyhow::bail!("could not parse JSON from model output: {trimmed}")
}

#[cfg(test)]
mod tests {
    use super::parse_json_fenced;
    use serde::Deserialize;

    #[derive(Debug, Deserialize, PartialEq)]
    struct Sample {
        ok: bool,
        count: u32,
    }

    #[test]
    fn parses_fenced_and_prose_wrapped_json() {
        let fenced = "Here is the evaluation:\n```json\n{\"ok\": true, \"count\": 3}\n```";
        assert_eq!(
            parse_json_fenced::<Sample>(fenced).unwrap(),
            Sample { ok: true, count: 3 }
        );

        let plain = "{\"ok\": false, \"count\": 0}";
        assert_eq!(
            parse_json_fenced::<Sample>(plain).unwrap(),
            Sample {
                ok: false,
                count: 0
            }
        );
    }
}
