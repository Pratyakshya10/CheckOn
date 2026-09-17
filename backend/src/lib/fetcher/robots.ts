/**
 * Minimal robots.txt check 
 */

const USER_AGENT = "CheckOnBot/1.0 (+https://checkon.app/about-bot)";

interface RobotsRules {
  disallow: string[];
  fetchedAt: number;
}

const cache = new Map<string, RobotsRules>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchRobots(origin: string): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;

  let disallow: string[] = [];
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const text = await res.text();
      disallow = parseDisallowRules(text, "*") ?? parseDisallowRules(text, "CheckOnBot") ?? [];
    }
  } catch {
    // Unreachable robots.txt 
    disallow = [];
  }

  const rules = { disallow, fetchedAt: Date.now() };
  cache.set(origin, rules);
  return rules;
}

function parseDisallowRules(robotsTxt: string, forAgent: string): string[] | null {
  const lines = robotsTxt.split("\n").map((l) => l.trim());
  let inMatchingGroup = false;
  let matched = false;
  const rules: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line === "") continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      inMatchingGroup = value === forAgent || value === "*";
      if (inMatchingGroup) matched = true;
    } else if (key === "disallow" && inMatchingGroup && value) {
      rules.push(value);
    }
  }

  return matched ? rules : null;
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const { disallow } = await fetchRobots(parsed.origin);
  return !disallow.some((rule) => parsed.pathname.startsWith(rule));
}

export { USER_AGENT };
