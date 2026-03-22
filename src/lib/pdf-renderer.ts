import { access } from "node:fs/promises";
import puppeteer from "puppeteer-core";

import { renderResumePdfHtml } from "@/lib/resume-pdf-template";
import type { ResumeContentJson } from "@/types/resume";

type RenderResumePdfBufferInput = {
  content: ResumeContentJson;
  templateName: string;
};

const browserPathCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean) as string[];

async function resolveBrowserExecutablePath() {
  for (const candidate of browserPathCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("PDF_BROWSER_UNAVAILABLE");
}

export async function renderResumePdfBuffer({
  content,
  templateName,
}: RenderResumePdfBufferInput) {
  const executablePath = await resolveBrowserExecutablePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--disable-gpu",
      "--no-default-browser-check",
      "--no-first-run",
      "--font-render-hinting=medium",
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: 1240,
      height: 1754,
      deviceScaleFactor: 1,
    });
    await page.setContent(
      renderResumePdfHtml({
        content,
        templateName,
      }),
      {
        waitUntil: "networkidle0",
      },
    );
    await page.emulateMediaType("screen");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "12mm",
        right: "10mm",
        bottom: "12mm",
        left: "10mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
