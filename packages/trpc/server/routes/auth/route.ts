import { TRPCError } from "@trpc/server";

import { authStore } from "../../auth/store";
import { signInInputSchema, signUpInputSchema } from "../../auth/schemas";
import { publicProcedure, router } from "../../trpc";

function mapAuthError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "Authentication failed";

  if (code === "CONFLICT") {
    throw new TRPCError({ code: "CONFLICT", message });
  }
  if (code === "UNAUTHORIZED") {
    throw new TRPCError({ code: "UNAUTHORIZED", message });
  }
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user ?? null),

  signIn: publicProcedure.input(signInInputSchema).mutation(async ({ ctx, input }) => {
    try {
      const user = await authStore.signIn(input);
      ctx.setSession(user, input.keepSignedIn);
      return user;
    } catch (error) {
      mapAuthError(error);
    }
  }),

  signUp: publicProcedure.input(signUpInputSchema).mutation(async ({ ctx, input }) => {
    try {
      const user = await authStore.signUp(input);
      ctx.setSession(user, input.keepSignedIn);
      return user;
    } catch (error) {
      mapAuthError(error);
    }
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.clearSession();
    return { ok: true as const };
  }),
});
