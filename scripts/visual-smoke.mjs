import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3017";
const outputDir = path.join(process.cwd(), "test-results", "visual-smoke");
const routes = [
  "/login",
  "/dashboard",
  "/leads",
  "/clients",
  "/products",
  "/sales",
  "/payments",
  "/orders",
  "/finance",
  "/post-sales",
  "/settings"
];
const viewports = [
  { name: "360", width: 360, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "768", width: 768, height: 1024 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1600x900", width: 1600, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 }
];

fs.mkdirSync(outputDir, { recursive: true });

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [rawName, ...rest] = line.split("=");
    const name = rawName.trim();
    const value = rest.join("=").trim().replace(/^"|"$/g, "");
    if (name) process.env[name] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD precisam estar configurados localmente.");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await context.newPage();
const failures = [];
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => {
  consoleErrors.push(error.message);
});

await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
await page.locator('input[name="email"]').fill(email);
await page.locator('input[name="password"]').fill(password);
await page.locator('button[type="submit"]').click();
await page.waitForURL(/\/dashboard$/, { timeout: 60000 });

for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(350);

    const status = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = doc.scrollWidth;
      const clientWidth = doc.clientWidth;
      const previousScrollX = window.scrollX;
      window.scrollTo(99999, window.scrollY);
      const canScrollHorizontally = window.scrollX > 1;
      window.scrollTo(previousScrollX, window.scrollY);
      const textOverflow = Array.from(document.querySelectorAll("button, input, select, textarea")).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && element.scrollWidth > element.clientWidth + 2;
      }).length;
      const appError = document.body.innerText.includes("Application error") || document.body.innerText.includes("Unhandled Runtime Error");
      return {
        title: document.title,
        path: location.pathname,
        bodyOverflow: canScrollHorizontally || scrollWidth > clientWidth + 2,
        scrollWidth,
        clientWidth,
        textOverflow,
        appError
      };
    });

    if (status.appError) failures.push(`${viewport.name} ${route}: app error renderizado`);
    if (status.bodyOverflow) failures.push(`${viewport.name} ${route}: overflow horizontal da página (${status.scrollWidth}/${status.clientWidth})`);
    if (status.textOverflow > 0) failures.push(`${viewport.name} ${route}: ${status.textOverflow} controles com texto/valor vazando`);

    const fileName = `${viewport.name}${route === "/" ? "/home" : route}.png`.replace(/[\\/]/g, "_").replace(/^_/, "");
    await page.screenshot({ path: path.join(outputDir, fileName), fullPage: true });
  }
}

await browser.close();

const relevantConsoleErrors = consoleErrors.filter((message) =>
  !message.includes("favicon") &&
  !message.includes("Failed to load resource: the server responded with a status of 404")
);

if (relevantConsoleErrors.length) {
  failures.push(`console errors: ${relevantConsoleErrors.slice(0, 5).join(" | ")}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`VISUAL_SMOKE_OK screenshots=${outputDir}`);
