import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Publishes runtime artifacts to GitHub Releases with the non-negotiable
 * ordering: parts first (on an immutable runtime-v<version> release), then the
 * per-platform manifests + .sig twins LAST (on the app release, so
 * releases/latest/download/<manifest> always resolves). A partial failure
 * deletes the draft runtime release so no manifest can ever point at missing
 * parts. Signing gate: a manifest without its .sig twin refuses to publish
 * unless --allow-unsigned is passed explicitly.
 *
 * Usage:
 *   node scripts/publish-runtime-artifacts.mjs --app-tag vX.Y.Z --artifacts-dir <dir> [--dry-run] [--allow-unsigned]
 */

const MANIFEST_NAME_PATTERN = /^mini-backend-latest-[a-z0-9]+-[a-z0-9]+\.json$/;

export const buildRuntimePublishPlan = ({
  artifactsDir,
  allowUnsigned = false,
}) => {
  const entries = fs.readdirSync(artifactsDir);
  const manifestFiles = entries.filter(
    (name) => MANIFEST_NAME_PATTERN.test(name) && fs.statSync(path.join(artifactsDir, name)).isFile(),
  );
  if (manifestFiles.length === 0) {
    throw new Error(`No per-platform manifests (${MANIFEST_NAME_PATTERN}) found in ${artifactsDir}`);
  }

  const partFiles = new Set();
  const unsignedManifests = [];
  const manifestUploads = [];
  const manifestVersions = new Set();

  for (const manifestFile of manifestFiles) {
    const manifestPath = path.join(artifactsDir, manifestFile);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.schemaVersion !== 2) {
      throw new Error(`${manifestFile}: expected schemaVersion 2, found ${manifest.schemaVersion}`);
    }
    manifestVersions.add(String(manifest.version));
    for (const profile of Object.values(manifest.profiles ?? {})) {
      for (const part of profile.parts ?? []) {
        if (/[\\/]/.test(part.file)) {
          throw new Error(`${manifestFile}: part asset name is not flat: ${part.file}`);
        }
        const partPath = path.join(artifactsDir, part.file);
        if (!fs.existsSync(partPath)) {
          throw new Error(`${manifestFile}: part file missing on disk: ${part.file}`);
        }
        const actualSize = fs.statSync(partPath).size;
        if (actualSize !== part.size) {
          throw new Error(
            `${manifestFile}: part size mismatch for ${part.file} (manifest ${part.size}, disk ${actualSize})`,
          );
        }
        partFiles.add(part.file);
      }
    }
    const signaturePath = `${manifestPath}.sig`;
    if (!fs.existsSync(signaturePath)) {
      unsignedManifests.push(manifestFile);
      continue;
    }
    manifestUploads.push({ file: manifestFile, signatureFile: `${manifestFile}.sig` });
  }

  if (manifestVersions.size !== 1) {
    throw new Error(
      `All platform manifests must carry the same version, found: ${[...manifestVersions].join(", ")}`,
    );
  }
  if (unsignedManifests.length > 0 && !allowUnsigned) {
    throw new Error(
      `Unsigned manifests refuse to publish without --allow-unsigned: ${unsignedManifests.join(", ")}`,
    );
  }
  if (manifestUploads.length === 0 && allowUnsigned) {
    for (const manifestFile of manifestFiles) {
      manifestUploads.push({ file: manifestFile, signatureFile: null });
    }
  }

  return {
    runtimeTag: `runtime-v${[...manifestVersions][0]}`,
    // Ordered by the choreography: parts first, manifests last.
    partUploads: [...partFiles].sort().map((file) => ({ file })),
    manifestUploads,
    unsignedManifests,
  };
};

const runGh = (args, { capture = false } = {}) =>
  execSync(`gh ${args}`, {
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    shell: true,
  });

const parseArgs = (argv) => {
  const options = { appTag: null, artifactsDir: null, dryRun: false, allowUnsigned: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--app-tag") {
      options.appTag = argv[++index];
    } else if (arg === "--artifacts-dir") {
      options.artifactsDir = argv[++index];
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--allow-unsigned") {
      options.allowUnsigned = true;
    }
  }
  if (!options.appTag || !options.artifactsDir) {
    throw new Error(
      "Usage: node scripts/publish-runtime-artifacts.mjs --app-tag vX.Y.Z --artifacts-dir <dir> [--dry-run] [--allow-unsigned]",
    );
  }
  return options;
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const artifactsDir = path.resolve(options.artifactsDir);
  const plan = buildRuntimePublishPlan({ artifactsDir, allowUnsigned: options.allowUnsigned });

  if (plan.unsignedManifests.length > 0) {
    console.warn(
      `[publish-runtime] WARNING: publishing UNSIGNED manifests: ${plan.unsignedManifests.join(", ")}`,
    );
  }

  console.log(`[publish-runtime] runtime release: ${plan.runtimeTag}`);
  for (const part of plan.partUploads) {
    console.log(`[publish-runtime]   part: ${part.file}`);
  }
  for (const manifest of plan.manifestUploads) {
    console.log(
      `[publish-runtime]   manifest last: ${manifest.file}${manifest.signatureFile ? ` + ${manifest.signatureFile}` : ""}`,
    );
  }
  console.log(`[publish-runtime] app release: ${options.appTag} (manifests attach here, last)`);

  if (options.dryRun) {
    console.log("[publish-runtime] dry-run: no network actions performed");
    return;
  }

  const releaseExists = (() => {
    try {
      runGh(`release view ${plan.runtimeTag}`, { capture: true });
      return true;
    } catch {
      return false;
    }
  })();
  if (releaseExists) {
    throw new Error(
      `${plan.runtimeTag} already exists; runtime releases are immutable (publish a new version instead)`,
    );
  }

  try {
    runGh(
      `release create ${plan.runtimeTag} --draft --title "Runtime ${plan.runtimeTag}" --notes "Mini-backend runtime parts for ${plan.runtimeTag} (auto-generated)"`,
    );
    for (const part of plan.partUploads) {
      runGh(`release upload ${plan.runtimeTag} "${path.join(artifactsDir, part.file)}"`);
    }
    const assets = JSON.parse(
      runGh(`release view ${plan.runtimeTag} --json assets --jq .assets`, { capture: true }),
    );
    const assetNames = new Set(assets.map((asset) => asset.name));
    const assetSizes = new Map(assets.map((asset) => [asset.name, asset.size]));
    for (const part of plan.partUploads) {
      if (!assetNames.has(part.file)) {
        throw new Error(`uploaded release is missing part asset: ${part.file}`);
      }
      const expectedSize = fs.statSync(path.join(artifactsDir, part.file)).size;
      if (assetSizes.get(part.file) !== expectedSize) {
        throw new Error(`uploaded part asset size mismatch: ${part.file}`);
      }
    }
    runGh(`release edit ${plan.runtimeTag} --draft=false`);

    // Manifests land on the app release LAST, after every part is live.
    for (const manifest of plan.manifestUploads) {
      const files = [path.join(artifactsDir, manifest.file)];
      if (manifest.signatureFile) {
        files.push(path.join(artifactsDir, manifest.signatureFile));
      }
      runGh(`release upload ${options.appTag} ${files.map((file) => `"${file}"`).join(" ")}`);
    }
  } catch (error) {
    // Partial uploads must not survive: delete the draft so no published
    // manifest can ever point at missing parts.
    try {
      runGh(`release delete ${plan.runtimeTag} --yes --cleanup-tag`);
      console.warn(`[publish-runtime] rolled back draft release ${plan.runtimeTag}`);
    } catch {
      console.warn(
        `[publish-runtime] rollback failed; delete ${plan.runtimeTag} manually before retrying`,
      );
    }
    throw error;
  }

  console.log(`[publish-runtime] published ${plan.runtimeTag} + manifests on ${options.appTag}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
