use std::collections::BTreeMap;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha384};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IncrementalUpdateManifest {
    pub version: String,
    pub channel: String,
    pub generated_at: String,
    pub base_url: Option<String>,
    pub merkle_root: String,
    pub signature: String,
    #[serde(default)]
    pub public_key: Option<String>,
    #[serde(default)]
    pub chunks: BTreeMap<String, ManifestChunk>,
    #[serde(default)]
    pub binary_deltas: Vec<BinaryDelta>,
    #[serde(default)]
    pub model_deltas: Vec<ModelDelta>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManifestChunk {
    pub hash: String,
    pub size: u64,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub path: Vec<MerkleProofStep>,
    #[serde(default)]
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MerkleProofStep {
    pub hash: String,
    pub position: MerkleProofPosition,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MerkleProofPosition {
    Left,
    Right,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BinaryDelta {
    pub artifact: String,
    pub from_version: String,
    pub to_version: String,
    pub patch_hash: String,
    pub patch_size: u64,
    pub target_hash: String,
    pub target_size: u64,
    pub patch_url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelDelta {
    pub model_id: String,
    pub from_version: String,
    pub to_version: String,
    pub format: String,
    pub patch_hash: String,
    pub patch_size: u64,
    pub target_hash: String,
    pub target_size: u64,
    pub patch_url: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManifestValidationReport {
    pub version: String,
    pub channel: String,
    pub chunk_count: usize,
    pub merkle_root: String,
    pub signature_valid: bool,
}

pub fn parse_manifest(raw: &str) -> Result<IncrementalUpdateManifest, String> {
    serde_json::from_str(raw).map_err(|error| format!("invalid manifest: {error}"))
}

pub fn validate_manifest(
    manifest: &IncrementalUpdateManifest,
    public_key_override: Option<&str>,
) -> Result<ManifestValidationReport, String> {
    if manifest.version.trim().is_empty() {
        return Err("manifest sem version".to_string());
    }
    if manifest.channel.trim().is_empty() {
        return Err("manifest sem channel".to_string());
    }

    let computed_root = merkle_root_for_manifest(manifest)?;
    let expected_root = normalize_hash_hex(&manifest.merkle_root)?;
    if computed_root != expected_root {
        return Err(format!(
            "merkle root mismatch: expected {expected_root}, computed {computed_root}"
        ));
    }

    for (name, chunk) in &manifest.chunks {
        verify_chunk_proof(chunk, &expected_root)
            .map_err(|error| format!("proof invalida para {name}: {error}"))?;
    }

    let public_key = public_key_override
        .or(manifest.public_key.as_deref())
        .ok_or_else(|| "manifest has no publicKey and no public key is configured".to_string())?;
    verify_signature(public_key, &manifest.signature, &manifest.merkle_root)?;

    Ok(ManifestValidationReport {
        version: manifest.version.clone(),
        channel: manifest.channel.clone(),
        chunk_count: manifest.chunks.len(),
        merkle_root: manifest.merkle_root.clone(),
        signature_valid: true,
    })
}

pub fn sha384_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha384::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

#[cfg(test)]
pub fn integrity_for_bytes(bytes: &[u8]) -> String {
    format!("sha384-{}", sha384_bytes(bytes))
}

pub fn verify_hash(bytes: &[u8], expected: &str) -> Result<String, String> {
    let actual = sha384_bytes(bytes);
    let expected = normalize_hash_hex(expected)?;
    if actual != expected {
        return Err(format!(
            "sha384 mismatch: expected {expected}, computed {actual}"
        ));
    }
    Ok(actual)
}

pub fn normalize_hash_hex(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    let raw = trimmed
        .strip_prefix("sha384-")
        .or_else(|| trimmed.strip_prefix("SHA384-"))
        .unwrap_or(trimmed);
    if raw.len() == 96 && raw.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Ok(raw.to_ascii_lowercase());
    }
    let decoded = BASE64
        .decode(raw)
        .map_err(|_| format!("invalid sha384 hash: {value}"))?;
    if decoded.len() != 48 {
        return Err(format!(
            "sha384 hash has an invalid length: {}",
            decoded.len()
        ));
    }
    Ok(hex::encode(decoded))
}

pub fn merkle_root_for_manifest(manifest: &IncrementalUpdateManifest) -> Result<String, String> {
    let leaves = manifest
        .chunks
        .values()
        .map(|chunk| decode_hash_bytes(&chunk.hash))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hex::encode(merkle_root_bytes(leaves)))
}

pub fn merkle_root_bytes(mut level: Vec<Vec<u8>>) -> Vec<u8> {
    if level.is_empty() {
        return Sha384::digest([]).to_vec();
    }

    while level.len() > 1 {
        let mut next = Vec::with_capacity(level.len().div_ceil(2));
        for pair in level.chunks(2) {
            let left = &pair[0];
            let right = pair.get(1).unwrap_or(left);
            let mut hasher = Sha384::new();
            hasher.update(left);
            hasher.update(right);
            next.push(hasher.finalize().to_vec());
        }
        level = next;
    }
    level.remove(0)
}

pub fn verify_chunk_proof(chunk: &ManifestChunk, root_hex: &str) -> Result<(), String> {
    let mut current = decode_hash_bytes(&chunk.hash)?;
    for step in &chunk.path {
        let sibling = decode_hash_bytes(&step.hash)?;
        let mut hasher = Sha384::new();
        match step.position {
            MerkleProofPosition::Left => {
                hasher.update(&sibling);
                hasher.update(&current);
            }
            MerkleProofPosition::Right => {
                hasher.update(&current);
                hasher.update(&sibling);
            }
        }
        current = hasher.finalize().to_vec();
    }

    let expected = normalize_hash_hex(root_hex)?;
    let actual = hex::encode(current);
    if actual != expected {
        return Err(format!("proof points to {actual}, expected {expected}"));
    }
    Ok(())
}

pub fn verify_signature(public_key: &str, signature: &str, message: &str) -> Result<(), String> {
    let key_bytes = decode_public_key(public_key)?;
    let signature_bytes = decode_signature(signature)?;
    let key_array: [u8; 32] = key_bytes
        .try_into()
        .map_err(|_| "Ed25519 public key must be 32 bytes long".to_string())?;
    let verifying_key = VerifyingKey::from_bytes(&key_array).map_err(|error| error.to_string())?;
    let signature = Signature::from_slice(&signature_bytes).map_err(|error| error.to_string())?;
    verifying_key
        .verify(message.as_bytes(), &signature)
        .map_err(|error| format!("invalid Ed25519 signature: {error}"))
}

fn decode_hash_bytes(value: &str) -> Result<Vec<u8>, String> {
    hex::decode(normalize_hash_hex(value)?).map_err(|error| error.to_string())
}

fn decode_signature(value: &str) -> Result<Vec<u8>, String> {
    let raw = value
        .trim()
        .strip_prefix("ed25519-")
        .unwrap_or_else(|| value.trim());
    let bytes = if raw.len() == 128 && raw.chars().all(|ch| ch.is_ascii_hexdigit()) {
        hex::decode(raw).map_err(|error| error.to_string())?
    } else {
        BASE64.decode(raw).map_err(|error| error.to_string())?
    };
    if bytes.len() != 64 {
        return Err(format!(
            "Ed25519 signature must be 64 bytes long, got {}",
            bytes.len()
        ));
    }
    Ok(bytes)
}

fn decode_public_key(value: &str) -> Result<Vec<u8>, String> {
    let trimmed = value.trim();
    let raw = trimmed
        .strip_prefix("ed25519-")
        .or_else(|| trimmed.strip_prefix("raw-ed25519-"))
        .unwrap_or(trimmed);

    if let Some(spki) = trimmed.strip_prefix("spki-ed25519-") {
        let bytes = BASE64.decode(spki).map_err(|error| error.to_string())?;
        return bytes
            .get(bytes.len().saturating_sub(32)..)
            .map(|slice| slice.to_vec())
            .ok_or_else(|| "invalid Ed25519 SPKI".to_string());
    }

    if raw.len() == 64 && raw.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return hex::decode(raw).map_err(|error| error.to_string());
    }

    let decoded = BASE64.decode(raw).map_err(|error| error.to_string())?;
    if decoded.len() == 32 {
        return Ok(decoded);
    }

    if let Ok(text) = String::from_utf8(decoded.clone()) {
        if text.contains("minisign public key") {
            if let Some(line) = text.lines().find(|line| line.starts_with("RW")) {
                let minisign = BASE64.decode(line).map_err(|error| error.to_string())?;
                return minisign
                    .get(minisign.len().saturating_sub(32)..)
                    .map(|slice| slice.to_vec())
                    .ok_or_else(|| "invalid minisign public key".to_string());
            }
        }
    }

    decoded
        .get(decoded.len().saturating_sub(32)..)
        .map(|slice| slice.to_vec())
        .ok_or_else(|| "invalid Ed25519 public key".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn signed_manifest(chunks: BTreeMap<String, ManifestChunk>) -> IncrementalUpdateManifest {
        let mut manifest = IncrementalUpdateManifest {
            version: "2.0.1".to_string(),
            channel: "stable".to_string(),
            generated_at: "2026-05-20T00:00:00Z".to_string(),
            base_url: None,
            merkle_root: String::new(),
            signature: String::new(),
            public_key: None,
            chunks,
            binary_deltas: Vec::new(),
            model_deltas: Vec::new(),
        };
        let root = merkle_root_for_manifest(&manifest).unwrap();
        manifest.merkle_root = format!("sha384-{root}");
        let signing_key = SigningKey::from_bytes(&[7_u8; 32]);
        let signature = signing_key.sign(manifest.merkle_root.as_bytes());
        manifest.signature = format!("ed25519-{}", BASE64.encode(signature.to_bytes()));
        manifest.public_key = Some(format!(
            "ed25519-{}",
            BASE64.encode(signing_key.verifying_key().to_bytes())
        ));
        manifest
    }

    #[test]
    fn validates_single_chunk_manifest_signature_and_root() {
        let bytes = b"console.log('chunk')";
        let hash = integrity_for_bytes(bytes);
        let mut chunks = BTreeMap::new();
        chunks.insert(
            "assets/index.js".to_string(),
            ManifestChunk {
                hash: hash.clone(),
                size: bytes.len() as u64,
                url: None,
                path: Vec::new(),
                content_type: Some("text/javascript".to_string()),
            },
        );
        let manifest = signed_manifest(chunks);
        let report = validate_manifest(&manifest, None).unwrap();
        assert_eq!(report.chunk_count, 1);
        assert!(report.signature_valid);
        verify_hash(bytes, &hash).unwrap();
    }

    #[test]
    fn rejects_tampered_merkle_root() {
        let mut chunks = BTreeMap::new();
        chunks.insert(
            "a.js".to_string(),
            ManifestChunk {
                hash: integrity_for_bytes(b"a"),
                size: 1,
                url: None,
                path: Vec::new(),
                content_type: None,
            },
        );
        let mut manifest = signed_manifest(chunks);
        manifest.merkle_root = format!("sha384-{}", "00".repeat(48));
        assert!(validate_manifest(&manifest, None).is_err());
    }
}
