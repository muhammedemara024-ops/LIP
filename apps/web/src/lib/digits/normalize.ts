/**
 * Replace Arabic-Indic (U+0660-U+0669) and Persian (U+06F0-U+06F9) digits with ASCII 0-9.
 * Every other character, including U+066B and punctuation, is returned unchanged. Never throws.
 * Source: PD-007 (Numbers, money, direction), FR-132; execution-briefs.md T010.
 */
export function normalizeDigits(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp >= 0x0660 && cp <= 0x0669) {
      out += String.fromCharCode(0x30 + (cp - 0x0660));
    } else if (cp !== undefined && cp >= 0x06f0 && cp <= 0x06f9) {
      out += String.fromCharCode(0x30 + (cp - 0x06f0));
    } else {
      out += ch;
    }
  }
  return out;
}
