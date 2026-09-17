export function instantAlertEmail(watchTitle: string, summary: string, reason: string, watchUrl: string) {
  const subject = `${watchTitle} changed`;
  const text = `${summary}\n\nMatched because: ${reason}\n\n${watchUrl}`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">${escapeHtml(watchTitle)} changed</h2>
      <p style="color: #1a1a1a;">${escapeHtml(summary)}</p>
      <p style="color: #6b7280; font-size: 13px;">Matched because: ${escapeHtml(reason)}</p>
      <a href="${watchUrl}" style="color: #2563eb;">View the change</a>
    </div>`;
  return { subject, text, html };
}

export interface DigestLine {
  watchTitle: string;
  oneLineSummary: string;
  watchUrl: string;
}

export function digestEmail(lines: DigestLine[], unchangedTitles: string[]) {
  const subject = `${lines.length} update${lines.length === 1 ? "" : "s"} on what you're waiting on`;

  const text = [
    ...lines.map((l) => `${l.watchTitle}: ${l.oneLineSummary} — ${l.watchUrl}`),
    unchangedTitles.length ? `No change on: ${unchangedTitles.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>What moved</h2>
      <ul style="padding-left: 16px;">
        ${lines
          .map(
            (l) =>
              `<li><strong>${escapeHtml(l.watchTitle)}</strong>: ${escapeHtml(l.oneLineSummary)} — <a href="${l.watchUrl}">view</a></li>`
          )
          .join("")}
      </ul>
      ${
        unchangedTitles.length
          ? `<p style="color: #9ca3af; font-size: 13px;">No change on: ${escapeHtml(unchangedTitles.join(", "))}</p>`
          : ""
      }
    </div>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
