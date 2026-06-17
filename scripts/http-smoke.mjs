import fs from "node:fs";

const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3017";

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

async function request(path, options = {}, cookie = "") {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...options.headers
    }
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

const checks = [];

const loginPage = await request("/login");
checks.push(["GET /login", loginPage.response.status]);

const login = await request("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password })
});

checks.push(["POST /api/auth/login", login.response.status]);

const cookie = login.response.headers.getSetCookie?.().join("; ") ?? login.response.headers.get("set-cookie") ?? "";
if (!cookie || login.response.status !== 200) {
  throw new Error(`Falha ao autenticar smoke HTTP: status=${login.response.status}`);
}

const customerList = await request("/api/customers", {}, cookie);
checks.push(["GET /api/customers", customerList.response.status]);

const customers = Array.isArray(customerList.body?.data) ? customerList.body.data : [];
const customerId = customers[0]?.id;

const authenticatedRoutes = [
  "/api/sales",
  "/api/orders",
  "/api/post-sales",
  "/api/finance/summary",
  "/api/finance/revenue",
  "/api/finance/by-payment-method"
];

if (customerId) authenticatedRoutes.push(`/api/customers/${customerId}`);

for (const path of authenticatedRoutes) {
  const result = await request(path, {}, cookie);
  checks.push([`GET ${path}`, result.response.status]);
}

const failures = checks.filter(([, status]) => status < 200 || status >= 300);
if (failures.length) {
  throw new Error(failures.map(([label, status]) => `${label}: ${status}`).join("\n"));
}

for (const [label, status] of checks) {
  console.log(`${label}: ${status}`);
}

console.log("HTTP_SMOKE_OK");
