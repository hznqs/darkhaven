import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth, requireAdmin } from "@/lib/server/security";
import { safeErrorResponse, warnInDevelopment, parseJsonBody } from "@/lib/server/errors";
import { z } from "zod";

const settingsSchema = z.object({
  storeName: z.string().min(2).max(100).optional(),
  whatsapp: z.string().max(20).optional().nullable(),
  email: z.string().email().max(120).optional().nullable(),
  theme: z.enum(["dark"]).optional(),
  glassMode: z.boolean().optional()
});

async function getOrCreateSettings() {
  const existing = await prisma.storeSettings.findFirst();
  if (existing) return existing;
  try {
    return await prisma.storeSettings.create({ data: { storeName: "DarkHaven" } });
  } catch {
    return prisma.storeSettings.findFirstOrThrow();
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const settings = await getOrCreateSettings();
    return NextResponse.json({
      data: {
        id: settings.id,
        storeName: settings.storeName,
        whatsapp: settings.whatsapp ?? null,
        email: settings.email ?? null,
        theme: settings.theme,
        glassMode: settings.glassMode,
        updatedAt: settings.updatedAt.toISOString()
      }
    });
  } catch (error) {
    warnInDevelopment("Settings GET", error);
    return safeErrorResponse("Erro ao carregar configurações.");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const body = await parseJsonBody(request);
    if (!body.ok) return body.response;

    const parsed = settingsSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const current = await getOrCreateSettings();
    const updated = await prisma.storeSettings.update({
      where: { id: current.id },
      data: parsed.data
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        storeName: updated.storeName,
        whatsapp: updated.whatsapp ?? null,
        email: updated.email ?? null,
        theme: updated.theme,
        glassMode: updated.glassMode,
        updatedAt: updated.updatedAt.toISOString()
      }
    });
  } catch (error) {
    warnInDevelopment("Settings PATCH", error);
    return safeErrorResponse("Erro ao salvar configurações.");
  }
}