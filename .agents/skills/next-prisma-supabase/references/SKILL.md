---
name: next-prisma-supabase
description: Use esta skill quando a tarefa envolver Next.js, API routes, Prisma, Supabase PostgreSQL, migrations, schema.prisma, serializers, validators, transações, banco ou erros como P1001.
---

# Next + Prisma + Supabase Skill

Use esta skill para alterações técnicas no backend e banco do DarkHaven CRM.

## Regras

- Não rodar `prisma migrate reset`.
- Não apagar dados.
- Não dropar tabela.
- Não usar truncate.
- Não editar migration antiga sem motivo forte.
- Preferir migration segura.
- Backend deve validar dados.
- Frontend não é fonte da verdade.

## Prisma

- Usar singleton Prisma Client.
- Evitar múltiplas instâncias em dev.
- Usar transações em operações críticas.
- Usar constraints reais no banco quando necessário.
- Usar sequence/autoincrement seguro para `saleNumber` e `orderNumber`.
- Nunca gerar sequência com `count + 1` no frontend.

## Supabase

- Tratar P1001 em GET com retry controlado, se necessário.
- Não aplicar retry automático em POST/PATCH/DELETE.
- Não expor connection string.
- Não logar credenciais.

## APIs

- Validar input.
- Normalizar dados.
- Usar serializers seguros.
- Retornar erro amigável.
- Não retornar stack trace.
- Atualizar dados após mutações.