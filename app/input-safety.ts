/* eslint-disable no-control-regex -- reject control characters in untrusted input */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export function safeExternalUrl(value: string): string | null {
  if (value.length > 4096 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !!url.hostname
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function fileType(name: string): string {
  if (
    name.length > 240 ||
    /[\u0000-\u001f\u007f/\\\u202a-\u202e\u2066-\u2069]/.test(name)
  )
    throw new Error(
      "Use a filename without path separators, control characters or direction overrides (up to 240 characters).",
    );
  const ext = name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    txt: "text/plain",
    csv: "text/csv",
  };
  if (!ext || !types[ext])
    throw new Error(
      "Use PDF, DOCX, XLSX, PPTX, PNG, JPG, TXT or CSV. Active web content is not accepted.",
    );
  return types[ext];
}
/** Inspect the ZIP directory before any XML decompression. ZIP64/encrypted archives are not accepted. */
export function checkZip(bytes: Uint8Array, maxExpanded = 40 * 1024 * 1024) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("Invalid Office archive.");
  const count = view.getUint16(end + 10, true),
    length = view.getUint32(end + 12, true),
    offset = view.getUint32(end + 16, true);
  if (
    view.getUint32(end + 4, true) !== 0 ||
    count !== view.getUint16(end + 8, true) ||
    count > 3000 ||
    count === 65535 ||
    offset + length !== end
  )
    throw new Error("Unsupported or oversized Office archive.");
  let cursor = offset,
    total = 0;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error("Invalid Office directory.");
    const flags = view.getUint16(cursor + 8, true),
      size = view.getUint32(cursor + 24, true),
      n = view.getUint16(cursor + 28, true),
      extra = view.getUint16(cursor + 30, true),
      comment = view.getUint16(cursor + 32, true),
      local = view.getUint32(cursor + 42, true);
    if (
      flags & 1 ||
      size === 0xffffffff ||
      local + 30 > offset ||
      cursor + 46 + n + extra + comment > end
    )
      throw new Error("Encrypted/invalid Office archive.");
    total += size;
    if (total > maxExpanded)
      throw new Error("Office content exceeds the expanded size limit.");
    const name = new TextDecoder().decode(
      bytes.slice(cursor + 46, cursor + 46 + n),
    );
    if (names.has(name) || /(^\/|\\|(^|\/)\.\.\/|vbaProject\.bin$)/i.test(name))
      throw new Error("Unsafe or macro-enabled Office archive.");
    names.add(name);
    cursor += 46 + n + extra + comment;
  }
  if (cursor !== end || !names.has("[Content_Types].xml"))
    throw new Error("Not a supported Office document.");
  return names;
}
export async function validateDocument(file: Blob & { name: string }) {
  if (!file.size || file.size > MAX_FILE_BYTES)
    throw new Error("Choose a non-empty file up to 20 MB.");
  const type = fileType(file.name),
    head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const starts = (signature: number[]) =>
    signature.every((value, i) => head[i] === value);
  if (type === "application/pdf" && !starts([37, 80, 68, 70, 45]))
    throw new Error("PDF contents do not match the filename.");
  if (type === "image/png" && !starts([137, 80, 78, 71, 13, 10, 26, 10]))
    throw new Error("PNG contents do not match the filename.");
  if (type === "image/jpeg" && !starts([255, 216, 255]))
    throw new Error("JPEG contents do not match the filename.");
  if (/\.(docx|xlsx|pptx)$/i.test(file.name)) {
    const names = checkZip(
      new Uint8Array(await file.arrayBuffer()),
      100 * 1024 * 1024,
    );
    const required = /\.xlsx$/i.test(file.name)
      ? "xl/workbook.xml"
      : /\.docx$/i.test(file.name)
        ? "word/document.xml"
        : "ppt/presentation.xml";
    if (!names.has(required))
      throw new Error("Office contents do not match the filename.");
  }
  return type;
}
export async function validateOfficeArchive(
  bytes: Uint8Array,
  maxExpanded = 40 * 1024 * 1024,
) {
  const expected = checkZip(bytes, maxExpanded);
  const { Unzip, UnzipInflate } = await import("fflate");
  let total = 0,
    completed = 0;
  const found = new Set<string>();
  const unzip = new Unzip((file) => {
    if (!expected.has(file.name) || found.has(file.name))
      throw new Error("Office archive directory mismatch.");
    found.add(file.name);
    file.ondata = (error, chunk, final) => {
      if (error) throw new Error("Invalid compressed Office content.");
      total += chunk.length;
      if (total > maxExpanded) {
        file.terminate();
        throw new Error("Office content exceeds the expanded size limit.");
      }
      if (final) completed++;
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  // Small compressed chunks bound each inflater step even if archive sizes lie.
  for (let offset = 0; offset < bytes.length; offset += 4096)
    unzip.push(
      bytes.subarray(offset, offset + 4096),
      offset + 4096 >= bytes.length,
    );
  if (found.size !== expected.size || completed !== expected.size)
    throw new Error("Incomplete Office archive.");
  return expected;
}
