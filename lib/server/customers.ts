import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { readWithRetry } from "@/lib/server/read-retry";

const paidCustomerSaleWhere = {
  status: "CONFIRMED",
  payments: { some: { status: "CONFIRMED" } }
} satisfies Prisma.SaleWhereInput;

export async function getPaidTotalByCustomerId(customerId: string) {
  const result = await readWithRetry(() =>
    prisma.sale.aggregate({
      where: {
        ...paidCustomerSaleWhere,
        customerId
      },
      _sum: { total: true }
    })
  );

  return Number(result._sum.total ?? 0);
}

export async function getPaidTotalsByCustomerIds(customerIds: string[]) {
  const uniqueCustomerIds = Array.from(new Set(customerIds));
  if (uniqueCustomerIds.length === 0) return new Map<string, number>();

  const totals = await readWithRetry(() =>
    prisma.sale.groupBy({
      by: ["customerId"],
      where: {
        ...paidCustomerSaleWhere,
        customerId: { in: uniqueCustomerIds }
      },
      _sum: { total: true }
    })
  );

  return new Map(totals.map((item) => [item.customerId, Number(item._sum.total ?? 0)]));
}

