// lib/time.ts
// Utility helpers for business hour string normalization

// Normalize a single time token like "400 AM" → "4:00 AM", "4pm" → "4:00 PM"
export function normalizeTimeToken(token: string): string {
  const t = token.trim().toUpperCase();
  // Insert missing colon for patterns like 400AM, 0400AM, 4PM, 4:0 PM
  const m = t.match(/^([0-2]?\d)(:?)([0-5]?\d)?\s*(A|P)\s*\.?M\.?$/);
  if (m) {
    let hh = parseInt(m[1], 10);
    const mm = m[3] ? m[3].padStart(2, '0') : '00';
    const mer = m[4] === 'A' ? 'AM' : 'PM';
    if (hh === 0) hh = 12;
    if (hh > 12) hh = hh % 12;
    return `${hh}:${mm} ${mer}`;
  }
  // Already has colon with AM/PM -> normalize spacing/case
  const m2 = t.match(/^([0-1]?\d|2[0-3]):([0-5]\d)\s*(A|P)\s*\.?M\.?$/);
  if (m2) {
    let hh = parseInt(m2[1], 10);
    const mm = m2[2];
    const mer = m2[3] === 'A' ? 'AM' : 'PM';
    if (hh === 0) hh = 12;
    if (hh > 12) hh = hh % 12;
    return `${hh}:${mm} ${mer}`;
  }
  // 24h like 16:00 -> 4:00 PM
  const m3 = t.match(/^([0-1]?\d|2[0-3]):([0-5]\d)$/);
  if (m3) {
    let hh = parseInt(m3[1], 10);
    const mm = m3[2];
    const mer = hh >= 12 ? 'PM' : 'AM';
    if (hh === 0) hh = 12; else if (hh > 12) hh = hh - 12;
    return `${hh}:${mm} ${mer}`;
  }
  return token.trim();
}

// Normalize ranges like "9-5" or "400 AM - 5 pm"
export function normalizeHoursString(hours: string): string {
  const text = hours.replace(/\u2013|\u2014/g, '-'); // en–/em— dashes → hyphen
  const parts = text.split(/\s*-\s*/);
  if (parts.length === 2) {
    const left = normalizeTimeToken(parts[0]);
    const right = normalizeTimeToken(parts[1]);
    return `${left} - ${right}`;
  }
  // Single token case – normalize as a time if possible
  return normalizeTimeToken(text);
}

