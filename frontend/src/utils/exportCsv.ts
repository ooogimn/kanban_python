function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>): void {
  const content = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  // BOM helps Excel correctly detect UTF-8 with Cyrillic text.
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
