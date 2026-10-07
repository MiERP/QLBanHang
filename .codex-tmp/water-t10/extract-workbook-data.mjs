import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = "D:/Agentic-AI/Doing/QLBanHang-main/QLBanHang";
const outDir = path.join(root, ".codex-tmp/water-t10/extracted");
await fs.mkdir(outDir, { recursive: true });

const files = [
  ["source", path.join(root, "excel/ĐIỀU PHỐI NƯỚC LỌC. T10.xlsx")],
  ["template", path.join(root, "excel/qaromi-nhap-T10.xlsx")],
  ["backup", path.join(root, "excel/qaromi-backup-2026-10-05.xlsx")],
];

for (const [label, file] of files) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(file));
  const result = {};
  for (const sheet of workbook.worksheets.items) {
    const used = sheet.getUsedRange();
    if (!used?.address) continue;
    result[sheet.name] = {
      address: used.address,
      values: used.values,
      formulas: used.formulas,
    };
  }
  await fs.writeFile(path.join(outDir, `${label}.json`), JSON.stringify(result, null, 2), "utf8");
  console.log(`${label}: ${Object.keys(result).length} sheets`);
}
