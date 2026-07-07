---
name: global-next-patterns
description: Use quando a tarefa envolver Next.js App Router, API routes, Prisma ORM, validação de dados, serialização, migrações, server components, ou padrões de backend em qualquer projeto Next.js.
---

# Global Next.js Patterns

Use esta skill para aplicar padrões testados de Next.js, Prisma e validação em qualquer projeto.

## 1. API Routes

### Estrutura padrão

```
app/api/[resource]/route.ts    — GET (list), POST (create)
app/api/[resource]/[id]/route.ts — GET (detail), PATCH (update), DELETE (soft delete)
```

### Padrão de handler

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/security";
import { parseJsonBody, safeErrorResponse } from "@/lib/server/errors";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  // ... business logic
  return NextResponse.json({ data: result });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
}
```

### Regras

- `requireAuth` para qualquer rota privada
- `requireAdmin` para rotas de escrita
- `parseJsonBody` para extrair e validar JSON
- `safeErrorResponse` para erros internos (nunca expor stack trace)
- Usar serializers para resposta (nunca retornar raw Prisma)
- Auditoria via `writeAuditLogSafe` em CREATE/UPDATE/DELETE

## 2. Validação com Zod

### Estrutura

```typescript
// lib/server/validators.ts
import { z } from "zod";

export const mySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(120).optional(),
  active: z.boolean().default(true),
});

export const updateSchema = mySchema.partial(); // para PATCH
```

### Regras

- `z.string().trim()` sempre para evitar espaços extras
- Usar `.optional().or(z.literal(""))` para campos opcionais de string
- `z.number().positive()` para preços/valores
- `z.number().min(0)` para custos/descontos
- `z.enum([...])` para campos com valores fixos
- `superRefine` para validações cruzadas
- Validar no backend SEMPRE, frontend é bônus

## 3. Serializers

### Padrão

```typescript
type RecordType = {
  id: string;
  // ... campos do Prisma
};

export function serialize(resource: RecordType): ResourceType {
  return {
    id: resource.id,
    name: resource.name,
    // ... converter tipos (Decimal → Number, Date → ISO string)
  };
}
```

### Regras

- Serializer é o ÚNICO lugar que molda a resposta
- Prisma Decimal → `Number()`
- Dates → `.toISOString()` para o frontend
- Objetos aninhados → serializar também
- Nunca incluir `passwordHash` ou secrets
- Usar `select` do Prisma para buscar só o necessário

## 4. Prisma

### Singleton

```typescript
// lib/server/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Transações

```typescript
await prisma.$transaction(async (tx) => {
  const resource = await tx.resource.create({ data: ... });
  await tx.auditLog.create({ data: { ... } });
  return resource;
});
```

### Queries seguras

- Usar `readWithRetry` apenas em GET (nunca em POST/PATCH/DELETE)
- Usar `select` explícito, nunca `include` genérico
- Usar `satisfies Prisma.XSelect` para type safety

### Migrations

- `npx prisma migrate dev --name descricao` para desenvolvimento
- `npx prisma migrate deploy` para produção
- Nunca `prisma migrate reset` sem autorização
- Nunca editar migration já aplicada
- Antes: `npx prisma validate`

## 5. Server Components vs Client Components

- Server components para páginas e layout: chamam `requirePageAuth()`, buscam dados
- Client components para interatividade: formulários, modais, drag-and-drop
- Server component carrega dados. Client component exibe e interage.
- Evitar "use client" em componentes que não precisam de interatividade

## 6. Autenticação em páginas

```typescript
// app/dashboard/page.tsx
import { requirePageAuth } from "@/lib/server/page-auth";

export default async function Page() {
  await requirePageAuth();
  return <ClientComponent />;
}
```

## 7. Comandos obrigatórios

```bash
npx prisma validate        # validar schema
npx prisma generate        # gerar client
npm run typecheck           # Passou?
npm run lint                # Limpo?
npm run build               # Buildou?
```
