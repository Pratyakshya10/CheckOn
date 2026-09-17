/**
 * Strips the parts of a page that change on every load but mean nothing —
*/

const STRIP_TAGS = ["script", "style", "nav", "noscript", "svg", "iframe"];

const NOISE_PATTERNS: RegExp[] = [
  /\b\d{1,2}:\d{2}(:\d{2})?\s?(AM|PM|am|pm)?\b/g, // clock times
  /\b(19|20)\d{2}-\d{2}-\d{2}\b/g, // ISO dates embedded as "last updated"
  /\bcsrf[-_]?token["']?\s*[:=]\s*["'][^"']+["']/gi,
  /\bsession[-_]?id["']?\s*[:=]\s*["'][^"']+["']/gi,
  /\b\d+\s+(views?|visitors?|online now)\b/gi,
];

export function normalizeHtml(html: string): string {
  let text = html;

  for (const tag of STRIP_TAGS) {
    text = text.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
  }

  // Strip all remaining tags, keep text content.
  text = text.replace(/<[^>]+>/g, " ");

  // Decode the handful of entities that show up as noise otherwise.
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  for (const pattern of NOISE_PATTERNS) {
    text = text.replace(pattern, "");
  }

  // Collapse whitespace last, after all the removals above may have left gaps.
  return text.replace(/\s+/g, " ").trim();
}
