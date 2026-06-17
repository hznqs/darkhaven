type PurchaseHistoryItem = {
  productNameSnapshot: string;
  quantity: number;
};

export function getPurchaseHistoryWindow(purchasedAt = new Date()) {
  const expiresAt = new Date(purchasedAt);
  expiresAt.setDate(expiresAt.getDate() + 30);
  return { purchasedAt, expiresAt };
}

export function buildPurchaseHistorySummary(saleNumber: number, items: PurchaseHistoryItem[]) {
  const itemSummary = items
    .map((item) => `${item.quantity}x ${item.productNameSnapshot}`)
    .join(", ");

  return `Venda #${saleNumber} - ${itemSummary || "Sem itens"}`.slice(0, 500);
}

export function validPurchaseHistoryWhere(now = new Date()) {
  return { expiresAt: { gt: now } };
}
