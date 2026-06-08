// Inline SVG placeholder for missing/broken album covers. Kept as a data URI
// so it works without an extra network request and is portable across web/Android.
export const PLACEHOLDER_COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">` +
      `<rect width="64" height="64" rx="12" fill="rgba(255,255,255,0.08)"/>` +
      `<path d="M27 42V18l18-3v21" stroke="rgba(255,255,255,0.55)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="22" cy="42" r="5" stroke="rgba(255,255,255,0.55)" stroke-width="2.4"/>` +
      `<circle cx="42" cy="38" r="5" stroke="rgba(255,255,255,0.55)" stroke-width="2.4"/>` +
      `</svg>`
  );

export function isCoverBroken(event: React.SyntheticEvent<HTMLImageElement>): boolean {
  const target = event.currentTarget;
  return target.naturalWidth === 0 && target.naturalHeight === 0;
}
