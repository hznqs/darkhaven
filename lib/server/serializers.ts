import type { Customer, Lead, LeadStatus, Order, Payment, PostSale, Product } from "@/lib/types";

type CustomerRecord = {
  id: string;
  name: string;
  whatsapp: string;
  email?: string | null;
  address?: string | null;
  city: string | null;
  state?: string | null;
  notes?: string | null;
  totalSpent: unknown;
  status: string;
  tags: string[];
  updatedAt?: Date;
  purchaseHistory?: Array<{
    id: string;
    saleId: string;
    purchasedAt: Date;
    expiresAt: Date;
    summary: string;
    total: unknown;
    sale?: { saleNumber?: number } | null;
  }>;
  sales?: Array<{
    id: string;
    saleNumber: number;
    createdAt: Date;
    status: string;
    total: unknown;
    items: Array<{ productNameSnapshot: string; product?: { name: string } | null }>;
  }>;
  orders?: Array<{
    id: string;
    orderNumber: number;
    createdAt: Date;
    status: Order["status"];
    total: unknown;
  }>;
  postSales?: Array<{
    id: string;
    type: PostSale["type"];
    status: PostSale["status"];
    priority: PostSale["priority"];
    createdAt: Date;
  }>;
};

type LeadRecord = {
  id: string;
  name: string;
  whatsapp: string;
  origin: string;
  status: string;
  notes?: string | null;
  convertedCustomerId?: string | null;
  convertedAt?: Date | null;
  updatedAt: Date;
};

type ProductRecord = {
  id: string;
  name: string;
  category: string;
  price: unknown;
  cost: unknown;
  imageUrl: string | null;
  colors: string[];
  sizes: string[];
  active: boolean;
  sku: string | null;
  description: string | null;
};

type OrderRecord = {
  id: string;
  orderNumber: number;
  status: Order["status"];
  total: unknown;
  createdAt: Date;
  saleId: string;
  customer: { name: string; address?: string | null; city?: string | null; state?: string | null };
  sale: { id: string; channel: string; saleNumber?: number };
  items: { product: { name: string } }[];
};

type PaymentRecord = {
  id: string;
  method: string;
  amount: unknown;
  status: string;
  createdAt: Date;
  sale: {
    id: string;
    saleNumber?: number;
    customer: { id: string; name: string };
  };
};

type PostSaleRecord = {
  id: string;
  type: PostSale["type"];
  status: PostSale["status"];
  priority: PostSale["priority"];
  notes: string | null;
  customerFeedback: string | null;
  resolution: string | null;
  nextActionAt: Date | null;
  createdAt: Date;
  orderId: string | null;
  order?: { orderNumber?: number } | null;
  saleId: string | null;
  sale?: { saleNumber?: number } | null;
  customer: { name: string; whatsapp: string };
  responsibleUser?: { name: string } | null;
};

export function serializeCustomer(customer: CustomerRecord): Customer {
  return {
    id: customer.id,
    name: customer.name,
    whatsapp: customer.whatsapp,
    email: customer.email ?? undefined,
    address: customer.address ?? undefined,
    city: customer.city ?? "",
    state: customer.state ?? undefined,
    notes: customer.notes ?? undefined,
    totalSpent: Number(customer.totalSpent),
    status: mapCustomerStatus(customer.status),
    tags: customer.tags,
    lastPurchase: (customer.updatedAt ?? new Date()).toISOString(),
    recentPurchases: customer.purchaseHistory?.map((purchase) => ({
      id: purchase.id,
      saleId: purchase.saleId,
      saleNumber: purchase.sale?.saleNumber,
      purchasedAt: purchase.purchasedAt.toISOString(),
      expiresAt: purchase.expiresAt.toISOString(),
      summary: purchase.summary,
      total: Number(purchase.total)
    })),
    relatedSales: customer.sales?.map((sale) => ({
      id: sale.id,
      saleNumber: sale.saleNumber,
      createdAt: sale.createdAt.toISOString(),
      status: sale.status as NonNullable<Customer["relatedSales"]>[number]["status"],
      total: Number(sale.total),
      items: sale.items.map((item) => item.productNameSnapshot || item.product?.name || "Produto removido")
    })),
    relatedOrders: customer.orders?.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      total: Number(order.total)
    })),
    relatedPostSales: customer.postSales?.map((item) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      priority: item.priority,
      createdAt: item.createdAt.toISOString()
    }))
  };
}

export function serializeLead(lead: LeadRecord): Lead {
  return {
    id: lead.id,
    name: lead.name,
    whatsapp: lead.whatsapp,
    origin: lead.origin,
    status: mapLeadStatus(lead.status),
    statusKey: mapLeadStatusKey(lead.status),
    notes: lead.notes ?? undefined,
    convertedCustomerId: lead.convertedCustomerId ?? undefined,
    convertedAt: lead.convertedAt?.toISOString() ?? undefined,
    value: 0,
    lastContact: lead.updatedAt.toLocaleDateString("pt-BR")
  };
}

export function serializeProduct(product: ProductRecord): Product {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: Number(product.price),
    cost: Number(product.cost),
    imageUrl: product.imageUrl,
    colors: product.colors,
    sizes: product.sizes,
    active: product.active,
    sku: product.sku,
    description: product.description ?? ""
  };
}

export function serializeOrder(order: OrderRecord): Order {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    saleId: order.saleId,
    saleNumber: order.sale.saleNumber,
    customer: order.customer.name,
    customerAddress: order.customer.address,
    customerCity: order.customer.city,
    customerState: order.customer.state,
    channel: order.sale.channel,
    total: Number(order.total),
    status: order.status,
    items: order.items.map((item) => item.product.name),
    date: order.createdAt.toISOString()
  };
}

export function serializePayment(payment: PaymentRecord): Payment {
  return {
    id: payment.id,
    saleId: payment.sale.id,
    saleNumber: payment.sale.saleNumber,
    customerId: payment.sale.customer.id,
    customer: payment.sale.customer.name,
    method: mapPaymentMethod(payment.method),
    amount: Number(payment.amount),
    status: mapPaymentStatus(payment.status),
    date: payment.createdAt.toISOString()
  };
}

export function serializePostSale(item: PostSaleRecord): PostSale {
  return {
    id: item.id,
    customer: item.customer.name,
    whatsapp: item.customer.whatsapp,
    orderId: item.orderId ?? undefined,
    orderNumber: item.order?.orderNumber,
    saleId: item.saleId ?? undefined,
    saleNumber: item.sale?.saleNumber,
    type: item.type,
    status: item.status,
    priority: item.priority,
    notes: item.notes ?? "",
    customerFeedback: item.customerFeedback ?? undefined,
    resolution: item.resolution ?? undefined,
    responsible: item.responsibleUser?.name ?? "Admin DarkHaven",
    nextActionAt: (item.nextActionAt ?? item.createdAt).toISOString(),
    createdAt: item.createdAt.toISOString(),
    overdue: item.status !== "RESOLVED" && item.nextActionAt ? item.nextActionAt.getTime() < Date.now() : false
  };
}

function mapCustomerStatus(status: string): Customer["status"] {
  const normalized = status.toLowerCase();
  if (normalized.includes("vip")) return "VIP";
  if (normalized.includes("recorr")) return "Recorrente";
  if (normalized.includes("inativ") || normalized.includes("inactive")) return "Inativo";
  if (normalized.includes("novo")) return "Novo";
  return "Ativo";
}

function mapLeadStatus(status: string) {
  const labels: Record<string, string> = {
    NEW: "Novo",
    IN_PROGRESS: "Em atendimento",
    INTERESTED: "Interessado",
    WAITING_REPLY: "Aguardando resposta",
    CLOSED_WON: "Fechou compra",
    CLOSED_LOST: "Perdido"
  };
  return labels[status] ?? status;
}

function mapLeadStatusKey(status: string): LeadStatus {
  const statuses = new Set<LeadStatus>(["NEW", "IN_PROGRESS", "INTERESTED", "WAITING_REPLY", "CLOSED_WON", "CLOSED_LOST"]);
  return statuses.has(status as LeadStatus) ? status as LeadStatus : "NEW";
}

function mapPaymentStatus(status: string): Payment["status"] {
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "REFUNDED") return "Estornado";
  if (status === "CANCELED") return "Cancelado";
  return "Pendente";
}

function mapPaymentMethod(method: string): Payment["method"] {
  if (method === "CREDIT_CARD" || method === "DEBIT_CARD") return "Cartão";
  if (method === "BOLETO") return "Boleto";
  if (method === "CASH") return "Dinheiro";
  return "Pix";
}
