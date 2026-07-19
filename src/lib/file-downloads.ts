export function safeArchiveSegment(value: string | number | null | undefined) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/[^A-Za-z0-9_. -]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return cleaned || "file";
}

export function downloadBytes({
  bytes,
  fileName,
  mimeType,
}: {
  // `Uint8Array<ArrayBuffer>` e non `Uint8Array`: quest'ultimo ammette
  // `SharedArrayBuffer`, che non è un `BlobPart` valido.
  bytes: Uint8Array<ArrayBuffer>;
  fileName: string;
  mimeType: string;
}) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
