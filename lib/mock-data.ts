import type { Customer, Lead, Order, Payment, PostSale, Product } from "@/lib/types";

export const customers: Customer[] = [
  { id: "CUS-001", name: "Lucas Almeida", whatsapp: "(11) 98765-4321", city: "São Paulo, SP", totalSpent: 2810, status: "Recorrente", tags: ["VIP", "Oversized"], lastPurchase: "2026-05-28" },
  { id: "CUS-002", name: "Bruna Silva", whatsapp: "(21) 97654-3210", city: "Rio de Janeiro, RJ", totalSpent: 1230, status: "Ativo", tags: ["Regatas"], lastPurchase: "2026-05-22" },
  { id: "CUS-003", name: "Rafael Santos", whatsapp: "(31) 96413-2109", city: "Belo Horizonte, MG", totalSpent: 980, status: "Ativo", tags: ["Bonés"], lastPurchase: "2026-05-19" },
  { id: "CUS-004", name: "Gabriel Oliveira", whatsapp: "(11) 95430-1008", city: "São Paulo, SP", totalSpent: 3450, status: "VIP", tags: ["Drop"], lastPurchase: "2026-04-25" },
  { id: "CUS-005", name: "Matheus Costa", whatsapp: "(47) 94321-0987", city: "Curitiba, PR", totalSpent: 1590, status: "Ativo", tags: ["Jaquetas"], lastPurchase: "2026-03-10" },
  { id: "CUS-006", name: "Felipe Martins", whatsapp: "(51) 90210-6676", city: "Porto Alegre, RS", totalSpent: 870, status: "Inativo", tags: ["Reativação"], lastPurchase: "2025-12-18" }
];

export const leads: Lead[] = [
  { id: "LEAD-014", name: "Ana Beatriz", whatsapp: "(11) 95555-2020", origin: "Instagram", status: "Novo", value: 189, lastContact: "há 1 dia" },
  { id: "LEAD-015", name: "Pedro Henrique", whatsapp: "(62) 98800-6754", origin: "WhatsApp", status: "Em atendimento", value: 332, lastContact: "há 2 dias" },
  { id: "LEAD-016", name: "Diego Silva", whatsapp: "(11) 97777-1000", origin: "Instagram", status: "Interessado", value: 410, lastContact: "há 12h" },
  { id: "LEAD-017", name: "Letícia Oliveira", whatsapp: "(31) 91234-7878", origin: "Site", status: "Aguardando resposta", value: 129, lastContact: "há 4 dias" },
  { id: "LEAD-018", name: "Thiago Mendes", whatsapp: "(21) 90001-2020", origin: "Indicação", status: "Fechou compra", value: 252, lastContact: "hoje" }
];

export const products: Product[] = [
  { id: "PRD-001", name: "Camiseta Oversized Dark", category: "Camisetas", price: 89.9, cost: 0, colors: [], sizes: [], active: true, sku: "DHV-TS-001", description: "Algodão premium, corte oversized e assinatura discreta." },
  { id: "PRD-002", name: "Regata Basic Performance", category: "Regatas", price: 69.9, cost: 0, colors: [], sizes: [], active: true, sku: "DHV-RG-002", description: "Regata leve para treino e composição urbana." },
  { id: "PRD-003", name: "Shorts Training", category: "Shorts", price: 129.9, cost: 0, colors: [], sizes: [], active: true, sku: "DHV-SH-003", description: "Shorts preto com bolso e acabamento esportivo." },
  { id: "PRD-004", name: "Calça Jogger", category: "Calças", price: 159.9, cost: 0, colors: [], sizes: [], active: true, sku: "DHV-JG-004", description: "Jogger com modelagem confortável e estética dark." },
  { id: "PRD-005", name: "Top Impact", category: "Tops", price: 79.9, cost: 0, colors: [], sizes: [], active: true, sku: "DHV-TP-005", description: "Top de alta sustentação para performance." },
  { id: "PRD-006", name: "Jaqueta Windbreaker", category: "Jaquetas", price: 109.9, cost: 0, colors: [], sizes: [], active: true, sku: "DHV-WB-006", description: "Corta-vento leve para drops sazonais." },
  { id: "PRD-007", name: "Boné Dark", category: "Acessórios", price: 69.9, cost: 0, colors: [], sizes: [], active: true, sku: "DHV-BN-007", description: "Boné preto com bordado frontal." },
  { id: "PRD-008", name: "Meia Performance", category: "Meias", price: 39.9, cost: 0, colors: [], sizes: [], active: true, sku: "DHV-ME-008", description: "Meia cano médio para treino." }
];

export const orders: Order[] = [
  { id: "PED-1041", orderNumber: 1041, customer: "Lucas Almeida", channel: "Instagram", total: 332.64, status: "NEW", items: ["Camiseta Oversized Dark", "Regata Basic Performance"], date: "2026-06-01" },
  { id: "PED-1042", orderNumber: 1042, customer: "Rafael Santos", channel: "WhatsApp", total: 129.9, status: "WAITING_PAYMENT", items: ["Shorts Training"], date: "2026-06-02" },
  { id: "PED-1043", orderNumber: 1043, customer: "Mariana Costa", channel: "Site", total: 219.8, status: "PAID", items: ["Top Impact", "Meia Performance"], date: "2026-06-03" },
  { id: "PED-1044", orderNumber: 1044, customer: "João Ferreira", channel: "Instagram", total: 159.9, status: "IN_PRODUCTION", items: ["Calça Jogger"], date: "2026-06-03" },
  { id: "PED-1045", orderNumber: 1045, customer: "Gabriel Oliveira", channel: "WhatsApp", total: 89.9, status: "SEPARATION", items: ["Camiseta Oversized Dark"], date: "2026-06-04" },
  { id: "PED-1046", orderNumber: 1046, customer: "Carla Aires", channel: "Instagram", total: 219.8, status: "SENT", items: ["Jaqueta Windbreaker", "Boné Dark"], date: "2026-06-05" },
  { id: "PED-1047", orderNumber: 1047, customer: "Fernanda Souza", channel: "Site", total: 69.9, status: "DELIVERED", items: ["Regata Basic Performance"], date: "2026-05-30" }
];

export const payments: Payment[] = [
  { id: "PGT-1048", saleId: "VDA-1048", customerId: "CLI-1048", customer: "Lucas Almeida", method: "Pix", amount: 332.64, status: "Pendente", date: "2026-06-08" },
  { id: "PGT-1047", saleId: "VDA-1047", customerId: "CLI-1047", customer: "Bruno Silva", method: "Cartão", amount: 219.8, status: "Confirmado", date: "2026-06-07" },
  { id: "PGT-1046", saleId: "VDA-1046", customerId: "CLI-1046", customer: "Rafael Santos", method: "Pix", amount: 189, status: "Confirmado", date: "2026-06-07" },
  { id: "PGT-1045", saleId: "VDA-1045", customerId: "CLI-1045", customer: "Gabriel Oliveira", method: "Boleto", amount: 478.7, status: "Pendente", date: "2026-06-06" },
  { id: "PGT-1044", saleId: "VDA-1044", customerId: "CLI-1044", customer: "Mariana Costa", method: "Cartão", amount: 109.9, status: "Estornado", date: "2026-06-05" }
];

export const postSales: PostSale[] = [
  { id: "POS-210", customer: "Lucas Almeida", whatsapp: "(11) 98765-4321", orderId: "PED-1047", saleId: "VDA-1047", type: "FEEDBACK", status: "OPEN", priority: "MEDIUM", notes: "Pedido entregue. Solicitar feedback e foto para depoimento.", responsible: "Admin DarkHaven", nextActionAt: "2026-06-09T10:00:00", createdAt: "2026-06-07", overdue: false },
  { id: "POS-211", customer: "Bruna Silva", whatsapp: "(21) 97654-3210", orderId: "PED-1038", type: "COMPLAINT", status: "IN_PROGRESS", priority: "HIGH", notes: "Cliente informou atraso na entrega. Acompanhar e retornar com posição.", responsible: "Lucas Silva", nextActionAt: "2026-06-08T16:00:00", createdAt: "2026-06-06", overdue: true },
  { id: "POS-212", customer: "Gabriel Oliveira", whatsapp: "(11) 95430-1008", orderId: "PED-1032", type: "EXCHANGE", status: "WAITING_CUSTOMER", priority: "MEDIUM", notes: "Troca de tamanho P para M. Não movimentar estoque nesta versão.", responsible: "Admin DarkHaven", nextActionAt: "2026-06-10T11:00:00", createdAt: "2026-06-05", overdue: false },
  { id: "POS-213", customer: "Felipe Martins", whatsapp: "(51) 90210-6676", type: "REACTIVATION", status: "OPEN", priority: "URGENT", notes: "Cliente há mais de 120 dias sem compra. Enviar mensagem de nova coleção.", responsible: "Bruno Ferreira", nextActionAt: "2026-06-08T14:30:00", createdAt: "2026-06-08", overdue: true },
  { id: "POS-214", customer: "Rafael Santos", whatsapp: "(31) 96413-2109", orderId: "PED-1029", type: "RETURN", status: "RESOLVED", priority: "LOW", notes: "Devolução por arrependimento. Reembolso registrado manualmente no financeiro.", resolution: "Resolvido com reembolso manual aprovado.", responsible: "Admin DarkHaven", nextActionAt: "2026-06-04T12:00:00", createdAt: "2026-06-01", overdue: false }
];

export const revenueSeries = [
  { day: "01", value: 4200 },
  { day: "05", value: 9100 },
  { day: "10", value: 5400 },
  { day: "15", value: 7800 },
  { day: "20", value: 7200 },
  { day: "25", value: 10400 },
  { day: "30", value: 13200 }
];

export const channelSeries = [
  { name: "Instagram", value: 45, fill: "#f4f2ec" },
  { name: "WhatsApp", value: 30, fill: "#9aa1a9" },
  { name: "Site", value: 15, fill: "#5b7567" },
  { name: "Loja Física", value: 10, fill: "#d8b15d" }
];
