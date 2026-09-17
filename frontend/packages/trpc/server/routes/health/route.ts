import { z } from "zod";

import { publicProcedure, router } from "../../trpc";

export const healthRouter = router({
  getHealth: publicProcedure
    .output(
      z.object({
        status: z.literal("ok"),
        service: z.literal("checkon"),
      }),
    )
    .query(() => ({
      status: "ok" as const,
      service: "checkon" as const,
    })),
});
