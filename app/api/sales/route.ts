import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin, requireAuth } from "@/lib/server/security";
import { buildSaleWhere, findSales, serializeSale } from "@/lib/server/sales";
import { saleSchema } from "@/lib/server/validators";
import { readWithRetry } from "@/lib/server/read-retry";
import { parseJsonBody } from "@/lib/server/errors";
import { buildPurchaseHistorySummary, getPurchaseHistoryWindow } from "@/lib/server/purchase-history";

type SaleItemSnapshot = {
  productId: string;
  productNameSnapshot: string;
  productSkuSnapshot: string | null;
  productCategorySnapshot: string;
  unitPriceSnapshot: number;
  unitCostSnapshot: number;
  selectedColor?: string;
  selectedSize?: string;
  estimatedUnitCost: number;
  discount: number;
  customizationNotes?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const sales = await readWithRetry(() => findSales(buildSaleWhere(request.nextUrl.searchParams)));
  return NextResponse.json({ data: sales.map(serializeSale) });
}

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.message }, { status: admin.status });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return body.response;
  }

  const parsed = saleSchema.safeParse(body.data);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: parsed.data.customerId },
    select: { id: true }
  });

  if (!customer) {
    return NextResponse.json({ error: "Cliente informado não existe." }, { status: 404 });
  }

  const productIds = parsed.data.items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
    select: { id: true, name: true, category: true, sku: true, price: true, cost: true, colors: true, sizes: true }
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  if (products.length !== new Set(productIds).size) {
    return NextResponse.json(
      { error: "Um ou mais produtos informados não existem ou estão inativos." },
      { status: 404 }
    );
  }

  const items: SaleItemSnapshot[] = [];
  for (const item of parsed.data.items) {
    const product = productById.get(item.productId);
    if (!product) {
      throw new Error("Produto validado não encontrado no mapa de preços.");
    }
    const unitPrice = Number(product.price);
    const unitCost = Number(product.cost);
    const itemDiscount = item.discount ?? 0;
    const selectedColor = item.selectedColor?.trim() || undefined;
    const selectedSize = item.selectedSize?.trim() || undefined;
    const customizationNotes = item.customizationNotes?.trim() || undefined;
    const subtotal = unitPrice * item.quantity;
    if (selectedColor && !product.colors.includes(selectedColor)) {
      return NextResponse.json({ error: "A cor selecionada não existe no catálogo do produto." }, { status: 422 });
    }
    if (selectedSize && !product.sizes.includes(selectedSize)) {
      return NextResponse.json({ error: "O tamanho selecionado não existe no catálogo do produto." }, { status: 422 });
    }
    if (itemDiscount > subtotal) {
      return NextResponse.json({ error: "O desconto do item não pode ser maior que o subtotal do item." }, { status: 422 });
    }

    items.push({
      productId: item.productId,
      productNameSnapshot: product.name,
      productSkuSnapshot: product.sku,
      productCategorySnapshot: product.category,
      unitPriceSnapshot: unitPrice,
      unitCostSnapshot: unitCost,
      selectedColor,
      selectedSize,
      estimatedUnitCost: unitCost,
      discount: itemDiscount,
      customizationNotes,
      quantity: item.quantity,
      unitPrice,
      subtotal
    });
  }
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const itemDiscountTotal = items.reduce((sum, item) => sum + item.discount, 0);
  const totalDiscount = itemDiscountTotal + parsed.data.discount;
  const total = subtotal - totalDiscount;
  if (totalDiscount > subtotal) {
    return NextResponse.json({ error: "O desconto não pode ser maior que o subtotal da venda." }, { status: 422 });
  }
  const estimatedCost = items.reduce((sum, item) => sum + item.unitCostSnapshot * item.quantity, 0);
  const estimatedProfit = total - estimatedCost;
  const estimatedMargin = total > 0 ? estimatedProfit / total : 0;

  const sale = await prisma.$transaction(async (tx) => {
    const createdSale = await tx.sale.create({
      data: {
        customerId: parsed.data.customerId,
        channel: parsed.data.channel,
        status: "WAITING_PAYMENT",
        subtotal,
        discount: totalDiscount,
        total,
        estimatedCost,
        estimatedProfit,
        estimatedMargin,
        items: {
          create: items
        }
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: { orderBy: { createdAt: "desc" } },
        orders: { orderBy: { createdAt: "desc" } },
        postSales: true
      }
    });

    const { purchasedAt, expiresAt } = getPurchaseHistoryWindow(createdSale.createdAt);
    await tx.customerPurchaseHistory.create({
      data: {
        customerId: createdSale.customerId,
        saleId: createdSale.id,
        purchasedAt,
        expiresAt,
        summary: buildPurchaseHistorySummary(createdSale.saleNumber, createdSale.items),
        total: createdSale.total
      }
    });

    return createdSale;
  });

  await writeAuditLogSafe({
    userId: admin.userId,
    action: "CREATE",
    entity: "Sale",
    entityId: sale.id,
    metadata: {
      total: Number(sale.total),
      itemCount: sale.items.length
    }
  });

  return NextResponse.json({ data: serializeSale(sale) }, { status: 201 });
}
