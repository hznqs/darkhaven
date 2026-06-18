import type { PaymentMethod, Prisma, SaleStatus } from "@prisma/client";
import type { SaleDetail, SalesSummaryData, SaleSummary } from "@/lib/types";
import { prisma } from "@/lib/server/prisma";
import { readWithRetry } from "@/lib/server/read-retry";

const chartColors = ["#f4f2ec", "#9aa1a9", "#5b7567", "#d8b15d", "#8f1d1d", "#71717a"];
const saleStatuses = new Set(["DRAFT", "WAITING_PAYMENT", "CONFIRMED", "CANCELED"]);
const paymentMethods = new Set(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO", "CASH"]);
const businessTimeZone = "America/Sao_Paulo";
const saoPauloUtcOffsetHours = 3;
const businessDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: businessTimeZone,
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

type SaleRecord = {
  id: string;
  saleNumber: number;
  channel: string;
  status: SaleStatus;
  subtotal: unknown;
  discount: unknown;
  total: unknown;
  estimatedCost?: unknown;
  estimatedProfit?: unknown;
  estimatedMargin?: unknown;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    whatsapp: string;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    notes?: string | null;
    status?: string;
  };
  items: Array<{
    productId: string;
    productNameSnapshot: string;
    productSkuSnapshot?: string | null;
    productCategorySnapshot?: string | null;
    unitPriceSnapshot?: unknown;
    unitCostSnapshot?: unknown;
    selectedColor?: string | null;
    selectedSize?: string | null;
    estimatedUnitCost?: unknown;
    discount: unknown;
    customizationNotes?: string | null;
    quantity: number;
    unitPrice: unknown;
    subtotal: unknown;
    product?: {
      name: string;
      category: string;
      sku?: string | null;
    };
  }>;
  payments: Array<{
    id: string;
    method: PaymentMethod;
    amount: unknown;
    status: string;
    paidAt?: Date | null;
    reason?: string | null;
    createdAt: Date;
  }>;
  orders: Array<{
    id: string;
    orderNumber?: number;
    status: string;
    createdAt: Date;
  }>;
  postSales: Array<{
    id: string;
    type: string;
    status: string;
    priority: string;
  }>;
};

export function buildSaleWhere(searchParams: URLSearchParams) {
  const where: Prisma.SaleWhereInput = {};
  const startDate = parseDate(searchParams.get("startDate"));
  const endDate = parseDate(searchParams.get("endDate"), true);
  const status = searchParams.get("status");
  const channel = searchParams.get("channel");
  const paymentMethod = searchParams.get("paymentMethod");
  const customerId = searchParams.get("customerId");
  const productId = searchParams.get("productId");
  const search = searchParams.get("search")?.trim();

  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {})
    };
  }
  if (status && saleStatuses.has(status)) where.status = status as SaleStatus;
  if (channel) where.channel = channel;
  if (paymentMethod && paymentMethods.has(paymentMethod)) {
    where.payments = { some: { method: paymentMethod as PaymentMethod } };
  }
  if (customerId) where.customerId = customerId;
  if (productId) where.items = { some: { productId } };
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { items: { some: { productNameSnapshot: { contains: search, mode: "insensitive" } } } }
    ];
  }

  return where;
}

export async function findSales(where: Prisma.SaleWhereInput) {
  return prisma.sale.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 250,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          whatsapp: true,
          email: true,
          address: true,
          city: true,
          state: true,
          notes: true,
          status: true
        }
      },
      items: {
        include: {
          product: { select: { name: true, category: true, sku: true } }
        }
      },
      payments: { orderBy: { createdAt: "desc" } },
      orders: { orderBy: { createdAt: "desc" }, select: { id: true, orderNumber: true, status: true, createdAt: true } },
      postSales: { select: { id: true, type: true, status: true, priority: true } }
    }
  });
}

export function serializeSale(sale: SaleRecord): SaleSummary {
  const payment = sale.payments[0];
  const order = sale.orders[0];
  const fallbackEstimatedCost = sale.items.reduce((sum, item) => {
    const unitCost = item.unitCostSnapshot === null || item.unitCostSnapshot === undefined
      ? Number(item.estimatedUnitCost ?? 0)
      : Number(item.unitCostSnapshot);
    return sum + unitCost * item.quantity;
  }, 0);
  const total = Number(sale.total);
  const estimatedCost = sale.estimatedCost === null || sale.estimatedCost === undefined ? fallbackEstimatedCost : Number(sale.estimatedCost);
  const estimatedProfit = sale.estimatedProfit === null || sale.estimatedProfit === undefined ? total - estimatedCost : Number(sale.estimatedProfit);
  const estimatedMargin = sale.estimatedMargin === null || sale.estimatedMargin === undefined
    ? total ? (estimatedProfit / total) * 100 : 0
    : Number(sale.estimatedMargin) * 100;

  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    shortId: String(sale.saleNumber),
    customer: sale.customer?.name ?? "Cliente não informado",
    customerId: sale.customer?.id ?? "",
    customerWhatsapp: sale.customer?.whatsapp ?? "",
    channel: sale.channel,
    status: sale.status,
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    total,
    ticket: total,
    estimatedCost,
    estimatedProfit,
    estimatedMargin,
    createdAt: sale.createdAt.toISOString(),
    payment: payment
      ? {
          id: payment.id,
          method: mapPaymentMethod(payment.method),
          status: mapPaymentStatus(payment.status),
          amount: Number(payment.amount),
          paidAt: payment.paidAt?.toISOString(),
          reason: payment.reason ?? undefined
        }
      : undefined,
    order: order
        ? {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status as NonNullable<SaleSummary["order"]>["status"],
          createdAt: order.createdAt.toISOString()
        }
      : undefined,
    postSales: sale.postSales.map((item) => ({
      id: item.id,
      type: item.type as SaleSummary["postSales"][number]["type"],
      status: item.status as SaleSummary["postSales"][number]["status"],
      priority: item.priority as SaleSummary["postSales"][number]["priority"]
    })),
    items: sale.items.map((item) => ({
      productId: item.productId,
      productName: item.productNameSnapshot || item.product?.name || "Produto removido",
      productSku: item.productSkuSnapshot ?? item.product?.sku,
      category: item.productCategorySnapshot ?? item.product?.category,
      quantity: item.quantity,
      unitPrice: item.unitPriceSnapshot === null || item.unitPriceSnapshot === undefined ? Number(item.unitPrice) : Number(item.unitPriceSnapshot),
      selectedColor: item.selectedColor,
      selectedSize: item.selectedSize,
      discount: Number(item.discount),
      subtotal: Number(item.subtotal),
      estimatedUnitCost: item.unitCostSnapshot === null || item.unitCostSnapshot === undefined
        ? item.estimatedUnitCost === null || item.estimatedUnitCost === undefined ? undefined : Number(item.estimatedUnitCost)
        : Number(item.unitCostSnapshot),
      customizationNotes: item.customizationNotes
    }))
  };
}

export function serializeSaleDetail(sale: SaleRecord): SaleDetail {
  return {
    ...serializeSale(sale),
    customerEmail: sale.customer?.email,
    customerAddress: sale.customer?.address,
    customerCity: sale.customer?.city,
    customerState: sale.customer?.state,
    customerNotes: sale.customer?.notes,
    customerStatus: "Ativo",
    responsible: "Admin DarkHaven"
  };
}

export async function getSalesSummary(where: Prisma.SaleWhereInput, searchParams: URLSearchParams): Promise<SalesSummaryData> {
  const now = new Date();
  const todayParts = getBusinessDateParts(now);
  const startOfToday = businessDateToUtcStart(todayParts.year, todayParts.month, todayParts.day);
  const todayLocalDate = businessLocalDate(todayParts.year, todayParts.month, todayParts.day);
  const startOfWeekLocalDate = new Date(todayLocalDate);
  startOfWeekLocalDate.setUTCDate(todayLocalDate.getUTCDate() - todayLocalDate.getUTCDay());
  const startOfWeek = businessDateToUtcStart(startOfWeekLocalDate.getUTCFullYear(), startOfWeekLocalDate.getUTCMonth() + 1, startOfWeekLocalDate.getUTCDate());
  const startOfMonth = businessDateToUtcStart(todayParts.year, todayParts.month, 1);
  const periodWhere = {
    ...where,
    createdAt: {
      gte: parseDate(searchParams.get("startDate")) ?? startOfMonth,
      lte: parseDate(searchParams.get("endDate"), true) ?? now
    }
  };

  const [todaySales, weekSales, monthSales] = await Promise.all([
    readWithRetry(() => prisma.sale.findMany({ where: { createdAt: { gte: startOfToday }, status: "CONFIRMED" }, select: { total: true } })),
    readWithRetry(() => prisma.sale.findMany({ where: { createdAt: { gte: startOfWeek }, status: "CONFIRMED" }, select: { total: true } })),
    readWithRetry(() => prisma.sale.findMany({ where: { createdAt: { gte: startOfMonth }, status: "CONFIRMED" }, select: { total: true } }))
  ]);
  const periodSales = await readWithRetry(() =>
    prisma.sale.findMany({
      where: periodWhere,
      include: { payments: true },
      orderBy: { createdAt: "asc" }
    })
  );

  const activeRevenueSales = periodSales.filter((sale) => sale.status === "CONFIRMED");
  const revenuePeriod = activeRevenueSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const confirmedSales = activeRevenueSales.length;
  const refundedSales = periodSales.filter((sale) => sale.payments.some((payment) => payment.status === "REFUNDED")).length;
  const canceledSales = periodSales.filter((sale) => sale.status === "CANCELED").length;
  const pendingSales = periodSales.filter((sale) => sale.status === "WAITING_PAYMENT").length;
  const metricSales = activeRevenueSales;
  const totalValueInFilter = metricSales.reduce((sum, sale) => sum + Number(sale.total), 0);

  return {
    salesToday: todaySales.length,
    salesTodayValue: sumSaleTotals(todaySales),
    salesWeek: weekSales.length,
    salesWeekValue: sumSaleTotals(weekSales),
    salesMonth: monthSales.length,
    salesMonthValue: sumSaleTotals(monthSales),
    totalSalesInFilter: metricSales.length,
    totalValueInFilter,
    averageTicketGeneral: metricSales.length ? totalValueInFilter / metricSales.length : 0,
    revenuePeriod,
    averageTicket: confirmedSales ? revenuePeriod / confirmedSales : 0,
    pendingSales,
    confirmedSales,
    refundedSales,
    canceledSales,
    salesByDay: groupByDay(metricSales.map((sale) => ({ date: sale.createdAt, value: 1 }))),
    revenueByDay: groupByDay(activeRevenueSales.map((sale) => ({ date: sale.createdAt, value: Number(sale.total) }))),
    averageTicketByDay: groupAverageTicketByDay(activeRevenueSales.map((sale) => ({ date: sale.createdAt, value: Number(sale.total) }))),
    salesByChannel: groupByLabel(periodSales.map((sale) => ({ label: sale.channel, value: 1 }))),
    salesByStatus: groupByLabel(periodSales.map((sale) => ({ label: sale.status, value: 1 })))
  };
}

function sumSaleTotals(sales: Array<{ total: unknown }>) {
  return sales.reduce((sum, sale) => sum + Number(sale.total), 0);
}

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return endOfDay ? businessDateToUtcEnd(year, month, day) : businessDateToUtcStart(year, month, day);
}

function groupByDay(points: { date: Date; value: number }[]) {
  const map = new Map<string, number>();
  for (const point of points) {
    const day = formatBusinessDayKey(point.date);
    map.set(day, (map.get(day) ?? 0) + point.value);
  }
  return Array.from(map.entries()).map(([day, value]) => ({ day: day.slice(5), value }));
}

function groupAverageTicketByDay(points: { date: Date; value: number }[]) {
  const map = new Map<string, { total: number; count: number }>();
  for (const point of points) {
    const day = formatBusinessDayKey(point.date);
    const current = map.get(day) ?? { total: 0, count: 0 };
    current.total += point.value;
    current.count += 1;
    map.set(day, current);
  }
  return Array.from(map.entries()).map(([day, value]) => ({ day: day.slice(5), value: value.count ? value.total / value.count : 0 }));
}

function getBusinessDateParts(date: Date) {
  const parts = Object.fromEntries(
    businessDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  ) as { day: string; month: string; year: string };

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
}

function formatBusinessDayKey(date: Date) {
  const parts = getBusinessDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function businessLocalDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function businessDateToUtcStart(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, saoPauloUtcOffsetHours, 0, 0, 0));
}

function businessDateToUtcEnd(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day + 1, saoPauloUtcOffsetHours, 0, 0, -1));
}

function groupByLabel(points: { label: string; value: number }[]) {
  const map = new Map<string, number>();
  for (const point of points) map.set(point.label, (map.get(point.label) ?? 0) + point.value);
  return Array.from(map.entries()).map(([name, value], index) => ({ name: formatStatus(name), value, fill: chartColors[index % chartColors.length] }));
}

function mapPaymentStatus(status: string) {
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "REFUNDED") return "Estornado";
  return "Pendente";
}

function mapPaymentMethod(method: PaymentMethod) {
  if (method === "CREDIT_CARD" || method === "DEBIT_CARD") return "Cartão";
  if (method === "BOLETO") return "Boleto";
  if (method === "CASH") return "Dinheiro";
  return "Pix";
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Rascunho",
    WAITING_PAYMENT: "Aguardando pagamento",
    CONFIRMED: "Confirmada",
    CANCELED: "Cancelada"
  };
  return labels[status] ?? status;
}
