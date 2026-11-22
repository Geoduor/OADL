// Kenyan mobile numbers have 9 digits after +254 and start with 7 or 1
// (written 07xx / 01xx at home). Source: Communications Authority of Kenya,
// Numbering Plan, April 2026:
// https://www.ca.go.ke/sites/default/files/2026-04/Numbering%20Plan%20Kenya%20April%202026.pdf
// Accepts +254712345678, 254712345678 and 0712345678 (spaces, dashes and
// brackets are ignored). Returns E.164, or null when the number is not valid.
export function normaliseKenyanMobile(input: string): string | null {
  const cleaned = input.replace(/[\s\-().]/g, '');
  let national: string;
  if (cleaned.startsWith('+254')) {
    national = cleaned.slice(4);
  } else if (cleaned.startsWith('254')) {
    national = cleaned.slice(3);
  } else if (cleaned.startsWith('0')) {
    national = cleaned.slice(1);
  } else {
    return null;
  }
  return /^[17]\d{8}$/.test(national) ? `+254${national}` : null;
}
