import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin, requireAuth } from "@/lib/server/security";
import { serializeProduct } from "@/lib/server/serializers";
import { productSchema } from "@/lib/server/validators";
import { readWithRetry } from "@/lib/server/read-retry";
import { parseJsonBody, safeErrorResponse, warnInDevelopment, isUniqueConstraintError } from "@/lib/server/errors";

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
  sku: true,
  description: true
} satisfies Prisma.ProductSelect;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const products = await readWithRetry(() =>
    prisma.product.findMany({
      where: { active: true },
      select: productSelect,
      orderBy: { createdAt: "desc" }
    })
  );
  return NextResponse.json({ data: products.map(serializeProduct) });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = productSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  try {
    const sku = parsed.data.sku || undefined;
    if (sku) {
      const duplicate = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
      if (duplicate) return NextResponse.json({ error: "Já existe produto com este SKU." }, { status: 409 });
    }

    const product = await prisma.product.create({
      select: productSelect,
      data: {
        ...parsed.data,
        sku,
        imageUrl: parsed.data.imageUrl || undefined,
        description: parsed.data.description || undefined
      }
    });
    await writeAuditLogSafe({ userId: admin.userId, action: "CREATE", entity: "Product", entityId: product.id });
    return NextResponse.json({ data: serializeProduct(product) }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Já existe produto com este SKU." }, { status: 409 });
    }
    warnInDevelopment("Product creation failed", error);
    return safeErrorResponse("Não foi possível criar o produto.");
  }
}
