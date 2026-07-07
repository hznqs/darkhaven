---
name: global-security-patterns
description: Use quando a tarefa envolver autenticação, autorização, CSP headers, rate limiting, sanitização de input, gerenciamento de sessão, JWT, proteção contra vazamento de dados, secrets, admin ou padrões de segurança em qualquer projeto web.
---

# Global Security Patterns

Use esta skill para aplicar padrões de segurança testados em qualquer projeto web.

## 1. Autenticação

### Admin principal

```typescript
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
```

- Admin é verificado por email fixo em env var
- Admin não pode ser deletado, rebaixado ou ter email alterado
- Admin cria outros admins via interface protegida
- Toda rota de escrita exige `requireAdmin()`

### requireAuth vs requireAdmin

```typescript
function requireAuth(request: NextRequest): { ok: true; userId: string } | { ok: false; message: string; status: number }
function requireAdmin(request: NextRequest): { ok: true; userId: string } | { ok: false; message: string; status: number }
```

- `requireAuth`: qualquer usuário logado
- `requireAdmin`: somente admins + admin principal
- Ambos extraem token do cookie `session`, decodificam JWT, verificam no banco

### Páginas protegidas (server-side)

```typescript
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

async function requirePageAuth() {
  const session = (await cookies()).get("session");
  if (!session) redirect("/login");
  const payload = await verifyJwt(session.value);
  if (!payload) redirect("/login");
  return payload;
}
```

## 2. Segurança de API

### Headers de segurança

```typescript
// middleware.ts
const response = NextResponse.next();
response.headers.set("X-Frame-Options", "DENY");
response.headers.set("X-Content-Type-Options", "nosniff");
response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
```

### Nunca expor

- Senhas ou password hash
- Tokens de API
- Chaves privadas
- Stack traces de erros (usar `safeErrorResponse`)
- Dados de outros usuários (sempre verificar `userId`)
- Email do admin em listas públicas

### Auditoria

```typescript
await writeAuditLogSafe({
  userId,
  action: "RESOURCE_CREATED",
  details: { resourceId: newResource.id },
});
```

- Toda ação de escrita (CREATE, UPDATE, DELETE) deve gerar audit log
- Auditoria roda dentro da mesma transação Prisma
- `writeAuditLogSafe` nunca quebra a requisição principal
- Logs de auditoria são imutáveis (append-only)
- Ações sensíveis: login, logout, criação de admin, deleção, alteração de preço

## 3. Validação e Sanitização

- Validar no BACKEND sempre (frontend é bônus)
- Usar Zod schemas para validar entrada
- `z.string().trim()` remove espaços extras
- `z.string().email()` garante formato de email
- Strings de texto longo: limitar tamanho máximo
- Campos opcionais: `.optional().or(z.literal(""))` para aceitar string vazia sem erro
- Validar também IDs UUIDs com `.uuid()`

## 4. Rate Limiting (quando aplicável)

```typescript
const rateLimit = new Map<string, { count: number; reset: number }>();

function checkRateLimit(key: string, max: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || now > entry.reset) {
    rateLimit.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
```

## 5. Tratamento de Erros

```typescript
async function safeErrorResponse(error: unknown): Promise<NextResponse> {
  const message = error instanceof Error ? error.message : "Erro interno do servidor";
  console.error("[500]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}
```

- `safeErrorResponse` retorna mensagem amigável, nunca stack trace
- Logar no servidor com `console.error`
- Erros de validação: 422 com detalhes do Zod
- Erros de autenticação: 401
- Erros de autorização: 403
- Erros de não encontrado: 404
- Erros de conflito (duplicado): 409

## 6. Middleware global

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/api/auth/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Aplicar headers de segurança
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

## 7. Checklist de segurança

- [ ] Rota usa `requireAuth` ou `requireAdmin`?
- [ ] Admin não é exposto em listas públicas?
- [ ] Validação Zod no backend para toda entrada?
- [ ] Auditoria para toda ação de escrita?
- [ ] `safeErrorResponse` em vez de expor erro bruto?
- [ ] Nenhum secrets em código ou commit?
- [ ] CSP headers aplicados?
- [ ] Sessão expira após tempo de inatividade?
- [ ] UUIDs usam `.uuid()` na validação?
