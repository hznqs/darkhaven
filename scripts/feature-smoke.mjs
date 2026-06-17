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
if (!email || !password) throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD precisam estar configurados localmente.");

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

function assertOk(label, result) {
  if (!result.response.ok) {
    throw new Error(`${label}: status=${result.response.status}`);
  }
}

const login = await request("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password })
});
assertOk("POST /api/auth/login", login);
const cookie = login.response.headers.getSetCookie?.().join("; ") ?? login.response.headers.get("set-cookie") ?? "";
if (!cookie) throw new Error("Cookie de sessão não retornado.");

const products = await request("/api/products", {}, cookie);
assertOk("GET /api/products", products);
const firstProduct = products.body?.data?.[0];
if (firstProduct) {
  const originalImageUrl = firstProduct.imageUrl ?? "";
  const png1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
  const formData = new FormData();
  formData.append("file", new File([png1x1], "smoke.png", { type: "image/png" }));
  const upload = await fetch(`${baseUrl}/api/uploads/product-image`, {
    method: "POST",
    headers: { cookie },
    body: formData
  });
  const uploadPayload = await upload.json().catch(() => ({}));
  const imageUrl = uploadPayload?.data?.imageUrl ?? "";
  const validImageUrl = imageUrl.includes("/storage/v1/object/public/") || imageUrl.startsWith("/uploads/products/");
  if (!upload.ok || !validImageUrl) {
    throw new Error(`POST /api/uploads/product-image: status=${upload.status}`);
  }
  const testImageUrl = uploadPayload.data.imageUrl;
  const update = await request(`/api/products/${firstProduct.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: firstProduct.name,
      category: firstProduct.category,
      sku: firstProduct.sku ?? "",
      price: firstProduct.price,
      cost: firstProduct.cost ?? 0,
      imageUrl: testImageUrl,
      colors: Array.isArray(firstProduct.colors) ? firstProduct.colors.join(", ") : "",
      sizes: Array.isArray(firstProduct.sizes) ? firstProduct.sizes.join(", ") : "",
      active: true,
      description: firstProduct.description ?? ""
    })
  }, cookie);
  assertOk("PATCH /api/products/[id] full product image payload", update);
  if (update.body?.data?.imageUrl !== testImageUrl) throw new Error("Imagem do produto não retornou atualizada.");

  const invalidFormData = new FormData();
  invalidFormData.append("file", new File([Buffer.from("not-an-image")], "invalid.txt", { type: "text/plain" }));
  const invalidUpload = await fetch(`${baseUrl}/api/uploads/product-image`, {
    method: "POST",
    headers: { cookie },
    body: invalidFormData
  });
  if (invalidUpload.status !== 422) {
    throw new Error(`POST /api/uploads/product-image invalid file: status=${invalidUpload.status}`);
  }

  const restore = await request(`/api/products/${firstProduct.id}`, {
    method: "PATCH",
    body: JSON.stringify({ imageUrl: originalImageUrl })
  }, cookie);
  assertOk("PATCH /api/products/[id] restore imageUrl", restore);
}

const stamp = Date.now().toString().slice(-10);
const whatsapp = `19${stamp}`.slice(0, 11).padEnd(10, "7");
const createdLead = await request("/api/leads", {
  method: "POST",
  body: JSON.stringify({
    name: `Lead Smoke ${stamp}`,
    whatsapp,
    origin: "Smoke",
    status: "NEW",
    notes: "Lead criado por smoke de funcionalidade."
  })
}, cookie);
assertOk("POST /api/leads", createdLead);
const leadId = createdLead.body?.data?.id;
if (!leadId) throw new Error("Lead criado sem id.");

const editedLead = await request(`/api/leads/${leadId}`, {
  method: "PATCH",
  body: JSON.stringify({ origin: "Smoke editado", notes: "Lead editado por smoke." })
}, cookie);
assertOk("PATCH /api/leads/[id] edit", editedLead);

const convertedLead = await request(`/api/leads/${leadId}`, {
  method: "PATCH",
  body: JSON.stringify({ status: "CLOSED_WON" })
}, cookie);
assertOk("PATCH /api/leads/[id] convert", convertedLead);
if (!convertedLead.body?.data?.convertedCustomerId) throw new Error("Lead convertido sem convertedCustomerId.");

const leadsAfterConversion = await request("/api/leads", {}, cookie);
assertOk("GET /api/leads after conversion", leadsAfterConversion);
if (leadsAfterConversion.body?.data?.some((lead) => lead.id === leadId)) {
  throw new Error("Lead convertido ainda aparece na listagem de leads.");
}

const customers = await request("/api/customers", {}, cookie);
assertOk("GET /api/customers", customers);
if (!customers.body?.data?.some((customer) => customer.whatsapp === whatsapp)) {
  throw new Error("Cliente convertido não apareceu na base de clientes.");
}

console.log("FEATURE_SMOKE_OK");
