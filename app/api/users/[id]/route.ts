import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireOwnerAdmin, sanitizeUser } from "@/lib/server/security";
import { userUpdateSchema } from "@/lib/server/validators";
import { parseJsonBody, safeErrorResponse, warnInDevelopment } from "@/lib/server/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const owner = requireOwnerAdmin(request);
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });

  const { id } = await context.params;
  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = userUpdateSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  if (current.isOwnerAdmin && (parsed.data.active === false || parsed.data.role === "STAFF")) {
    return NextResponse.json({ error: "O admin principal não pode ser desativado ou rebaixado." }, { status: 409 });
  }

  try {
    const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : undefined;
    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
        active: parsed.data.active
      }
    });

    await writeAuditLogSafe({
      userId: owner.userId,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      metadata: { role: updated.role, active: updated.active }
    });

    return NextResponse.json({ data: sanitizeUser(updated) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Já existe usuário com este e-mail." }, { status: 409 });
    }

    warnInDevelopment("User update failed", error);
    return safeErrorResponse("Não foi possível atualizar o usuário.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const owner = requireOwnerAdmin(request);
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });

  const { id } = await context.params;
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  if (current.isOwnerAdmin || current.id === owner.userId) {
    return NextResponse.json({ error: "O admin principal não pode desativar a si mesmo." }, { status: 409 });
  }

  const updated = await prisma.user.update({ where: { id }, data: { active: false } });
  await writeAuditLogSafe({
    userId: owner.userId,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    metadata: { active: false }
  });

  return NextResponse.json({ data: sanitizeUser(updated) });
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
