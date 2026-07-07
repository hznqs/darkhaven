import { prisma } from "@/lib/server/prisma";
import { readWithRetry } from "@/lib/server/read-retry";
import { businessStartOfToday, businessStartOfWeek, businessStartOfMonth, formatBusinessDayKey } from "@/lib/server/sales";

const channelColors = ["#f4f2ec", "#9aa1a9", "#5b7567", "#d8b15d", "#8f1d1d"];

export async function getDashboardData() {
  const startOfToday = businessStartOfToday();
  const startOfWeek = businessStartOfWeek();
  const startOfMonth = businessStartOfMonth();
  const [
    confirmedSales,
    payments,
    postSales,
    productionOrders,
    pendingPayments,
    inactiveCustomers,
    customers,
    leads,
    salesToday,
    salesWeek,
    salesMonth
  ] = await Promise.all([
    readWithRetry(() =>
      prisma.sale.findMany({
        where: { status: "CONFIRMED" },
        select: {
          total: true,
          estimatedCost: true,
          channel: true,
          items: { select: { estimatedUnitCost: true, unitCostSnapshot: true, quantity: true } }
        }
      })
    ),
    readWithRetry(() =>
      prisma.payment.findMany({
        where: { status: "CONFIRMED" },
        select: { amount: true, createdAt: true }
      })
    ),
    readWithRetry(() => prisma.postSale.count({ where: { status: { not: "RESOLVED" } } })),
    readWithRetry(() => prisma.order.count({ where: { status: "IN_PRODUCTION" } })),
    readWithRetry(() => prisma.payment.count({ where: { status: "PENDING" } })),
    readWithRetry(() => prisma.customer.count({ where: { status: { contains: "inactive", mode: "insensitive" } } })),
    readWithRetry(() => prisma.customer.count()),
    readWithRetry(() => prisma.lead.count()),
    readWithRetry(() => prisma.sale.count({ where: { createdAt: { gte: startOfToday }, status: { not: "CANCELED" } } })),
    readWithRetry(() => prisma.sale.count({ where: { createdAt: { gte: startOfWeek }, status: { not: "CANCELED" } } })),
    readWithRetry(() => prisma.sale.count({ where: { createdAt: { gte: startOfMonth }, status: { not: "CANCELED" } } }))
  ]);

  const revenue = confirmedSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const sales = confirmedSales.length;
  const estimatedCost = confirmedSales.reduce((sum, sale) => sum + saleEstimatedCost(sale), 0);
  const estimatedProfit = revenue - estimatedCost;

  return {
    kpis: {
      revenue,
      sales,
      salesToday,
      salesWeek,
      salesMonth,
      averageTicket: sales ? revenue / sales : 0,
      estimatedProfit,
      customers,
      leads,
      postSales,
      reactivationCustomers: inactiveCustomers,
      productionOrders,
      pendingPayments
    },
    revenueByDay: groupRevenueByDay(payments.map((payment) => ({ date: payment.createdAt, value: Number(payment.amount) }))),
    revenueByChannel: groupByLabel(
      confirmedSales.map((sale) => ({
        label: sale.channel,
        value: Number(sale.total)
      }))
    )
  };
}

export async function getFinanceData() {
  const [confirmedSales, confirmedPayments, refundedTotal, pendingTotal] = await Promise.all([
    readWithRetry(() =>
      prisma.sale.findMany({
        where: { status: "CONFIRMED" },
        select: {
          total: true,
          estimatedCost: true,
          items: { select: { estimatedUnitCost: true, unitCostSnapshot: true, quantity: true } }
        }
      })
    ),
    readWithRetry(() =>
      prisma.payment.findMany({
        where: { status: "CONFIRMED" },
        select: { amount: true, createdAt: true, method: true }
      })
    ),
    readWithRetry(() => prisma.payment.aggregate({ where: { status: "REFUNDED" }, _sum: { amount: true } })),
    readWithRetry(() => prisma.payment.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }))
  ]);

  const revenue = confirmedSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const estimatedCost = confirmedSales.reduce((sum, sale) => sum + saleEstimatedCost(sale), 0);
  const estimatedProfit = revenue - estimatedCost;
  const refunds = Number(refundedTotal._sum.amount ?? 0);
  const pendingPayments = Number(pendingTotal._sum.amount ?? 0);

  return {
    summary: {
      revenue,
      estimatedCost,
      estimatedProfit,
      estimatedMargin: revenue ? (estimatedProfit / revenue) * 100 : 0,
      pendingPayments,
      refunds,
      averageTicket: confirmedSales.length ? revenue / confirmedSales.length : 0
    },
    revenue: groupRevenueByDay(confirmedPayments.map((payment) => ({ date: payment.createdAt, value: Number(payment.amount) }))),
    paymentMethods: groupByLabel(
      confirmedPayments.map((payment) => ({
        label: payment.method,
        value: Number(payment.amount)
      }))
    )
  };
}

export function groupRevenueByDay(points: { date: Date; value: number }[]) {
  const map = new Map<string, number>();
  for (const point of points) {
    const day = formatBusinessDayKey(point.date);
    map.set(day, (map.get(day) ?? 0) + point.value);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ day: day.slice(5), value }));
}

export function groupByLabel(points: { label: string; value: number }[]) {
  const map = new Map<string, number>();
  const total = points.reduce((sum, point) => sum + point.value, 0);
  for (const point of points) {
    map.set(point.label, (map.get(point.label) ?? 0) + point.value);
  }

  return Array.from(map.entries()).map(([name, value], index) => ({
    name: formatMethod(name),
    value: total ? Math.round((value / total) * 100) : 0,
    fill: channelColors[index % channelColors.length]
  }));
}

function formatMethod(value: string) {
  const labels: Record<string, string> = {
    PIX: "Pix",
    CREDIT_CARD: "Cartão crédito",
    DEBIT_CARD: "Cartão débito",
    BOLETO: "Boleto",
    CASH: "Dinheiro"
  };
  return labels[value] ?? value;
}

function saleEstimatedCost(sale: { estimatedCost?: unknown; items: { estimatedUnitCost?: unknown; unitCostSnapshot?: unknown; quantity: number }[] }) {
  if (sale.estimatedCost !== null && sale.estimatedCost !== undefined) {
    return Number(sale.estimatedCost);
  }

  return sale.items.reduce((itemSum, item) => {
    const unitCost = item.unitCostSnapshot === null || item.unitCostSnapshot === undefined
      ? Number(item.estimatedUnitCost ?? 0)
      : Number(item.unitCostSnapshot);
    return itemSum + unitCost * item.quantity;
  }, 0);
}
