import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@checkon/trpc/client";

function trpcUrl() {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
  return `${base}/trpc`;
}

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: trpcUrl(),
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});
