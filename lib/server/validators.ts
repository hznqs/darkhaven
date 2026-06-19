import { z } from "zod";
import { normalizePhoneBR } from "@/lib/masks";
import { getProductImagesBucket } from "@/lib/server/product-image-storage";

export const orderStatuses = [
  "NEW",
  "WAITING_PAYMENT",
  "PAID",
  "IN_PRODUCTION",
  "SEPARATION",
  "SENT",
  "DELIVERED",
  "CANCELED"
] as const;

export const allowedOrderTransitions: Record<(typeof orderStatuses)[number], (typeof orderStatuses)[number][]> = {
  NEW: ["WAITING_PAYMENT", "CANCELED"],
  WAITING_PAYMENT: ["PAID", "CANCELED"],
  PAID: ["IN_PRODUCTION", "CANCELED"],
  IN_PRODUCTION: ["SEPARATION", "CANCELED"],
  SEPARATION: ["SENT", "CANCELED"],
  SENT: ["DELIVERED", "CANCELED"],
  DELIVERED: [],
  CANCELED: []
};

export const orderStatusSchema = z.object({
  status: z.enum(orderStatuses)
});

const optionListSchema = z.preprocess(
  (value) => {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
    return [];
  },
  z.array(z.string().trim().min(1).max(40)).max(40).transform((items) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))))
);

const productImageUrlSchema = z.string().trim().max(500).refine((value) => {
  if (!value) return true;
  if (/^\/uploads\/products\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(value)) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;

    const bucket = getProductImagesBucket();
    const storagePath = `/storage/v1/object/public/${bucket}/products/`;
    if (!url.pathname.startsWith(storagePath)) return false;
    if (!/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(url.pathname)) return false;

    const configuredUrl = process.env.SUPABASE_URL?.trim();
    if (!configuredUrl) return url.hostname.endsWith(".supabase.co");
    return url.origin === new URL(configuredUrl).origin;
  } catch {
    return false;
  }
}, "Envie uma imagem pelo upload seguro do produto.");

export const saleSchema = z.object({
  customerId: z.string().min(1),
  channel: z.enum(["WhatsApp", "Instagram", "Site", "Loja Física"]),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO", "CASH"]).default("PIX"),
  discountMode: z.enum(["AMOUNT", "PERCENTAGE"]).default("AMOUNT"),
  discount: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1).max(999),
      selectedColor: z.string().trim().max(40).optional(),
      selectedSize: z.string().trim().max(40).optional(),
      discount: z.number().min(0).default(0),
      customizationNotes: z.string().trim().max(500).optional()
    })
  ).min(1),
  notes: z.string().trim().max(500).optional()
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, "O nome precisa ter pelo menos 2 caracteres.").max(100),
  whatsapp: z.string().transform(normalizePhoneBR).refine((value) => value.length >= 10 && value.length <= 11, "Informe um WhatsApp válido com DDD."),
  instagram: z.string().trim().max(60).optional(),
  email: z.string().trim().max(120).email().optional().or(z.literal("")),
  address: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(2).transform((value) => value.toUpperCase()).optional(),
  notes: z.string().trim().max(500).optional(),
  status: z.string().trim().max(40).default("active"),
  tags: z.array(z.string().trim().max(40)).default([])
});

export const leadStatuses = ["IN_PROGRESS", "CLOSED_WON", "CLOSED_LOST", "WAITING_REPLY"] as const;

export const leadSchema = z.object({
  name: z.string().trim().min(2, "O nome precisa ter pelo menos 2 caracteres.").max(100),
  whatsapp: z.string().transform(normalizePhoneBR).refine((value) => value.length >= 10 && value.length <= 11, "Informe um WhatsApp válido com DDD."),
  origin: z.string().trim().min(1).max(60),
  status: z.enum(leadStatuses).default("IN_PROGRESS"),
  notes: z.string().trim().max(500).optional()
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(1).max(60),
  sku: z.string().trim().max(40).optional().or(z.literal("")),
  price: z.number().min(0),
  cost: z.number().min(0).default(0),
  imageUrl: productImageUrlSchema.optional().or(z.literal("")),
  colors: optionListSchema.default([]),
  sizes: optionListSchema.default([]),
  active: z.boolean().default(true),
  description: z.string().trim().max(600).optional()
});

export const paymentSchema = z.object({
  saleId: z.string().min(1),
  method: z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO", "CASH"]),
  amount: z.number().positive().optional()
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(5).max(300)
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(120).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(120).regex(/[A-Z]/, "A senha precisa ter ao menos uma letra maiúscula.").regex(/[a-z]/, "A senha precisa ter ao menos uma letra minúscula.").regex(/[0-9]/, "A senha precisa ter ao menos um número."),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
  active: z.boolean().default(true)
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(120).transform((value) => value.toLowerCase()).optional(),
  password: z.string().min(8).max(120).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  active: z.boolean().optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(120).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(120)
});

export const postSaleSchema = z.object({
  customerId: z.string().min(1),
  orderId: z.string().optional(),
  saleId: z.string().optional(),
  type: z.enum(["FEEDBACK", "COMPLAINT", "EXCHANGE", "RETURN", "REPURCHASE", "REACTIVATION", "FOLLOW_UP"]),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CANCELED"]).default("OPEN"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  notes: z.string().min(5).max(800).optional(),
  customerFeedback: z.string().max(800).optional(),
  resolution: z.string().max(800).optional(),
  responsibleUserId: z.string().optional(),
  nextActionAt: z.string().datetime().optional(),
  refundRequested: z.boolean().default(false),
  refundReason: z.string().optional()
}).superRefine((data, ctx) => {
  if (["COMPLAINT", "EXCHANGE", "RETURN"].includes(data.type) && !data.notes?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["notes"],
      message: "Observação obrigatória para reclamação, troca e devolução."
    });
  }

  if ((data.type === "RETURN" || data.refundRequested) && !data.refundReason?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["refundReason"],
      message: "Motivo obrigatório para devolução/reembolso manual."
    });
  }
});
