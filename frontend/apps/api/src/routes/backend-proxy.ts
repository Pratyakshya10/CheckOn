import { Router } from "express";

import { env } from "../env";

export const backendProxyRouter = Router();

backendProxyRouter.use(async (req, res) => {
  if (!env.AWS_BACKEND_API_URL) {
    res.status(503).json({
      error: "backend_not_configured",
      message: "The AWS backend API URL is not configured yet.",
    });
    return;
  }

  const upstreamUrl = new URL(req.url, `${env.AWS_BACKEND_API_URL.replace(/\/$/, "")}/`);
  const headers = new Headers({ accept: "application/json" });
  const contentType = req.header("content-type");
  const cookie = req.header("cookie");
  const requestId = req.header("x-request-id");

  if (contentType) headers.set("content-type", contentType);
  if (cookie) headers.set("cookie", cookie);
  if (requestId) headers.set("x-request-id", requestId);

  const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: hasBody ? JSON.stringify(req.body) : undefined,
      redirect: "manual",
    });

    const responseType = upstream.headers.get("content-type");
    if (responseType) res.setHeader("content-type", responseType);
    res.status(upstream.status);

    if (upstream.status === 204) {
      res.end();
      return;
    }

    res.send(await upstream.text());
  } catch (error) {
    console.error("AWS backend proxy failed", error);
    res.status(502).json({
      error: "backend_unreachable",
      message: "The AWS backend could not be reached.",
    });
  }
});
