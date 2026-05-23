/**
 * Minimal, dependency-free RFC-4180-style CSV parser.
 *
 * Handles quoted fields, escaped quotes (""), and commas/newlines inside
 * quotes. Returns the header row plus an array of objects keyed by header.
 * Kept dependency-free deliberately so the ARM/Raspberry build stays small and
 * the parsing behavior is fully under our control (and unit-testable).
 */

export interface ParsedCsv {
  headers: string[];
  records: Record<string, string>[];
}

export function parseCsv(input: string): ParsedCsv {
  const rows = parseRows(input);
  if (rows.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = rows[0].map((h, idx) => {
    const normalized = idx === 0 ? h.replace(/^\uFEFF/, '') : h;
    return normalized.trim();
  });
  const seen = new Set<string>();
  for (const h of headers) {
    if (h === '') {
      throw new Error('CSV header contains an empty column name');
    }
    if (seen.has(h)) {
      throw new Error(`CSV header contains a duplicate column name: "${h}"`);
    }
    seen.add(h);
  }

  const records: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    // Skip fully empty trailing lines.
    if (cells.length === 1 && cells[0] === '') {
      continue;
    }
    if (cells.length !== headers.length) {
      throw new Error(
        `CSV row ${i + 1} has ${cells.length} fields, expected ${headers.length}`
      );
    }
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = cells[idx] ?? '';
    });
    records.push(record);
  }

  return { headers, records };
}

/** Splits raw CSV text into rows of string cells, respecting quotes. */
function parseRows(input: string): string[][] {
  const delimiter = detectDelimiter(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  // Normalize line endings handling inside the loop (CRLF / LF / CR).
  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (char === '\n' || char === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      // Consume the \n of a \r\n pair.
      if (char === '\r' && input[i + 1] === '\n') {
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    field += char;
    i++;
  }

  // Flush the final field/row if the file did not end with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function detectDelimiter(input: string): string {
  const sample = input.slice(0, 2048);
  const candidates = [',', ';', '\t'];
  const counts = new Map<string, number>(candidates.map((c) => [c, 0]));
  let inQuotes = false;

  for (let i = 0; i < sample.length; i++) {
    const char = sample[i];
    if (char === '"') {
      if (inQuotes && sample[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && counts.has(char)) {
      counts.set(char, (counts.get(char) || 0) + 1);
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      break;
    }
  }

  let best = ',';
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = counts.get(candidate) || 0;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}
