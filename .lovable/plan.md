
# Event → CRM Matcher

Single-user web app. Google Sheets access via the Lovable Google Sheets connector (your Google account). Config, aliases, and match cache stored in Lovable Cloud (Postgres).

## Setup work
1. Enable Lovable Cloud (Postgres + auth).
2. Link the Google Sheets connector.
3. Create a single admin login (email + password). All data is shared across future logins (workspace-shared).

## Database schema
- `sheet_configs` — one row per saved configuration (event sheet URL/tab, org DB URL/tab, contacts DB URL/tab, optional row_limit, name, created_at).
- `org_aliases` — alias → canonical org name (or canonical Record Id). Editable in UI.
- `org_match_cache` — normalized input name → matched Record Id, confidence, method, created_at. Clearable in UI.
- `match_runs` — history of runs (config_id, type, counts, unmatched JSON, started_at, finished_at).

## Screens
1. **Sign in** — single email/password.
2. **Dashboard** — pick a saved config, buttons "Run Contact Matching" and "Run Organization Matching", live progress (SSE / polling), summary card + link back to the sheet, table of unmatched names for org runs.
3. **Configurations** — CRUD list of `sheet_configs`.
4. **Settings** — edit alias map, clear org match cache.

## Server functions (all TanStack `createServerFn`, connector called server-side only)
- `sheets.readRange(spreadsheetId, range)` / `sheets.writeColumn(...)` — thin Google Sheets gateway wrappers.
- `configs.list/create/update/delete`.
- `aliases.list/upsert/delete`.
- `cache.clear`.
- `runContactMatching(configId)` — reads contacts DB, builds indexes (email, normalized phone, first+last name), reads event rows, matches in priority order email → phone → name, writes `Contact ID` column back, returns `{processed, matched, unmatched}`.
- `runOrgMatching(configId)` — pipeline below, writes `Organization ID` column, returns summary + unmatched list.
- `matchRuns.list/get` for progress polling.

## Org matching pipeline (in order, stops at first accepted match)
1. Exact match on canonical name.
2. Alias map lookup (`org_aliases`).
3. Cache lookup (`org_match_cache`).
4. Normalized exact match (lowercased, punctuation stripped, Armenian/Latin transliteration folded).
5. Fuzzy / token-overlap scoring — top 20–30 candidates by score.
6. AI fallback — Lovable AI Gateway, `google/gemini-3-flash-preview`, prompt with input + top candidates, must return one Record Id or `NOT FOUND`.

**Validators applied to steps 5–6 before accepting**:
- If input contains a city (Armenian or Latin transliteration table), candidate must contain the same city.
- If input contains a school number (`N 123`, `#123`, `թիվ 123`), candidate must have the same number.
- School inputs never match business-category candidates (heuristic: presence of `դպրոց` / "school" vs `ՍՊԸ` / "LLC" / "Ltd").

Accepted fuzzy/AI matches are written to `org_match_cache` for future runs.

## Phone normalization
Strip whitespace, `+`, `-`, `()`. Drop leading `374`. Drop leading `0`. Compare last 8 digits.

## Technical notes (for reference)
- Google Sheets via `standard_connectors--call_gateway_connection` (`google_sheets`, `/v4/...`). Batch reads with `values:batchGet`, batch writes with `values:batchUpdate`. Never encode the range param.
- AI Gateway via `@ai-sdk/openai-compatible` helper (`ai-sdk-lovable-gateway` pattern), model `google/gemini-3-flash-preview`, structured output enforced by prompt (returns `{recordId|null, reason}`).
- Long-running matching runs write progress rows to `match_runs`; the dashboard polls every 1s.
- All Google/AI calls happen in `createServerFn` handlers — no keys reach the browser.

## Out of scope (ask if you want it)
- Multi-user sharing controls, per-user configs.
- Automatic scheduled runs (cron).
- Undo / rollback of writes to the sheet.
- Editing the city / school-number / category rules from the UI (they live in code; alias map is editable).
