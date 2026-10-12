/**
 * Resolves deadlines spoken in a meeting ("by Friday", "tomorrow", "kal tak", "in 2 weeks", "Oct 15")
 * into YYYY-MM-DD dates relative to the meeting date. Returns null when nothing is stated.
 */

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, ravivar: 0, itwar: 0,
  monday: 1, mon: 1, somvar: 1, somwar: 1,
  tuesday: 2, tue: 2, tues: 2, mangalvar: 2, mangalwar: 2,
  wednesday: 3, wed: 3, budhvar: 3, budhwar: 3,
  thursday: 4, thu: 4, thurs: 4, guruvar: 4, guruwar: 4,
  friday: 5, fri: 5, shukravar: 5, shukrawar: 5,
  saturday: 6, sat: 6, shanivar: 6, shaniwar: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

export const toIsoDate = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

const parseBase = (base: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(base);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
};

const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 86400000);

export function addDaysIso(base: string, n: number): string {
  return toIsoDate(addDays(parseBase(base), n));
}

/** @param baseDate meeting date as YYYY-MM-DD */
export function resolveDeadline(text: string, baseDate: string): string | null {
  const t = ` ${text.toLowerCase()} `;
  const base = parseBase(baseDate);

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // "15 Oct", "15th of October", "Oct 15", "October 15th"
  const dm = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\b/.exec(t);
  const md = /\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\b/.exec(t);
  for (const [day, mon] of [dm ? [dm[1], dm[2]] : null, md ? [md[2], md[1]] : null].filter(Boolean) as string[][]) {
    if (mon in MONTHS && +day >= 1 && +day <= 31) {
      let d = new Date(Date.UTC(base.getUTCFullYear(), MONTHS[mon], +day));
      if (d < base) d = new Date(Date.UTC(base.getUTCFullYear() + 1, MONTHS[mon], +day));
      return toIsoDate(d);
    }
  }

  if (/\b(today|tonight|eod|end of (the )?day|aaj)\b/.test(t)) return toIsoDate(base);
  if (/\b(day after tomorrow|parso|parson)\b/.test(t)) return toIsoDate(addDays(base, 2));
  if (/\b(tomorrow|tmrw|kal)\b/.test(t)) return toIsoDate(addDays(base, 1));

  const inN = /\b(?:in|within|next)\s+(\d{1,2}|a|one|two|three|four)\s+(day|days|week|weeks|month|months)\b/.exec(t);
  if (inN) {
    const words: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4 };
    const n = words[inN[1]] ?? parseInt(inN[1], 10);
    const unit = inN[2].startsWith('day') ? 1 : inN[2].startsWith('week') ? 7 : 30;
    return toIsoDate(addDays(base, n * unit));
  }
  const nDin = /\b(\d{1,2})\s+(din|dino|hafte|hafton)\b/.exec(t);
  if (nDin) return toIsoDate(addDays(base, parseInt(nDin[1], 10) * (nDin[2].startsWith('din') ? 1 : 7)));

  if (/\b(end of (the )?week|eow|this week|week ke end)\b/.test(t)) {
    const toFri = (5 - base.getUTCDay() + 7) % 7;
    return toIsoDate(addDays(base, toFri));
  }
  if (/\b(next week|agle hafte|agle week|next sprint)\b/.test(t)) return toIsoDate(addDays(base, 7));
  if (/\b(end of (the )?month|eom|month end|mahine ke end)\b/.test(t)) {
    return toIsoDate(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)));
  }

  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      let diff = (dow - base.getUTCDay() + 7) % 7;
      if (diff === 0) diff = 7;
      if (new RegExp(`\\bnext\\s+${name}\\b`).test(t) && diff < 7) diff += 7;
      return toIsoDate(addDays(base, diff));
    }
  }
  return null;
}
