import type { FetchResult } from "./static";
import { USER_AGENT } from "./robots";


export async function fetchHeadless(url: string, timeoutMs = 15_000): Promise<FetchResult> {
  const chromium = (await import("@sparticuz/chromium")).default;
  const puppeteer = await import("puppeteer-core");

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    const response = await page.goto(url, { waitUntil: "networkidle0", timeout: timeoutMs });
    const html = await page.content();
    return { html, statusCode: response?.status() ?? 0 };
  } finally {
    await browser.close();
  }
}
