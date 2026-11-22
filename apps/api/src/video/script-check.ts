/**
 * Every number in a generated script must appear in the verified property facts (§3.6, rule 7).
 * Invented area, rooms or price are rejected, so the pipeline fails instead of publishing them.
 */
export function unsupportedNumbers(text: string, facts: Record<string, unknown>): string[] {
  const allowed = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === 'number') allowed.add(String(v));
    if (typeof v === 'string')
      for (const m of v.matchAll(/\d+(?:[.,]\d+)?/g)) allowed.add(m[0].replace(',', '.'));
  };
  for (const v of Object.values(facts)) add(v);
  const found = [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(',', '.'));
  return found.filter((n) => !allowed.has(n) && !allowed.has(String(Number(n))));
}
