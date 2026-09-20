import { TRPCError } from "@trpc/server";
import { z } from "../../schema";
import { authStore } from "../../auth/store";
import { protectedProcedure, router } from "../../trpc";

const settingsSchema = z.object({
  emailAlerts: z.boolean(),
  weeklyDigest: z.boolean(),
  pushNotifications: z.boolean(),
  noiseFiltering: z.boolean(),
  digestFrequency: z.enum(["daily", "weekly", "biweekly", "off"]),
  digestTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  includeQuietWatches: z.boolean(),
});

function userEmail(user: { email: string } | undefined) {
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  return user.email;
}

function mapAccountError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "Account update failed";
  if (code === "UNAUTHORIZED") throw new TRPCError({ code: "UNAUTHORIZED", message });
  if (code === "NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message });
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const accountRouter = router({
  settings: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await authStore.getSettings(userEmail(ctx.user));
    } catch (error) {
      mapAccountError(error);
    }
  }),

  updateSettings: protectedProcedure.input(settingsSchema.partial()).mutation(async ({ ctx, input }) => {
    try {
      return await authStore.updateSettings(userEmail(ctx.user), input);
    } catch (error) {
      mapAccountError(error);
    }
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().trim().min(2).max(80),
        profileRole: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await authStore.updateProfile(userEmail(ctx.user), input.fullName, input.profileRole);
        ctx.setSession(user, true);
        return user;
      } catch (error) {
        mapAccountError(error);
      }
    }),

  changePassword: protectedProcedure
    .input(
      z
        .object({
          currentPassword: z.string().min(1),
          newPassword: z.string().min(6).max(128),
          confirmPassword: z.string(),
        })
        .refine((value) => value.newPassword === value.confirmPassword, {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await authStore.changePassword(
          userEmail(ctx.user),
          input.currentPassword,
          input.newPassword,
        );
        return { ok: true as const };
      } catch (error) {
        mapAccountError(error);
      }
    }),

  beginTotp: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await authStore.beginTotp(userEmail(ctx.user));
    } catch (error) {
      mapAccountError(error);
    }
  }),

  enableTotp: protectedProcedure
    .input(z.object({ code: z.string().trim().regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await authStore.enableTotp(userEmail(ctx.user), input.code);
        ctx.setSession(user, true);
        return user;
      } catch (error) {
        mapAccountError(error);
      }
    }),

  disableTotp: protectedProcedure
    .input(z.object({ code: z.string().trim().regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await authStore.disableTotp(userEmail(ctx.user), input.code);
        ctx.setSession(user, true);
        return user;
      } catch (error) {
        mapAccountError(error);
      }
    }),
});
