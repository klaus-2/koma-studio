"""Partition a runtime dist directory into per-part zips under a byte budget.

Each part is an independent, valid zip whose entries always use forward-slash
separators, so every extractor (Rust zip crate, bsdtar, fflate) reads them
identically on every platform. A part is closed before writing the next file
whenever the current part size plus the file's raw size would exceed the
budget; deflate never grows a file beyond its raw size by a meaningful margin,
so raw size is a safe upper bound for the compressed contribution.

Writes a partition plan JSON next to the parts describing every part and its
entries. Exits with code 2 when a single file alone exceeds the budget (such a
part could never be uploaded under the 2 GiB release-asset limit).
"""

import argparse
import json
import os
import sys
import zipfile

PART_BUDGET_MIN_BYTES = 1024 * 1024
# Per-entry zip overhead (local header + data descriptor + central directory)
# so a part closed under the raw-size predictor still lands under the budget.
ENTRY_OVERHEAD_BYTES = 4096


def collect_files(source_dir: str) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    for root, dirs, files in os.walk(source_dir):
        dirs.sort()
        for name in sorted(files):
            full_path = os.path.join(root, name)
            relative = os.path.relpath(full_path, source_dir).replace(os.sep, "/")
            entries.append((relative, full_path))
    return entries


def build_parts(source_dir: str, output_base: str, budget_bytes: int) -> list[dict]:
    files = collect_files(source_dir)
    if not files:
        raise RuntimeError(f"no files found under {source_dir}")

    parts: list[dict] = []
    current_path: str | None = None
    current_zip = None
    current_entries: list[str] = []

    def close_current() -> None:
        nonlocal current_path, current_zip, current_entries
        if current_zip is None:
            return
        current_zip.close()
        parts.append(
            {
                "path": current_path,
                "entries": list(current_entries),
                "sizeBytes": os.path.getsize(current_path),
            }
        )
        current_path = None
        current_zip = None
        current_entries = []

    for relative, full_path in files:
        raw_size = os.path.getsize(full_path)
        if (
            current_zip is not None
            and os.path.getsize(current_path) + raw_size + ENTRY_OVERHEAD_BYTES > budget_bytes
        ):
            close_current()
        if current_zip is None:
            current_path = f"{output_base}.part-{len(parts) + 1}-of-pending.zip"
            current_zip = zipfile.ZipFile(current_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9)
            current_entries = []
        current_zip.write(full_path, relative)
        current_entries.append(relative)
    close_current()

    total = len(parts)
    finalized: list[dict] = []
    for index, part in enumerate(parts, start=1):
        final_path = f"{output_base}.part-{index}-of-{total}.zip"
        os.replace(part["path"], final_path)
        finalized.append(
            {
                "file": os.path.basename(final_path),
                "sizeBytes": os.path.getsize(final_path),
                "entries": part["entries"],
            }
        )
    return finalized


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--output-base", required=True)
    parser.add_argument("--budget-bytes", type=int, required=True)
    args = parser.parse_args()

    if args.budget_bytes < PART_BUDGET_MIN_BYTES:
        print(
            json.dumps(
                {
                    "error": "budget too small",
                    "budgetBytes": args.budget_bytes,
                    "minimumBytes": PART_BUDGET_MIN_BYTES,
                }
            ),
            file=sys.stderr,
        )
        return 1

    try:
        parts = build_parts(args.source_dir, args.output_base, args.budget_bytes)
    except RuntimeError as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1

    oversized = next((part for part in parts if part["sizeBytes"] > args.budget_bytes), None)
    if oversized is not None:
        for index in range(1, len(parts) + 1):
            candidate = f"{args.output_base}.part-{index}-of-{len(parts)}.zip"
            if os.path.exists(candidate):
                os.remove(candidate)
        print(
            json.dumps(
                {
                    "error": "single file exceeds part budget",
                    "part": oversized["file"],
                    "sizeBytes": oversized["sizeBytes"],
                    "budgetBytes": args.budget_bytes,
                }
            ),
            file=sys.stderr,
        )
        return 2

    plan_path = f"{args.output_base}.partition-plan.json"
    with open(plan_path, "w", encoding="utf-8") as plan_file:
        json.dump(
            {
                "sourceDir": args.source_dir,
                "budgetBytes": args.budget_bytes,
                "parts": parts,
            },
            plan_file,
            indent=2,
        )
        plan_file.write("\n")

    total_bytes = sum(part["sizeBytes"] for part in parts)
    print(
        json.dumps(
            {
                "parts": len(parts),
                "entries": sum(len(part["entries"]) for part in parts),
                "totalBytes": total_bytes,
                "plan": os.path.basename(plan_path),
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
