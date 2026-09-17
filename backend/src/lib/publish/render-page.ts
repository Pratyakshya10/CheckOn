import type { Watch } from "../../types/watch";
import type { Change } from "../../types/change";

/** Static HTML for /w/<slug> — no client JS needed, so CloudFront can cache it as a plain object. */
export function renderWatchPage(watch: Watch, changes: Change[]): string {
  const timelineItems = changes
    .map(
      (c) => `
        <li class="${c.isCosmetic ? "cosmetic" : "change"}">
          <time>${new Date(c.detectedAt).toLocaleString()}</time>
          <p>${c.isCosmetic ? "No meaningful change" : escapeHtml(c.summary)}</p>
        </li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(watch.title)} — CheckOn</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; color: #1a1a1a; }
    .subscribers { color: #6b7280; }
    ul { list-style: none; padding: 0; }
    li { border-left: 2px solid #e5e7eb; padding: 8px 16px; margin-bottom: 8px; }
    li.cosmetic { color: #9ca3af; border-color: #f3f4f6; }
    time { font-size: 12px; color: #6b7280; display: block; }
  </style>
</head>
<body>
  <h1>${escapeHtml(watch.title)}</h1>
  <p class="subscribers">${watch.subscriberCount} people watching &middot; <a href="${escapeHtml(watch.url)}">source</a></p>
  <a href="/subscribe?watchId=${encodeURIComponent(watch.watchId)}">Watch this too</a>
  <h2>Timeline</h2>
  <ul>${timelineItems || "<li>No changes recorded yet.</li>"}</ul>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
