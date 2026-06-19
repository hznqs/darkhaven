"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DndContext, DragOverlay, PointerSensor, closestCenter, pointerWithin, type CollisionDetection, type DragEndEvent, type DragStartEvent, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  BadgeDollarSign,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  Gauge,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  UserX,
  Users,
  X,
  type LucideIcon
} from "lucide-react";
import { brl, shortDate } from "@/lib/format";
import { formatCurrencyBR, formatPhoneBR, normalizePhoneBR, parseCurrencyBR } from "@/lib/masks";
import type {
  AppUser,
  Customer,
  DashboardData,
  FinanceData,
  Lead,
  LeadStatus,
  ModuleKey,
  Order,
  OrderStatus,
  Payment,
  PostSale,
  PostSaleStatus,
  PostSaleType,
  Priority,
  Product,
  SaleDetail,
  SalesSummaryData,
  SaleSummary
} from "@/lib/types";

type NavItem = {
  key: ModuleKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

type ActiveModal =
  | "customer"
  | "customer-detail"
  | "lead"
  | "product"
  | "sale"
  | "payment"
  | "post-sale"
  | "payment-confirm"
  | "payment-refund"
  | "payment-cancel"
  | "user"
  | "order-detail"
  | null;

type SalesFilters = {
  range: "today" | "yesterday" | "7d" | "30d" | "month" | "lastMonth" | "custom";
  startDate: string;
  endDate: string;
  status: string;
  channel: string;
  paymentMethod: string;
  customerId: string;
  productId: string;
  search: string;
};

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

type DataKey =
  | "customers"
  | "leads"
  | "products"
  | "orders"
  | "payments"
  | "sales"
  | "postSales"
  | "dashboard"
  | "finance"
  | "users";

type LoadTarget = ModuleKey | "all";

type LoadTask<T> = {
  key: DataKey;
  url: string;
  apply: (data: T) => void;
};

type RefreshOptions = {
  ignoreCache?: boolean;
};

type SaleDraftItem = {
  id: string;
  productId: string;
  quantity: number;
  selectedColor: string;
  selectedSize: string;
  discount: string;
  customizationNotes: string;
};

type SaleDiscountMode = "AMOUNT" | "PERCENTAGE";

const navItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: Home },
  { key: "clients", label: "Clientes", href: "/clients", icon: Users },
  { key: "leads", label: "Leads", href: "/leads", icon: Sparkles },
  { key: "products", label: "Produtos", href: "/products", icon: Package },
  { key: "sales", label: "Vendas", href: "/sales", icon: ShoppingBag },
  { key: "orders", label: "Pedidos", href: "/orders", icon: ClipboardList },
  { key: "payments", label: "Pagamentos", href: "/payments", icon: CreditCard },
  { key: "finance", label: "Financeiro", href: "/finance", icon: BadgeDollarSign },
  { key: "post-sales", label: "Pós-venda", href: "/post-sales", icon: MessageCircle },
  { key: "settings", label: "Configurações", href: "/settings", icon: Settings }
];

const moduleMeta: Record<ModuleKey, { title: string; eyebrow: string; cta?: string }> = {
  dashboard: { title: "Dashboard", eyebrow: "Bem-vindo de volta, Admin" },
  clients: { title: "Clientes", eyebrow: "Gerencie sua carteira", cta: "Novo Cliente" },
  leads: { title: "Leads", eyebrow: "Pipeline comercial sem campanhas manuais", cta: "Novo Lead" },
  products: { title: "Produtos", eyebrow: "Catálogo sem controle de estoque", cta: "Novo Produto" },
  sales: { title: "Vendas", eyebrow: "Gestão de vendas manuais, pagamentos e pedidos sob demanda", cta: "Nova venda" },
  orders: { title: "Pedidos", eyebrow: "Kanban com atualização segura de status", cta: "Novo Pedido" },
  payments: { title: "Pagamentos", eyebrow: "Confirmação manual e estornos auditáveis", cta: "Novo Pagamento" },
  finance: { title: "Financeiro", eyebrow: "Receita, lucro estimado e margem", cta: "Exportar" },
  "post-sales": { title: "Pós-venda", eyebrow: "Relacionamento, recompra, reclamações e reativação", cta: "Novo Atendimento" },
  settings: { title: "Configurações", eyebrow: "Loja, pagamentos, canais e usuários", cta: "Salvar Alterações" }
};

const orderColumns: { key: OrderStatus; label: string }[] = [
  { key: "NEW", label: "Novo Pedido" },
  { key: "WAITING_PAYMENT", label: "Aguardando Pagamento" },
  { key: "PAID", label: "Pago" },
  { key: "IN_PRODUCTION", label: "Em Produção" },
  { key: "SEPARATION", label: "Separação" },
  { key: "SENT", label: "Enviado" },
  { key: "DELIVERED", label: "Entregue" }
];

const leadColumns: { key: LeadStatus; label: string }[] = [
  { key: "IN_PROGRESS", label: "Qualificado" },
  { key: "CLOSED_WON", label: "Convertido" },
  { key: "CLOSED_LOST", label: "Perdido" },
  { key: "WAITING_REPLY", label: "Follow up" }
];

const postSaleTypeLabels: Record<PostSaleType, string> = {
  FEEDBACK: "Feedback",
  COMPLAINT: "Reclamação",
  EXCHANGE: "Troca",
  RETURN: "Devolução",
  REPURCHASE: "Recompra",
  REACTIVATION: "Reativação",
  FOLLOW_UP: "Acompanhamento"
};

const postSaleStatusLabels: Record<PostSaleStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  WAITING_CUSTOMER: "Aguardando cliente",
  RESOLVED: "Resolvido",
  CANCELED: "Cancelado"
};

const priorityLabels: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente"
};

const emptyDashboard: DashboardData = {
  kpis: {
    revenue: 0,
    sales: 0,
    salesToday: 0,
    salesWeek: 0,
    salesMonth: 0,
    averageTicket: 0,
    estimatedProfit: 0,
    customers: 0,
    leads: 0,
    postSales: 0,
    reactivationCustomers: 0,
    productionOrders: 0,
    pendingPayments: 0
  },
  revenueByDay: [],
  revenueByChannel: []
};

const emptyFinance: FinanceData = {
  summary: {
    revenue: 0,
    estimatedCost: 0,
    estimatedProfit: 0,
    estimatedMargin: 0,
    pendingPayments: 0,
    refunds: 0,
    averageTicket: 0
  },
  revenue: [],
  paymentMethods: []
};

const emptySalesSummary: SalesSummaryData = {
  salesToday: 0,
  salesTodayValue: 0,
  salesWeek: 0,
  salesWeekValue: 0,
  salesMonth: 0,
  salesMonthValue: 0,
  totalSalesInFilter: 0,
  totalValueInFilter: 0,
  averageTicketGeneral: 0,
  revenuePeriod: 0,
  averageTicket: 0,
  pendingSales: 0,
  confirmedSales: 0,
  refundedSales: 0,
  canceledSales: 0,
  salesByDay: [],
  revenueByDay: [],
  averageTicketByDay: [],
  salesByChannel: [],
  salesByStatus: []
};

const defaultSalesFilters: SalesFilters = {
  range: "30d",
  startDate: "",
  endDate: "",
  status: "",
  channel: "",
  paymentMethod: "",
  customerId: "",
  productId: "",
  search: ""
};

const moduleDataKeys: Record<ModuleKey, DataKey[]> = {
  dashboard: ["dashboard"],
  clients: ["customers", "products"],
  leads: ["leads"],
  products: ["products"],
  sales: ["customers", "products", "sales"],
  orders: ["orders"],
  payments: ["payments", "sales"],
  finance: ["finance"],
  "post-sales": ["customers", "postSales"],
  settings: ["users"]
};

const responseCache = new Map<string, { data: unknown; updatedAt: number }>();
const responseCacheMaxAge = 5 * 60 * 1000;
let workspaceWarmupStarted = false;

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length ? pointerCollisions : closestCenter(args);
};

export function CrmWorkspace({ module }: Readonly<{ module: ModuleKey }>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDetail, setCustomerDetail] = useState<Customer | null>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [customerDetailError, setCustomerDetailError] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productImagePreview, setProductImagePreview] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummaryData>(emptySalesSummary);
  const [postSales, setPostSales] = useState<PostSale[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [finance, setFinance] = useState<FinanceData>(emptyFinance);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [salesFilters, setSalesFilters] = useState<SalesFilters>(defaultSalesFilters);
  const [saleDetailId, setSaleDetailId] = useState("");
  const [saleDetail, setSaleDetail] = useState<SaleDetail | null>(null);
  const [saleDetailLoading, setSaleDetailLoading] = useState(false);
  const [saleDetailError, setSaleDetailError] = useState("");
  const [selectedSaleForPostSale, setSelectedSaleForPostSale] = useState<SaleSummary | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saleDraftItems, setSaleDraftItems] = useState<SaleDraftItem[]>(() => [createSaleDraftItem()]);
  const [saleDiscount, setSaleDiscount] = useState("R$ 0,00");
  const [saleDiscountMode, setSaleDiscountMode] = useState<SaleDiscountMode>("AMOUNT");
  const [saleCustomerId, setSaleCustomerId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [loadingKeys, setLoadingKeys] = useState<Partial<Record<DataKey, boolean>>>({});
  const [loadedKeys, setLoadedKeys] = useState<Partial<Record<DataKey, boolean>>>({});
  const loadedKeysRef = useRef<Partial<Record<DataKey, boolean>>>({});
  const [loadErrors, setLoadErrors] = useState<Partial<Record<DataKey, string>>>({});
  const productPreviewObjectUrlRef = useRef("");
  const meta = moduleMeta[module];
  const activeDataKeys = moduleDataKeys[module];
  const moduleLoading = activeDataKeys.some((key) => loadingKeys[key] && !loadedKeys[key]);
  const moduleError = activeDataKeys.map((key) => loadErrors[key]).find(Boolean) ?? "";
  const salesQuery = useMemo(() => buildSalesQuery(salesFilters), [salesFilters]);
  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();
    if (!search) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.whatsapp, customer.email ?? ""].some((value) => value.toLowerCase().includes(search))
    );
  }, [customers, customerSearch]);

  useEffect(() => {
    loadedKeysRef.current = loadedKeys;
  }, [loadedKeys]);

  useEffect(() => () => {
    if (!productPreviewObjectUrlRef.current) return;
    URL.revokeObjectURL(productPreviewObjectUrlRef.current);
    productPreviewObjectUrlRef.current = "";
  }, []);

  const refreshData = useCallback(async (target: LoadTarget = "all", options: RefreshOptions = {}) => {
    const allTasks: LoadTask<unknown>[] = [
      { key: "customers", url: "/api/customers", apply: (data) => setCustomers(data as Customer[]) },
      { key: "leads", url: "/api/leads", apply: (data) => setLeads(data as Lead[]) },
      { key: "products", url: "/api/products", apply: (data) => setProducts(data as Product[]) },
      { key: "orders", url: "/api/orders", apply: (data) => setOrders(data as Order[]) },
      { key: "payments", url: "/api/payments", apply: (data) => setPayments(data as Payment[]) },
      { key: "sales", url: `/api/sales${salesQuery}`, apply: (data) => setSales(data as SaleSummary[]) },
      { key: "sales", url: `/api/sales/summary${salesQuery}`, apply: (data) => setSalesSummary(data as SalesSummaryData) },
      { key: "postSales", url: "/api/post-sales", apply: (data) => setPostSales(data as PostSale[]) },
      { key: "users", url: "/api/users", apply: (data) => setUsers(data as AppUser[]) },
      {
        key: "dashboard",
        url: "/api/dashboard/kpis",
        apply: (data) => {
          setDashboard((current) => ({ ...current, kpis: data as DashboardData["kpis"] }));
        }
      },
      {
        key: "dashboard",
        url: "/api/dashboard/revenue-by-day",
        apply: (data) => {
          setDashboard((current) => ({ ...current, revenueByDay: data as DashboardData["revenueByDay"] }));
        }
      },
      {
        key: "dashboard",
        url: "/api/dashboard/revenue-by-channel",
        apply: (data) => {
          setDashboard((current) => ({ ...current, revenueByChannel: data as DashboardData["revenueByChannel"] }));
        }
      },
      {
        key: "finance",
        url: "/api/finance/summary",
        apply: (data) => {
          setFinance((current) => ({ ...current, summary: data as FinanceData["summary"] }));
        }
      },
      {
        key: "finance",
        url: "/api/finance/revenue",
        apply: (data) => {
          setFinance((current) => ({ ...current, revenue: data as FinanceData["revenue"] }));
        }
      },
      {
        key: "finance",
        url: "/api/finance/by-payment-method",
        apply: (data) => {
          setFinance((current) => ({ ...current, paymentMethods: data as FinanceData["paymentMethods"] }));
        }
      }
    ];
    const keys = target === "all" ? Object.keys(moduleDataKeys).flatMap((key) => moduleDataKeys[key as ModuleKey]) : moduleDataKeys[target];
    const selectedKeys = new Set(keys);
    const tasks = target === "all" ? allTasks : allTasks.filter((task) => selectedKeys.has(task.key));
    const taskKeys = Array.from(new Set(tasks.map((task) => task.key)));

    if (!tasks.length) return;

    const cachedKeys = new Set<DataKey>();
    if (!options.ignoreCache) {
      for (const task of tasks) {
        const cached = readCachedResponse(task.url);
        if (!cached) continue;
        task.apply(cached);
        cachedKeys.add(task.key);
      }
      if (cachedKeys.size) {
        setLoadedKeys((current) => ({
          ...current,
          ...Object.fromEntries(Array.from(cachedKeys).map((key) => [key, true]))
        }));
      }
    }

    setLoadingKeys((current) => ({
      ...current,
      ...Object.fromEntries(taskKeys.map((key) => [key, !loadedKeysRef.current[key] && !cachedKeys.has(key)]))
    }));
    setLoadErrors((current) => {
      const next = { ...current };
      for (const key of taskKeys) delete next[key];
      return next;
    });

    const results = await Promise.allSettled(tasks.map(async (task) => ({ task, result: await fetchData<unknown>(task.url) })));
    const errors: Partial<Record<DataKey, string>> = {};

    for (const settled of results) {
      if (settled.status === "rejected") {
        continue;
      }

      const { task, result } = settled.value;
      if (!result.ok) {
        if (!loadedKeysRef.current[task.key] && !cachedKeys.has(task.key)) {
          errors[task.key] = "Não foi possível carregar os dados. Tentar novamente.";
        }
        continue;
      }

      writeCachedResponse(task.url, result.data);
      task.apply(result.data);
      loadedKeysRef.current = { ...loadedKeysRef.current, [task.key]: true };
      setLoadedKeys((current) => ({ ...current, [task.key]: true }));
    }

    setLoadErrors((current) => ({ ...current, ...errors }));
    setLoadingKeys((current) => ({ ...current, ...Object.fromEntries(taskKeys.map((key) => [key, false])) }));
  }, [salesQuery]);

  useLayoutEffect(() => {
    let active = true;

    const timeout = window.setTimeout(() => {
      refreshData(module).catch(() => {
        if (active) setToast({ type: "error", message: "Não foi possível carregar os dados agora." });
      });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [module, refreshData]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      warmWorkspaceData(salesQuery).catch(() => undefined);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [salesQuery]);

  function openModal(modal: ActiveModal) {
    setSubmitError("");
    if (modal === "sale") {
      setSaleDraftItems([createSaleDraftItem()]);
      setSaleDiscount("R$ 0,00");
    }
    setActiveModal(modal);
  }

  function clearProductImageObjectUrl() {
    if (!productPreviewObjectUrlRef.current) return;
    URL.revokeObjectURL(productPreviewObjectUrlRef.current);
    productPreviewObjectUrlRef.current = "";
  }

  function updateProductImagePreviewFromFile(file: File | null) {
    clearProductImageObjectUrl();
    if (!file) {
      setProductImagePreview(editingProduct?.imageUrl ?? "");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    productPreviewObjectUrlRef.current = objectUrl;
    setProductImagePreview(objectUrl);
  }

  function closeModal() {
    setActiveModal(null);
    setSelectedPayment(null);
    setSelectedOrder(null);
    setSelectedSaleForPostSale(null);
    setEditingCustomer(null);
    setEditingLead(null);
    setEditingProduct(null);
    setProductImagePreview("");
    clearProductImageObjectUrl();
    setEditingUser(null);
    setCustomerDetail(null);
    setCustomerDetailError("");
    setSaleCustomerId("");
    setSubmitError("");
  }

  function openSaleModal(customerId = "") {
    setSaleCustomerId(customerId);
    openModal("sale");
  }

  function showToast(type: NonNullable<ToastState>["type"], message: string) {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  }

  function handlePrimaryAction() {
    if (module === "clients") {
      setEditingCustomer(null);
      openModal("customer");
    }
    else if (module === "leads") {
      setEditingLead(null);
      openModal("lead");
    }
    else if (module === "products") {
      setEditingProduct(null);
      setProductImagePreview("");
      clearProductImageObjectUrl();
      openModal("product");
    }
    else if (module === "sales") {
      openSaleModal();
    }
    else if (module === "payments") openModal("payment");
    else if (module === "post-sales") openModal("post-sale");
    else if (module === "orders") showToast("info", "Pedidos são criados automaticamente ao confirmar um pagamento.");
    else if (module === "settings") showToast("info", "Configurações avançadas ficam para a próxima etapa.");
    else if (module === "finance") showToast("info", "Exportação será ativada após definir o formato do relatório.");
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  async function openCustomerDetail(customerId: string) {
    setCustomerDetail(null);
    setCustomerDetailError("");
    setCustomerDetailLoading(true);
    setActiveModal("customer-detail");

    try {
      const response = await fetch(`/api/customers/${customerId}`);
      const payload = (await response.json().catch(() => ({}))) as { data?: Customer; error?: string };
      if (!response.ok || !payload.data) {
        setCustomerDetailError(payload.error ?? "Não foi possível carregar o cliente.");
        return;
      }
      setCustomerDetail(payload.data);
    } catch {
      setCustomerDetailError("Falha de conexão ao carregar o cliente.");
    } finally {
      setCustomerDetailLoading(false);
    }
  }

  function editCustomer(customer: Customer) {
    setEditingCustomer(customer);
    openModal("customer");
  }

  function editLead(lead: Lead) {
    setEditingLead(lead);
    openModal("lead");
  }

  function editProduct(product: Product) {
    clearProductImageObjectUrl();
    setEditingProduct(product);
    setProductImagePreview(product.imageUrl ?? "");
    openModal("product");
  }

  async function inactivateCustomer(customer: Customer) {
    const previous = customers;
    setCustomers((current) => current.map((item) => (item.id === customer.id ? { ...item, status: "Inativo" } : item)));

    const response = await fetch(`/api/customers/${customer.id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      setCustomers(previous);
      showToast("error", "Não foi possível inativar o cliente.");
      return;
    }

    await refreshData("clients", { ignoreCache: true });
    showToast("success", "Cliente inativado.");
  }

  function closeSaleDetail() {
    setSaleDetailId("");
    setSaleDetail(null);
    setSaleDetailError("");
    setSaleDetailLoading(false);
  }

  async function openSaleDetail(saleId: string) {
    setSaleDetailId(saleId);
    setSaleDetail(null);
    setSaleDetailError("");
    setSaleDetailLoading(true);

    try {
      const response = await fetch(`/api/sales/${saleId}`);
      const payload = (await response.json().catch(() => ({}))) as { data?: SaleDetail; error?: string };
      if (!response.ok || !payload.data) {
        setSaleDetailError(payload.error ?? "Não foi possível carregar os detalhes da venda.");
        return;
      }
      setSaleDetail(payload.data);
    } catch {
      setSaleDetailError("Falha de conexão ao carregar a venda.");
    } finally {
      setSaleDetailLoading(false);
    }
  }

  function salePaymentToPayment(sale: SaleSummary): Payment | null {
    if (!sale.payment) return null;
    return {
      id: sale.payment.id,
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      customerId: sale.customerId,
      customer: sale.customer,
      method: sale.payment.method,
      amount: sale.payment.amount,
      status: sale.payment.status,
      date: sale.createdAt
    };
  }

  function openPostSaleFromSale(sale: SaleSummary) {
    closeSaleDetail();
    setSelectedSaleForPostSale(sale);
    openModal("post-sale");
  }

  async function openOrderFromSale(sale: SaleSummary) {
    if (!sale.order) {
      showToast("info", "Pedido ainda não criado para esta venda.");
      return;
    }

    let order = orders.find((item) => item.id === sale.order?.id) ?? null;
    if (!order) {
      const result = await fetchData<Order[]>("/api/orders");
      if (result.ok) {
        setOrders(result.data);
        order = result.data.find((item) => item.id === sale.order?.id) ?? null;
      }
    }

    if (!order) {
      showToast("error", "Não foi possível carregar o pedido relacionado.");
      return;
    }

    closeSaleDetail();
    setSelectedOrder(order);
    openModal("order-detail");
  }

  function openPaymentsFromSale(sale: SaleSummary) {
    const payment = salePaymentToPayment(sale);
    if (payment) setSelectedPayment(payment);
    window.location.href = "/payments";
  }

  async function moveOrder(orderId: string, status: OrderStatus) {
    const previous = orders;
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));

    const response = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      setOrders(previous);
      showToast("error", "Não foi possível mover o pedido.");
      return;
    }

    await refreshData("all", { ignoreCache: true });
  }

  async function moveLead(leadId: string, status: LeadStatus) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.statusKey === status) return;

    const previous = leads;
    const nextLabel = leadColumns.find((column) => column.key === status)?.label ?? lead.status;
    setLeads((current) =>
      current.map((item) =>
        item.id === leadId
          ? { ...item, statusKey: status, status: nextLabel }
          : item
      )
    );

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });
      const payload = (await response.json().catch(() => ({}))) as { data?: Lead; error?: string };

      if (!response.ok || !payload.data) {
        setLeads(previous);
        showToast("error", payload.error ?? "Não foi possível mover o lead.");
        return;
      }

      setLeads((current) => current.map((item) => (item.id === leadId ? payload.data as Lead : item)));
      await refreshData("all", { ignoreCache: true });
      if (status === "CLOSED_WON" && payload.data.convertedCustomerId) {
        setSaleCustomerId(payload.data.convertedCustomerId);
        openModal("sale");
        showToast("success", "Lead convertido. Complete a nova venda.");
        return;
      }
      showToast("success", "Lead movido.");
    } catch {
      setLeads(previous);
      showToast("error", "Falha de conexão ao mover o lead.");
    }
  }

  async function resolvePostSale(id: string) {
    const previous = postSales;
    setPostSales((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status: "RESOLVED", resolution: item.resolution ?? "Atendimento resolvido e auditado.", overdue: false }
          : item
      )
    );

    const response = await fetch(`/api/post-sales/${id}/resolve`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ resolution: "Atendimento resolvido e auditado." })
    });

    if (response.ok) {
      const payload = (await response.json()) as { data: PostSale };
      setPostSales((current) => current.map((item) => (item.id === id ? payload.data : item)));
      await refreshData("all", { ignoreCache: true });
      showToast("success", "Atendimento resolvido.");
    } else {
      setPostSales(previous);
      showToast("error", "Não foi possível resolver o atendimento.");
    }
  }

  async function submitJson<T>(url: string, body: T, successMessage: string, method = "POST", refreshTarget: LoadTarget = "all") {
    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: unknown };

      if (!response.ok) {
        const message = getApiErrorMessage(payload.error);
        setSubmitError(message);
        showToast("error", message);
        return false;
      }

      await refreshData(refreshTarget, { ignoreCache: true });
      closeModal();
      showToast("success", successMessage);
      return true;
    } catch {
      setSubmitError("Falha de conexão. Tente novamente.");
      showToast("error", "Falha de conexão. Tente novamente.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadProductImage(file: File) {
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      throw new Error("Formato inválido. Use JPG, PNG ou WEBP.");
    }
    if (file.size <= 0 || file.size > 4 * 1024 * 1024) {
      throw new Error("A imagem precisa ter até 4 MB.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/uploads/product-image", {
      method: "POST",
      body: formData
    });
    const payload = (await response.json().catch(() => ({}))) as { data?: { imageUrl: string }; error?: string };

    if (!response.ok || !payload.data?.imageUrl) {
      throw new Error(payload.error ?? "Não foi possível enviar a imagem.");
    }

    return payload.data.imageUrl;
  }

  async function handleCustomerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: getString(form, "name"),
      whatsapp: normalizePhoneBR(getString(form, "whatsapp")),
      email: getString(form, "email"),
      address: getString(form, "address"),
      city: getString(form, "city"),
      state: getString(form, "state"),
      notes: getString(form, "notes"),
      status: getString(form, "status") || "active",
      tags: []
    };
    await submitJson(
      editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers",
      payload,
      editingCustomer ? "Cliente atualizado com sucesso." : "Cliente criado com sucesso.",
      editingCustomer ? "PATCH" : "POST",
      "clients"
    );
  }

  async function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = getString(form, "password");
    const payload = {
      name: getString(form, "name"),
      email: getString(form, "email"),
      password: password || undefined,
      role: getString(form, "role") || "STAFF",
      active: getString(form, "active") !== "false"
    };

    await submitJson(
      editingUser ? `/api/users/${editingUser.id}` : "/api/users",
      payload,
      editingUser ? "Usuário atualizado com sucesso." : "Usuário criado com sucesso.",
      editingUser ? "PATCH" : "POST",
      "settings"
    );
  }

  async function deactivateUser(user: AppUser) {
    const response = await fetch(`/api/users/${user.id}`, {
      method: "DELETE"
    });
    const payload = (await response.json().catch(() => ({}))) as { data?: AppUser; error?: string };
    if (!response.ok || !payload.data) {
      showToast("error", payload.error ?? "Não foi possível desativar o usuário.");
      return;
    }

    setUsers((current) => current.map((item) => (item.id === user.id ? payload.data as AppUser : item)));
    showToast("success", "Usuário desativado.");
  }

  async function handleLeadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = getString(form, "status") || "IN_PROGRESS";
    const body = {
      name: getString(form, "name"),
      whatsapp: normalizePhoneBR(getString(form, "whatsapp")),
      origin: getString(form, "origin"),
      status,
      notes: getString(form, "notes")
    };

    if (status !== "CLOSED_WON") {
      await submitJson(
        editingLead ? `/api/leads/${editingLead.id}` : "/api/leads",
        body,
        editingLead ? "Lead atualizado com sucesso." : "Lead criado com sucesso.",
        editingLead ? "PATCH" : "POST",
        "leads"
      );
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch(editingLead ? `/api/leads/${editingLead.id}` : "/api/leads", {
        method: editingLead ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => ({}))) as { data?: Lead; error?: unknown };

      if (!response.ok || !payload.data?.convertedCustomerId) {
        const message = getApiErrorMessage(payload.error) || "Não foi possível converter o lead.";
        setSubmitError(message);
        showToast("error", message);
        return;
      }

      await refreshData("all", { ignoreCache: true });
      closeModal();
      setSaleCustomerId(payload.data.convertedCustomerId);
      openModal("sale");
      showToast("success", "Lead convertido. Complete a nova venda.");
    } catch {
      setSubmitError("Falha de conexão. Tente novamente.");
      showToast("error", "Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const imageFile = form.get("imageFile");
    let imageUrl = editingProduct?.imageUrl ?? "";

    if (imageFile instanceof File && imageFile.size > 0) {
      setSubmitting(true);
      setSubmitError("");
      try {
        imageUrl = await uploadProductImage(imageFile);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível enviar a imagem.";
        setSubmitError(message);
        showToast("error", message);
        setSubmitting(false);
        return;
      }
    }

    await submitJson(editingProduct ? `/api/products/${editingProduct.id}` : "/api/products", {
      name: getString(form, "name"),
      category: getString(form, "category"),
      sku: getString(form, "sku"),
      price: getMoney(form, "price"),
      cost: getMoney(form, "cost"),
      imageUrl,
      colors: getString(form, "colors"),
      sizes: getString(form, "sizes"),
      active: true,
      description: getString(form, "description")
    }, editingProduct ? "Produto atualizado com sucesso." : "Produto criado com sucesso.", editingProduct ? "PATCH" : "POST", "products");
  }

  async function handleSaleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customerId = getString(form, "customerId");

    const items = saleDraftItems
      .filter((item) => item.productId)
      .map((item) => ({
        productId: item.productId,
        quantity: Math.min(999, Math.max(1, item.quantity || 1)),
        selectedColor: item.selectedColor || undefined,
        selectedSize: item.selectedSize || undefined,
        discount: parseCurrencyBR(item.discount),
        customizationNotes: item.customizationNotes || undefined
      }));

    if (!customerId || items.length === 0) {
      setSubmitError("Cadastre e selecione um cliente e um produto antes de criar a venda.");
      return;
    }

    await submitJson("/api/sales", {
      customerId,
      channel: getString(form, "channel") || "WhatsApp",
      paymentMethod: getString(form, "paymentMethod") || "PIX",
      discountMode: saleDiscountMode,
      discount: saleDiscountMode === "AMOUNT" ? parseCurrencyBR(saleDiscount) : 0,
      discountPercent: saleDiscountMode === "PERCENTAGE" ? parsePercentBR(saleDiscount) : 0,
      items
    }, "Venda criada com pagamento pendente.");
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saleId = getString(form, "saleId");

    if (!saleId) {
      setSubmitError("Selecione uma venda para registrar o pagamento.");
      return;
    }

    const sale = sales.find((item) => item.id === saleId);
    if (!sale) {
      setSubmitError("Venda selecionada não foi encontrada na lista carregada.");
      return;
    }

    await submitJson("/api/payments", {
      saleId,
      method: getString(form, "method") || "PIX",
      amount: sale.total
    }, "Pagamento criado com sucesso.");
  }

  async function handlePostSaleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customerId = getString(form, "customerId");

    if (!customerId) {
      setSubmitError("Selecione um cliente para abrir o atendimento.");
      return;
    }

    await submitJson("/api/post-sales", {
      customerId,
      saleId: getString(form, "saleId") || undefined,
      orderId: getString(form, "orderId") || undefined,
      type: getString(form, "type") || "FOLLOW_UP",
      priority: getString(form, "priority") || "MEDIUM",
      status: "OPEN",
      notes: getString(form, "notes"),
      nextActionAt: getString(form, "nextActionAt") ? new Date(getString(form, "nextActionAt")).toISOString() : undefined
    }, "Atendimento criado com sucesso.");
  }

  async function handlePaymentActionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPayment) return;

    const form = new FormData(event.currentTarget);
    const isRefund = activeModal === "payment-refund";
    const isCancel = activeModal === "payment-cancel";
    await submitJson(
      `/api/payments/${selectedPayment.id}/${isRefund ? "refund" : isCancel ? "cancel" : "confirm"}`,
      isRefund || isCancel ? { reason: getString(form, "reason") } : {},
      isRefund ? "Pagamento estornado." : isCancel ? "Pagamento cancelado." : "Pagamento confirmado.",
      "PATCH"
    );
  }

  return (
    <main className="min-h-screen lg:pl-[248px]">
  <aside
    className={`fixed inset-y-0 left-0 z-50 h-screen w-72 overflow-y-auto border-r border-white/10 bg-black/84 p-4 shadow-glass backdrop-blur-2xl transition soft-scroll lg:w-[248px] lg:translate-x-0 ${
      mobileOpen ? "translate-x-0" : "-translate-x-full"
    }`}
  >
    <Link
      href="/dashboard"
      className="mb-8 flex h-32 items-center justify-center overflow-hidden rounded-crm px-2"
    >
      <Image
        src="/brand/logo-darkhaven.png"
        alt="DarkHaven"
        width={260}
        height={180}
        className="h-40 w-56 object-cover object-center"
        priority
      />
    </Link>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-crm px-3 py-2.5 text-sm transition ${
                  active
                    ? "border border-white/12 bg-white/[0.09] text-white shadow-glow"
                    : "text-zinc-400 hover:bg-white/[0.055] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {mobileOpen ? <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

      <section className="min-w-0 px-4 py-4 md:px-6 lg:px-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-crm border border-white/10 bg-black/36 px-3 py-3 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-crm border border-white/10 bg-white/[0.04] text-white lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember">{meta.eyebrow}</p>
              <h1 className="truncate text-2xl font-semibold text-white md:text-3xl">{meta.title}</h1>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2">
            <label className="hidden min-w-52 max-w-sm flex-1 items-center gap-2 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-500 md:flex">
              <Search className="h-4 w-4" aria-hidden />
              <input className="w-full bg-transparent text-zinc-200 outline-none" placeholder="Buscar..." />
            </label>
            {meta.cta ? (
              <button
                className="inline-flex items-center gap-2 rounded-crm bg-bone px-3 py-2 text-sm font-bold text-black transition hover:bg-white"
                onClick={handlePrimaryAction}
              >
                <Plus className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{meta.cta}</span>
              </button>
            ) : null}
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-crm border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:text-white"
              aria-label="Sair da conta"
              onClick={handleLogout}
              type="button"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}

        <DataBoundary loading={moduleLoading} error={moduleError} onRetry={() => refreshData(module)}>
          {module === "dashboard" ? <Dashboard dashboard={dashboard} /> : null}
          {module === "clients" ? (
            <Clients
              customers={filteredCustomers}
              search={customerSearch}
              onSearchChange={setCustomerSearch}
              onOpenDetail={openCustomerDetail}
              onEdit={editCustomer}
              onInactivate={inactivateCustomer}
              onCreateSale={(customer) => openSaleModal(customer.id)}
            />
          ) : null}
          {module === "leads" ? <Leads leads={leads} onCreate={() => openModal("lead")} onMove={moveLead} onEdit={editLead} /> : null}
          {module === "products" ? <Products products={products} onEdit={editProduct} /> : null}
          {module === "sales" ? (
            <Sales
              sales={sales}
              summary={salesSummary}
              products={products}
              customers={customers}
              filters={salesFilters}
              onFiltersChange={setSalesFilters}
              onOpenDetail={openSaleDetail}
              onOpenOrder={openOrderFromSale}
              onOpenPayments={openPaymentsFromSale}
              onCreatePostSale={openPostSaleFromSale}
            />
          ) : null}
          {module === "orders" ? (
            <Orders
              orders={orders}
              onMove={moveOrder}
              onSelect={(order) => {
                setSelectedOrder(order);
                openModal("order-detail");
              }}
            />
          ) : null}
          {module === "payments" ? (
            <Payments
              payments={payments}
              onOpenSale={(payment) => openSaleDetail(payment.saleId)}
              onOpenCustomer={(payment) => openCustomerDetail(payment.customerId)}
              onConfirm={(payment) => {
                setSelectedPayment(payment);
                openModal("payment-confirm");
              }}
              onRefund={(payment) => {
                setSelectedPayment(payment);
                openModal("payment-refund");
              }}
              onCancel={(payment) => {
                setSelectedPayment(payment);
                openModal("payment-cancel");
              }}
            />
          ) : null}
          {module === "finance" ? <Finance finance={finance} /> : null}
          {module === "post-sales" ? <PostSales postSales={postSales} onResolve={resolvePostSale} onCreate={() => openModal("post-sale")} /> : null}
          {module === "settings" ? (
            <SettingsPanel
              users={users}
              onCreateUser={() => {
                setEditingUser(null);
                openModal("user");
              }}
              onEditUser={(user) => {
                setEditingUser(user);
                openModal("user");
              }}
              onDeactivateUser={deactivateUser}
            />
          ) : null}
        </DataBoundary>

        <ActionModal
          activeModal={activeModal}
          customers={customers}
          products={products}
          orders={orders}
          sales={sales}
          saleDraftItems={saleDraftItems}
          saleDiscount={saleDiscount}
          saleDiscountMode={saleDiscountMode}
          saleCustomerId={saleCustomerId}
          selectedPayment={selectedPayment}
          selectedOrder={selectedOrder}
          selectedSaleForPostSale={selectedSaleForPostSale}
          editingCustomer={editingCustomer}
          editingLead={editingLead}
          editingProduct={editingProduct}
          productImagePreview={productImagePreview}
          editingUser={editingUser}
          customerDetail={customerDetail}
          customerDetailLoading={customerDetailLoading}
          customerDetailError={customerDetailError}
          submitting={submitting}
          submitError={submitError}
          onClose={closeModal}
          onCustomerDetailRetry={() => customerDetail ? openCustomerDetail(customerDetail.id) : null}
          onCustomerEdit={editCustomer}
          onCustomerInactivate={inactivateCustomer}
          onCustomerSubmit={handleCustomerSubmit}
          onUserSubmit={handleUserSubmit}
          onLeadSubmit={handleLeadSubmit}
          onProductSubmit={handleProductSubmit}
          onProductImageFileChange={updateProductImagePreviewFromFile}
          onSaleSubmit={handleSaleSubmit}
          onSaleItemAdd={() => setSaleDraftItems((current) => [...current, createSaleDraftItem()])}
          onSaleItemRemove={(id) => setSaleDraftItems((current) => current.length === 1 ? current : current.filter((item) => item.id !== id))}
          onSaleItemChange={(id, patch) =>
            setSaleDraftItems((current) =>
              current.map((item) => {
                if (item.id !== id) return item;
                const next = { ...item, ...patch };
                if (patch.productId !== undefined) {
                  next.selectedColor = "";
                  next.selectedSize = "";
                }
                return next;
              })
            )
          }
          onSaleDiscountChange={setSaleDiscount}
          onSaleDiscountModeChange={(mode) => {
            setSaleDiscountMode(mode);
            setSaleDiscount(mode === "AMOUNT" ? "R$ 0,00" : "0");
          }}
          onPaymentSubmit={handlePaymentSubmit}
          onPostSaleSubmit={handlePostSaleSubmit}
          onPaymentActionSubmit={handlePaymentActionSubmit}
        />
        <SaleDetailDrawer
          sale={saleDetail}
          loading={saleDetailLoading}
          error={saleDetailError}
          onClose={closeSaleDetail}
          onRetry={() => saleDetailId ? openSaleDetail(saleDetailId) : undefined}
          onOpenOrder={openOrderFromSale}
          onOpenPayments={openPaymentsFromSale}
          onCreatePostSale={openPostSaleFromSale}
        />
      </section>
    </main>
  );
}

function DataBoundary({ loading, error, onRetry, children }: Readonly<{ loading: boolean; error: string; onRetry: () => void; children: React.ReactNode }>) {
  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <section className="glass-panel rounded-crm p-5">
        <p className="text-sm font-semibold text-white">{error}</p>
        <button className="mt-4 rounded-crm bg-bone px-4 py-2 text-sm font-bold text-black" onClick={onRetry}>
          Tentar novamente
        </button>
      </section>
    );
  }

  return <>{children}</>;
}

function LoadingState() {
  return (
    <section className="glass-panel rounded-crm p-5">
      <div className="space-y-3">
        <div className="h-5 w-44 rounded-crm bg-white/[0.08]" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 rounded-crm border border-white/10 bg-white/[0.035]" />
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ message }: Readonly<{ message: string }>) {
  return (
    <div className="rounded-crm border border-dashed border-white/14 bg-white/[0.025] px-4 py-8 text-center text-sm text-zinc-400">
      {message}
    </div>
  );
}

function ActionModal({
  activeModal,
  customers,
  products,
  orders,
  sales,
  saleDraftItems,
  saleDiscount,
  saleDiscountMode,
  saleCustomerId,
  selectedPayment,
  selectedOrder,
  selectedSaleForPostSale,
  editingCustomer,
  editingLead,
  editingProduct,
  productImagePreview,
  editingUser,
  customerDetail,
  customerDetailLoading,
  customerDetailError,
  submitting,
  submitError,
  onClose,
  onCustomerDetailRetry,
  onCustomerEdit,
  onCustomerInactivate,
  onCustomerSubmit,
  onUserSubmit,
  onLeadSubmit,
  onProductSubmit,
  onProductImageFileChange,
  onSaleSubmit,
  onSaleItemAdd,
  onSaleItemRemove,
  onSaleItemChange,
  onSaleDiscountChange,
  onSaleDiscountModeChange,
  onPaymentSubmit,
  onPostSaleSubmit,
  onPaymentActionSubmit
}: Readonly<{
  activeModal: ActiveModal;
  customers: Customer[];
  products: Product[];
  orders: Order[];
  sales: SaleSummary[];
  saleDraftItems: SaleDraftItem[];
  saleDiscount: string;
  saleDiscountMode: SaleDiscountMode;
  saleCustomerId: string;
  selectedPayment: Payment | null;
  selectedOrder: Order | null;
  selectedSaleForPostSale: SaleSummary | null;
  editingCustomer: Customer | null;
  editingLead: Lead | null;
  editingProduct: Product | null;
  productImagePreview: string;
  editingUser: AppUser | null;
  customerDetail: Customer | null;
  customerDetailLoading: boolean;
  customerDetailError: string;
  submitting: boolean;
  submitError: string;
  onClose: () => void;
  onCustomerDetailRetry: () => void;
  onCustomerEdit: (customer: Customer) => void;
  onCustomerInactivate: (customer: Customer) => void;
  onCustomerSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUserSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onLeadSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onProductSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onProductImageFileChange: (file: File | null) => void;
  onSaleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSaleItemAdd: () => void;
  onSaleItemRemove: (id: string) => void;
  onSaleItemChange: (id: string, patch: Partial<SaleDraftItem>) => void;
  onSaleDiscountChange: (value: string) => void;
  onSaleDiscountModeChange: (mode: SaleDiscountMode) => void;
  onPaymentSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPostSaleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPaymentActionSubmit: (event: FormEvent<HTMLFormElement>) => void;
}>) {
  if (!activeModal) return null;

  if (activeModal === "customer-detail") {
    return (
      <ModalFrame title={customerDetail ? customerDetail.name : "Detalhe do cliente"} onClose={onClose}>
        {customerDetailLoading ? <LoadingState /> : null}
        {customerDetailError ? (
          <div className="space-y-4">
            <EmptyState message={customerDetailError} />
            <button className="rounded-crm bg-bone px-4 py-2 text-sm font-bold text-black" onClick={onCustomerDetailRetry}>Tentar novamente</button>
          </div>
        ) : null}
        {customerDetail ? (
          <div className="space-y-5 text-sm">
            <section className="grid gap-3 sm:grid-cols-2">
              <DetailBox label="Nome" value={customerDetail.name} />
              <DetailBox label="WhatsApp" value={formatPhoneBR(customerDetail.whatsapp)} />
              <DetailBox label="E-mail" value={customerDetail.email ?? "Não informado"} />
              <DetailBox label="Status" value={customerDetail.status} />
              <DetailBox label="Cidade/UF" value={`${customerDetail.city || "Não informado"}${customerDetail.state ? `/${customerDetail.state}` : ""}`} />
              <DetailBox label="Total gasto" value={brl(customerDetail.totalSpent)} />
            </section>

            <GlassPanel title="Endereço e observações">
              <div className="space-y-3 text-sm">
                <SummaryRow label="Endereço" value={customerDetail.address ?? "Endereço não informado."} />
                <SummaryRow label="Observações" value={customerDetail.notes ?? "Sem observações."} />
              </div>
            </GlassPanel>

            <GlassPanel title="Compras recentes">
              <div className="space-y-2">
                {customerDetail.recentPurchases?.length ? customerDetail.recentPurchases.map((purchase) => (
                  <div key={purchase.id} className="rounded-crm border border-white/10 bg-white/[0.04] p-3 text-xs text-zinc-300">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-white">{purchase.saleNumber ? `Venda #${purchase.saleNumber}` : "Venda"}</strong>
                      <span>{brl(purchase.total)}</span>
                    </div>
                    <p className="mt-2 text-zinc-400">{purchase.summary}</p>
                  </div>
                )) : <EmptyState message="Nenhuma compra recente válida nos últimos 30 dias." />}
              </div>
            </GlassPanel>

            <section className="grid gap-5 xl:grid-cols-3">
              <GlassPanel title="Vendas relacionadas">
                <div className="space-y-2">
                  {customerDetail.relatedSales?.length ? customerDetail.relatedSales.map((sale) => (
                    <div key={sale.id} className="rounded-crm border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-300">
                      <strong className="text-white">Venda #{sale.saleNumber}</strong>
                      <p className="mt-1">{brl(sale.total)} · {sale.status} · {shortDate(sale.createdAt)}</p>
                      <p className="mt-1 text-zinc-500">{sale.items.slice(0, 2).join(", ") || "Sem produtos"}</p>
                    </div>
                  )) : <EmptyState message="Nenhuma venda relacionada." />}
                </div>
              </GlassPanel>
              <GlassPanel title="Pedidos relacionados">
                <div className="space-y-2">
                  {customerDetail.relatedOrders?.length ? customerDetail.relatedOrders.map((order) => (
                    <div key={order.id} className="rounded-crm border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-300">
                      <strong className="text-white">Pedido #{order.orderNumber}</strong>
                      <p className="mt-1">{brl(order.total)} · {order.status} · {shortDate(order.createdAt)}</p>
                    </div>
                  )) : <EmptyState message="Nenhum pedido relacionado." />}
                </div>
              </GlassPanel>
              <GlassPanel title="Pós-venda relacionado">
                <div className="space-y-2">
                  {customerDetail.relatedPostSales?.length ? customerDetail.relatedPostSales.map((item) => (
                    <div key={item.id} className="rounded-crm border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-300">
                      <strong className="text-white">{postSaleTypeLabels[item.type]}</strong>
                      <p className="mt-1">{postSaleStatusLabels[item.status]} · {priorityLabels[item.priority]} · {shortDate(item.createdAt)}</p>
                    </div>
                  )) : <EmptyState message="Nenhum pós-venda relacionado." />}
                </div>
              </GlassPanel>
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <button className="rounded-crm border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white" onClick={() => onCustomerEdit(customerDetail)}>Editar</button>
              <button className="rounded-crm border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-white" onClick={() => onCustomerInactivate(customerDetail)}>Inativar</button>
            </div>
          </div>
        ) : null}
      </ModalFrame>
    );
  }

  if (activeModal === "customer") {
    const isEditing = Boolean(editingCustomer);
    return (
      <ModalFrame title={isEditing ? "Editar cliente" : "Novo cliente"} onClose={onClose}>
        <form className="space-y-4" onSubmit={onCustomerSubmit}>
          <FormInput label="Nome" name="name" required minLength={2} maxLength={100} defaultValue={editingCustomer?.name} />
          <FormInput label="WhatsApp" name="whatsapp" placeholder="19 99283-7929" required maxLength={13} mask="phone" defaultValue={editingCustomer ? formatPhoneBR(editingCustomer.whatsapp) : undefined} />
          <FormInput label="E-mail" name="email" type="email" maxLength={120} defaultValue={editingCustomer?.email} />
          <FormInput label="Endereço" name="address" maxLength={120} defaultValue={editingCustomer?.address} />
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <FormInput label="Cidade" name="city" maxLength={80} defaultValue={editingCustomer?.city} />
            <FormInput label="UF" name="state" maxLength={2} defaultValue={editingCustomer?.state} />
          </div>
          <FormSelect label="Status" name="status" defaultValue={customerStatusValue(editingCustomer?.status)} options={[["active", "Ativo"], ["novo", "Novo"], ["recorrente", "Recorrente"], ["vip", "VIP"], ["inativo", "Inativo"]]} />
          <FormTextArea label="Observações" name="notes" maxLength={500} defaultValue={editingCustomer?.notes} />
          <FormFooter submitting={submitting} submitError={submitError} onClose={onClose} label={isEditing ? "Salvar alterações" : "Criar cliente"} />
        </form>
      </ModalFrame>
    );
  }

  if (activeModal === "lead") {
    const isEditing = Boolean(editingLead);
    return (
      <ModalFrame title={isEditing ? "Editar lead" : "Novo lead"} onClose={onClose}>
        <form className="space-y-4" onSubmit={onLeadSubmit}>
          <FormInput label="Nome" name="name" required minLength={2} maxLength={100} defaultValue={editingLead?.name} />
          <FormInput label="WhatsApp" name="whatsapp" required maxLength={13} mask="phone" defaultValue={editingLead ? formatPhoneBR(editingLead.whatsapp) : undefined} />
          <FormInput label="Origem" name="origin" placeholder="Instagram" required maxLength={60} defaultValue={editingLead?.origin} />
          <FormSelect
            label="Status"
            name="status"
            defaultValue={getLeadStatusKey(editingLead) ?? "IN_PROGRESS"}
            options={[
              ["IN_PROGRESS", "Qualificado"],
              ["CLOSED_WON", "Convertido"],
              ["CLOSED_LOST", "Perdido"],
              ["WAITING_REPLY", "Follow up"]
            ]}
          />
          <FormTextArea label="Observações" name="notes" maxLength={500} defaultValue={editingLead?.notes ?? undefined} />
          <FormFooter submitting={submitting} submitError={submitError} onClose={onClose} label={isEditing ? "Salvar lead" : "Criar lead"} />
        </form>
      </ModalFrame>
    );
  }

  if (activeModal === "user") {
    return (
      <ModalFrame title={editingUser ? "Editar usuário" : "Novo usuário"} onClose={onClose}>
        <form className="space-y-4" onSubmit={onUserSubmit}>
          <FormInput label="Nome" name="name" required minLength={2} maxLength={100} defaultValue={editingUser?.name} />
          <FormInput label="E-mail" name="email" type="email" required maxLength={120} defaultValue={editingUser?.email} />
          <FormInput label={editingUser ? "Nova senha (opcional)" : "Senha"} name="password" type="password" required={!editingUser} minLength={8} maxLength={120} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,120}" title="Use pelo menos 8 caracteres com maiúscula, minúscula e número." />
          <FormSelect label="Função" name="role" required defaultValue={editingUser?.role ?? "STAFF"} options={[["STAFF", "Equipe"], ["ADMIN", "Admin"]]} />
          <FormSelect label="Status" name="active" required defaultValue={editingUser?.active === false ? "false" : "true"} options={[["true", "Ativo"], ["false", "Inativo"]]} />
          {editingUser?.isOwnerAdmin ? <DependencyNotice text="Admin principal não pode ser desativado ou rebaixado." /> : null}
          <FormFooter submitting={submitting} submitError={submitError} onClose={onClose} label={editingUser ? "Salvar usuário" : "Criar usuário"} />
        </form>
      </ModalFrame>
    );
  }

  if (activeModal === "product") {
    const isEditing = Boolean(editingProduct);
    return (
      <ModalFrame title={isEditing ? "Editar produto" : "Novo produto"} onClose={onClose}>
        <form className="space-y-4" onSubmit={onProductSubmit}>
          <FormInput label="Nome" name="name" required minLength={2} maxLength={120} defaultValue={editingProduct?.name} />
          <FormInput label="Categoria" name="category" required maxLength={60} defaultValue={editingProduct?.category} />
          <FormInput label="SKU opcional" name="sku" maxLength={40} defaultValue={editingProduct?.sku ?? undefined} />
          <ProductImagePreview imageUrl={productImagePreview} productName={editingProduct?.name ?? "Produto DarkHaven"} />
          <FormFile
            label="Imagem opcional"
            name="imageFile"
            accept="image/jpeg,image/png,image/webp"
            hint={editingProduct?.imageUrl ? "Imagem atual será mantida se nenhum arquivo novo for escolhido." : "JPG, PNG ou WEBP até 4 MB."}
            onFileChange={onProductImageFileChange}
          />
          <FormInput label="Preço" name="price" required mask="currency" defaultValue={editingProduct ? formatCurrencyBR(editingProduct.price) : undefined} />
          <FormInput label="Custo" name="cost" defaultValue={editingProduct ? formatCurrencyBR(editingProduct.cost) : "R$ 0,00"} mask="currency" />
          <FormInput label="Cores" name="colors" placeholder="Preto, Branco, Cinza" maxLength={240} defaultValue={editingProduct?.colors.join(", ")} />
          <FormInput label="Tamanhos" name="sizes" placeholder="P, M, G, GG" maxLength={240} defaultValue={editingProduct?.sizes.join(", ")} />
          <FormTextArea label="Descrição" name="description" maxLength={600} defaultValue={editingProduct?.description} />
          <FormFooter submitting={submitting} submitError={submitError} onClose={onClose} label={isEditing ? "Salvar produto" : "Criar produto"} />
        </form>
      </ModalFrame>
    );
  }

  if (activeModal === "sale") {
    const selectedSaleCustomer = saleCustomerId ? customers.find((customer) => customer.id === saleCustomerId) ?? null : null;
    const activeProducts = products.filter((product) => product.active);
    const canSubmit = customers.length > 0 && activeProducts.length > 0 && (!saleCustomerId || Boolean(selectedSaleCustomer));
    return (
      <ModalFrame title="Nova venda" onClose={onClose}>
        <form className="space-y-4" onSubmit={onSaleSubmit}>
          {!canSubmit ? <DependencyNotice text="Cadastre ao menos um cliente e um produto antes de criar vendas reais." /> : null}
          {saleCustomerId ? (
            <div className="rounded-crm border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-300">
              <input type="hidden" name="customerId" value={saleCustomerId} />
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Cliente selecionado</p>
              <strong className="mt-1 block text-white">{selectedSaleCustomer?.name ?? "Cliente não encontrado"}</strong>
              {selectedSaleCustomer ? <p className="mt-1 text-xs text-zinc-500">{formatPhoneBR(selectedSaleCustomer.whatsapp)}</p> : null}
            </div>
          ) : (
            <FormSelect label="Cliente" name="customerId" options={customers.map((customer) => [customer.id, customer.name])} required />
          )}
          <SaleCartFields
            products={activeProducts}
            items={saleDraftItems}
            saleDiscount={saleDiscount}
            saleDiscountMode={saleDiscountMode}
            onAdd={onSaleItemAdd}
            onRemove={onSaleItemRemove}
            onChange={onSaleItemChange}
            onDiscountChange={onSaleDiscountChange}
            onDiscountModeChange={onSaleDiscountModeChange}
          />
          <FormSelect label="Canal" name="channel" options={[["WhatsApp", "WhatsApp"], ["Instagram", "Instagram"], ["Site", "Site"], ["Loja Física", "Loja Física"]]} />
          <FormSelect label="Forma de pagamento" name="paymentMethod" options={[["PIX", "Pix"], ["CREDIT_CARD", "Cartão de crédito"], ["DEBIT_CARD", "Cartão de débito"], ["BOLETO", "Boleto"], ["CASH", "Dinheiro"]]} defaultValue="PIX" />
          <FormFooter submitting={submitting} submitError={submitError} onClose={onClose} label="Salvar venda" disabled={!canSubmit} />
        </form>
      </ModalFrame>
    );
  }

  if (activeModal === "payment") {
    const salesWithoutPayment = sales.filter((sale) => !sale.payment && sale.status !== "CANCELED");
    const canSubmit = salesWithoutPayment.length > 0;
    return (
      <ModalFrame title="Novo pagamento" onClose={onClose}>
        <form className="space-y-4" onSubmit={onPaymentSubmit}>
          {!canSubmit ? <DependencyNotice text="Todas as vendas carregadas já possuem pagamento pendente ou confirmado." /> : null}
          {canSubmit ? <PaymentSalePicker sales={salesWithoutPayment} /> : null}
          <FormSelect label="Método" name="method" options={[["PIX", "Pix"], ["CREDIT_CARD", "Cartão de crédito"], ["DEBIT_CARD", "Cartão de débito"], ["BOLETO", "Boleto"], ["CASH", "Dinheiro"]]} />
          <FormFooter submitting={submitting} submitError={submitError} onClose={onClose} label="Registrar pagamento" disabled={!canSubmit} />
        </form>
      </ModalFrame>
    );
  }

  if (activeModal === "post-sale") {
    const canSubmit = customers.length > 0;
    return (
      <ModalFrame title="Novo pós-venda" onClose={onClose}>
        <form className="space-y-4" onSubmit={onPostSaleSubmit}>
          {!canSubmit ? <DependencyNotice text="Cadastre um cliente antes de abrir atendimento." /> : null}
          {selectedSaleForPostSale ? (
            <div className="rounded-crm border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-300">
              <p className="font-semibold text-white">{formatSaleCode(selectedSaleForPostSale)}</p>
              <p className="mt-1">{selectedSaleForPostSale.customer} - {brl(selectedSaleForPostSale.total)}</p>
            </div>
          ) : null}
          <FormSelect label="Cliente" name="customerId" options={customers.map((customer) => [customer.id, customer.name])} required defaultValue={selectedSaleForPostSale?.customerId} />
          <FormSelect label="Venda relacionada" name="saleId" options={sales.map((sale) => [sale.id, `${formatSaleCode(sale)} - ${sale.customer}`])} defaultValue={selectedSaleForPostSale?.id} />
          <FormSelect label="Pedido relacionado" name="orderId" options={orders.map((order) => [order.id, `${formatOrderCode(order)} - ${order.customer}`])} defaultValue={selectedSaleForPostSale?.order?.id} />
          <FormSelect
            label="Tipo"
            name="type"
            options={[
              ["FOLLOW_UP", "Acompanhamento"],
              ["FEEDBACK", "Feedback"],
              ["COMPLAINT", "Reclamação"],
              ["EXCHANGE", "Troca"],
              ["RETURN", "Devolução"],
              ["REPURCHASE", "Recompra"],
              ["REACTIVATION", "Reativação"]
            ]}
          />
          <FormSelect label="Prioridade" name="priority" options={[["LOW", "Baixa"], ["MEDIUM", "Média"], ["HIGH", "Alta"], ["URGENT", "Urgente"]]} />
          <FormInput label="Próxima ação" name="nextActionAt" type="datetime-local" />
          <FormTextArea label="Observações" name="notes" required minLength={5} maxLength={800} />
          <FormFooter submitting={submitting} submitError={submitError} onClose={onClose} label="Criar atendimento" disabled={!canSubmit} />
        </form>
      </ModalFrame>
    );
  }

  if (activeModal === "payment-confirm" || activeModal === "payment-refund" || activeModal === "payment-cancel") {
    const isRefund = activeModal === "payment-refund";
    const isCancel = activeModal === "payment-cancel";
    return (
      <ModalFrame title={isRefund ? "Estornar pagamento" : isCancel ? "Cancelar pagamento" : "Confirmar pagamento"} onClose={onClose}>
        <form className="space-y-4" onSubmit={onPaymentActionSubmit}>
          <div className="rounded-crm border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-300">
            <p className="font-semibold text-white">{selectedPayment?.customer ?? "Pagamento"}</p>
            <p className="mt-1">{selectedPayment ? `${formatSaleCode(selectedPayment)} - ${brl(selectedPayment.amount)} - ${selectedPayment.method}` : "Selecione um pagamento."}</p>
          </div>
          {isRefund || isCancel ? <FormTextArea label={isRefund ? "Motivo do estorno" : "Motivo do cancelamento"} name="reason" required minLength={5} maxLength={300} /> : null}
          <FormFooter submitting={submitting} submitError={submitError} onClose={onClose} label={isRefund ? "Estornar" : isCancel ? "Cancelar" : "Confirmar"} />
        </form>
      </ModalFrame>
    );
  }

  return (
    <ModalFrame title="Detalhes do pedido" onClose={onClose}>
      {selectedOrder ? (
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailBox label="Pedido" value={formatOrderCode(selectedOrder)} />
            <DetailBox label="Venda" value={selectedOrder.saleNumber ? `Venda #${selectedOrder.saleNumber}` : "Venda não informada"} />
            <DetailBox label="Status" value={selectedOrder.status} />
            <DetailBox label="Cliente" value={selectedOrder.customer} />
            <DetailBox label="Canal" value={selectedOrder.channel} />
            <DetailBox label="Total" value={brl(selectedOrder.total)} />
            <DetailBox label="Data" value={shortDate(selectedOrder.date)} />
            <DetailBox label="Endereço" value={buildOrderAddress(selectedOrder)} />
            <DetailBox label="Observações" value="Sem observações registradas." />
          </div>
          <div className="rounded-crm border border-white/10 bg-black/36 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Itens</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedOrder.items.map((item) => <span key={item} className="rounded-crm bg-white/[0.05] px-2 py-1 text-xs text-zinc-300">{item}</span>)}
            </div>
          </div>
          <div className="flex justify-end">
            <button className="rounded-crm bg-bone px-4 py-2 text-sm font-bold text-black" onClick={onClose}>Fechar</button>
          </div>
        </div>
      ) : null}
    </ModalFrame>
  );
}

function ModalFrame({ title, children, onClose }: Readonly<{ title: string; children: React.ReactNode; onClose: () => void }>) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 px-4 py-6 backdrop-blur-md">
      <section className="glass-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-crm p-5 shadow-glass soft-scroll">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button className="rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-300 hover:text-white" onClick={onClose}>Fechar</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Toast({ toast, onClose }: Readonly<{ toast: NonNullable<ToastState>; onClose: () => void }>) {
  const tone = toast.type === "success" ? "border-moss/50 bg-moss/18" : toast.type === "error" ? "border-red-500/40 bg-red-500/14" : "border-ember/40 bg-ember/12";
  return (
    <button
      className={`fixed right-4 top-4 z-50 max-w-sm rounded-crm border px-4 py-3 text-left text-sm font-semibold text-white shadow-glass backdrop-blur-xl ${tone}`}
      onClick={onClose}
    >
      {toast.message}
    </button>
  );
}

function SaleDetailDrawer({
  sale,
  loading,
  error,
  onClose,
  onRetry,
  onOpenOrder,
  onOpenPayments,
  onCreatePostSale
}: Readonly<{
  sale: SaleDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
  onOpenOrder: (sale: SaleSummary) => void;
  onOpenPayments: (sale: SaleSummary) => void;
  onCreatePostSale: (sale: SaleSummary) => void;
}>) {
  if (!sale && !loading && !error) return null;

  return (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 px-4 py-6 backdrop-blur-md">
    <aside className="glass-panel max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-crm border border-white/10 p-5 shadow-glass soft-scroll sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember">Detalhes da venda</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{sale ? formatSaleCode(sale) : "Carregando..."}</h2>
          </div>
          <button className="rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-300 hover:text-white" onClick={onClose}>Fechar</button>
        </div>

        {loading ? <LoadingState /> : null}
        {error ? (
          <section className="glass-panel rounded-crm p-5">
            <p className="text-sm font-semibold text-white">{error}</p>
            <button className="mt-4 rounded-crm bg-bone px-4 py-2 text-sm font-bold text-black" onClick={onRetry}>Tentar novamente</button>
          </section>
        ) : null}

        {sale ? (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailBox label="Status" value={saleStatusLabel(sale.status)} />
              <DetailBox label="Pagamento" value={sale.payment?.status ?? "Pagamento ainda não registrado."} />
              <DetailBox label="Canal" value={sale.channel} />
              <DetailBox label="Responsável" value={sale.responsible} />
              <DetailBox label="Data da venda" value={shortDate(sale.createdAt)} />
              <DetailBox label="Observações" value="Sem observações registradas." />
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <GlassPanel title="Cliente">
                <div className="space-y-3 text-sm text-zinc-300">
                  <SummaryRow label="Nome" value={sale.customer} />
                  <SummaryRow label="WhatsApp" value={formatPhoneBR(sale.customerWhatsapp) || "Não informado"} />
                  <SummaryRow label="E-mail" value={sale.customerEmail ?? "Não informado"} />
                  <SummaryRow label="Endereço" value={sale.customerAddress ?? "Endereço não informado."} />
                  <SummaryRow label="Cidade/estado" value={formatCityState(sale.customerCity, sale.customerState)} />
                  <SummaryRow label="Observações" value={sale.customerNotes ?? "Sem observações registradas."} />
                </div>
                <button className="mt-4 inline-flex items-center gap-2 rounded-crm bg-bone px-3 py-2 text-xs font-bold text-black disabled:opacity-45" onClick={() => openWhatsapp(sale.customerWhatsapp)} disabled={!sale.customerWhatsapp}>
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  Abrir WhatsApp
                </button>
              </GlassPanel>

              <GlassPanel title="Valores">
                <div className="space-y-3 text-sm">
                  <SummaryRow label="Subtotal" value={brl(sale.subtotal)} />
                  <SummaryRow label="Desconto total" value={brl(sale.discount)} />
                  <SummaryRow label="Total final" value={brl(sale.total)} strong />
                  <SummaryRow label="Ticket da venda" value={brl(sale.ticket)} />
                  <SummaryRow label="Custo estimado" value={brl(sale.estimatedCost)} />
                  <SummaryRow label="Lucro estimado" value={brl(sale.estimatedProfit)} />
                  <SummaryRow label="Margem estimada" value={`${sale.estimatedMargin.toFixed(2)}%`} />
                </div>
              </GlassPanel>
            </section>

            <GlassPanel title="Produtos vendidos">
              <div className="grid gap-3">
                {sale.items.length ? sale.items.map((item) => (
                  <article key={`${sale.id}-${item.productId}-${item.productName}`} className="rounded-crm border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">{item.productName}</h3>
                        <p className="mt-1 text-xs text-zinc-500">{item.category ?? "Categoria não informada"} · {item.productSku ?? "sem SKU"}</p>
                      </div>
                      <strong className="text-white">{brl(item.subtotal)}</strong>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-6">
                      <span>Qtd: {item.quantity}</span>
                      <span>Unitário: {brl(item.unitPrice)}</span>
                      <span>Custo: {brl(item.estimatedUnitCost ?? 0)}</span>
                      <span>Desconto: {brl(item.discount)}</span>
                      <span>Tamanho: {item.selectedSize ?? "não informado"}</span>
                      <span>Cor: {item.selectedColor ?? "não informada"}</span>
                    </div>
                    {item.customizationNotes ? <p className="mt-3 rounded-crm bg-black/35 p-2 text-xs text-zinc-300">{item.customizationNotes}</p> : null}
                  </article>
                )) : <EmptyState message="Produtos não encontrados para esta venda." />}
              </div>
            </GlassPanel>

            <section className="grid gap-5 xl:grid-cols-3">
              <GlassPanel title="Pagamento">
                <div className="space-y-3 text-sm">
                  <SummaryRow label="Forma" value={sale.payment?.method ?? "Pagamento ainda não registrado."} />
                  <SummaryRow label="Status" value={sale.payment?.status ?? "Pendente"} />
                  <SummaryRow label="Valor pago" value={sale.payment ? brl(sale.payment.amount) : brl(0)} />
                  <SummaryRow label="Confirmação" value={sale.payment?.paidAt ? shortDate(sale.payment.paidAt) : "Não confirmado"} />
                  <SummaryRow label="Motivo" value={sale.payment?.reason ?? "Sem motivo registrado"} />
                </div>
              </GlassPanel>
              <GlassPanel title="Pedido relacionado">
                <div className="space-y-3 text-sm">
                  <SummaryRow label="Código" value={sale.order ? formatOrderCode(sale.order) : "Pedido ainda não criado."} />
                  <SummaryRow label="Venda" value={formatSaleCode(sale)} />
                  <SummaryRow label="Status" value={sale.order?.status ?? "Sem pedido"} />
                  <SummaryRow label="Criação" value={sale.order?.createdAt ? shortDate(sale.order.createdAt) : "Não informado"} />
                  <SummaryRow label="Envio" value="Não informado" />
                  <SummaryRow label="Entrega" value="Não informado" />
                  <SummaryRow label="Endereço" value={buildCustomerAddress(sale)} />
                </div>
              </GlassPanel>
              <GlassPanel title="Pós-venda">
                {sale.postSales.length ? (
                  <div className="space-y-2">
                    {sale.postSales.map((item) => (
                      <div key={item.id} className="rounded-crm border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-300">
                        {postSaleTypeLabels[item.type]} · {postSaleStatusLabels[item.status]} · {priorityLabels[item.priority]}
                      </div>
                    ))}
                  </div>
                ) : (
                  <button className="rounded-crm bg-bone px-4 py-2 text-sm font-bold text-black" onClick={() => onCreatePostSale(sale)}>Criar pós-venda</button>
                )}
              </GlassPanel>
            </section>

            <div className="flex flex-wrap gap-2">
              <button className="rounded-crm border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white" onClick={() => navigator.clipboard?.writeText(buildSaleSummary(sale))}>Copiar resumo</button>
              <button className="rounded-crm bg-bone px-4 py-2 text-sm font-bold text-black" onClick={() => onCreatePostSale(sale)}>Criar pós-venda</button>
              <button className="rounded-crm border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white disabled:opacity-45" disabled={!sale.order} onClick={() => onOpenOrder(sale)}>Ver pedido relacionado</button>
              <button className="rounded-crm border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white" onClick={() => onOpenPayments(sale)}>Ir para Pagamentos</button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function FormInput({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
  min,
  max,
  step,
  minLength,
  maxLength,
  pattern,
  title,
  mask,
  onValueChange
}: Readonly<{ label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string; min?: string; max?: string; step?: string; minLength?: number; maxLength?: number; pattern?: string; title?: string; mask?: "phone" | "currency"; onValueChange?: (value: string) => void }>) {
  return (
    <label className="block space-y-2 text-sm text-zinc-300">
      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <input
        className="w-full rounded-crm border border-white/10 bg-white/[0.04] px-3 py-3 text-white outline-none focus:border-ember/60"
        name={name}
        type={mask ? "text" : type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        minLength={minLength}
        maxLength={maxLength}
        pattern={pattern}
        title={title}
        inputMode={mask === "currency" ? "numeric" : mask === "phone" ? "tel" : undefined}
        onInput={(event) => {
          if (mask === "phone") event.currentTarget.value = formatPhoneBR(event.currentTarget.value);
          if (mask === "currency") event.currentTarget.value = formatCurrencyBR(event.currentTarget.value);
          onValueChange?.(event.currentTarget.value);
        }}
        onChange={(event) => onValueChange?.(event.currentTarget.value)}
      />
    </label>
  );
}

function ProductImagePreview({ imageUrl, productName }: Readonly<{ imageUrl: string; productName: string }>) {
  return (
    <section className="rounded-crm border border-white/10 bg-black/35 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Prévia da imagem</span>
        <span className="text-[11px] text-zinc-500">Catálogo</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-crm border border-white/10 bg-white/[0.035]">
          {imageUrl ? (
            <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${imageUrl})` }} aria-label={`Prévia de ${productName}`} />
          ) : (
            <Boxes className="h-8 w-8 text-zinc-600" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{productName}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {imageUrl ? "A imagem selecionada será exibida no catálogo após salvar." : "Selecione uma imagem para visualizar antes de salvar."}
          </p>
        </div>
      </div>
    </section>
  );
}

function FormFile({ label, name, accept, hint, onFileChange }: Readonly<{ label: string; name: string; accept: string; hint?: string; onFileChange?: (file: File | null) => void }>) {
  return (
    <label className="block space-y-2 text-sm text-zinc-300">
      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <input
        className="block w-full cursor-pointer rounded-crm border border-white/10 bg-white/[0.04] text-sm text-zinc-300 file:mr-4 file:border-0 file:bg-bone file:px-3 file:py-3 file:text-sm file:font-bold file:text-black hover:file:bg-white"
        name={name}
        type="file"
        accept={accept}
        onChange={(event) => onFileChange?.(event.currentTarget.files?.[0] ?? null)}
      />
      {hint ? <span className="block text-xs leading-5 text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function FormTextArea({ label, name, required = false, minLength, maxLength, defaultValue }: Readonly<{ label: string; name: string; required?: boolean; minLength?: number; maxLength?: number; defaultValue?: string }>) {
  return (
    <label className="block space-y-2 text-sm text-zinc-300">
      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <textarea
        className="min-h-24 w-full resize-none rounded-crm border border-white/10 bg-white/[0.04] p-3 text-white outline-none focus:border-ember/60"
        name={name}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        defaultValue={defaultValue}
      />
    </label>
  );
}

function FormSelect({ label, name, options, required = false, defaultValue }: Readonly<{ label: string; name: string; options: string[][]; required?: boolean; defaultValue?: string }>) {
  return (
    <label className="block space-y-2 text-sm text-zinc-300">
      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <select
        className="w-full rounded-crm border border-white/10 bg-black/70 px-3 py-3 text-white outline-none focus:border-ember/60"
        name={name}
        required={required}
        defaultValue={defaultValue}
      >
        <option value="">{required ? "Selecione" : "Nenhum"}</option>
        {options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function PaymentSalePicker({ sales }: Readonly<{ sales: SaleSummary[] }>) {
  const [selectedSaleId, setSelectedSaleId] = useState(sales[0]?.id ?? "");
  const effectiveSelectedSaleId = sales.some((sale) => sale.id === selectedSaleId) ? selectedSaleId : sales[0]?.id ?? "";
  const selectedSale = sales.find((sale) => sale.id === effectiveSelectedSaleId);

  return (
    <div className="space-y-3">
      <label className="block space-y-2 text-sm text-zinc-300">
        <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Venda</span>
        <select
          className="w-full rounded-crm border border-white/10 bg-black/70 px-3 py-3 text-white outline-none focus:border-ember/60"
          name="saleId"
          required
          value={effectiveSelectedSaleId}
          onChange={(event) => setSelectedSaleId(event.target.value)}
        >
          {sales.map((sale) => (
            <option key={sale.id} value={sale.id}>
              {formatSaleCode(sale)} - {sale.customer} - {brl(sale.total)}
            </option>
          ))}
        </select>
      </label>
      <div className="rounded-crm border border-white/10 bg-white/[0.04] p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Valor do pagamento</p>
        <strong className="mt-2 block text-xl font-semibold text-white">{selectedSale ? brl(selectedSale.total) : brl(0)}</strong>
        <p className="mt-1 text-xs text-zinc-500">Valor definido pela venda selecionada.</p>
      </div>
    </div>
  );
}

function ProductPicker({
  products,
  value,
  required,
  onChange
}: Readonly<{
  products: Product[];
  value: string;
  required?: boolean;
  onChange: (productId: string) => void;
}>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedProduct = products.find((product) => product.id === value) ?? null;
  const normalizedSearch = search.trim().toLowerCase();
  const visibleProducts = normalizedSearch
    ? products.filter((product) => [product.name, product.sku ?? "", product.category].some((field) => field.toLowerCase().includes(normalizedSearch)))
    : products;

  return (
    <div
      className="relative block space-y-2 text-sm text-zinc-300"
      onBlur={(event) => {
        const nextFocused = event.relatedTarget;
        if (!(nextFocused instanceof Node) || !event.currentTarget.contains(nextFocused)) setOpen(false);
      }}
    >
      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Produto</span>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex w-full items-center justify-between gap-3 rounded-crm border px-3 py-3 text-left text-white outline-none transition ${open ? "border-ember/60 bg-black/80" : "border-white/10 bg-black/70"}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={`min-w-0 flex-1 truncate ${selectedProduct ? "text-white" : "text-zinc-500"}`}>
          {selectedProduct?.name ?? "Selecione"}
        </span>
        <span className="shrink-0 text-xs text-zinc-500">v</span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-crm border border-ember/30 bg-[#080808] shadow-2xl shadow-black/60">
          <div className="border-b border-white/10 p-2">
            <input
              autoFocus
              className="w-full rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-ember/60"
              maxLength={80}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar produto..."
              value={search}
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1 soft-scroll" role="listbox">
            <button
              className="flex w-full rounded-crm px-3 py-2 text-left text-sm text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
              onClick={() => {
                onChange("");
                setSearch("");
                setOpen(false);
              }}
              type="button"
            >
              Selecione
            </button>
            {visibleProducts.map((product) => (
              <button
                aria-selected={product.id === value}
                className={`flex w-full items-center justify-between gap-3 rounded-crm px-3 py-2 text-left text-sm transition ${product.id === value ? "bg-ember/15 text-white" : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"}`}
                key={product.id}
                onClick={() => {
                  onChange(product.id);
                  setSearch("");
                  setOpen(false);
                }}
                role="option"
                type="button"
              >
                <span className="min-w-0 flex-1 truncate">{product.name}</span>
                <span className="shrink-0 text-xs text-ember">{brl(product.price)}</span>
              </button>
            ))}
            {visibleProducts.length === 0 ? (
              <p className="px-3 py-4 text-sm text-zinc-500">Nenhum produto encontrado.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SaleCartFields({
  products,
  items,
  saleDiscount,
  saleDiscountMode,
  onAdd,
  onRemove,
  onChange,
  onDiscountChange,
  onDiscountModeChange
}: Readonly<{
  products: Product[];
  items: SaleDraftItem[];
  saleDiscount: string;
  saleDiscountMode: SaleDiscountMode;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<SaleDraftItem>) => void;
  onDiscountChange: (value: string) => void;
  onDiscountModeChange: (mode: SaleDiscountMode) => void;
}>) {
  const subtotal = items.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) return sum;
    return sum + Math.max(0, product.price * Math.max(1, item.quantity || 1) - parseCurrencyBR(item.discount));
  }, 0);
  const itemCount = items.reduce((sum, item) => sum + (item.productId ? Math.max(1, item.quantity || 1) : 0), 0);
  const saleDiscountPercent = parsePercentBR(saleDiscount);
  const saleDiscountValue = saleDiscountMode === "PERCENTAGE"
    ? roundCurrency(subtotal * (saleDiscountPercent / 100))
    : parseCurrencyBR(saleDiscount);
  const total = Math.max(0, subtotal - saleDiscountValue);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Produtos da venda</p>
        <button type="button" className="inline-flex items-center gap-2 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Adicionar produto
        </button>
      </div>
      {items.map((item, index) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        const hasColors = Boolean(product?.colors.length);
        const hasSizes = Boolean(product?.sizes.length);
        const itemQuantity = Math.max(1, item.quantity || 1);
        const itemDiscount = parseCurrencyBR(item.discount);
        const itemSubtotal = product ? Math.max(0, product.price * itemQuantity - itemDiscount) : 0;

        return (
          <div key={item.id} className="rounded-crm border border-white/10 bg-white/[0.025] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{index === 0 ? "Produto principal" : `Produto ${index + 1}`}</p>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-crm border border-white/10 bg-white/[0.04] text-zinc-300 disabled:opacity-35" onClick={() => onRemove(item.id)} disabled={items.length === 1} aria-label="Remover produto">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.25fr_0.45fr_0.75fr]">
  <ProductPicker products={products} value={item.productId} required={index === 0} onChange={(productId) => onChange(item.id, { productId })} />

  <label className="block space-y-2 text-sm text-zinc-300">
    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Quantidade</span>
    <input
      className="w-full rounded-crm border border-white/10 bg-white/[0.04] px-3 py-3 text-white outline-none focus:border-ember/60"
      type="number"
      min="1"
      max="999"
      step="1"
      value={item.quantity}
      required={index === 0}
      onChange={(event) => onChange(item.id, { quantity: Number(event.target.value) })}
    />
  </label>

  <div className="rounded-crm border border-white/10 bg-black/35 px-3 py-2.5 text-sm">
    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Valor do produto</span>
    <p className="mt-1 font-semibold text-white">
      {product ? brl(product.price) : "Selecione um produto"}
    </p>
    {product ? (
        <p className="mt-1 text-xs text-zinc-500">
         Subtotal do item: {brl(itemSubtotal)}
          </p>
          ) : null}
          </div>
      </div>

            <div className={`mt-3 grid gap-3 ${hasColors && hasSizes ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              {hasColors ? (
                <label className="block space-y-2 text-sm text-zinc-300">
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Cor</span>
                  <select className="w-full rounded-crm border border-white/10 bg-black/70 px-3 py-3 text-white outline-none focus:border-ember/60" value={item.selectedColor} onChange={(event) => onChange(item.id, { selectedColor: event.target.value })}>
                    <option value="">Selecione</option>
                    {product?.colors.map((color) => <option key={color} value={color}>{color}</option>)}
                  </select>
                </label>
              ) : null}
              {hasSizes ? (
                <label className="block space-y-2 text-sm text-zinc-300">
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Tamanho</span>
                  <select className="w-full rounded-crm border border-white/10 bg-black/70 px-3 py-3 text-white outline-none focus:border-ember/60" value={item.selectedSize} onChange={(event) => onChange(item.id, { selectedSize: event.target.value })}>
                    <option value="">Selecione</option>
                    {product?.sizes.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
              ) : null}
              <label className="block space-y-2 text-sm text-zinc-300">
                <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Desconto do item</span>
                <input className="w-full rounded-crm border border-white/10 bg-white/[0.04] px-3 py-3 text-white outline-none focus:border-ember/60" inputMode="numeric" value={item.discount} onInput={(event) => onChange(item.id, { discount: formatCurrencyBR(event.currentTarget.value) })} onChange={(event) => onChange(item.id, { discount: event.currentTarget.value })} />
              </label>
            </div>

            <div className="mt-3">
              <label className="block space-y-2 text-sm text-zinc-300">
                <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Customização/observações</span>
                <textarea className="min-h-20 w-full resize-none rounded-crm border border-white/10 bg-white/[0.04] p-3 text-white outline-none focus:border-ember/60" maxLength={500} value={item.customizationNotes} onChange={(event) => onChange(item.id, { customizationNotes: event.target.value })} />
              </label>
            </div>
          </div>
        );
      })}

      <div className="grid gap-3 rounded-crm border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-[0.75fr_1fr]">
        <label className="block space-y-2 text-sm text-zinc-300">
          <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Tipo de desconto</span>
          <select
            className="w-full rounded-crm border border-white/10 bg-black/70 px-3 py-3 text-white outline-none focus:border-ember/60"
            name="discountMode"
            value={saleDiscountMode}
            onChange={(event) => onDiscountModeChange(event.target.value as SaleDiscountMode)}
          >
            <option value="AMOUNT">Valor em R$</option>
            <option value="PERCENTAGE">Porcentagem</option>
          </select>
        </label>
        {saleDiscountMode === "PERCENTAGE" ? (
          <label className="block space-y-2 text-sm text-zinc-300">
            <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Desconto da venda (%)</span>
            <input
              className="w-full rounded-crm border border-white/10 bg-white/[0.04] px-3 py-3 text-white outline-none focus:border-ember/60"
              inputMode="decimal"
              max="100"
              min="0"
              name="discountPercent"
              onChange={(event) => onDiscountChange(formatPercentInput(event.target.value))}
              placeholder="0"
              value={saleDiscount}
            />
          </label>
        ) : (
          <FormInput label="Desconto da venda" name="discount" defaultValue={saleDiscount} mask="currency" onValueChange={onDiscountChange} />
        )}
      </div>
      <div className="grid gap-3 rounded-crm border border-white/10 bg-black/35 p-3 text-sm sm:grid-cols-4">
        <DetailBox label="Itens" value={String(itemCount)} />
        <DetailBox label="Subtotal" value={brl(subtotal)} />
        <DetailBox label="Desconto" value={saleDiscountMode === "PERCENTAGE" ? `${formatPercentDisplay(saleDiscountPercent)}% (${brl(saleDiscountValue)})` : brl(saleDiscountValue)} />
        <DetailBox label="Total estimado" value={brl(total)} />
      </div>
    </div>
  );
}

function createSaleDraftItem(): SaleDraftItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: "",
    quantity: 1,
    selectedColor: "",
    selectedSize: "",
    discount: "R$ 0,00",
    customizationNotes: ""
  };
}

function FormFooter({ submitting, submitError, onClose, label, disabled = false }: Readonly<{ submitting: boolean; submitError: string; onClose: () => void; label: string; disabled?: boolean }>) {
  return (
    <div className="space-y-3">
      {submitError ? <p className="rounded-crm border border-red-500/35 bg-red-500/10 p-3 text-sm text-red-200">{submitError}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="rounded-crm border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white" onClick={onClose}>Cancelar</button>
        <button type="submit" className="rounded-crm bg-bone px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-45" disabled={submitting || disabled}>
          {submitting ? "Salvando..." : label}
        </button>
      </div>
    </div>
  );
}

function DependencyNotice({ text }: Readonly<{ text: string }>) {
  return <p className="rounded-crm border border-ember/30 bg-ember/10 p-3 text-sm text-ember">{text}</p>;
}

function DetailBox({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-crm border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  );
}

function Dashboard({ dashboard }: Readonly<{ dashboard: DashboardData }>) {
  const mounted = useMounted();
  const revenueSeries = dashboard.revenueByDay.length ? dashboard.revenueByDay : [{ day: "01", value: 0 }];
  const revenueTotal = dashboard.revenueByDay.reduce((sum, item) => sum + item.value, 0);
  const bestRevenueDay = dashboard.revenueByDay.reduce<(typeof dashboard.revenueByDay)[number] | null>((best, item) => {
    if (!best || item.value > best.value) return item;
    return best;
  }, null);
  const channelSeries = dashboard.revenueByChannel;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Faturamento" value={brl(dashboard.kpis.revenue)} hint="dados atualizados" />
        <Metric label="Vendas hoje" value={String(dashboard.kpis.salesToday)} hint="vendas criadas hoje" />
        <Metric label="Vendas semana" value={String(dashboard.kpis.salesWeek)} hint="semana atual" />
        <Metric label="Vendas mês" value={String(dashboard.kpis.salesMonth)} hint="mês atual" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Vendas confirmadas" value={String(dashboard.kpis.sales)} hint="pagas/confirmadas" />
        <Metric label="Ticket médio" value={brl(dashboard.kpis.averageTicket)} hint="média das vendas" />
        <Metric label="Lucro estimado" value={brl(dashboard.kpis.estimatedProfit)} hint="total - custo estimado" />
        <Metric label="Clientes" value={String(dashboard.kpis.customers)} hint="base real" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.75fr]">
        <GlassPanel title="Faturamento do mês">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <SalesInsight label="Total mensal" value={brl(revenueTotal)} detail="pagamentos confirmados" />
            <SalesInsight label="Melhor dia do mês" value={bestRevenueDay?.day ?? "Sem dados"} detail={bestRevenueDay ? brl(bestRevenueDay.value) : "sem faturamento"} />
            <SalesInsight label="Ticket médio" value={brl(dashboard.kpis.averageTicket)} detail={`${dashboard.kpis.sales} vendas confirmadas`} />
          </div>
          <div className="relative h-72 overflow-hidden rounded-crm border border-white/10 bg-[radial-gradient(circle_at_70%_18%,rgba(216,177,93,0.18),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(91,117,103,0.18),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))] p-3">
            <div className="pointer-events-none absolute inset-x-10 bottom-7 h-16 rounded-full bg-ember/10 blur-3xl" aria-hidden />
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries} margin={{ top: 18, right: 18, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="dashboardRevenueGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d8b15d" stopOpacity={0.46} />
                      <stop offset="52%" stopColor="#5b7567" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#5b7567" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.055)" strokeDasharray="4 8" vertical={false} />
                  <XAxis dataKey="day" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} minTickGap={12} />
                  <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} width={72} tickFormatter={(value) => brl(Number(value)).replace("R$", "").trim()} />
                  <Tooltip formatter={(value) => brl(Number(value))} labelFormatter={(label) => `Dia ${label}`} contentStyle={{ background: "#080a0c", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
                  <Area name="Faturamento" type="monotone" dataKey="value" stroke="#d8b15d" strokeWidth={3} fill="url(#dashboardRevenueGlow)" dot={false} activeDot={{ r: 5, stroke: "#fff7df", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartSkeleton />
            )}
          </div>
        </GlassPanel>

        <GlassPanel title="Vendas por canal">
          <div className="grid min-h-72 place-items-center gap-4 sm:grid-cols-[1fr_1fr] xl:grid-cols-1">
            <div className="h-44 w-full">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelSeries} innerRadius={54} outerRadius={78} dataKey="value" paddingAngle={3}>
                      {channelSeries.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ChartSkeleton />
              )}
            </div>
            <div className="w-full space-y-3">
              {channelSeries.length ? channelSeries.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <span className="h-2 w-2 rounded-full" style={{ background: item.fill }} />
                    {item.name}
                  </span>
                  <span className="font-semibold text-white">{item.value}%</span>
                </div>
              )) : <p className="text-sm text-zinc-500">Sem vendas confirmadas por canal.</p>}
            </div>
          </div>
        </GlassPanel>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Leads" value={String(dashboard.kpis.leads)} hint="funil comercial" />
        <Metric label="Atendimentos pós-venda" value={String(dashboard.kpis.postSales)} hint="em operação" warning />
        <Metric label="Clientes para reativação" value={String(dashboard.kpis.reactivationCustomers)} hint="clientes inativos" warning />
        <Metric label="Pedidos em produção" value={String(dashboard.kpis.productionOrders)} hint="fila sob demanda" />
        <Metric label="Pagamentos pendentes" value={String(dashboard.kpis.pendingPayments)} hint="validar manualmente" warning />
      </section>
    </div>
  );
}

function Clients({
  customers,
  search,
  onSearchChange,
  onOpenDetail,
  onEdit,
  onInactivate,
  onCreateSale
}: Readonly<{
  customers: Customer[];
  search: string;
  onSearchChange: (value: string) => void;
  onOpenDetail: (customerId: string) => void;
  onEdit: (customer: Customer) => void;
  onInactivate: (customer: Customer) => void;
  onCreateSale: (customer: Customer) => void;
}>) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(customers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedCustomers = customers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <GlassPanel
      title="Lista de clientes"
      actions={(
        <label className="flex min-w-60 items-center gap-2 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-500">
          <Search className="h-4 w-4" aria-hidden />
          <input
            className="w-full bg-transparent text-zinc-200 outline-none"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(event) => {
              onSearchChange(event.target.value);
              setPage(1);
            }}
          />
        </label>
      )}
    >
      {customers.length === 0 ? <EmptyState message="Nenhum cliente cadastrado ainda." /> : null}
      <div className="overflow-x-auto soft-scroll">
        {customers.length > 0 ? <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            <tr>
              <th className="py-3">Cliente</th>
              <th>WhatsApp</th>
              <th>Cidade</th>
              <th>E-mail</th>
              <th>Total gasto</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {paginatedCustomers.map((customer) => (
              <tr key={customer.id} className="text-zinc-300">
                <td className="py-4 font-semibold text-white">
                  <button className="text-left hover:text-ember" onClick={() => onOpenDetail(customer.id)}>{customer.name}</button>
                </td>
                <td>{formatPhoneBR(customer.whatsapp)}</td>
                <td>{customer.city}{customer.state ? `/${customer.state}` : ""}</td>
                <td>{customer.email ?? "Não informado"}</td>
                <td>{brl(customer.totalSpent)}</td>
                <td><Pill label={customer.status} /></td>
                <td className="flex gap-2 py-3">
                  <IconButton label="Ver detalhes" icon={ClipboardList} onClick={() => onOpenDetail(customer.id)} />
                  <IconButton label="Editar cliente" icon={Pencil} onClick={() => onEdit(customer)} />
                  <IconButton label="Abrir WhatsApp" icon={MessageCircle} onClick={() => window.open(`https://wa.me/55${customer.whatsapp.replace(/\D/g, "")}`, "_blank")} />
                  <IconButton label="Nova venda" icon={ShoppingBag} onClick={() => onCreateSale(customer)} />
                  <IconButton label="Inativar cliente" icon={UserX} disabled={customer.status === "Inativo"} onClick={() => onInactivate(customer)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table> : null}
      </div>
      <PaginationControls
        className="mt-4"
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={customers.length}
        pageSize={pageSize}
        itemLabel="clientes"
        onPageChange={setPage}
      />
    </GlassPanel>
  );
}

function Leads({ leads, onCreate, onMove, onEdit }: Readonly<{ leads: Lead[]; onCreate: () => void; onMove: (leadId: string, status: LeadStatus) => void; onEdit: (lead: Lead) => void }>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [activeLeadId, setActiveLeadId] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [listPage, setListPage] = useState(1);
  const pageSize = 5;
  const activeLead = leads.find((lead) => lead.id === activeLeadId) ?? null;
  const filteredListLeads = useMemo(() => {
    const search = listSearch.trim().toLowerCase();
    if (!search) return leads;
    return leads.filter((lead) =>
      [lead.name, lead.whatsapp, lead.origin, lead.status, lead.notes ?? ""].some((value) => value.toLowerCase().includes(search))
    );
  }, [leads, listSearch]);
  const totalPages = Math.max(1, Math.ceil(filteredListLeads.length / pageSize));
  const currentPage = Math.min(listPage, totalPages);
  const paginatedListLeads = filteredListLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleDragStart(event: DragStartEvent) {
    setActiveLeadId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const destination = event.over?.id;
    setActiveLeadId("");
    if (!destination || !leadColumns.some((column) => column.key === destination)) return;
    onMove(String(event.active.id), destination as LeadStatus);
  }

  return (
    <div className="space-y-5">
      <DndContext sensors={sensors} collisionDetection={kanbanCollisionDetection} onDragStart={handleDragStart} onDragCancel={() => setActiveLeadId("")} onDragEnd={handleDragEnd}>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {leadColumns.map((column) => {
            const columnLeads = leads.filter((lead) => getLeadStatusKey(lead) === column.key);
            return (
              <LeadColumn key={column.key} status={column.key} label={column.label} leads={columnLeads} onCreate={onCreate} onEdit={onEdit} />
            );
          })}
        </div>
        <DragOverlay>
          {activeLead ? <LeadCardPreview lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>

      <GlassPanel
        title="Lista detalhada de leads"
        actions={(
          <label className="flex min-w-60 items-center gap-2 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-500">
            <Search className="h-4 w-4" aria-hidden />
            <input
              className="w-full bg-transparent text-zinc-200 outline-none"
              placeholder="Buscar lead..."
              value={listSearch}
              maxLength={80}
              onChange={(event) => {
                setListSearch(event.target.value);
                setListPage(1);
              }}
            />
          </label>
        )}
      >
        {filteredListLeads.length === 0 ? <EmptyState message="Nenhum lead encontrado." /> : null}
        {filteredListLeads.length > 0 ? (
          <div className="overflow-x-auto soft-scroll">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                <tr>
                  <th className="py-3">Nome</th>
                  <th>WhatsApp</th>
                  <th>Status</th>
                  <th>Origem</th>
                  <th>Último contato</th>
                  <th>Valor estimado</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {paginatedListLeads.map((lead) => (
                  <tr key={lead.id} className="text-zinc-300">
                    <td className="py-4 font-semibold text-white">{lead.name}</td>
                    <td>{formatPhoneBR(lead.whatsapp)}</td>
                    <td><Pill label={lead.status} warning={getLeadStatusKey(lead) === "CLOSED_LOST"} /></td>
                    <td><Pill label={lead.origin || "Não informado"} /></td>
                    <td>{lead.lastContact}</td>
                    <td className="font-semibold text-ember">{brl(lead.value)}</td>
                    <td className="flex gap-2 py-3">
                      <IconButton label="Ver detalhes" icon={ClipboardList} onClick={() => onEdit(lead)} />
                      <IconButton label="Editar lead" icon={Pencil} onClick={() => onEdit(lead)} />
                      <IconButton label="Converter em cliente" icon={Users} onClick={() => onMove(lead.id, "CLOSED_WON")} disabled={Boolean(lead.convertedCustomerId) || getLeadStatusKey(lead) === "CLOSED_WON"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              className="mt-4"
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredListLeads.length}
              pageSize={pageSize}
              itemLabel="leads"
              onPageChange={setListPage}
            />
          </div>
        ) : null}
      </GlassPanel>
    </div>
  );
}

function LeadColumn({ status, label, leads, onCreate, onEdit }: Readonly<{ status: LeadStatus; label: string; leads: Lead[]; onCreate: () => void; onEdit: (lead: Lead) => void }>) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`min-w-0 min-h-96 rounded-crm border p-3 transition ${isOver ? "border-ember/70 bg-ember/10" : "border-white/10 bg-black/42"}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{label}</h2>
        <Pill label={String(leads.length)} />
      </div>
      <div className={`${leads.length > 3 ? "max-h-[520px] overflow-y-auto pr-1 soft-scroll" : ""} space-y-3`}>
        {leads.length === 0 ? <EmptyState message="Nenhum lead nesta etapa." /> : null}
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onEdit={onEdit} />
        ))}
      </div>
      <button className="mt-3 w-full rounded-crm border border-dashed border-white/14 px-3 py-2 text-xs text-zinc-400 hover:text-white" onClick={onCreate}>+ lead</button>
    </section>
  );
}

function LeadCard({ lead, onEdit }: Readonly<{ lead: Lead; onEdit: (lead: Lead) => void }>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`touch-none overflow-hidden rounded-crm border border-white/10 bg-black/36 p-3 transition-opacity ${isDragging ? "cursor-grabbing opacity-35" : "cursor-grab"}`}
    >
      <LeadCardContent lead={lead} />
      <div className="mt-3 flex justify-end">
        <button
          className="inline-flex items-center gap-1 rounded-crm border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-zinc-300 transition hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(lead);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          type="button"
        >
          <Pencil className="h-3 w-3" aria-hidden />
          Editar
        </button>
      </div>
    </article>
  );
}

function LeadCardPreview({ lead }: Readonly<{ lead: Lead }>) {
  return (
    <article className="w-[min(260px,calc(100vw-32px))] overflow-hidden rounded-crm border border-ember/45 bg-black/92 p-3 shadow-2xl shadow-black/50">
      <LeadCardContent lead={lead} />
    </article>
  );
}

function LeadCardContent({ lead }: Readonly<{ lead: Lead }>) {
  return (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold leading-6 text-white">{lead.name}</h3>
          <p className="mt-1 text-xs text-zinc-500">{lead.whatsapp}</p>
        </div>
        <Pill label={lead.origin} className="max-w-[46%] shrink-0 truncate" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-400">
        <span className="min-w-0 truncate">{lead.lastContact}</span>
        <strong className="shrink-0 text-ember">{brl(lead.value)}</strong>
      </div>
    </>
  );
}

function getLeadStatusKey(lead?: Lead | null): LeadStatus {
  if (!lead) return "IN_PROGRESS";
  if (lead.statusKey === "NEW") return "IN_PROGRESS";
  if (lead.statusKey === "INTERESTED") return "IN_PROGRESS";
  if (lead.statusKey) return lead.statusKey;
  if (lead.status === "Novo") return "IN_PROGRESS";
  return leadColumns.find((column) => column.label === lead.status)?.key ?? "IN_PROGRESS";
}

function Products({ products, onEdit }: Readonly<{ products: Product[]; onEdit: (product: Product) => void }>) {
  if (products.length === 0) {
    return (
      <GlassPanel title="Catálogo de produtos">
        <EmptyState message="Nenhum produto cadastrado ainda." />
      </GlassPanel>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {products.map((product, index) => (
        <article key={product.id} className="glass-panel overflow-hidden rounded-crm">
          <div className="product-shine grid aspect-[1.22] place-items-center overflow-hidden bg-black/40">
            {product.imageUrl ? (
              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${product.imageUrl})` }} aria-label={`Imagem de ${product.name}`} />
            ) : (
              <div className={`relative h-28 w-28 rounded-full border border-white/10 bg-black/70 shadow-glow ${index % 3 === 0 ? "rotate-3" : "-rotate-2"}`}>
                <Boxes className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 text-zinc-300" aria-hidden />
              </div>
            )}
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{product.name}</h3>
                <p className="text-xs text-zinc-500">{product.category}</p>
              </div>
              <Pill label="Ativo" />
            </div>
            <p className="min-h-10 text-xs leading-5 text-zinc-400">{product.description}</p>
            <div className="flex items-end justify-between">
              <strong className="text-lg text-white">{brl(product.price)}</strong>
              <span className="text-xs text-zinc-500">{product.sku}</span>
            </div>
            <div className="grid gap-2 text-xs text-zinc-500">
              <span>Custo: {brl(product.cost)}</span>
              <span>Cores: {product.colors.length ? product.colors.join(", ") : "Opcional"}</span>
              <span>Tamanhos: {product.sizes.length ? product.sizes.join(", ") : "Opcional"}</span>
            </div>
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:text-white"
              onClick={() => onEdit(product)}
              type="button"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Editar produto
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Sales({
  sales,
  summary,
  products,
  customers,
  filters,
  onFiltersChange,
  onOpenDetail,
  onOpenOrder,
  onOpenPayments,
  onCreatePostSale
}: Readonly<{
  sales: SaleSummary[];
  summary: SalesSummaryData;
  products: Product[];
  customers: Customer[];
  filters: SalesFilters;
  onFiltersChange: (filters: SalesFilters) => void;
  onOpenDetail: (saleId: string) => void;
  onOpenOrder: (sale: SaleSummary) => void;
  onOpenPayments: (sale: SaleSummary) => void;
  onCreatePostSale: (sale: SaleSummary) => void;
}>) {
  const mounted = useMounted();
  const [page, setPage] = useState(1);
  const pageSize = 3;
  const performanceSeries = buildSalesPerformanceSeries(summary.revenueByDay, summary.salesByDay, summary.averageTicketByDay);
  const bestDay = getBestPerformanceDay(performanceSeries);
  const topChannel = getTopChartItem(summary.salesByChannel);
  const topStatus = getTopChartItem(summary.salesByStatus);
  const channelSeries = summary.salesByChannel;
  const totalPages = Math.max(1, Math.ceil(sales.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedSales = sales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function updateFilter(partial: Partial<SalesFilters>) {
    setPage(1);
    onFiltersChange({ ...filters, ...partial });
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SalesMetric label="Vendas hoje" value={brl(summary.salesTodayValue)} detail={`${summary.salesToday} vendas realizadas`} />
        <SalesMetric label="Vendas da semana" value={brl(summary.salesWeekValue)} detail={`${summary.salesWeek} vendas na semana atual`} />
        <SalesMetric label="Vendas do mês" value={brl(summary.salesMonthValue)} detail={`${summary.salesMonth} vendas no mês atual`} />
        <SalesMetric label="Ticket médio geral" value={brl(summary.averageTicketGeneral)} detail={`baseado em ${summary.totalSalesInFilter} vendas`} />
      </section>

      <GlassPanel title="Filtros de vendas">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(3,0.7fr)]">
          <label className="flex items-center gap-2 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-500">
            <Search className="h-4 w-4" aria-hidden />
            <input
              className="w-full bg-transparent text-zinc-200 outline-none"
              placeholder="Buscar venda, cliente ou produto..."
              value={filters.search}
              maxLength={80}
              onChange={(event) => updateFilter({ search: event.target.value })}
            />
          </label>
          <select className="rounded-crm border border-white/10 bg-black/60 px-3 py-2 text-sm text-white" value={filters.range} onChange={(event) => updateFilter({ ...rangeToDates(event.target.value as SalesFilters["range"]), range: event.target.value as SalesFilters["range"] })}>
            <option value="today">Hoje</option>
            <option value="yesterday">Ontem</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="month">Este mês</option>
            <option value="lastMonth">Mês passado</option>
            <option value="custom">Personalizado</option>
          </select>
          <select className="rounded-crm border border-white/10 bg-black/60 px-3 py-2 text-sm text-white" value={filters.status} onChange={(event) => updateFilter({ status: event.target.value })}>
            <option value="">Status</option>
            <option value="WAITING_PAYMENT">Aguardando pagamento</option>
            <option value="CONFIRMED">Confirmada</option>
            <option value="CANCELED">Cancelada</option>
          </select>
          <select className="rounded-crm border border-white/10 bg-black/60 px-3 py-2 text-sm text-white" value={filters.channel} onChange={(event) => updateFilter({ channel: event.target.value })}>
            <option value="">Canal</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Instagram">Instagram</option>
            <option value="Site">Site</option>
            <option value="Loja Física">Loja Física</option>
          </select>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FormInput label="Data inicial" name="salesStartDate" type="date" defaultValue={filters.startDate} onValueChange={(value) => updateFilter({ range: "custom", startDate: value })} />
          <FormInput label="Data final" name="salesEndDate" type="date" defaultValue={filters.endDate} onValueChange={(value) => updateFilter({ range: "custom", endDate: value })} />
          <select className="rounded-crm border border-white/10 bg-black/60 px-3 py-2 text-sm text-white" value={filters.customerId} onChange={(event) => updateFilter({ customerId: event.target.value })}>
            <option value="">Cliente</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
          <select className="rounded-crm border border-white/10 bg-black/60 px-3 py-2 text-sm text-white" value={filters.productId} onChange={(event) => updateFilter({ productId: event.target.value })}>
            <option value="">Produto</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </div>
      </GlassPanel>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_0.75fr]">
        <GlassPanel title="Desempenho do período">
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <SalesInsight label="Melhor dia" value={bestDay ? bestDay.day : "Sem vendas"} detail={bestDay ? `${brl(bestDay.revenue)} em receita` : "Sem leitura no período"} />
            <SalesInsight label="Canal principal" value={topChannel?.name ?? "Sem canal"} detail={topChannel ? `${topChannel.value} vendas` : "Sem vendas por canal"} />
            <SalesInsight label="Status dominante" value={topStatus?.name ?? "Sem status"} detail={topStatus ? `${topStatus.value} vendas` : "Sem status no período"} />
          </div>
          <div className="relative h-[340px] min-w-0 overflow-hidden rounded-crm border border-white/10 bg-[radial-gradient(circle_at_75%_20%,rgba(91,117,103,0.22),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))] p-3">
            <div className="pointer-events-none absolute inset-x-8 bottom-8 h-20 rounded-full bg-moss/10 blur-3xl" aria-hidden />
            {!mounted ? <ChartSkeleton /> : null}
            {mounted && performanceSeries.length === 0 ? <EmptyState message="Sem vendas no período selecionado." /> : null}
            {mounted && performanceSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceSeries} margin={{ top: 18, right: 12, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="salesRevenueGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93c5a3" stopOpacity={0.46} />
                      <stop offset="58%" stopColor="#5b7567" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="#5b7567" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="salesTicketGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d8b15d" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#d8b15d" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="salesCountGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f4f2ec" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#f4f2ec" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.055)" strokeDasharray="4 8" vertical={false} />
                  <XAxis dataKey="day" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} minTickGap={10} />
                  <YAxis yAxisId="money" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} width={72} tickFormatter={(value) => brl(Number(value)).replace("R$", "").trim()} />
                  <YAxis yAxisId="count" orientation="right" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "Vendas") return [`${Number(value)} vendas`, name];
                      return [brl(Number(value)), name];
                    }}
                    labelFormatter={(label) => `Dia ${label}`}
                    contentStyle={{ background: "#080a0c", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ color: "#d4d4d8", fontSize: 12, paddingBottom: 8 }} />
                  <Area yAxisId="money" name="Receita" type="monotone" dataKey="revenue" stroke="#93c5a3" strokeWidth={3} fill="url(#salesRevenueGlow)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#e8efe9" }} />
                  <Area yAxisId="money" name="Ticket médio" type="monotone" dataKey="ticket" stroke="#d8b15d" strokeWidth={2.5} fill="url(#salesTicketGlow)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff7df" }} />
                  <Area yAxisId="count" name="Vendas" type="monotone" dataKey="sales" stroke="#f4f2ec" strokeWidth={2} fill="url(#salesCountGlow)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </GlassPanel>

        <div className="space-y-5">
          <GlassPanel title="Canais">
            <RankingBars items={channelSeries} emptyMessage="Sem vendas por canal no período." />
          </GlassPanel>
          <GlassPanel title="Status">
            <RankingBars items={summary.salesByStatus} emptyMessage="Sem vendas por status no período." />
          </GlassPanel>
        </div>
      </section>

      <GlassPanel title="Lista de vendas" actions={<Filters labels={["Data", "Valor", "Status"]} />}>
        {sales.length === 0 ? <EmptyState message="Nenhuma venda encontrada para este período." /> : null}
        {sales.length > 0 ? (
          <div className="overflow-x-auto soft-scroll">
            <table className="w-full min-w-[1060px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[7.5%]" />
                <col className="w-[7%]" />
                <col className="w-[12%]" />
                <col className="w-[15.5%]" />
                <col className="w-[8%]" />
                <col className="w-[11.5%]" />
                <col className="w-[14%]" />
                <col className="w-[9%]" />
                <col className="w-[7.5%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                <tr>
                  <th className="px-2 py-3 first:pl-0">Venda</th>
                  <th className="px-2 py-3">Data</th>
                  <th className="px-2 py-3">Cliente</th>
                  <th className="px-2 py-3">Produtos</th>
                  <th className="px-2 py-3">Canal</th>
                  <th className="px-2 py-3">Pagamento</th>
                  <th className="px-2 py-3">Status</th>
                  <th className="px-2 py-3">Total</th>
                  <th className="px-2 py-3">Ticket</th>
                  <th className="px-2 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {paginatedSales.map((sale) => (
                  <tr key={sale.id} className="cursor-pointer text-zinc-300 transition hover:bg-white/[0.035]" onClick={() => onOpenDetail(sale.id)}>
                    <td className="whitespace-nowrap px-2 py-4 first:pl-0 font-semibold text-white">{formatSaleCode(sale)}</td>
                    <td className="whitespace-nowrap px-2 py-4">{shortDate(sale.createdAt)}</td>
                    <td className="px-2 py-4"><div className="truncate">{sale.customer}</div></td>
                    <td className="px-2 py-4"><div className="truncate">{sale.items.map((item) => item.productName).join(", ") || "Sem produtos"}</div></td>
                    <td className="whitespace-nowrap px-2 py-4">{sale.channel}</td>
                    <td className="px-2 py-4"><div className="truncate">{sale.payment ? `${sale.payment.method} · ${sale.payment.status}` : "Sem pagamento"}</div></td>
                    <td className="overflow-hidden whitespace-nowrap px-2 py-4"><Pill label={saleStatusLabel(sale.status)} warning={sale.status !== "CONFIRMED"} /></td>
                    <td className="whitespace-nowrap px-2 py-4 font-semibold text-white">{brl(sale.total)}</td>
                    <td className="whitespace-nowrap px-2 py-4">{brl(sale.ticket)}</td>
                    <td className="grid grid-cols-2 gap-1.5 px-2 py-3" onClick={(event) => event.stopPropagation()}>
                      <IconButton label="Ver detalhes" icon={ClipboardList} onClick={() => onOpenDetail(sale.id)} />
                      <IconButton label="Copiar resumo" icon={Copy} onClick={() => navigator.clipboard?.writeText(buildSaleSummary(sale))} />
                      <IconButton label="Abrir WhatsApp" icon={MessageCircle} onClick={() => openWhatsapp(sale.customerWhatsapp)} disabled={!sale.customerWhatsapp} />
                      <IconButton label="Criar pós-venda" icon={MessageCircle} onClick={() => onCreatePostSale(sale)} />
                      <IconButton label="Ver pedido relacionado" icon={Package} disabled={!sale.order} onClick={() => onOpenOrder(sale)} />
                      <IconButton label="Ir para Pagamentos" icon={CreditCard} onClick={() => onOpenPayments(sale)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sales.length > pageSize ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs text-zinc-400">
                <span>
                  Mostrando {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sales.length)} de {sales.length} vendas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 font-semibold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={currentPage === 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    type="button"
                  >
                    Anterior
                  </button>
                  <span className="rounded-crm border border-white/10 bg-black/30 px-3 py-2 text-zinc-300">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    className="rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 font-semibold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    type="button"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </GlassPanel>
    </div>
  );
}

function SalesMetric({ label, value, detail }: Readonly<{ label: string; value: string; detail: string }>) {
  return (
    <article className="glass-panel min-w-0 rounded-crm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
          <strong className="mt-3 block truncate text-2xl font-semibold leading-none text-white">{value}</strong>
        </div>
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-moss shadow-[0_0_18px_rgba(91,117,103,0.95)]" aria-hidden />
      </div>
      <p className="mt-3 truncate text-xs font-medium text-moss">{detail}</p>
    </article>
  );
}

function SalesInsight({ label, value, detail }: Readonly<{ label: string; value: string; detail: string }>) {
  return (
    <div className="min-w-0 rounded-crm border border-white/10 bg-white/[0.035] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <strong className="mt-2 block truncate text-lg font-semibold text-white">{value}</strong>
      <p className="mt-1 truncate text-xs text-moss">{detail}</p>
    </div>
  );
}

function RankingBars({ items, emptyMessage }: Readonly<{ items: { name: string; value: number; fill?: string }[]; emptyMessage: string }>) {
  const maxValue = Math.max(...items.map((item) => item.value), 0);

  if (items.length === 0 || maxValue === 0) return <EmptyState message={emptyMessage} />;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.name} className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-zinc-200">{item.name}</span>
            <strong className="shrink-0 text-xs text-ember">{item.value}</strong>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(6, (item.value / maxValue) * 100)}%`,
                background: item.fill ?? "#d8b15d"
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Orders({ orders, onMove, onSelect }: Readonly<{ orders: Order[]; onMove: (orderId: string, status: OrderStatus) => void; onSelect: (order: Order) => void }>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [activeOrderId, setActiveOrderId] = useState("");
  const activeOrder = orders.find((order) => order.id === activeOrderId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveOrderId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const destination = event.over?.id;
    setActiveOrderId("");
    if (!destination || !orderColumns.some((column) => column.key === destination)) return;
    onMove(String(event.active.id), destination as OrderStatus);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={kanbanCollisionDetection} onDragStart={handleDragStart} onDragCancel={() => setActiveOrderId("")} onDragEnd={handleDragEnd}>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {orderColumns.map((column) => (
          <OrderColumn key={column.key} status={column.key} label={column.label} orders={orders.filter((order) => order.status === column.key)} onSelect={onSelect} />
        ))}
      </div>
      <DragOverlay>
        {activeOrder ? <OrderCardPreview order={activeOrder} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function OrderColumn({ status, label, orders, onSelect }: Readonly<{ status: OrderStatus; label: string; orders: Order[]; onSelect: (order: Order) => void }>) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`min-w-0 min-h-96 rounded-crm border p-3 transition ${isOver ? "border-ember/70 bg-ember/10" : "border-white/10 bg-black/42"}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{label}</h2>
        <Pill label={String(orders.length)} />
      </div>
      <div className={`${orders.length > 3 ? "max-h-[560px] overflow-y-auto pr-1 soft-scroll" : ""} space-y-3`}>
        {orders.length === 0 ? <EmptyState message="Nenhum pedido nesta etapa." /> : null}
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} onSelect={onSelect} />
        ))}
      </div>
      <button className="mt-3 w-full rounded-crm border border-dashed border-white/14 px-3 py-2 text-xs text-zinc-500" disabled title="Pedidos são criados automaticamente ao confirmar pagamento">+ Adicionar</button>
    </section>
  );
}

function OrderCard({ order, onSelect }: Readonly<{ order: Order; onSelect: (order: Order) => void }>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });
  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (!isDragging) onSelect(order);
      }}
      className={`touch-none rounded-crm border border-white/10 bg-white/[0.055] p-3 shadow-glow transition-opacity ${isDragging ? "cursor-grabbing opacity-35" : "cursor-grab"}`}
    >
      <OrderCardContent order={order} />
    </article>
  );
}

function OrderCardPreview({ order }: Readonly<{ order: Order }>) {
  return (
    <article className="w-[min(260px,calc(100vw-32px))] rounded-crm border border-ember/45 bg-black/92 p-3 shadow-2xl shadow-black/50">
      <OrderCardContent order={order} />
    </article>
  );
}

function OrderCardContent({ order }: Readonly<{ order: Order }>) {
  return (
    <>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-semibold text-white">{formatOrderCode(order)}</h3>
        <span className="max-w-[52%] shrink-0 truncate text-right text-xs font-semibold text-ember" title={brl(order.total)}>{brl(order.total)}</span>
      </div>
      <p className="mt-2 truncate text-sm text-zinc-300" title={order.customer}>{order.customer}</p>
      <p className="mt-1 min-w-0 truncate text-xs text-zinc-500" title={`${order.saleNumber ? `Venda #${order.saleNumber} · ` : ""}${order.channel} · ${shortDate(order.date)}`}>{order.saleNumber ? `Venda #${order.saleNumber} · ` : ""}{order.channel} · {shortDate(order.date)}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {order.items.slice(0, 2).map((item) => (
          <span key={item} className="rounded-crm bg-black/40 px-2 py-1 text-[11px] text-zinc-400">{item}</span>
        ))}
      </div>
    </>
  );
}

function Payments({
  payments,
  onOpenSale,
  onOpenCustomer,
  onConfirm,
  onRefund,
  onCancel
}: Readonly<{
  payments: Payment[];
  onOpenSale: (payment: Payment) => void;
  onOpenCustomer: (payment: Payment) => void;
  onConfirm: (payment: Payment) => void;
  onRefund: (payment: Payment) => void;
  onCancel: (payment: Payment) => void;
}>) {
  const [filters, setFilters] = useState({ search: "", status: "", method: "" });
  const filteredPayments = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesSearch = !search || [formatSaleCode(payment), payment.customer, payment.method].some((value) => value.toLowerCase().includes(search));
      const matchesStatus = !filters.status || payment.status === filters.status;
      const matchesMethod = !filters.method || payment.method === filters.method;
      return matchesSearch && matchesStatus && matchesMethod;
    });
  }, [filters, payments]);
  const pendingTotal = payments.filter((payment) => payment.status === "Pendente").reduce((sum, payment) => sum + payment.amount, 0);
  const confirmedTotal = payments.filter((payment) => payment.status === "Confirmado").reduce((sum, payment) => sum + payment.amount, 0);
  const refundedTotal = payments.filter((payment) => payment.status === "Estornado").reduce((sum, payment) => sum + payment.amount, 0);
  const canceledCount = payments.filter((payment) => payment.status === "Cancelado").length;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pendente" value={brl(pendingTotal)} hint={`${payments.filter((payment) => payment.status === "Pendente").length} pagamentos`} warning />
        <Metric label="Confirmado" value={brl(confirmedTotal)} hint={`${payments.filter((payment) => payment.status === "Confirmado").length} pagamentos`} />
        <Metric label="Estornado" value={brl(refundedTotal)} hint={`${payments.filter((payment) => payment.status === "Estornado").length} pagamentos`} warning />
        <Metric label="Cancelado" value={String(canceledCount)} hint="não entra na receita" warning />
      </section>

      <GlassPanel title="Pagamentos">
        <div className="mb-4 grid gap-3 md:grid-cols-[1.2fr_0.7fr_0.7fr]">
          <label className="flex items-center gap-2 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-500">
            <Search className="h-4 w-4" aria-hidden />
            <input
              className="w-full bg-transparent text-zinc-200 outline-none"
              placeholder="Buscar cliente ou venda..."
              value={filters.search}
              maxLength={80}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </label>
          <select className="rounded-crm border border-white/10 bg-black/60 px-3 py-2 text-sm text-white" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Todos os status</option>
            <option value="Pendente">Pendente</option>
            <option value="Confirmado">Confirmado</option>
            <option value="Estornado">Estornado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
          <select className="rounded-crm border border-white/10 bg-black/60 px-3 py-2 text-sm text-white" value={filters.method} onChange={(event) => setFilters((current) => ({ ...current, method: event.target.value }))}>
            <option value="">Todas as formas</option>
            <option value="Pix">Pix</option>
            <option value="Cartão">Cartão</option>
            <option value="Boleto">Boleto</option>
            <option value="Dinheiro">Dinheiro</option>
          </select>
        </div>

        {filteredPayments.length === 0 ? <EmptyState message="Nenhum pagamento encontrado." /> : null}
        <div className="overflow-x-auto soft-scroll">
          {filteredPayments.length > 0 ? <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              <tr>
                <th className="py-3">Venda</th>
                <th>Cliente</th>
                <th>Método</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="text-zinc-300">
                  <td className="py-4 font-semibold text-white">
                    <button className="hover:text-ember" onClick={() => onOpenSale(payment)}>{formatSaleCode(payment)}</button>
                  </td>
                  <td>
                    <button className="hover:text-ember" onClick={() => onOpenCustomer(payment)}>{payment.customer}</button>
                  </td>
                  <td>{payment.method}</td>
                  <td>{brl(payment.amount)}</td>
                  <td><Pill label={payment.status} warning={payment.status !== "Confirmado"} /></td>
                  <td>{shortDate(payment.date)}</td>
                  <td className="flex gap-2 py-3">
                    <IconButton label="Confirmar" icon={CheckCircle2} onClick={() => onConfirm(payment)} disabled={payment.status !== "Pendente"} />
                    <IconButton label="Estornar" icon={CreditCard} onClick={() => onRefund(payment)} disabled={payment.status !== "Confirmado"} />
                    <IconButton label="Cancelar" icon={X} onClick={() => onCancel(payment)} disabled={payment.status !== "Pendente"} />
                    <IconButton label="Ver venda" icon={ClipboardList} onClick={() => onOpenSale(payment)} />
                    <IconButton label="Ver cliente" icon={Users} onClick={() => onOpenCustomer(payment)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table> : null}
        </div>
      </GlassPanel>
    </div>
  );
}

function Finance({ finance }: Readonly<{ finance: FinanceData }>) {
  const mounted = useMounted();
  const revenueSeries = finance.revenue.length ? finance.revenue : [{ day: "01", value: 0 }];

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <FinanceMetric label="Faturamento" value={brl(finance.summary.revenue)} hint="pagamentos confirmados" />
        <FinanceMetric label="Custo estimado" value={brl(finance.summary.estimatedCost)} hint="itens vendidos" warning />
        <FinanceMetric label="Lucro estimado" value={brl(finance.summary.estimatedProfit)} hint="total menos custo" />
        <FinanceMetric label="Margem estimada" value={`${finance.summary.estimatedMargin.toFixed(2)}%`} hint="sobre vendas confirmadas" />
        <FinanceMetric label="Pendências" value={brl(finance.summary.pendingPayments)} hint="pagamentos pendentes" warning />
        <FinanceMetric label="Ticket médio" value={brl(finance.summary.averageTicket)} hint="vendas confirmadas" />
        <FinanceMetric label="Reembolsos" value={brl(finance.summary.refunds)} hint="manual" warning />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <GlassPanel title="Receita por dia">
          <div className="h-80">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                  <XAxis dataKey="day" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#080a0c", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="value" stroke="#d8b15d" strokeWidth={2} fill="#d8b15d22" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartSkeleton />
            )}
          </div>
        </GlassPanel>
        <GlassPanel title="Por forma de pagamento">
          <div className="space-y-3">
            {(finance.paymentMethods.length ? finance.paymentMethods : ["Sem pagamentos confirmados"]).map((item) => (
              <div key={item} className="rounded-crm border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-zinc-300">{item}</div>
            ))}
          </div>
        </GlassPanel>
      </section>
    </div>
  );
}

function PostSales({ postSales, onResolve, onCreate }: Readonly<{ postSales: PostSale[]; onResolve: (id: string) => void; onCreate: () => void }>) {
  const [typeFilter, setTypeFilter] = useState<PostSaleType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<PostSaleStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");

  const filtered = useMemo(
    () => postSales.filter((item) =>
      (typeFilter === "ALL" || item.type === typeFilter) &&
      (statusFilter === "ALL" || item.status === statusFilter) &&
      (priorityFilter === "ALL" || item.priority === priorityFilter)
    ),
    [postSales, priorityFilter, statusFilter, typeFilter]
  );

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Atendimentos abertos" value={String(postSales.filter((item) => item.status !== "RESOLVED").length)} hint="em operação" />
        <Metric label="Atrasados" value={String(postSales.filter((item) => item.overdue).length)} hint="próxima ação vencida" warning />
        <Metric label="Reativações" value={String(postSales.filter((item) => item.type === "REACTIVATION").length)} hint="clientes sem compra" warning />
        <Metric label="Feedbacks" value={String(postSales.filter((item) => item.type === "FEEDBACK").length)} hint="relacionamento ativo" />
      </section>

      <GlassPanel
        title="Atendimentos"
        actions={
          <div className="flex flex-wrap gap-2">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as PostSaleType | "ALL")} className="rounded-crm border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
              <option value="ALL">Todos os tipos</option>
              {Object.entries(postSaleTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PostSaleStatus | "ALL")} className="rounded-crm border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
              <option value="ALL">Todos os status</option>
              {Object.entries(postSaleStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Priority | "ALL")} className="rounded-crm border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
              <option value="ALL">Todas as prioridades</option>
              {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        }
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.length === 0 ? <EmptyState message="Nenhum atendimento de pós-venda encontrado." /> : null}
          {filtered.map((item) => (
            <article key={item.id} className="rounded-crm border border-white/10 bg-black/36 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">{item.customer}</h3>
                    <Pill label={postSaleTypeLabels[item.type]} warning={item.priority === "HIGH" || item.priority === "URGENT"} />
                    <Pill label={priorityLabels[item.priority]} warning={item.overdue} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{item.id} · {item.orderNumber ? `Pedido #${item.orderNumber}` : item.orderId ?? "sem pedido vinculado"} · {item.saleNumber ? `Venda #${item.saleNumber} · ` : ""}{item.responsible}</p>
                </div>
                <Pill label={postSaleStatusLabels[item.status]} warning={item.status !== "RESOLVED"} />
              </div>

              <p className="mt-4 min-h-12 text-sm leading-6 text-zinc-300">{item.notes}</p>
              <div className="mt-4 grid gap-3 text-xs text-zinc-400 sm:grid-cols-2">
                <span className="rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2">Próxima ação: {new Date(item.nextActionAt).toLocaleString("pt-BR")}</span>
                <span className="rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2">Status: {postSaleStatusLabels[item.status]}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`https://wa.me/55${item.whatsapp.replace(/\D/g, "")}`} target="_blank" className="inline-flex items-center gap-2 rounded-crm bg-bone px-3 py-2 text-xs font-bold text-black">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  Abrir WhatsApp
                </a>
                <button
                  className="inline-flex items-center gap-2 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white"
                  onClick={() => navigator.clipboard?.writeText(buildPostSaleMessage(item))}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Copiar mensagem
                </button>
                <button className="inline-flex items-center gap-2 rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white" onClick={onCreate}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Criar nova ação
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-crm border border-moss/50 bg-moss/18 px-3 py-2 text-xs font-semibold text-white disabled:opacity-45"
                  disabled={item.status === "RESOLVED"}
                  onClick={() => onResolve(item.id)}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Marcar como resolvido
                </button>
              </div>
            </article>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function SettingsPanel({
  users,
  onCreateUser,
  onEditUser,
  onDeactivateUser
}: Readonly<{
  users: AppUser[];
  onCreateUser: () => void;
  onEditUser: (user: AppUser) => void;
  onDeactivateUser: (user: AppUser) => void;
}>) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-3">
        <GlassPanel title="Dados da loja">
          <div className="space-y-3">
            <Field label="Nome da loja" value="DarkHaven" />
            <Field label="CNPJ" value="12.345.678/0001-90" />
            <Field label="WhatsApp" value="(11) 98765-4321" />
            <Field label="E-mail" value="contato@darkhaven.com" />
          </div>
        </GlassPanel>
        <GlassPanel title="Logo da loja">
          <div className="grid place-items-center rounded-crm border border-white/10 bg-black/44 p-8">
            <Image src="/brand/logo-darkhaven.png" alt="DarkHaven" width={230} height={140} className="h-auto w-56 object-contain" />
          </div>
          <button className="mt-4 w-full rounded-crm border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-500" disabled title="Edição de branding fica para a próxima etapa">Alterar logo</button>
        </GlassPanel>
        <GlassPanel title="Aparência">
          <div className="space-y-3">
            <Field label="Tema" value="Escuro" />
            <Field label="Glass morphism" value="Ativo" />
            <Field label="Idioma" value="Português (BR)" />
            <Field label="Usuários ativos" value={String(users.filter((user) => user.active).length)} />
          </div>
        </GlassPanel>
      </div>

      <GlassPanel
        title="Usuários"
        actions={<button className="inline-flex items-center gap-2 rounded-crm bg-bone px-3 py-2 text-sm font-bold text-black" onClick={onCreateUser}><Plus className="h-4 w-4" aria-hidden />Novo usuário</button>}
      >
        {users.length === 0 ? <EmptyState message="Nenhum usuário cadastrado." /> : null}
        {users.length > 0 ? (
          <div className="overflow-x-auto soft-scroll">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                <tr>
                  <th className="py-3">Usuário</th>
                  <th>E-mail</th>
                  <th>Função</th>
                  <th>Status</th>
                  <th>Último acesso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {users.map((user) => (
                  <tr key={user.id} className="text-zinc-300">
                    <td className="py-4 font-semibold text-white">{user.name}{user.isOwnerAdmin ? " · Admin principal" : ""}</td>
                    <td>{user.email}</td>
                    <td>{user.role === "ADMIN" ? "Admin" : "Equipe"}</td>
                    <td><Pill label={user.active ? "Ativo" : "Inativo"} warning={!user.active} /></td>
                    <td>{user.lastLoginAt ? shortDate(user.lastLoginAt) : "Nunca"}</td>
                    <td className="flex gap-2 py-3">
                      <IconButton label="Editar usuário" icon={Pencil} onClick={() => onEditUser(user)} />
                      <IconButton label="Desativar usuário" icon={UserX} onClick={() => onDeactivateUser(user)} disabled={user.isOwnerAdmin || !user.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </GlassPanel>
    </div>
  );
}

function GlassPanel({ title, badge, actions, children }: Readonly<{ title: string; badge?: string; actions?: React.ReactNode; children: React.ReactNode }>) {
  return (
    <section className="glass-panel min-w-0 rounded-crm p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          {title}
          {badge ? <Pill label={badge} /> : null}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, hint, warning = false }: Readonly<{ label: string; value: string; hint: string; warning?: boolean }>) {
  return (
    <article className="glass-panel min-w-0 rounded-crm p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <strong className="text-2xl font-semibold text-white">{value}</strong>
        <Gauge className={`h-5 w-5 ${warning ? "text-ember" : "text-moss"}`} aria-hidden />
      </div>
      <p className={`mt-2 text-xs ${warning ? "text-ember" : "text-moss"}`}>{hint}</p>
    </article>
  );
}

function FinanceMetric({ label, value, hint, warning = false }: Readonly<{ label: string; value: string; hint: string; warning?: boolean }>) {
  return (
    <article className="glass-panel min-w-0 rounded-crm p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <strong className="mt-3 block min-h-8 truncate text-2xl font-semibold leading-none text-white">{value}</strong>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className={`truncate text-xs ${warning ? "text-ember" : "text-moss"}`}>{hint}</p>
        <Gauge className={`h-4 w-4 shrink-0 ${warning ? "text-ember" : "text-moss"}`} aria-hidden />
      </div>
    </article>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
  className = ""
}: Readonly<{
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  className?: string;
}>) {
  if (totalItems <= pageSize) return null;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs text-zinc-400 ${className}`}>
      <span>
        Mostrando {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)} de {totalItems} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <button
          className="rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 font-semibold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          type="button"
        >
          Anterior
        </button>
        <span className="rounded-crm border border-white/10 bg-black/30 px-3 py-2 text-zinc-300">
          {currentPage} / {totalPages}
        </span>
        <button
          className="rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 font-semibold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          type="button"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

function Pill({ label, warning = false, className = "" }: Readonly<{ label: string; warning?: boolean; className?: string }>) {
  return (
    <span title={label} className={`inline-flex min-w-0 max-w-full items-center truncate rounded-crm border px-2 py-1 text-[11px] font-semibold ${warning ? "border-ember/35 bg-ember/12 text-ember" : "border-moss/35 bg-moss/14 text-zinc-200"} ${className}`}>
      {label}
    </span>
  );
}

function IconButton({ label, icon: Icon, onClick, disabled = false }: Readonly<{ label: string; icon: LucideIcon; onClick?: () => void; disabled?: boolean }>) {
  return (
    <button
      className="inline-flex h-8 w-8 items-center justify-center rounded-crm border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function Filters({ labels }: Readonly<{ labels: string[] }>) {
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <button key={label} className="rounded-crm border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300">{label}</button>
      ))}
    </div>
  );
}

function Field({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <label className="block space-y-2 text-sm text-zinc-300">
      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <input className="w-full rounded-crm border border-white/10 bg-white/[0.04] px-3 py-3 text-white outline-none focus:border-ember/60" defaultValue={value} />
    </label>
  );
}

function SummaryRow({ label, value, strong = false }: Readonly<{ label: string; value: string; strong?: boolean }>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-400">{label}</span>
      <strong className={strong ? "text-xl text-white" : "text-white"}>{value}</strong>
    </div>
  );
}

function buildPostSaleMessage(item: PostSale) {
  if (item.type === "REACTIVATION") {
    return `Oi, ${item.customer}! Passando para te mostrar as novidades da DarkHaven e separar uma recomendação para o seu estilo.`;
  }
  if (item.type === "COMPLAINT") {
    return `Oi, ${item.customer}. Recebemos sua mensagem e já estamos acompanhando seu caso com prioridade.`;
  }
  if (item.type === "EXCHANGE" || item.type === "RETURN") {
    return `Oi, ${item.customer}. Vamos te orientar no processo de ${item.type === "EXCHANGE" ? "troca" : "devolução"} com todo cuidado.`;
  }
  return `Oi, ${item.customer}! Seu pedido chegou? Queremos saber como foi sua experiência com a DarkHaven.`;
}

function useMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
}

function ChartSkeleton() {
  return <div className="h-full w-full rounded-crm border border-white/10 bg-white/[0.035]" />;
}

function buildSalesPerformanceSeries(
  revenueByDay: SalesSummaryData["revenueByDay"],
  salesByDay: SalesSummaryData["salesByDay"],
  averageTicketByDay: SalesSummaryData["averageTicketByDay"]
) {
  const revenueByKey = new Map(revenueByDay.map((item) => [normalizeChartDayKey(item.day), item.value]));
  const salesByKey = new Map(salesByDay.map((item) => [normalizeChartDayKey(item.day), item.value]));
  const ticketByKey = new Map(averageTicketByDay.map((item) => [normalizeChartDayKey(item.day), item.value]));
  const days = Array.from(new Set([...revenueByKey.keys(), ...salesByKey.keys(), ...ticketByKey.keys()]));

  return days.map((day) => ({
    day: formatChartDayLabel(day),
    revenue: revenueByKey.get(day) ?? 0,
    sales: salesByKey.get(day) ?? 0,
    ticket: ticketByKey.get(day) ?? 0
  }));
}

function getBestPerformanceDay(series: ReturnType<typeof buildSalesPerformanceSeries>) {
  return series.reduce<(typeof series)[number] | null>((best, item) => {
    if (!best || item.revenue > best.revenue) return item;
    return best;
  }, null);
}

function getTopChartItem(items: { name: string; value: number; fill?: string }[]) {
  return items.reduce<(typeof items)[number] | null>((best, item) => {
    if (!best || item.value > best.value) return item;
    return best;
  }, null);
}

function normalizeChartDayKey(day: string) {
  const [first, second] = day.split("-");
  if (first?.length === 2 && second?.length === 2) return `${first}-${second}`;
  if (first?.length === 2 && second?.length === 4) return `${second.slice(0, 2)}-${first}`;
  return day;
}

function formatChartDayLabel(day: string) {
  const [month, date] = day.split("-");
  if (!month || !date) return day;
  return `${date}/${month}`;
}

async function fetchData<T>(url: string): Promise<{ ok: true; data: T } | { ok: false }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const payload = (await response.json()) as { data?: T };
        if (!("data" in payload)) return { ok: false };
        return { ok: true, data: payload.data as T };
      }
      if (response.status < 500) return { ok: false };
    } catch {
      if (attempt === 2) return { ok: false };
    }

    await wait(500);
  }

  return { ok: false };
}

async function warmWorkspaceData(salesQuery: string) {
  if (workspaceWarmupStarted) return;
  workspaceWarmupStarted = true;

  const urls = [
    "/api/customers",
    "/api/leads",
    "/api/products",
    `/api/sales${salesQuery}`,
    `/api/sales/summary${salesQuery}`,
    "/api/orders",
    "/api/payments",
    "/api/post-sales",
    "/api/dashboard/kpis",
    "/api/dashboard/revenue-by-day",
    "/api/dashboard/revenue-by-channel",
    "/api/finance/summary",
    "/api/finance/revenue",
    "/api/finance/by-payment-method",
    "/api/users"
  ];

  for (const url of urls) {
    if (readCachedResponse(url)) continue;
    const result = await fetchData<unknown>(url);
    if (result.ok) writeCachedResponse(url, result.data);
    await wait(60);
  }

  for (const item of navItems) {
    await fetch(item.href, { credentials: "same-origin" }).catch(() => undefined);
    await wait(60);
  }
}

function readCachedResponse(url: string) {
  const now = Date.now();
  const memory = responseCache.get(url);
  if (memory && now - memory.updatedAt <= responseCacheMaxAge) return memory.data;

  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(cacheKeyForUrl(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: unknown; updatedAt?: number };
    if (!parsed.updatedAt || now - parsed.updatedAt > responseCacheMaxAge) {
      window.sessionStorage.removeItem(cacheKeyForUrl(url));
      return null;
    }
    responseCache.set(url, { data: parsed.data, updatedAt: parsed.updatedAt });
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedResponse(url: string, data: unknown) {
  const entry = { data, updatedAt: Date.now() };
  responseCache.set(url, entry);

  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(cacheKeyForUrl(url), JSON.stringify(entry));
  } catch {
    // Cache is an optimization only; ignore storage quota/privacy mode failures.
  }
}

function cacheKeyForUrl(url: string) {
  return `darkhavencrm:${url}`;
}

function getApiErrorMessage(error: unknown) {
  if (typeof error === "string" && error.trim()) return error;

  if (error && typeof error === "object") {
    const flattened = error as {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    };
    const fieldMessage = Object.values(flattened.fieldErrors ?? {}).flat().find(Boolean);
    if (fieldMessage) return fieldMessage;
    const formMessage = flattened.formErrors?.find(Boolean);
    if (formMessage) return formMessage;
  }

  return "Não foi possível concluir a ação.";
}

function getString(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(form: FormData, name: string) {
  const value = getString(form, name);
  if (!value) return 0;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMoney(form: FormData, name: string) {
  return parseCurrencyBR(getString(form, name));
}

function parsePercentBR(value: string) {
  const parsed = Number(value.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

function formatPercentInput(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  if (!normalized) return "";
  const [integerPart, ...decimalParts] = normalized.split(".");
  const decimalPart = decimalParts.join("").slice(0, 2);
  const nextValue = decimalParts.length > 0 ? `${integerPart.slice(0, 3)}.${decimalPart}` : integerPart.slice(0, 3);
  const parsed = Number(nextValue);
  if (!Number.isFinite(parsed)) return "";
  return parsed > 100 ? "100" : nextValue;
}

function formatPercentDisplay(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildSalesQuery(filters: SalesFilters) {
  const params = new URLSearchParams();
  const dates = filters.range === "custom" ? { startDate: filters.startDate, endDate: filters.endDate } : rangeToDates(filters.range);
  const entries: Record<string, string> = {
    startDate: dates.startDate,
    endDate: dates.endDate,
    status: filters.status,
    channel: filters.channel,
    paymentMethod: filters.paymentMethod,
    customerId: filters.customerId,
    productId: filters.productId,
    search: filters.search
  };

  for (const [key, value] of Object.entries(entries)) {
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

function rangeToDates(range: SalesFilters["range"]) {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (range === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (range === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (range === "30d") {
    start.setDate(start.getDate() - 29);
  } else if (range === "month") {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
  } else if (range === "lastMonth") {
    start.setMonth(start.getMonth() - 1, 1);
    end.setDate(0);
  }

  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end)
  };
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function saleStatusLabel(status: SaleSummary["status"]) {
  const labels: Record<SaleSummary["status"], string> = {
    DRAFT: "Rascunho",
    WAITING_PAYMENT: "Aguardando pagamento",
    CONFIRMED: "Confirmada",
    CANCELED: "Cancelada"
  };
  return labels[status];
}

function customerStatusValue(status?: Customer["status"]) {
  const values: Record<Customer["status"], string> = {
    Ativo: "active",
    Novo: "novo",
    Recorrente: "recorrente",
    VIP: "vip",
    Inativo: "inativo"
  };
  return status ? values[status] : "active";
}

function buildSaleSummary(sale: SaleSummary) {
  return [
    formatSaleCode(sale),
    `Cliente: ${sale.customer}`,
    `Total: ${brl(sale.total)}`,
    `Status: ${saleStatusLabel(sale.status)}`,
    `Produtos: ${sale.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ") || "Sem produtos"}`
  ].join("\n");
}

function openWhatsapp(whatsapp: string) {
  const normalized = normalizePhoneBR(whatsapp);
  if (!normalized) return;
  window.open(`https://wa.me/55${normalized}`, "_blank", "noopener,noreferrer");
}

function formatCityState(city?: string | null, state?: string | null) {
  if (city && state) return `${city}/${state}`;
  return city || state || "Cidade/estado não informado.";
}

function buildCustomerAddress(sale: Pick<SaleDetail, "customerAddress" | "customerCity" | "customerState">) {
  const address = sale.customerAddress?.trim();
  const cityState = formatCityState(sale.customerCity, sale.customerState);
  if (!address && cityState === "Cidade/estado não informado.") return "Endereço não informado.";
  if (!address) return cityState;
  if (cityState === "Cidade/estado não informado.") return address;
  return `${address} - ${cityState}`;
}

function buildOrderAddress(order: Pick<Order, "customerAddress" | "customerCity" | "customerState">) {
  const address = order.customerAddress?.trim();
  const cityState = formatCityState(order.customerCity, order.customerState);
  if (!address && cityState === "Cidade/estado não informado.") return "Endereço não informado.";
  if (!address) return cityState;
  if (cityState === "Cidade/estado não informado.") return address;
  return `${address} - ${cityState}`;
}

function formatSaleCode(sale: Pick<SaleSummary, "saleNumber" | "shortId"> | Pick<Payment, "saleNumber" | "saleId">) {
  if ("saleNumber" in sale && sale.saleNumber) return `Venda #${sale.saleNumber}`;
  if ("shortId" in sale) return `Venda #${sale.shortId}`;
  return `Venda ${sale.saleId}`;
}

function formatOrderCode(order: Pick<Order, "orderNumber" | "id"> | NonNullable<SaleSummary["order"]>) {
  return order.orderNumber ? `Pedido #${order.orderNumber}` : `Pedido ${order.id}`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
