---
name: crm-security-audit
description: Use esta skill quando a tarefa envolver segurança, autenticação, autorização, usuários, admin principal, APIs privadas, secrets, AuditLog, validação de backend, vazamento de dados ou revisão de rotas sensíveis.
---

# CRM Security Audit

Use esta skill para revisar segurança do DarkHaven CRM.

## Regras

- Nunca retornar `passwordHash`.
- Nunca expor secrets.
- Nunca imprimir `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` ou tokens.
- Nunca retornar stack trace para o frontend.
- Nunca usar userId fake.
- Nunca usar admin hardcoded.
- Nunca confiar em permissão enviada pelo frontend.
- Nunca deixar rota sensível sem autenticação.
- Nunca deixar ação admin sem autorização de admin principal.
- Nunca usar retry automático em POST/PATCH/DELETE.

## AuditLog

- AuditLog não pode derrubar a operação principal.
- Se userId for inválido ou inexistente, gravar null.
- Se falhar, registrar warn seguro em dev e não retornar 500 falso.

## Usuários

- Apenas admin principal cria usuários.
- Usuário comum não cria usuários.
- Senha sempre com hash.
- Não permitir remover/desativar último admin principal.
- Não permitir admin principal desativar a si mesmo sem proteção.

## Checklist final

Antes de concluir, confirme:

- Rotas privadas exigem auth.
- Rotas admin exigem admin principal.
- Serializers removem dados sensíveis.
- Logs não exibem credenciais.
- Erros internos são genéricos no frontend.
- `.env` está protegido.
- `.env.example` não contém credenciais reais.