import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = "D:/Agentic-AI/Doing/QLBanHang-main/QLBanHang";
const previewDir = path.join(root, ".codex-tmp/water-t10/previews-before");
await fs.mkdir(previewDir, { recursive: true });

const files = [
  ["source", path.join(root, "excel/ĐIỀU PHỐI NƯỚC LỌC. T10.xlsx")],
  ["template", path.join(root, "excel/qaromi-nhap-T10.xlsx")],
];

for (const [label, file] of files) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(file));
  const summary = await workbook.inspect({
    kind: "workbook,sheet,table,definedName,drawing",
    maxChars: 20000,
    tableMaxRows: 8,
    tableMaxCols: 16,
    tableMaxCellChars: 120,
  });
  await fs.writeFile(path.join(previewDir, `${label}-summary.ndjson`), summary.ndjson, "utf8");

  const sheets = workbook.worksheets.items;
  const sheetInfo = [];
  for (const sheet of sheets) {
    const used = sheet.getUsedRange();
    const address = used?.address ?? null;
    sheetInfo.push({ name: sheet.name, usedRange: address });

    if (address) {
      const region = await workbook.inspect({
        kind: "region",
        sheetId: sheet.name,
        range: address,
        include: "values,formulas",
        maxChars: 60000,
        tableMaxRows: 80,
        tableMaxCols: 30,
        tableMaxCellChars: 180,
      });
      await fs.writeFile(
        path.join(previewDir, `${label}-${sheet.name.replace(/[\\/:*?\"<>|]/g, "_")}-region.ndjson`),
        region.ndjson,
        "utf8",
      );

      const image = await workbook.render({
        sheetName: sheet.name,
        autoCrop: "all",
        scale: 1,
        format: "png",
      });
      await fs.writeFile(
        path.join(previewDir, `${label}-${sheet.name.replace(/[\\/:*?\"<>|]/g, "_")}.png`),
        new Uint8Array(await image.arrayBuffer()),
      );
    }
  }
  await fs.writeFile(path.join(previewDir, `${label}-sheets.json`), JSON.stringify(sheetInfo, null, 2), "utf8");
  console.log(JSON.stringify({ label, file, sheets: sheetInfo }));
}
