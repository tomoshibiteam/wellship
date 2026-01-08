type Header = { key: string; label: string };

// シンプルな CSV 生成ヘルパー。引数 data は配列で、headers の順に値を取り出す。
export function toCsv(data: Record<string, unknown>[], headers: Header[]): string {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map((h) => escape(h.label)).join(","),
    ...data.map((row) => headers.map((h) => escape(row[h.key])).join(",")),
  ];
  return lines.join("\n");
}
