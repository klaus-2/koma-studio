import { writeFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const gzipSize = (buffer) => zlib.gzipSync(buffer, { level: 9 }).length;
const brotliSize = (buffer) => zlib.brotliCompressSync(buffer).length;

const packageOf = (id) => {
  const normalized = id.replaceAll("\\", "/");
  const nodeModules = normalized.lastIndexOf("/node_modules/");
  if (nodeModules !== -1) {
    const rest = normalized.slice(nodeModules + "/node_modules/".length);
    const parts = rest.split("/");
    return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
  }
  const workspace = normalized.match(/\/packages\/([^/]+)\//);
  if (workspace) return `workspace:@koma/${workspace[1]}`;
  const app = normalized.match(/\/apps\/([^/]+)\//);
  if (app) return `app:${app[1]}`;
  return "(app source)";
};

export function bundleReport({ outputFile = "perf-bundle-report.json" } = {}) {
  return {
    name: "koma-bundle-report",
    apply: "build",
    generateBundle(_options, bundle) {
      const assets = [];
      const chunks = [];
      const packages = new Map();

      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === "asset") {
          const buffer = Buffer.isBuffer(item.source)
            ? item.source
            : Buffer.from(String(item.source));
          assets.push({
            fileName,
            size: buffer.length,
            gzip: gzipSize(buffer),
            brotli: brotliSize(buffer),
          });
          continue;
        }

        const code = Buffer.from(item.code);
        const modules = Object.entries(item.modules ?? {})
          .map(([id, info]) => ({
            id: id.replaceAll("\\", "/"),
            package: packageOf(id),
            rendered: info.renderedLength,
            original: info.originalLength,
          }))
          .sort((a, b) => b.rendered - a.rendered);

        for (const module of modules) {
          packages.set(
            module.package,
            (packages.get(module.package) ?? 0) + module.rendered,
          );
        }

        chunks.push({
          fileName,
          kind: "chunk",
          isEntry: item.isEntry,
          isDynamicEntry: item.isDynamicEntry,
          size: code.length,
          gzip: gzipSize(code),
          brotli: brotliSize(code),
          imports: item.imports,
          dynamicImports: item.dynamicImports,
          modules,
        });
      }

      const report = {
        generatedAt: new Date().toISOString(),
        chunks,
        assets,
        packages: [...packages.entries()]
          .map(([name, rendered]) => ({ name, rendered }))
          .sort((a, b) => b.rendered - a.rendered),
      };

      writeFileSync(path.resolve(outputFile), JSON.stringify(report, null, 2));
      this.info(`bundle report written to ${outputFile}`);
    },
  };
}
