import { Router } from "express";
import { authStore } from "@checkon/trpc/server";

import { env } from "../env";
import { setSession } from "../services/session";

const googleAuthRouter = Router();

function clientErrorRedirect(message: string) {
  const url = new URL(env.CLIENT_URL);
  url.searchParams.set("auth_error", message);
  return url.toString();
}

function clientSuccessRedirect() {
  const url = new URL(env.CLIENT_URL);
  url.searchParams.set("auth", "ok");
  return url.toString();
}

googleAuthRouter.get("/google", (_req, res) => {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.redirect(
      clientErrorRedirect("Google sign-in is not configured. Add GOOGLE_OAUTH_* to .env and restart."),
    );
    return;
  }

  const state = crypto.randomUUID();
  res.cookie("checkon_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

googleAuthRouter.get("/google/callback", async (req, res) => {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.redirect(clientErrorRedirect("Google sign-in is not configured."));
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const expectedState = req.cookies?.checkon_oauth_state;
  res.clearCookie("checkon_oauth_state", { path: "/" });

  if (!code || !state || !expectedState || state !== expectedState) {
    res.redirect(clientErrorRedirect("Google sign-in was cancelled or expired. Try again."));
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      throw new Error("token_exchange_failed");
    }

    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      throw new Error("missing_access_token");
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) {
      throw new Error("profile_fetch_failed");
    }

    const profile = (await profileRes.json()) as { email?: string; name?: string };
    if (!profile.email) {
      throw new Error("missing_email");
    }

    const user = await authStore.upsertGoogle({
      email: profile.email,
      fullName: profile.name ?? profile.email.split("@")[0] ?? "Google user",
    });
    setSession(res, user, true);
    res.redirect(clientSuccessRedirect());
  } catch {
    res.redirect(clientErrorRedirect("Google sign-in failed. Check OAuth credentials and try again."));
  }
});

googleAuthRouter.get("/demo", async (_req, res) => {
  if (env.DEMO_LOGIN_ENABLED !== "true") {
    res.redirect(clientErrorRedirect("Demo login is disabled."));
    return;
  }

  try {
    setSession(res, await authStore.demoUser(), true);
    res.redirect(clientSuccessRedirect());
  } catch {
    res.redirect(clientErrorRedirect("Demo sign-in failed."));
  }
});

export { googleAuthRouter };
