import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin, requireAuth } from "@/lib/server/security";
import { serializeProduct } from "@/lib/server/serializers";
import { productSchema } from "@/lib/server/validators";
import { readWithRetry } from "@/lib/server/read-retry";
import { parseJsonBody } from "@/lib/server/errors";

const productSelect = {
  id: true,
  name: true,
  category: true,
  price: true,
  cost: true,
  imageUrl: true,
  colors: true,
  sizes: true,
  active: true,
  available: true,
  sku: true,
  description: true
} satisfies Prisma.ProductSelect;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { id } = await context.params;
  const product = await readWithRetry(() => prisma.product.findUnique({ where: { id }, select: productSelect }));
  if (!product) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  return NextResponse.json({ data: serializeProduct(product) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const { id } = await context.params;
  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = productSchema.partial().safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const sku = parsed.data.sku || undefined;
  if (sku) {
    const duplicate = await prisma.product.findFirst({ where: { sku, id: { not: id } }, select: { id: true } });
    if (duplicate) return NextResponse.json({ error: "Já existe produto com este SKU." }, { status: 409 });
  }

  const product = await prisma.product.update({
    where: { id },
    select: productSelect,
    data: {
      ...parsed.data,
      sku,
      imageUrl: "imageUrl" in parsed.data ? parsed.data.imageUrl || null : undefined,
      description: "description" in parsed.data ? parsed.data.description || null : undefined
    }
  });
  await writeAuditLogSafe({ userId: admin.userId, action: "UPDATE", entity: "Product", entityId: id });
  return NextResponse.json({ data: serializeProduct(product) });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const { id } = await context.params;
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });

  const product = await prisma.product.update({ where: { id }, select: productSelect, data: { active: false } });
  await writeAuditLogSafe({ userId: admin.userId, action: "UPDATE", entity: "Product", entityId: id, metadata: { archived: true } });
  return NextResponse.json({ data: serializeProduct(product) });
}
