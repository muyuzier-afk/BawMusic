'use client';

type Props = {
  urls: string[];
  disabled?: boolean;
  highlightUrl?: string;
};

function formatHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function ManualLinks({ urls, disabled, highlightUrl }: Props) {
  return (
    <div className="manual-links">
      <div className="manual-links-title">手动选择</div>
      <div className="manual-links-list">
        {urls.map((url) => {
          const target = url.replace(/\/+$/, '') + (typeof window !== 'undefined'
            ? window.location.pathname + window.location.search + window.location.hash
            : '');
          const isHighlight = highlightUrl && url === highlightUrl;
          return (
            <a
              key={url}
              className={`manual-link ${isHighlight ? 'highlight' : ''}`}
              href={target}
              onClick={(e) => {
                if (disabled) e.preventDefault();
              }}
            >
              <span className="manual-link-arrow" aria-hidden="true">→</span>
              前往 {formatHost(url)}
            </a>
          );
        })}
      </div>
    </div>
  );
}
