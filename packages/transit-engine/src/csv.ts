// Minimal RFC 4180 line parser. GTFS files do not use line breaks inside fields.
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}

export type GtfsRow = Record<string, string>;

// Turns raw lines (header first) into rows keyed by column name.
export async function* csvRows(lines: AsyncIterable<string> | Iterable<string>): AsyncGenerator<GtfsRow> {
  let header: string[] | null = null;
  for await (const raw of lines) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!line) continue;
    const cells = parseCsvLine(header ? line : line.replace(/^\uFEFF/, ''));
    if (!header) { header = cells; continue; }
    const row: GtfsRow = {};
    for (let i = 0; i < header.length; i++) row[header[i]!] = cells[i] ?? '';
    yield row;
  }
}
