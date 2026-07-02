// Google Sheets API through the Lovable connector gateway.
// Server-only: never import from client code.

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function authHeaders(): HeadersInit {
  const lov = process.env.LOVABLE_API_KEY;
  const gs = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lov) throw new Error("Missing LOVABLE_API_KEY");
  if (!gs) throw new Error("Missing GOOGLE_SHEETS_API_KEY (Google Sheets connector not linked)");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": gs,
    "Content-Type": "application/json",
  };
}

export function extractSpreadsheetId(urlOrId: string): string {
  const m = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // If it looks like a raw ID, return as-is.
  if (/^[a-zA-Z0-9_-]{20,}$/.test(urlOrId.trim())) return urlOrId.trim();
  throw new Error(`Cannot extract spreadsheet ID from: ${urlOrId}`);
}

async function gfetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google Sheets ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

export async function readRange(spreadsheetId: string, range: string): Promise<string[][]> {
  // Do NOT encode the range: colons must stay literal.
  const data = await gfetch(`/spreadsheets/${spreadsheetId}/values/${range}`);
  return (data.values ?? []) as string[][];
}

export async function writeColumnValues(
  spreadsheetId: string,
  range: string,
  values: (string | null)[],
): Promise<void> {
  const body = {
    range,
    majorDimension: "ROWS",
    values: values.map((v) => [v ?? ""]),
  };
  await gfetch(`/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function colIndexToLetter(n: number): string {
  // 0 -> A, 25 -> Z, 26 -> AA
  let s = "";
  n = n + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function findHeaderIndex(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => (h ?? "").toString().trim().toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

export function quoteTab(tab: string): string {
  if (/[\s'!]/.test(tab)) return `'${tab.replace(/'/g, "''")}'`;
  return tab;
}
