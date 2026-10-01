import { validateOfficeArchive } from "./input-safety";
// Parsing/writing code is loaded only when used, not on every dashboard visit.
export async function readXlsxFile(file: File) {
  if (!/\.xlsx$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024)
    throw new Error("Choose an XLSX file up to 5 MB.");
  const names = await validateOfficeArchive(
    new Uint8Array(await file.arrayBuffer()),
  );
  if (!names.has("xl/workbook.xml")) throw new Error("Not an Excel workbook.");
  const { readSheet } = await import("read-excel-file/browser");
  const rows = await readSheet(file);
  if (
    rows.length > 5001 ||
    rows.some(
      (row) =>
        row.length > 60 ||
        row.some((cell) => typeof cell === "string" && cell.length > 50000),
    )
  )
    throw new Error(
      "Excel import limit: 5,000 rows, 60 columns, 50,000 characters per cell.",
    );
  return rows;
}
export async function writeXlsxFile(
  data: import("write-excel-file/browser").SheetData,
  options: { fileName: string },
) {
  const { default: write } = await import("write-excel-file/browser");
  return write(data).toFile(options.fileName);
}
