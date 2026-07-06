import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  extractSpreadsheetId,
  readRange,
  writeColumnValues,
  findHeaderIndex,
  colIndexToLetter,
  quoteTab,
} from "@/lib/sheets.server";
import {
  normalizeEmail,
  normalizePhone,
  normalizeName,
  normalizeOrg,
  tokenScore,
  validateOrgMatch,
} from "@/lib/normalize";
import { createLovableGateway } from "@/lib/ai-gateway.server";

/* ------------------------ helpers ------------------------ */

async function loadConfig(supabase: any, id: string) {
  const { data, error } = await supabase.from("sheet_configs").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

async function startRun(supabase: any, configId: string, runType: "contact" | "org", total: number) {
  const { data, error } = await supabase
    .from("match_runs")
    .insert({ config_id: configId, run_type: runType, status: "running", total })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function updateRun(supabase: any, id: string, patch: Record<string, any>) {
  await supabase.from("match_runs").update(patch).eq("id", id);
}

/* ------------------------ progress polling ------------------------ */

export const getRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("match_runs")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listRecentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("match_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ------------------------ contact matcher ------------------------ */

export const runContactMatching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ configId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const cfg = await loadConfig(context.supabase, data.configId);
    const runId = await startRun(context.supabase, cfg.id, "contact", 0);

    try {
      // 1. Read contacts DB
      const contactsSid = extractSpreadsheetId(cfg.contacts_spreadsheet_url);
      const contactsRange = `${quoteTab(cfg.contacts_tab)}!A1:ZZ`;
      const contactsRows = await readRange(contactsSid, contactsRange);
      if (contactsRows.length < 2) throw new Error("Contacts DB has no data");

      const cHeaders = contactsRows[0];
      const idxRecId = findHeaderIndex(cHeaders, ["Record ID", "Record Id", "RecordID", "ID", "Id"]);
      const idxEmail = findHeaderIndex(cHeaders, ["Email", "Email Address", "E-mail"]);
      const idxPhone = findHeaderIndex(cHeaders, ["Phone", "Phone Number", "Mobile", "Tel"]);
      const idxFirst = findHeaderIndex(cHeaders, ["First Name", "FirstName", "First"]);
      const idxLast = findHeaderIndex(cHeaders, ["Last Name", "LastName", "Last", "Surname"]);
      if (idxRecId === -1) throw new Error("Contacts DB missing 'Record ID' column");

      const emailIdx = new Map<string, string>();
      const phoneIdx = new Map<string, string>();
      const nameIdx = new Map<string, string>();

      for (let i = 1; i < contactsRows.length; i++) {
        const r = contactsRows[i];
        const rid = (r[idxRecId] ?? "").toString().trim();
        if (!rid) continue;
        if (idxEmail !== -1) {
          const e = normalizeEmail(r[idxEmail]);
          if (e && !emailIdx.has(e)) emailIdx.set(e, rid);
        }
        if (idxPhone !== -1) {
          const p = normalizePhone(r[idxPhone]);
          if (p && !phoneIdx.has(p)) phoneIdx.set(p, rid);
        }
        if (idxFirst !== -1 && idxLast !== -1) {
          const key = `${normalizeName(r[idxFirst])}|${normalizeName(r[idxLast])}`;
          if (key !== "|" && !nameIdx.has(key)) nameIdx.set(key, rid);
        }
      }

      // 2. Read event sheet
      const eventSid = extractSpreadsheetId(cfg.event_spreadsheet_url);
      const eventRange = `${quoteTab(cfg.event_tab)}!A1:ZZ`;
      const eventRows = await readRange(eventSid, eventRange);
      if (eventRows.length < 2) throw new Error("Event sheet has no data");

      const eHeaders = eventRows[0];
      let evIdxContactId = findHeaderIndex(eHeaders, ["Contact ID", "Contact Id", "ContactID"]);
      const evIdxEmail = findHeaderIndex(eHeaders, ["Email", "Email Address", "E-mail"]);
      const evIdxPhone = findHeaderIndex(eHeaders, ["Phone", "Phone Number", "Mobile", "Tel"]);
      const evIdxFirst = findHeaderIndex(eHeaders, ["First Name", "FirstName", "First"]);
      const evIdxLast = findHeaderIndex(eHeaders, ["Last Name", "LastName", "Last", "Surname"]);

      // If Contact ID column doesn't exist, append it.
      if (evIdxContactId === -1) {
        evIdxContactId = eHeaders.length;
        const letter = colIndexToLetter(evIdxContactId);
        await writeColumnValues(eventSid, `${quoteTab(cfg.event_tab)}!${letter}1`, ["Contact ID"]);
      }

      const limit = cfg.row_limit ? Math.min(cfg.row_limit, eventRows.length - 1) : eventRows.length - 1;
      await updateRun(context.supabase, runId, { total: limit });

      const outValues: string[] = [];
      let matched = 0;
      const unmatched: any[] = [];

      for (let i = 1; i <= limit; i++) {
        const r = eventRows[i] ?? [];
        let rid = "";
        if (evIdxEmail !== -1) {
          const e = normalizeEmail(r[evIdxEmail]);
          if (e && emailIdx.has(e)) rid = emailIdx.get(e)!;
        }
        if (!rid && evIdxPhone !== -1) {
          const p = normalizePhone(r[evIdxPhone]);
          if (p && phoneIdx.has(p)) rid = phoneIdx.get(p)!;
        }
        if (!rid && evIdxFirst !== -1 && evIdxLast !== -1) {
          const key = `${normalizeName(r[evIdxFirst])}|${normalizeName(r[evIdxLast])}`;
          if (key !== "|" && nameIdx.has(key)) rid = nameIdx.get(key)!;
        }
        outValues.push(rid);
        if (rid) matched++;
        else
          unmatched.push({
            row: i + 1,
            email: evIdxEmail !== -1 ? r[evIdxEmail] : "",
            phone: evIdxPhone !== -1 ? r[evIdxPhone] : "",
            name:
              evIdxFirst !== -1 || evIdxLast !== -1
                ? `${r[evIdxFirst] ?? ""} ${r[evIdxLast] ?? ""}`.trim()
                : "",
          });

        if (i % 25 === 0) {
          await updateRun(context.supabase, runId, { processed: i, matched });
        }
      }

      // 3. Write back Contact ID column
      const letter = colIndexToLetter(evIdxContactId);
      const writeRange = `${quoteTab(cfg.event_tab)}!${letter}2:${letter}${limit + 1}`;
      await writeColumnValues(eventSid, writeRange, outValues);

      await updateRun(context.supabase, runId, {
        status: "done",
        processed: limit,
        matched,
        unmatched: unmatched.slice(0, 500),
        finished_at: new Date().toISOString(),
      });

      return { runId, processed: limit, matched, unmatched: unmatched.length };
    } catch (err: any) {
      await updateRun(context.supabase, runId, {
        status: "error",
        error: err?.message ?? String(err),
        finished_at: new Date().toISOString(),
      });
      throw err;
    }
  });

/* ------------------------ org matcher ------------------------ */

type OrgCand = { recordId: string; name: string; normalized: string };

async function aiPickBest(
  input: string,
  candidates: OrgCand[],
): Promise<{ recordId: string | null; reason: string }> {
  const gw = createLovableGateway();
  const list = candidates
    .map((c, i) => `${i + 1}. [${c.recordId}] ${c.name}`)
    .join("\n");
  const prompt = `You are matching an organization name to the correct record in a CRM.

INPUT NAME:
"${input}"

CANDIDATES (id in brackets):
${list}

Rules:
- Return the single BEST match ONLY if you are confident it refers to the same real-world organization.
- If a city is mentioned in the input, the match must be in the same city.
- If a school number is mentioned, it must match.
- A school must never be matched with a business (LLC/CJSC/ՍՊԸ/ՓԲԸ).
- If none of the candidates is clearly the same organization, return NOT FOUND.

Respond in exactly this format on a single line:
MATCH: <record_id>
or
NOT FOUND

Then a short reason on the next line.`;

  const { text } = await generateText({
    model: gw("google/gemini-3-flash-preview"),
    prompt,
  });
  const line = text.split("\n")[0]?.trim() ?? "";
  const reason = text.split("\n").slice(1).join(" ").trim().slice(0, 200);
  const m = line.match(/^MATCH:\s*(.+)$/i);
  if (!m) return { recordId: null, reason };
  const rid = m[1].trim().replace(/^\[|\]$/g, "");
  const found = candidates.find((c) => c.recordId === rid);
  if (!found) return { recordId: null, reason: "AI returned unknown id" };
  return { recordId: rid, reason };
}

export const runOrgMatching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ configId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const cfg = await loadConfig(context.supabase, data.configId);
    const runId = await startRun(context.supabase, cfg.id, "org", 0);

    const diag: string[] = [];
    const log = (s: string) => {
      diag.push(s);
      console.log("[orgmatch]", s);
    };

    try {
      // 1. Load org DB
      const orgSid = extractSpreadsheetId(cfg.org_spreadsheet_url);
      const orgRange = `${quoteTab(cfg.org_tab)}!A1:ZZ`;
      const orgRows = await readRange(orgSid, orgRange);
      if (orgRows.length < 2) throw new Error("Org DB has no data");
      const oHeaders = orgRows[0];
      log(`orgDB headers: ${JSON.stringify(oHeaders)}`);
      const idxRecId = findHeaderIndex(oHeaders, ["Record ID", "Record Id", "RecordID", "ID", "Id"]);
      const idxName = findHeaderIndex(oHeaders, [
        "Organization Name",
        "Organisation Name",
        "Name",
        "Org Name",
        "Company Name",
      ]);
      log(`orgDB idxRecId=${idxRecId} idxName=${idxName}`);
      if (idxRecId === -1 || idxName === -1)
        throw new Error("Org DB requires 'Record ID' and 'Organization Name' columns");

      const cands: OrgCand[] = [];
      const byExact = new Map<string, string>();
      const byNormalized = new Map<string, string>();
      for (let i = 1; i < orgRows.length; i++) {
        const r = orgRows[i];
        const rid = (r[idxRecId] ?? "").toString().trim();
        const name = (r[idxName] ?? "").toString().trim();
        if (!rid || !name) continue;
        const norm = normalizeOrg(name);
        cands.push({ recordId: rid, name, normalized: norm });
        if (!byExact.has(name.toLowerCase())) byExact.set(name.toLowerCase(), rid);
        if (!byNormalized.has(norm)) byNormalized.set(norm, rid);
      }
      log(`orgDB loaded ${cands.length} candidates. Sample first 5:`);
      for (const c of cands.slice(0, 5)) {
        log(`  [${c.recordId}] raw="${c.name}" norm="${c.normalized}"`);
      }

      // 2. Alias map
      const { data: aliases } = await context.supabase.from("org_aliases").select("*");
      const aliasMap = new Map<string, string>();
      for (const a of aliases ?? []) {
        let rid: string | null | undefined = a.record_id;
        if (!rid && a.canonical_name) {
          rid = byExact.get(a.canonical_name.toLowerCase()) ?? byNormalized.get(normalizeOrg(a.canonical_name)) ?? null;
        }
        if (rid) aliasMap.set(normalizeOrg(a.alias), rid);
      }
      log(`alias map size: ${aliasMap.size}`);

      // 3. Cache
      const { data: cacheRows } = await context.supabase
        .from("org_match_cache")
        .select("input_normalized,record_id");
      const cache = new Map<string, string>();
      for (const c of cacheRows ?? []) cache.set(c.input_normalized, c.record_id);
      log(`cache size: ${cache.size}`);

      // 4. Read event sheet
      const eventSid = extractSpreadsheetId(cfg.event_spreadsheet_url);
      const eventRange = `${quoteTab(cfg.event_tab)}!A1:ZZ`;
      const eventRows = await readRange(eventSid, eventRange);
      if (eventRows.length < 2) throw new Error("Event sheet has no data");
      const eHeaders = eventRows[0];
      log(`event headers: ${JSON.stringify(eHeaders)}`);
      const evIdxOrgName = findHeaderIndex(eHeaders, [
        "Organization",
        "Organization Name",
        "School",
        "School Name",
        "Company",
        "Org",
      ]);
      log(`event idxOrgName=${evIdxOrgName}`);
      if (evIdxOrgName === -1) throw new Error("Event sheet missing organization/school column");
      let evIdxOrgId = findHeaderIndex(eHeaders, ["Organization ID", "Organization Id", "Org ID"]);
      if (evIdxOrgId === -1) {
        evIdxOrgId = eHeaders.length;
        await writeColumnValues(eventSid, `${quoteTab(cfg.event_tab)}!${colIndexToLetter(evIdxOrgId)}1`, [
          "Organization ID",
        ]);
      }

      const limit = cfg.row_limit ? Math.min(cfg.row_limit, eventRows.length - 1) : eventRows.length - 1;
      await updateRun(context.supabase, runId, { total: limit });
      log(`processing ${limit} event rows. Fuzzy accept threshold = 0.75 (jaccard).`);

      const out: string[] = [];
      const unmatched: any[] = [];
      const newCache: { input_normalized: string; input_original: string; record_id: string; canonical_name: string; confidence: number; method: string }[] = [];
      let matched = 0;
      let unmatchedLoggedCands = 0;

      for (let i = 1; i <= limit; i++) {
        const raw = ((eventRows[i] ?? [])[evIdxOrgName] ?? "").toString().trim();
        const doTrace = i <= 20;
        if (!raw) {
          if (doTrace) log(`row ${i + 1}: EMPTY org cell`);
          out.push("");
          if (i % 10 === 0) await updateRun(context.supabase, runId, { processed: i, matched });
          continue;
        }
        const norm = normalizeOrg(raw);
        if (doTrace) log(`row ${i + 1}: raw="${raw}" norm="${norm}"`);
        let rid = "";
        let method = "";

        // 1 exact
        const exactHit = byExact.get(raw.toLowerCase());
        if (doTrace) log(`  step exact: ${exactHit ? `HIT ${exactHit}` : "miss"}`);
        if (exactHit) { rid = exactHit; method = "exact"; }

        // 2 alias
        if (!rid) {
          const h = aliasMap.get(norm);
          if (doTrace) log(`  step alias: ${h ? `HIT ${h}` : "miss"}`);
          if (h) { rid = h; method = "alias"; }
        }
        // 3 cache
        if (!rid) {
          const h = cache.get(norm);
          if (doTrace) log(`  step cache: ${h ? `HIT ${h}` : "miss"}`);
          if (h) { rid = h; method = "cache"; }
        }
        // 4 normalized exact
        if (!rid) {
          const h = byNormalized.get(norm);
          if (doTrace) log(`  step normalized: ${h ? `HIT ${h}` : "miss"}`);
          if (h) { rid = h; method = "normalized"; }
        }
        // 5 fuzzy
        let topCands: (OrgCand & { score: number })[] = [];
        if (!rid) {
          topCands = cands
            .map((c) => ({ ...c, score: tokenScore(raw, c.name) }))
            .filter((c) => c.score > 0.2)
            .sort((a, b) => b.score - a.score)
            .slice(0, 25);
          const best = topCands[0];
          if (doTrace) {
            const top3 = topCands.slice(0, 3).map((c) => `${c.score.toFixed(2)}:"${c.name}"`).join(" | ");
            log(`  step fuzzy: top3=[${top3 || "none"}] threshold=0.75`);
          }
          if (best && best.score >= 0.75) {
            const v = validateOrgMatch(raw, best.name);
            if (doTrace) log(`  fuzzy validate: ok=${v.ok} reason=${v.reason ?? ""}`);
            if (v.ok) {
              rid = best.recordId;
              method = "fuzzy";
              newCache.push({
                input_normalized: norm,
                input_original: raw,
                record_id: rid,
                canonical_name: best.name,
                confidence: best.score,
                method,
              });
            }
          }
        }
        // 6 AI fallback
        if (!rid && topCands.length > 0) {
          if (doTrace) log(`  step ai: attempting with ${topCands.length} candidates`);
          try {
            const ai = await aiPickBest(raw, topCands);
            if (doTrace) log(`  ai result: recordId=${ai.recordId ?? "null"} reason="${ai.reason}"`);
            if (ai.recordId) {
              const cand = topCands.find((c) => c.recordId === ai.recordId)!;
              const v = validateOrgMatch(raw, cand.name);
              if (doTrace) log(`  ai validate: ok=${v.ok} reason=${v.reason ?? ""}`);
              if (v.ok) {
                rid = ai.recordId;
                method = "ai";
                newCache.push({
                  input_normalized: norm,
                  input_original: raw,
                  record_id: rid,
                  canonical_name: cand.name,
                  confidence: 0.5,
                  method,
                });
              }
            }
          } catch (e: any) {
            log(`  ai error: ${e?.message ?? e}`);
          }
        } else if (!rid && doTrace) {
          log(`  step ai: skipped (no fuzzy candidates)`);
        }

        if (doTrace) log(`row ${i + 1} => ${rid ? `MATCH ${rid} via ${method}` : "UNMATCHED"}`);

        out.push(rid);
        if (rid) matched++;
        else {
          // Log top-3 fuzzy candidates for up to 10 unmatched rows (in addition to trace)
          if (unmatchedLoggedCands < 10) {
            const top3 = topCands.slice(0, 3).map((c) => `${c.score.toFixed(2)}:"${c.name}"`).join(" | ");
            log(`unmatched row ${i + 1} "${raw}" top3=[${top3 || "none"}]`);
            unmatchedLoggedCands++;
          }
          unmatched.push({ row: i + 1, name: raw, topCandidates: topCands.slice(0, 3).map((c) => ({ id: c.recordId, name: c.name, score: Number(c.score.toFixed(2)) })) });
        }

        if (i % 5 === 0) await updateRun(context.supabase, runId, { processed: i, matched });
      }

      // Write column
      const letter = colIndexToLetter(evIdxOrgId);
      await writeColumnValues(eventSid, `${quoteTab(cfg.event_tab)}!${letter}2:${letter}${limit + 1}`, out);

      // Persist new cache entries
      if (newCache.length > 0) {
        await context.supabase.from("org_match_cache").upsert(newCache, { onConflict: "input_normalized" });
      }

      await updateRun(context.supabase, runId, {
        status: "done",
        processed: limit,
        matched,
        unmatched: unmatched.slice(0, 500),
        message: diag.join("\n").slice(0, 200000),
        finished_at: new Date().toISOString(),
      });

      return { runId, processed: limit, matched, unmatched: unmatched.length };
    } catch (err: any) {
      await updateRun(context.supabase, runId, {
        status: "error",
        error: err?.message ?? String(err),
        message: diag.join("\n").slice(0, 200000),
        finished_at: new Date().toISOString(),
      });
      throw err;
    }
  });
