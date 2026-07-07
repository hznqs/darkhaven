import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/security";
import { safeErrorResponse, warnInDevelopment } from "@/lib/server/errors";
import { businessDateToUtcStart, businessDateToUtcEnd } from "@/lib/server/sales";

function brlCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2
  });
}

function brl(value: number | string | undefined) {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return brlCents(Math.round(num * 100));
}

function escapeCSV(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(...cells: (string | number | undefined | null)[]) {
  return cells.map(escapeCSV).join(",");
}

const methodLabels: Record<string, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BOLETO: "Boleto",
  CASH: "Dinheiro"
};

const statusLabels: Record<string, string> = {
  WAITING_PAYMENT: "Aguardando pagamento",
  CONFIRMED: "Confirmada",
  CANCELED: "Cancelada",
  DRAFT: "Rascunho"
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = { status: "CONFIRMED" };
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) {
      const [y, m, d] = startDate.split("-").map(Number);
      if (y && m && d) dateFilter.gte = businessDateToUtcStart(y, m, d);
    }
    if (endDate) {
      const [y, m, d] = endDate.split("-").map(Number);
      if (y && m && d) dateFilter.lte = businessDateToUtcEnd(y, m, d);
    }
    where.createdAt = dateFilter;
  }

  try {
    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        saleNumber: true,
        createdAt: true,
        status: true,
        channel: true,
        subtotal: true,
        discount: true,
        total: true,
        estimatedCost: true,
        estimatedProfit: true,
        estimatedMargin: true,
        customer: { select: { name: true, whatsapp: true, email: true } },
        payments: {
          select: { method: true, status: true, amount: true, paidAt: true },
          take: 1,
          orderBy: { createdAt: "desc" }
        },
        items: {
          select: { productNameSnapshot: true, quantity: true, unitPrice: true, subtotal: true }
        }
      }
    });

    const lines: string[] = [];

    // BOM for Excel UTF-8
    const BOM = "\uFEFF";

    // Header
    lines.push(row(
      "Venda",
      "Data",
      "Status",
      "Canal",
      "Cliente",
      "WhatsApp",
      "E-mail",
      "Subtotal",
      "Desconto",
      "Total",
      "Custo Est.",
      "Lucro Est.",
      "Margem Est. (%)",
      "Pagamento",
      "Status Pagamento",
      "Data Pagamento",
      "Produtos"
    ));

    for (const sale of sales) {
      const payment = sale.payments[0];
      const products = sale.items.map((i) => `${i.quantity}x ${i.productNameSnapshot}`).join("; ");
      lines.push(row(
        `#${sale.saleNumber}`,
        sale.createdAt.toLocaleDateString("pt-BR"),
        statusLabels[sale.status] ?? sale.status,
        sale.channel,
        sale.customer.name,
        sale.customer.whatsapp,
        sale.customer.email ?? "",
        brl(Number(sale.subtotal)),
        brl(Number(sale.discount)),
        brl(Number(sale.total)),
        brl(Number(sale.estimatedCost)),
        brl(Number(sale.estimatedProfit)),
        (Number(sale.estimatedMargin) * 100).toFixed(2),
        payment ? methodLabels[payment.method] ?? payment.method : "Sem pagamento",
        payment?.status ?? "",
        payment?.paidAt ? payment.paidAt.toLocaleDateString("pt-BR") : "",
        products
      ));
    }

    const csv = BOM + lines.join("\r\n");
    const period = startDate && endDate ? `_${startDate}_${endDate}` : "";
    const filename = `darkhaven_financeiro${period}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    warnInDevelopment("Finance Export GET", error);
    return safeErrorResponse("Erro ao gerar exportação financeira.");
  }
}
