export function sanitizeFilename(name: string): string {
  const illegalChars = /[\\/:*?"<>|]/g;
  return name.replace(illegalChars, '_');
}

export async function downloadSong(url: string, filename: string): Promise<void> {
  const response = await fetch(url, { mode: 'no-cors' });
  if (!response.ok && response.type !== 'opaque') {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  try {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = sanitizeFilename(filename);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
