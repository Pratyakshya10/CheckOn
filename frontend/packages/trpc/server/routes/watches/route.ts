import { TRPCError } from "@trpc/server";

import { z } from "../../schema";
import { publicProcedure, router } from "../../trpc";

const watchStatusSchema = z.enum(["active", "failing", "blocked"]);

const publicWatchSchema = z.object({
  watchId: z.string(),
  slug: z.string(),
  title: z.string(),
  url: z.string().url(),
  subscriberCount: z.number().int().nonnegative(),
  lastCheckedAt: z.string().nullable(),
  status: watchStatusSchema,
});

export type PublicWatch = z.infer<typeof publicWatchSchema>;

/** Seed watches from the CheckOn spec — swap for DynamoDB later. */
const MOCK_WATCHES: PublicWatch[] = [
  {
    watchId: "watch_upsc_notifications",
    slug: "upsc-notifications",
    title: "UPSC notifications",
    url: "https://upsc.gov.in/whats-new",
    subscriberCount: 214,
    lastCheckedAt: "2026-09-17T06:30:00.000Z",
    status: "active",
  },
  {
    watchId: "watch_us_visa_mumbai",
    slug: "us-visa-slots-mumbai",
    title: "US visa slots, Mumbai",
    url: "https://www.usvisascheduling.com/",
    subscriberCount: 187,
    lastCheckedAt: "2026-09-17T06:45:00.000Z",
    status: "active",
  },
  {
    watchId: "watch_neet_counselling",
    slug: "neet-counselling",
    title: "NEET counselling updates",
    url: "https://mcc.nic.in/",
    subscriberCount: 96,
    lastCheckedAt: "2026-09-17T06:20:00.000Z",
    status: "active",
  },
];

export const watchesRouter = router({
  listPublic: publicProcedure
    .output(z.array(publicWatchSchema))
    .query(() => MOCK_WATCHES),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(120) }))
    .output(publicWatchSchema)
    .query(({ input }) => {
      const watch = MOCK_WATCHES.find((item) => item.slug === input.slug);
      if (!watch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Watch not found" });
      }
      return watch;
    }),
});
