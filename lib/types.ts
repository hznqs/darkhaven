export type ModuleKey =
  | "dashboard"
  | "clients"
  | "leads"
  | "products"
  | "sales"
  | "orders"
  | "payments"
  | "finance"
  | "post-sales"
  | "settings";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  active: boolean;
  isOwnerAdmin: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
};

export type Customer = {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  address?: string;
  city: string;
  state?: string;
  notes?: string;
  totalSpent: number;
  status: "Ativo" | "Recorrente" | "VIP" | "Novo" | "Inativo";
  tags: string[];
  lastPurchase: string;
  recentPurchases?: CustomerRecentPurchase[];
  relatedSales?: CustomerRelatedSale[];
  relatedOrders?: CustomerRelatedOrder[];
  relatedPostSales?: CustomerRelatedPostSale[];
};

export type CustomerRecentPurchase = {
  id: string;
  saleId: string;
  saleNumber?: number;
  purchasedAt: string;
  expiresAt: string;
  summary: string;
  total: number;
};

export type CustomerRelatedSale = {
  id: string;
  saleNumber: number;
  createdAt: string;
  status: SaleSummary["status"];
  total: number;
  items: string[];
};

export type CustomerRelatedOrder = {
  id: string;
  orderNumber: number;
  createdAt: string;
  status: OrderStatus;
  total: number;
};

export type CustomerRelatedPostSale = {
  id: string;
  type: PostSaleType;
  status: PostSaleStatus;
  priority: Priority;
  createdAt: string;
};

export type Lead = {
  id: string;
  name: string;
  whatsapp: string;
  origin: string;
  status: string;
  statusKey?: LeadStatus;
  notes?: string | null;
  convertedCustomerId?: string | null;
  convertedAt?: string | null;
  value: number;
  lastContact: string;
};

export type LeadStatus =
  | "NEW"
  | "IN_PROGRESS"
  | "INTERESTED"
  | "WAITING_REPLY"
  | "CLOSED_WON"
  | "CLOSED_LOST";

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  imageUrl?: string | null;
  colors: string[];
  sizes: string[];
  active: boolean;
  available: boolean;
  sku?: string | null;
  description: string;
};

export type OrderStatus =
  | "NEW"
  | "WAITING_PAYMENT"
  | "PAID"
  | "IN_PRODUCTION"
  | "SEPARATION"
  | "SENT"
  | "DELIVERED"
  | "CANCELED";

export type Order = {
  id: string;
  orderNumber: number;
  saleId?: string;
  saleNumber?: number;
  customer: string;
  customerAddress?: string | null;
  customerCity?: string | null;
  customerState?: string | null;
  channel: string;
  total: number;
  status: OrderStatus;
  items: string[];
  date: string;
};

export type PaymentStatus = "Pendente" | "Confirmado" | "Estornado" | "Cancelado";

export type Payment = {
  id: string;
  saleId: string;
  saleNumber?: number;
  customerId: string;
  customer: string;
  method: "Pix" | "Cartão" | "Boleto" | "Dinheiro";
  amount: number;
  status: PaymentStatus;
  date: string;
};

export type SaleSummary = {
  id: string;
  saleNumber: number;
  shortId: string;
  customer: string;
  customerId: string;
  customerWhatsapp: string;
  channel: string;
  status: "DRAFT" | "WAITING_PAYMENT" | "CONFIRMED" | "CANCELED";
  subtotal: number;
  discount: number;
  total: number;
  ticket: number;
  estimatedCost: number;
  estimatedProfit: number;
  estimatedMargin: number;
  createdAt: string;
  payment?: {
    id: string;
    method: Payment["method"];
    status: PaymentStatus;
    amount: number;
    paidAt?: string;
    reason?: string;
  };
  order?: {
    id: string;
    orderNumber?: number;
    status: OrderStatus;
    createdAt: string;
  };
  postSales: {
    id: string;
    type: PostSaleType;
    status: PostSaleStatus;
    priority: Priority;
  }[];
  items: {
    productId: string;
    productName: string;
    productSku?: string | null;
    category?: string;
    quantity: number;
    unitPrice: number;
    selectedColor?: string | null;
    selectedSize?: string | null;
    discount: number;
    subtotal: number;
    estimatedUnitCost?: number;
    customizationNotes?: string | null;
  }[];
};

export type SalesSummaryData = {
  salesToday: number;
  salesTodayValue: number;
  salesWeek: number;
  salesWeekValue: number;
  salesMonth: number;
  salesMonthValue: number;
  totalSalesInFilter: number;
  totalValueInFilter: number;
  averageTicketGeneral: number;
  revenuePeriod: number;
  averageTicket: number;
  pendingSales: number;
  confirmedSales: number;
  refundedSales: number;
  canceledSales: number;
  salesByDay: { day: string; value: number }[];
  revenueByDay: { day: string; value: number }[];
  averageTicketByDay: { day: string; value: number }[];
  salesByChannel: { name: string; value: number; fill: string }[];
  salesByStatus: { name: string; value: number; fill: string }[];
};

export type SaleDetail = SaleSummary & {
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerCity?: string | null;
  customerState?: string | null;
  customerNotes?: string | null;
  customerStatus?: Customer["status"];
  responsible: string;
};

export type DashboardData = {
  kpis: {
    revenue: number;
    sales: number;
    salesToday: number;
    salesWeek: number;
    salesMonth: number;
    averageTicket: number;
    estimatedProfit: number;
    customers: number;
    leads: number;
    postSales: number;
    reactivationCustomers: number;
    productionOrders: number;
    pendingPayments: number;
  };
  revenueByDay: { day: string; value: number }[];
  revenueByChannel: { name: string; value: number; fill: string }[];
};

export type FinancePaymentMethod = {
  name: string;
  value: number;
  fill: string;
};

export type FinanceData = {
  summary: {
    revenue: number;
    estimatedCost: number;
    estimatedProfit: number;
    estimatedMargin: number;
    pendingPayments: number;
    refunds: number;
    averageTicket: number;
  };
  revenue: { day: string; value: number }[];
  paymentMethods: FinancePaymentMethod[];
};

export type StoreSettings = {
  id: string;
  storeName: string;
  cnpj?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  theme: string;
  glassMode: boolean;
  updatedAt: string;
};

export type PostSaleType =
  | "FEEDBACK"
  | "COMPLAINT"
  | "EXCHANGE"
  | "RETURN"
  | "REPURCHASE"
  | "REACTIVATION"
  | "FOLLOW_UP";

export type PostSaleStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_CUSTOMER"
  | "RESOLVED"
  | "CANCELED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type PostSale = {
  id: string;
  customer: string;
  whatsapp: string;
  orderId?: string;
  orderNumber?: number;
  saleId?: string;
  saleNumber?: number;
  type: PostSaleType;
  status: PostSaleStatus;
  priority: Priority;
  notes: string;
  customerFeedback?: string;
  resolution?: string;
  responsible: string;
  nextActionAt: string;
  createdAt: string;
  overdue: boolean;
};
