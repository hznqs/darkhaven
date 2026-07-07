import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [rawName, ...rest] = line.split("=");
    const name = rawName.trim();
    const value = rest.join("=").trim().replace(/^"|"$/g, "");
    if (name) process.env[name] = value;
  }
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});
const prisma = new PrismaClient({ adapter });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const email = requireEnv("ADMIN_EMAIL").trim().toLowerCase();
  const password = requireEnv("ADMIN_PASSWORD");

  const weakPatterns = ["change-me", "before-production", "admin", "password", "senha", "123456"];
  const passwordLower = password.toLowerCase();
  if (weakPatterns.some((p) => passwordLower.includes(p))) {
    throw new Error("ADMIN_PASSWORD is too weak. Avoid common words like 'change-me', 'admin', 'password'.");
  }
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must have at least 12 characters");
  if (!/[A-Z]/.test(password)) throw new Error("ADMIN_PASSWORD must contain at least one uppercase letter");
  if (!/[a-z]/.test(password)) throw new Error("ADMIN_PASSWORD must contain at least one lowercase letter");
  if (!/[0-9]/.test(password)) throw new Error("ADMIN_PASSWORD must contain at least one number");

  const existingOwner = await prisma.user.findFirst({ where: { isOwnerAdmin: true } });
  if (existingOwner) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      active: true,
      isOwnerAdmin: true,
      passwordHash
    },
    create: {
      name: "Admin DarkHaven",
      email,
      passwordHash,
      role: "ADMIN",
      active: true,
      isOwnerAdmin: true
    }
  });
}

main()
  .catch((error) => {
    const message = error instanceof Error ? redactSensitive(error.message) : "Seed failed";
    console.error(message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

function redactSensitive(value) {
  return value
    .replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://[redacted]@")
    .replace(/(DATABASE_URL|DIRECT_URL|JWT_SECRET|SUPABASE_SERVICE_ROLE_KEY|ADMIN_PASSWORD)=([^\s]+)/gi, "$1=[redacted]")
    .replace(/password=([^&\s]+)/gi, "password=[redacted]");
}
