/**

 * Usage: WATCHES_TABLE=checkon-watches npx ts-node scripts/seed-watches.ts
 */
import { putWatch, getWatch } from "../src/lib/db/watches";
import { hashUrl, shardFor } from "../src/lib/hash";
import { slugify } from "../src/lib/slug";
import type { Watch } from "../src/types/watch";


const SEED_URLS: Array<{ url: string; title: string }> = [
  { url: "https://upsc.gov.in/whats-new", title: "UPSC Notifications" },
  { url: "https://cbse.gov.in/results", title: "CBSE Board Results" },
  { url: "https://ibps.in/recruitment", title: "IBPS Recruitment" },
  { url: "https://ais.usvisa-info.com/en-in/niv/schedule", title: "US Visa Slots — Mumbai" },
  { url: "https://scholarships.gov.in/", title: "National Scholarship Portal" },
  { url: "https://www.rrbcdg.gov.in/", title: "Railway Recruitment Board" },
];

async function seed(): Promise<void> {
  for (const { url, title } of SEED_URLS) {
    const normalizedUrl = new URL(url).hostname + new URL(url).pathname;
    const watchId = hashUrl(normalizedUrl);

    const existing = await getWatch(watchId);
    if (existing) {
      console.log(`skip (exists): ${title}`);
      continue;
    }

    const watch: Watch = {
      watchId,
      url,
      normalizedUrl,
      title,
      slug: `${slugify(title)}-${watchId.slice(2, 8)}`,
      isPublic: true,
      subscriberCount: 0,
      checkIntervalMinutes: 15,
      nextCheckAt: new Date().toISOString(),
      lastCheckedAt: null,
      lastContentHash: null,
      lastSnapshotKey: null,
      fetchMode: "static",
      robotsAllowed: true,
      status: "active",
      consecutiveFailures: 0,
      shardId: shardFor(watchId),
    };

    await putWatch(watch);
    console.log(`seeded: ${title} -> /w/${watch.slug}`);
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
