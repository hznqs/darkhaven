import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireOwnerAdmin, sanitizeUser } from "@/lib/server/security";
import { userCreateSchema } from "@/lib/server/validators";
import { parseJsonBody, safeErrorResponse, warnInDevelopment } from "@/lib/server/errors";

export async function GET(request: NextRequest) {
  const owner = requireOwnerAdmin(request);
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });

  const users = await prisma.user.findMany({ orderBy: [{ isOwnerAdmin: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ data: users.map(sanitizeUser) });
}

export async function POST(request: NextRequest) {
  const owner = requireOwnerAdmin(request);
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });

  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = userCreateSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
        active: parsed.data.active,
        createdById: owner.userId
      }
    });

    await writeAuditLogSafe({
      userId: owner.userId,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      metadata: { role: user.role }
    });

    return NextResponse.json({ data: sanitizeUser(user) }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Já existe usuário com este e-mail." }, { status: 409 });
    }

    warnInDevelopment("User creation failed", error);
    return safeErrorResponse("Não foi possível criar o usuário.");
  }
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
