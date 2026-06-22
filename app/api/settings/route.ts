import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/security";
import { z } from "zod";

const settingsSchema = z.object({
  storeName: z.string().min(2).max(100).optional(),
  cnpj: z.string().max(20).optional().nullable(),
  whatsapp: z.string().max(20).optional().nullable(),
  email: z.string().email().max(120).optional().nullable(),
  theme: z.enum(["dark"]).optional(),
  glassMode: z.boolean().optional()
});

async function getOrCreateSettings() {
  const existing = await prisma.storeSettings.findFirst();
  if (existing) return existing;
  return prisma.storeSettings.create({
    data: { storeName: "DarkHaven" }
  });
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const settings = await getOrCreateSettings();
    return NextResponse.json({
      data: {
        id: settings.id,
        storeName: settings.storeName,
        cnpj: (settings as Record<string, unknown>).cnpj as string | null ?? null,
        whatsapp: settings.whatsapp ?? null,
        email: settings.email ?? null,
        theme: settings.theme,
        glassMode: settings.glassMode,
        updatedAt: settings.updatedAt.toISOString()
      }
    });
  } catch (error) {
    console.error("[Settings GET]", error);
    return NextResponse.json({ error: "Erro ao carregar configurações." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  if (auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem alterar as configurações." }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
        cnpj: (updated as Record<string, unknown>).cnpj as string | null ?? null,
        whatsapp: updated.whatsapp ?? null,
        email: updated.email ?? null,
        theme: updated.theme,
        glassMode: updated.glassMode,
        updatedAt: updated.updatedAt.toISOString()
      }
    });
  } catch (error) {
    console.error("[Settings PATCH]", error);
    return NextResponse.json({ error: "Erro ao salvar configurações." }, { status: 500 });
  }
}
