import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  parseFontRegistryExport,
  parseFontRegistryExportBytes,
  readWindowsFontFamilies,
} from "../font-registry.ts";

const STRIPPED_STYLE_TOKENS = ["bold italic", "italic bold", "bold", "italic", "regular"];

const fixtureText = fs.readFileSync(
  new URL("./fixtures/font-registry-export-sample.txt", import.meta.url),
  "utf8",
);

const parsedFamilies = parseFontRegistryExport(fixtureText);

const EXPECTED_FAMILIES: string[] = [
  "Arial",
  "Arial Black",
  "Bahnschrift",
  "Calibri",
  "Calibri Light",
  "Cambria",
  "Cambria Math",
  "Candara",
  "Candara Light",
  "Comic Sans MS",
  "Consolas",
  "Constantia",
  "Corbel",
  "Corbel Light",
  "Courier New",
  "Ebrima",
  "Franklin Gothic Medium",
  "Gabriola",
  "Gadugi",
  "Georgia",
  "Impact",
  "Ink Free",
  "Javanese Text",
  "Leelawadee UI",
  "Leelawadee UI Semilight",
  "Lucida Console",
  "Lucida Sans Unicode",
  "Malgun Gothic",
  "Malgun Gothic SemiLight",
  "Microsoft Himalaya",
  "Microsoft JhengHei",
  "Microsoft JhengHei UI",
  "Microsoft JhengHei Light",
  "Microsoft JhengHei UI Light",
  "Microsoft New Tai Lue",
  "Microsoft PhagsPa",
  "Microsoft Sans Serif",
  "Microsoft Tai Le",
  "Microsoft YaHei",
  "Microsoft YaHei UI",
  "Microsoft YaHei Light",
  "Microsoft YaHei UI Light",
  "Microsoft Yi Baiti",
  "MingLiU-ExtB",
  "PMingLiU-ExtB",
  "MingLiU_HKSCS-ExtB",
  "Modern",
  "Mongolian Baiti",
  "MS Gothic",
  "MS UI Gothic",
  "MS PGothic",
  "MV Boli",
  "Myanmar Text",
  "Nirmala UI",
  "Nirmala UI Semilight",
  "Nirmala Text",
  "Nirmala Text Semilight",
  "Palatino Linotype",
  "Roman",
  "Sans Serif Collection",
  "Script",
  "Segoe Fluent Icons",
  "Segoe MDL2 Assets",
  "Segoe Print",
  "Segoe Script",
  "Segoe UI",
  "Segoe UI Black",
  "Segoe UI Emoji",
  "Segoe UI Historic",
  "Segoe UI Light",
  "Segoe UI Semibold",
  "Segoe UI Semilight",
  "Segoe UI Symbol",
  "Segoe UI Variable",
  "SimSun",
  "NSimSun",
  "SimSun-ExtB",
  "Sitka Text",
  "Sylfaen",
  "Symbol",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "Webdings",
  "Wingdings",
  "Yu Gothic",
  "Yu Gothic UI Semibold",
  "Yu Gothic UI",
  "Yu Gothic Light",
  "Yu Gothic UI Light",
  "Yu Gothic Medium",
  "Yu Gothic UI Semilight",
  "Courier 10,12,15",
  "MS Serif 8,10,12,14,18,24",
  "MS Sans Serif 8,10,12,14,18,24",
  "Small Fonts",
  "SimSun-ExtG",
  "Visitor TT2 BRK",
  "Visitor -BRK- 7",
  "Visitor TT1 BRK",
  "Cascadia Code",
  "Cascadia Mono",
  "Ubuntu Mono",
  "Épée Nova",
  "Cirrus",
  "Cumulus Light",
];

console.log("font-registry fixture family list size: " + String(EXPECTED_FAMILIES.length));

const countOf = (families: string[], family: string): number =>
  families.filter((candidate) => candidate === family).length;

test("parseFontRegistryExport produces exactly the family list of the committed fixture", () => {
  assert.deepStrictEqual(parsedFamilies, EXPECTED_FAMILIES);
});

test("style instances collapse into their family", () => {
  assert.equal(countOf(parsedFamilies, "Arial"), 1);
  assert.ok(!parsedFamilies.includes("Arial Bold"));
  assert.ok(!parsedFamilies.includes("Arial Italic"));
  assert.ok(!parsedFamilies.includes("Calibri Bold Italic"));
});

test("families whose name ends in a real weight word survive the collapse", () => {
  for (const family of [
    "Arial Black",
    "Calibri Light",
    "Candara Light",
    "Segoe UI Semibold",
    "Yu Gothic UI Light",
  ]) {
    assert.ok(parsedFamilies.includes(family), "missing family: " + family);
  }
});

test("group names joined by an ampersand split into their individual families", () => {
  for (const family of ["Cambria", "Cambria Math", "Microsoft YaHei", "Microsoft YaHei UI"]) {
    assert.ok(parsedFamilies.includes(family), "missing family: " + family);
  }
});

test("per-user installs from the HKCU hive are listed", () => {
  assert.ok(parsedFamilies.includes("Ubuntu Mono"));
});

test("non-ASCII family names are preserved byte-exact", () => {
  const expected = "Épée Nova";
  assert.ok(parsedFamilies.includes(expected));
  assert.equal(parsedFamilies.filter((family) => family === "Épée Nova").length, 1);
});

test("fixture-synthesized split families are listed", () => {
  assert.ok(parsedFamilies.includes("Cirrus"));
  assert.ok(parsedFamilies.includes("Cumulus Light"));
});

test("no listed family keeps a group marker or a stripped style suffix", () => {
  assert.ok(!parsedFamilies.some((family) => family.includes("&")));
  assert.ok(
    !parsedFamilies.some((family) =>
      STRIPPED_STYLE_TOKENS.some((token) => family.toLowerCase().endsWith(" " + token)),
    ),
  );
});

test("nested package subkeys are never read", () => {
  for (const junk of [
    "CascadiaCode.ttf",
    "CascadiaCodeItalic.ttf",
    "CascadiaMono.ttf",
    "CascadiaMonoItalic.ttf",
  ]) {
    assert.ok(!parsedFamilies.includes(junk), "nested subkey value leaked: " + junk);
  }
  assert.ok(!parsedFamilies.some((family) => family.toLowerCase().endsWith(".ttf")));
});

test("a duplicate style instance collapses onto the family it already belongs to", () => {
  assert.equal(countOf(parsedFamilies, "Arial"), 1);
  assert.deepStrictEqual(parsedFamilies, EXPECTED_FAMILIES);
});

test("malformed, unterminated, BOM-less and empty exports parse to an empty list", () => {
  assert.deepEqual(parseFontRegistryExport(""), []);
  assert.deepEqual(parseFontRegistryExport("   " + String.fromCharCode(10)), []);
  assert.deepEqual(
    parseFontRegistryExport('"W3C Invalid Line Without Equals' + String.fromCharCode(10)),
    [],
  );
  assert.deepEqual(
    parseFontRegistryExport(
      "[HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" +
        String.fromCharCode(10) +
        '"Aeon Nova (TrueType)"="aeon.ttf"',
    ),
    [],
  );
  assert.deepEqual(
    parseFontRegistryExport(
      "[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts\\Sub]" +
        String.fromCharCode(10) +
        '"Aeon Nova (TrueType)"="aeon.ttf"',
    ),
    [],
  );
});

test("a BOM-prefixed export parses identically to the same text without the BOM", () => {
  const withoutBom =
    "[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts]" +
    String.fromCharCode(10) +
    '"Aeon Nova (TrueType)"="aeon.ttf"';
  const withBom = String.fromCharCode(65279) + withoutBom;
  assert.deepEqual(parseFontRegistryExport(withBom), parseFontRegistryExport(withoutBom));
  assert.deepEqual(parseFontRegistryExport(withBom), ["Aeon Nova"]);
});

test("section key matching is case-insensitive but never a substring match", () => {
  const lowerCaseExport =
    "[hkey_local_machine\\software\\microsoft\\windows nt\\currentversion\\fonts]" +
    String.fromCharCode(10) +
    '"Aeon Nova (TrueType)"="aeon.ttf"';
  assert.deepEqual(parseFontRegistryExport(lowerCaseExport), ["Aeon Nova"]);

  const lookalikeKeyExport =
    "[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\FontsExtra]" +
    String.fromCharCode(10) +
    '"Aeon Nova (TrueType)"="aeon.ttf"';
  assert.deepEqual(parseFontRegistryExport(lookalikeKeyExport), []);
});

test("a 2,000-entry UTF-16LE export parses completely and stays under the time budget", () => {
  const sectionHeader =
    "[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts]";
  const valueLines: string[] = [];
  for (let index = 0; index < 2_000; index += 1) {
    valueLines.push('"Koma Test Font ' + String(index) + ' (TrueType)"="koma' + String(index) + '.ttf"');
  }
  const exportText = sectionHeader + String.fromCharCode(10) + valueLines.join(String.fromCharCode(10));
  const bom = Buffer.from([255, 254]);
  const utf16Export = Buffer.concat([bom, Buffer.from(exportText, "utf16le")]);

  const startedAt = performance.now();
  const decoded = new TextDecoder("utf-16le").decode(utf16Export);
  const families = parseFontRegistryExport(decoded);
  const elapsedMs = performance.now() - startedAt;

  assert.equal(families.length, 2_000);
  assert.equal(families[0], "Koma Test Font 0");
  assert.equal(families[1_999], "Koma Test Font 1999");
  assert.ok(elapsedMs < 250, "parse took " + String(Math.round(elapsedMs)) + " ms");
});

const FONT_REGISTRY_SECTION =
  "[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts]";

const exportOfValueNames = (valueNames: string[]): string =>
  FONT_REGISTRY_SECTION +
  String.fromCharCode(10) +
  valueNames.map((name) => '"' + name + '"="koma.ttf"').join(String.fromCharCode(10));

const valueNameOfLength = (length: number): string => "Koma Long Family ".padEnd(length, "x");

const MAX_EXPORT_BYTES = 4 * 1024 * 1024;

const utf16ExportOf = (valueNames: string[]): Buffer =>
  Buffer.concat([Buffer.from([255, 254]), Buffer.from(exportOfValueNames(valueNames), "utf16le")]);

// The removed regex cost 2,089 ms on this exact name and 14,536 ms at 20 pairs; the budget is what
// keeps a backtracking rewrite from coming back.
test("a value name of repeated style tokens plus one unmatchable byte parses inside the time budget", () => {
  const poisonName = "Poison Font" + " Bold Italic".repeat(18) + "!";
  assert.equal(poisonName.length, 228);

  const startedAt = performance.now();
  const families = parseFontRegistryExport(exportOfValueNames([poisonName]));
  const elapsedMs = performance.now() - startedAt;

  assert.ok(
    elapsedMs < 100,
    "parse took " +
      String(Math.round(elapsedMs)) +
      " ms for a " +
      String(poisonName.length) +
      "-character value name",
  );
  assert.equal(families.length, 1);
});

test("value names at the length bound are kept and names past it are dropped whole", () => {
  const atBound = valueNameOfLength(512);
  const pastBound = valueNameOfLength(513);
  assert.equal(atBound.length, 512);
  assert.equal(pastBound.length, 513);

  assert.deepEqual(parseFontRegistryExport(exportOfValueNames([atBound])), [atBound]);
  assert.deepEqual(parseFontRegistryExport(exportOfValueNames([pastBound])), []);
  assert.deepEqual(parseFontRegistryExport(exportOfValueNames([atBound, pastBound])), [atBound]);
});

test("an export over the read ceiling is rejected before it is decoded", () => {
  const valueNames: string[] = [];
  let oversized = utf16ExportOf(valueNames);
  while (oversized.byteLength <= MAX_EXPORT_BYTES) {
    for (let index = 0; index < 4_000; index += 1) {
      valueNames.push("Koma Bulk Font " + String(valueNames.length));
    }
    oversized = utf16ExportOf(valueNames);
  }
  assert.ok(oversized.byteLength > MAX_EXPORT_BYTES, "fixture bytes: " + String(oversized.byteLength));

  assert.deepEqual(parseFontRegistryExportBytes(oversized), []);
  assert.ok(parseFontRegistryExport(new TextDecoder("utf-16le").decode(oversized)).length > 1_000);
  assert.deepEqual(parseFontRegistryExportBytes(utf16ExportOf(["Aeon Nova (TrueType)"])), [
    "Aeon Nova",
  ]);
});

test("readWindowsFontFamilies degrades to an empty list when reg.exe cannot export", async () => {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-font-registry-"));
  const missingTempDir = path.join(scratchDir, "absent-subdirectory");

  const families = await readWindowsFontFamilies({ tempDir: missingTempDir });

  assert.deepEqual(families, []);
  assert.deepEqual(fs.readdirSync(scratchDir), []);
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

test("readWindowsFontFamilies leaves no .reg file behind", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-font-registry-clean-"));

  const families = await readWindowsFontFamilies({ tempDir });

  const leftovers = fs.readdirSync(tempDir).filter((entry) => entry.endsWith(".reg"));
  assert.deepEqual(leftovers, []);
  assert.deepEqual(fs.readdirSync(tempDir), []);
  assert.ok(Array.isArray(families));
  fs.rmSync(tempDir, { recursive: true, force: true });
});
