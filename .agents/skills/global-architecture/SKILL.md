---
name: global-architecture
description: Use quando a tarefa envolver estrutura de projeto, organização de diretórios, separação de camadas, server vs client components, data flow, injeção de dependência, patterns de código limpo, monorepo, ou arquitetura de aplicações Next.js.
---

# Global Architecture Patterns

Use esta skill para aplicar padrões de arquitetura testados em projetos Next.js escaláveis.

## 1. Estrutura de Diretórios

```
src/                          # Código-fonte
├── app/                      # Next.js App Router
│   ├── (auth)/              # Rotas públicas (login, etc)
│   ├── (dashboard)/          # Rotas protegidas (layout com sidebar)
│   │   ├── layout.tsx        # Layout com sidebar + Header
│   │   ├── page.tsx          # Dashboard home
│   │   └── [resource]/       # Páginas de cada recurso
│   ├── api/                  # API routes
│   │   └── [resource]/       # CRUD de cada recurso
│   └── providers.tsx         # Providers globais
├── components/               # Componentes reutilizáveis
│   ├── ui/                   # Componentes de UI puros (botões, inputs, modais)
│   └── layout/               # Layout components (sidebar, header)
├── lib/                      # Lógica pura (sem React)
│   ├── server/               # Código apenas server-side
│   │   ├── prisma.ts         # Prisma singleton
│   │   ├── validators.ts     # Zod schemas
│   │   ├── serializers.ts    # Serializers
│   │   ├── security.ts       # requireAuth, requireAdmin
│   │   ├── errors.ts         # safeErrorResponse, parseJsonBody
│   │   └── audit.ts          # Audit log
│   └── utils.ts              # Funções utilitárias puras
├── types/                    # Tipos TypeScript globais
├── hooks/                    # Custom hooks React
└── styles/                   # Estilos globais
```

## 2. Separação de Camadas

### Regra de ouro: Server nunca importa Client

```
Server (API routes / Server Components)
  └── lib/server/* (Prisma, Auth, Validation)
       └── NUNCA importa componentes React

Client (Client Components)
  └── hooks/*, components/*
       └── Chama API via fetch, nunca importa lib/server
```

### Data Flow

```
Browser → [API Route] → Validação (Zod) → Prisma Query → Serializer → JSON Response
                                                                        ↓
Browser ← [Client Component] ← fetch() ← Página ← [Server Component] carrega dados
```

### Regras de camada

- `lib/server/*` nunca importa `"use client"` ou componentes React
- API routes só fazem: auth → parse → validate → query → serialize → respond
- Server Components carregam dados iniciais; Client Components exibem e interagem
- Lógica de negócio pura (sem framework) vai em `lib/utils.ts`

## 3. Component Architecture

### Single file pattern (para CRUD complexo)

Um arquivo por recurso principal com:

```typescript
// components/ResourceWorkspace.tsx
function ResourceWorkspace() {
  // 1. Estado: list, filters, modal control
  // 2. Handlers: callbacks para CRUD
  // 3. Early returns: loading, empty, error
  // 4. Render: filters + table/cards + pagination + modal
}
```

### Regras

- Manter o workspace em 1 arquivo (não fragmentar em 10 micro-componentes)
- Extrair apenas componentes realmente reutilizáveis
- Estado do modal/drawer fica no workspace (não em store global)
- Callbacks nomeados descritivamente: `handleCreate`, `handleEdit`, `handleDelete`
- Tipos definidos em `types/`, não no componente

## 4. Gerenciamento de Estado

- Modal state: `useState` local no workspace
- Dados da lista: `useState` + `useCallback` para refresh
- Form data: `useState` ou `react-hook-form` (preferir useState para forms simples)
- Filtros: `useState` local
- Paginação: `useState` local
- Loading: `useState` local
- Evitar estado global desnecessário. Context/Redux só para estado realmente compartilhado (auth, tema).

## 5. Padrão de API Response

```typescript
// GET /api/resource
{ "data": [...], "total": 50, "page": 1, "pageSize": 10, "totalPages": 5 }

// GET /api/resource/[id]
{ "data": { ... } }

// POST /api/resource
{ "data": { ... }, "message": "Criado com sucesso" }

// Erros
{ "error": "Mensagem amigável" }
{ "error": { "fieldErrors": { "name": ["Campo obrigatório"] }, "formErrors": [] } } // 422
```

### Status codes

| Código | Uso                              |
|--------|----------------------------------|
| 200    | GET, PATCH, DELETE sucesso       |
| 201    | POST criação                     |
| 400    | Bad request (JSON inválido)      |
| 401    | Não autenticado                  |
| 403    | Não autorizado (não-admin)       |
| 404    | Recurso não encontrado           |
| 409    | Conflito (registro duplicado)    |
| 422    | Erro de validação (Zod)          |
| 500    | Erro interno (safeErrorResponse) |

## 6. Error Handling

```typescript
try {
  // operação arriscada
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") // unique constraint
    if (error.code === "P2025") // not found
  }
  return safeErrorResponse(error);
}
```

- `P2002`: campo duplicado → 409
- `P2025`: registro não encontrado → 404
- `P1001`: banco offline → 500
- Outros: `safeErrorResponse`

## 7. Code Organization Rules

- Um arquivo, uma responsabilidade clara
- Nomes descritivos: `createSale`, `updateOrder`, não `doStuff`
- Evitar comentários: código deve ser autoexplicativo
- Funções pequenas (max ~50 linhas)
- Mesmo padrão para todos os CRUDs (consistency > cleverness)
- Não repetir patterns manualmente → extrair helper functions
- DRY: lógica repetida 3x+ merece extração
- Tipos em `types/`, validators em `lib/server/validators.ts`, serializers junto

## 8. Build e Type Safety

- `npm run typecheck` antes de commit
- `npm run lint` para estilo
- `npm run build` para verificar build
- TypeScript strict mode ativado
- `satisfies` para type safety em queries Prisma
- Zod schema é fonte da verdade para tipos de input
- Serializer é fonte da verdade para tipos de output
