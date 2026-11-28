pub mod client;
pub mod triage;

pub use client::{ExistingIssue, GitHubClient};
pub use triage::evaluate_viability;
