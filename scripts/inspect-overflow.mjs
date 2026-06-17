import { chromium } from "@playwright/test";
import fs from "node:fs";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [rawName, ...rest] = line.split("=");
    process.env[rawName.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const route = process.argv[2] ?? "/sales";
const width = Number(process.argv[3] ?? 360);
const height = Number(process.argv[4] ?? 800);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width, height } });

await page.goto("http://127.0.0.1:3017/login", { waitUntil: "networkidle" });
await page.locator('input[name="email"]').fill(process.env.ADMIN_EMAIL ?? "");
await page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD ?? "");
await page.locator('button[type="submit"]').click();
await page.waitForURL(/\/dashboard$/, { timeout: 60000 });
await page.goto(`http://127.0.0.1:3017${route}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const result = await page.evaluate(() => {
  function nodeInfo(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      tag: element.tagName,
      className: String(element.className).slice(0, 180),
      text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
      overflowX: style.overflowX,
      display: style.display,
      minWidth: style.minWidth,
      maxWidth: style.maxWidth,
      position: style.position
    };
  }

  const items = Array.from(document.querySelectorAll("*"))
    .map(nodeInfo)
    .filter((item) => item.width > 0 && (item.right > window.innerWidth + 2 || item.left < -2))
    .sort((a, b) => b.right - a.right)
    .slice(0, 30);

  const firstOverflow = document.querySelector("table") ?? Array.from(document.querySelectorAll("*"))
    .find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.right > window.innerWidth + 2 || rect.left < -2);
    });
  const ancestors = [];
  let current = firstOverflow;
  while (current) {
    ancestors.push(nodeInfo(current));
    current = current.parentElement;
  }

  return {
    path: location.pathname,
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    items,
    ancestors
  };
});

console.log(JSON.stringify(result, null, 2));
await page.screenshot({ path: `test-results/overflow-${route.replace(/\W+/g, "-")}-${width}.png`, fullPage: true });
await browser.close();
