import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import type { AppUser } from "@/lib/types";

export const sessionCookieName = "darkhaven_session";

type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: AppUser["role"];
  isOwnerAdmin: boolean;
  exp: number;
};

export type AuthResult =
  | { ok: true; user: AppUser; userId: string }
  | { ok: false; status: number; message: string };

export function signSession(user: Pick<AppUser, "id" | "email" | "name" | "role" | "isOwnerAdmin">) {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isOwnerAdmin: user.isOwnerAdmin,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8
  };

  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function requireAuth(request: NextRequest): AuthResult {
  const token = request.cookies.get(sessionCookieName)?.value;
  const payload = token ? verifySession(token) : null;
  if (!payload) {
    return { ok: false, status: 401, message: "Autenticação obrigatória." };
  }

  return {
    ok: true,
    userId: payload.sub,
    user: {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      active: true,
      isOwnerAdmin: payload.isOwnerAdmin,
      createdAt: new Date(0).toISOString()
    }
  };
}

export function requireAdmin(request: NextRequest): AuthResult {
  const auth = requireAuth(request);
  if (!auth.ok) return auth;
  if (auth.user.role !== "ADMIN") {
    return { ok: false, status: 403, message: "Usuário ADMIN autenticado é obrigatório para esta ação." };
  }
  return auth;
}

export function requireOwnerAdmin(request: NextRequest): AuthResult {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth;
  if (!auth.user.isOwnerAdmin) {
    return { ok: false, status: 403, message: "Apenas o admin principal pode executar esta ação." };
  }
  return auth;
}

export function sanitizeUser(user: {
  id: string;
  name: string;
  email: string;
  role: AppUser["role"];
  active: boolean;
  isOwnerAdmin: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
}): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    isOwnerAdmin: user.isOwnerAdmin,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString()
  };
}

export function hasValidSessionToken(token?: string) {
  return token ? verifySession(token) !== null : false;
}

function verifySession(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = sign(`${encodedHeader}.${encodedPayload}`);
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!payload.sub || !payload.email || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function sign(value: string) {
  return crypto.createHmac("sha256", getJwtSecret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET precisa estar configurado com pelo menos 32 caracteres.");
  }
  return secret;
}
