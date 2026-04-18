export function normalizeMediaUrl(url: string | null | undefined) {
  const trimmed = url?.trim() ?? '';

  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('http://')) return `https://${trimmed.slice('http://'.length)}`;

  return trimmed;
}
