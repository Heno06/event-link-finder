// Text/phone/name normalization + Armenian↔Latin city detection.

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = String(raw).replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("374")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(-8);
}

export function normalizeEmail(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function normalizeName(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const ARM_TO_LATIN: Record<string, string> = {
  ա: "a", բ: "b", գ: "g", դ: "d", ե: "e", զ: "z", է: "e", ը: "y",
  թ: "t", ժ: "zh", ի: "i", լ: "l", խ: "kh", ծ: "ts", կ: "k", հ: "h",
  ձ: "dz", ղ: "gh", ճ: "ch", մ: "m", յ: "y", ն: "n", շ: "sh", ո: "o",
  չ: "ch", պ: "p", ջ: "j", ռ: "r", ս: "s", վ: "v", տ: "t", ր: "r",
  ց: "ts", ու: "u", փ: "p", ք: "k", և: "ev", օ: "o", ֆ: "f",
};

export function transliterateArmenian(s: string): string {
  let out = "";
  const lower = s.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const two = lower.slice(i, i + 2);
    if (ARM_TO_LATIN[two]) {
      out += ARM_TO_LATIN[two];
      i++;
      continue;
    }
    const ch = lower[i];
    out += ARM_TO_LATIN[ch] ?? ch;
  }
  return out;
}

export function normalizeOrg(raw: string | null | undefined): string {
  return transliterateArmenian(String(raw ?? "").toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// City aliases: canonical Latin form → variants (Armenian + Latin spellings).
const CITY_VARIANTS: Record<string, string[]> = {
  yerevan: ["yerevan", "երևան", "erevan", "ереван"],
  gyumri: ["gyumri", "գյումրի", "gjumri"],
  vanadzor: ["vanadzor", "վանաձոր"],
  vagharshapat: ["vagharshapat", "էջմիածին", "ejmiatsin", "echmiadzin"],
  hrazdan: ["hrazdan", "հրազդան"],
  abovyan: ["abovyan", "աբովյան"],
  kapan: ["kapan", "կապան"],
  armavir: ["armavir", "արմավիր"],
  gavar: ["gavar", "գավառ"],
  ijevan: ["ijevan", "իջևան"],
  artashat: ["artashat", "արտաշատ"],
  ashtarak: ["ashtarak", "աշտարակ"],
  sevan: ["sevan", "սևան"],
  dilijan: ["dilijan", "դիլիջան"],
  goris: ["goris", "գորիս"],
  masis: ["masis", "մասիս"],
  charentsavan: ["charentsavan", "չարենցավան"],
  spitak: ["spitak", "սպիտակ"],
  stepanavan: ["stepanavan", "ստեփանավան"],
  martuni: ["martuni", "մարտունի"],
  sisian: ["sisian", "սիսիան"],
};

export function extractCity(s: string): string | null {
  const hay = (s + " " + transliterateArmenian(s)).toLowerCase();
  for (const [canonical, variants] of Object.entries(CITY_VARIANTS)) {
    for (const v of variants) {
      if (hay.includes(v.toLowerCase())) return canonical;
    }
  }
  return null;
}

export function extractSchoolNumber(s: string): string | null {
  // matches "N 123", "#123", "թիվ 123", "no. 123", " 123 school"
  const patterns = [
    /(?:թիվ|թ\.?)\s*(\d{1,4})/i,
    /(?:no\.?|n[°º]?|#)\s*(\d{1,4})/i,
    /\bschool\s*(?:no\.?|#|number)?\s*(\d{1,4})\b/i,
    /\b(\d{1,4})\s*(?:-?(?:րդ|th|st|nd|rd))?\s*(?:դպրոց|school)\b/i,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  return null;
}

const SCHOOL_MARKERS = ["դպրոց", "school", "գիմնազիա", "gymnasium", "lyceum", "լիցեյ"];
const BUSINESS_MARKERS = ["ՍՊԸ", "սպը", " llc", " ltd", " inc", "ՓԲԸ", "ՓԲԸ", "cjsc", "ojsc", "ՓԲԸ"];

export function isSchoolInput(s: string): boolean {
  const l = s.toLowerCase();
  return SCHOOL_MARKERS.some((m) => l.includes(m.toLowerCase()));
}

export function isBusinessCandidate(s: string): boolean {
  const l = s.toLowerCase();
  return BUSINESS_MARKERS.some((m) => l.includes(m.toLowerCase()));
}

// Token-overlap Jaccard score.
export function tokenScore(a: string, b: string): number {
  const at = new Set(normalizeOrg(a).split(" ").filter((t) => t.length > 1));
  const bt = new Set(normalizeOrg(b).split(" ").filter((t) => t.length > 1));
  if (at.size === 0 || bt.size === 0) return 0;
  let inter = 0;
  for (const t of at) if (bt.has(t)) inter++;
  const union = at.size + bt.size - inter;
  return inter / union;
}

export function validateOrgMatch(input: string, candidate: string): { ok: boolean; reason?: string } {
  if (isSchoolInput(input) && isBusinessCandidate(candidate)) {
    return { ok: false, reason: "school→business" };
  }
  const inCity = extractCity(input);
  const cdCity = extractCity(candidate);
  if (inCity && cdCity && inCity !== cdCity) {
    return { ok: false, reason: `city ${inCity}≠${cdCity}` };
  }
  const inNum = extractSchoolNumber(input);
  const cdNum = extractSchoolNumber(candidate);
  if (inNum && cdNum && inNum !== cdNum) {
    return { ok: false, reason: `number ${inNum}≠${cdNum}` };
  }
  return { ok: true };
}
