# DarkHaven CRM

CRM premium para a operação da **DarkHaven**, desenvolvido para gerenciar um ecommerce inicial de roupas fitness/academia com foco em vendas manuais, pedidos sob demanda, financeiro, relacionamento com clientes e pós-venda.

O projeto segue uma identidade visual **dark premium**, com **glass morphism**, interface moderna, dashboard com gráficos e um fluxo operacional simples para equipes que precisam controlar vendas e pedidos sem depender inicialmente de APIs externas.

---

## Visão geral

O **DarkHaven CRM** foi criado para uma operação de ecommerce sob demanda.

Nesta versão, os produtos funcionam como um **catálogo interno**, permitindo vinculá-los às vendas sem controle de estoque.

Fluxo principal do sistema:

```txt
Cliente/Lead → Venda manual → Pagamento manual → Pedido sob demanda → Entrega → Pós-venda
```

---

## Escopo desta versão

Esta primeira versão inclui:

* Dashboard dark com glass morphism.
* Gráficos premium para indicadores comerciais e financeiros.
* Gestão de clientes.
* Gestão de leads.
* Produtos como catálogo, sem estoque.
* Vendas manuais.
* Pagamentos manuais.
* Pedidos sob demanda.
* Kanban de pedidos com drag and drop.
* Financeiro básico.
* Pós-venda completo.
* Configurações da loja.
* Prisma schema preparado para Supabase PostgreSQL.
* Rotas API com validações principais de venda, pagamento, pedidos e pós-venda.

---

## Fora do escopo nesta versão

Esta versão **não inclui**:

* Controle de estoque.
* Movimentação de estoque.
* Campanhas manuais.
* WhatsApp API.
* Instagram API.
* Gateway de pagamento.
* Integração com Correios ou transportadoras.
* Integração com Shopify, Nuvemshop ou marketplaces.
* Automações externas pagas.

---

## Principais módulos

### Dashboard

Painel inicial com indicadores da operação:

* Faturamento.
* Vendas.
* Ticket médio.
* Lucro estimado.
* Pedidos em andamento.
* Pedidos por status.
* Produtos mais vendidos.
* Leads em atendimento.
* Crescimento de clientes.
* Vendas por canal e forma de pagamento.

### Clientes

Cadastro e acompanhamento de clientes, incluindo dados de contato, histórico de compras, total gasto e informações úteis para relacionamento.

### Leads

Controle manual de interessados vindos de canais como Instagram, WhatsApp, indicação, site ou atendimento direto.

### Produtos

Produtos funcionam como catálogo interno.

Nesta versão, produtos **não possuem estoque**. Eles são usados apenas para vincular itens às vendas.

### Vendas

Registro de vendas manuais com cliente, produtos, quantidade, tamanho, cor, desconto, canal, forma de pagamento e status.

O backend deve recalcular valores críticos, como subtotal, desconto e total.

### Pagamentos

Pagamentos são confirmados manualmente pela equipe.

Somente pagamentos confirmados entram no financeiro.

### Pedidos

Pedidos são gerados a partir de vendas e seguem um fluxo sob demanda:

```txt
Novo → Aguardando pagamento → Pago → Em produção → Separação → Enviado → Entregue → Cancelado
```

O Kanban possui drag and drop, mas toda mudança de status deve ser validada pelo backend.

### Financeiro

Resumo financeiro baseado em vendas pagas:

* Faturamento bruto.
* Custo estimado.
* Lucro estimado.
* Margem estimada.
* Ticket médio.
* Descontos.
* Vendas por canal.
* Vendas por forma de pagamento.

### Pós-venda

Módulo para relacionamento após a compra, incluindo:

* Feedback.
* Reclamação.
* Troca.
* Devolução.
* Recompra.
* Reativação.
* Follow-up.
* Copiar mensagem.
* Abrir WhatsApp.
* Resolver atendimento.

---

## Stack utilizada

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Lucide React
* Recharts
* TanStack Query
* Prisma ORM
* Supabase PostgreSQL
* Zod
* Playwright

---

## Banco de dados

O projeto foi preparado para usar **Supabase PostgreSQL** com Prisma.

O Supabase deve ser tratado como banco PostgreSQL gerenciado. Operações críticas devem passar pelo backend/API, e não diretamente pelo frontend.

Configuração esperada no `schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## Variáveis de ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Exemplo de variáveis necessárias:

```env
DATABASE_URL=""
DIRECT_URL=""
JWT_SECRET=""
APP_URL="http://127.0.0.1:3017"
NODE_ENV="development"

ADMIN_EMAIL=""
ADMIN_PASSWORD=""

NEXT_PUBLIC_APP_URL="http://127.0.0.1:3017"
```

### Importante

Nunca exponha no frontend:

```txt
DATABASE_URL
DIRECT_URL
JWT_SECRET
SUPABASE_SERVICE_ROLE_KEY
Senha do banco
Tokens privados
```

Nunca use `NEXT_PUBLIC_` em variáveis sensíveis.

---

## Rodar localmente

Instale as dependências:

```bash
npm install
```

Gere o Prisma Client:

```bash
npx prisma generate
```

Aplique as migrations, se necessário:

```bash
npx prisma migrate dev --name init
```

Se o Supabase/Prisma Schema Engine falhar em desenvolvimento com o Session Pooler, use `npx prisma db push` apenas em ambiente não produtivo e documente o ocorrido.

Inicie o servidor local:

```bash
npm run dev
```

Acesse:

```txt
http://127.0.0.1:3017
```

---

## Scripts úteis

```bash
npm run dev
```

Inicia o servidor de desenvolvimento.

```bash
npm run build
```

Gera o build de produção.

```bash
npm run lint
```

Executa verificação de lint.

```bash
npm run typecheck
```

Executa verificação de tipos TypeScript.

```bash
npx prisma studio
```

Abre o Prisma Studio para visualizar os dados do banco.

```bash
npx prisma validate
```

Valida o schema Prisma.

```bash
npx prisma generate
```

Gera o Prisma Client.

```bash
npx prisma migrate deploy
```

Aplica migrations versionadas em produção.

---

## Regras de segurança

O backend não deve confiar 100% no frontend.

O frontend pode validar campos para melhorar a experiência do usuário, mas as regras reais devem ser validadas no backend.

O backend deve validar:

* Usuário autenticado.
* Permissão do usuário.
* Cliente existente.
* Produto existente.
* Produto ativo.
* Quantidade válida.
* Preço real do produto.
* Desconto permitido.
* Total da venda.
* Status permitido.
* Transição de pedido permitida.
* Motivo obrigatório em cancelamentos, estornos e devoluções.

O backend deve recalcular:

* Subtotal da venda.
* Total da venda.
* Desconto final.
* Custo estimado.
* Lucro estimado.
* Margem estimada.
* Indicadores financeiros.

O frontend não deve decidir sozinho:

* Total da venda.
* Lucro.
* Margem.
* Status final.
* Permissão.
* Pagamento confirmado.
* Mudança de status do pedido.

---

## Regras de negócio principais

### Produtos

* Produtos funcionam como catálogo.
* Produtos não possuem estoque nesta versão.
* Produto ativo pode ser vinculado a vendas.
* Produto inativo não deve aparecer como opção principal em novas vendas.
* Produto com histórico de venda não deve ser excluído fisicamente.

### Vendas

* Venda precisa ter cliente.
* Venda precisa ter pelo menos um produto.
* Venda pode ter múltiplos produtos.
* Desconto não pode deixar o total negativo.
* Backend deve recalcular total.
* Venda paga deve criar pedido.
* Venda cancelada deve refletir no financeiro.
* Venda não deve movimentar estoque.

### Pagamentos

* Pagamento é manual.
* Apenas pagamento confirmado entra no financeiro.
* Estorno exige motivo.
* Confirmação e estorno devem ser registrados.

### Pedidos

* Pedido nasce a partir de uma venda.
* Pedido não deve ser enviado se o pagamento estiver pendente.
* Toda mudança de status deve ser validada.
* Toda mudança de status relevante deve gerar histórico.
* O Kanban pode permitir drag and drop, mas o backend valida a transição.

### Pós-venda

* Pós-venda deve estar vinculado a um cliente.
* Pode estar vinculado a pedido ou venda.
* Reclamações, trocas e devoluções devem exigir observação.
* Troca/devolução não movimenta estoque nesta versão.
* Reembolso deve ser tratado no financeiro/pagamento.

---

## Testes e validações

Validações já realizadas nesta versão:

* `npx prisma validate`
* `npx prisma generate`
* `npm run typecheck`
* `npm run lint`
* `npm run build`
* Smoke visual com Playwright em desktop e mobile
* Confirmação de que Campanhas e Estoque não aparecem na interface

Migration baseline:

```txt
prisma/migrations/20260609000000_init/migration.sql
```

Não use `prisma migrate reset` em banco real.

---

## Observações de segurança

O projeto utiliza dependências modernas, mas é importante acompanhar vulnerabilidades reportadas por:

```bash
npm audit
```

Não aplique `npm audit fix --force` automaticamente sem testar, pois isso pode instalar versões quebráveis e comprometer o funcionamento do projeto.

Quando houver vulnerabilidades:

1. Verifique o pacote afetado.
2. Verifique a severidade.
3. Confirme se afeta produção.
4. Teste atualização em branch separada.
5. Rode build, lint, typecheck e smoke test antes de aplicar em definitivo.

---

## Deploy

Antes de publicar em produção:

* Configurar variáveis de ambiente no servidor.
* Usar uma senha segura para o Admin.
* Trocar qualquer valor padrão de desenvolvimento.
* Garantir que `.env` não foi versionado.
* Rodar migrations com segurança.
* Configurar domínio e HTTPS.
* Revisar CORS.
* Revisar logs.
* Validar autenticação.
* Testar fluxo completo de venda, pagamento, pedido e pós-venda.

Em produção, para aplicar migrations, prefira:

```bash
npx prisma migrate deploy
```

---

## Status atual

O projeto está em fase inicial funcional, com foco em:

* Interface premium.
* Fluxo manual de ecommerce sob demanda.
* Produtos como catálogo.
* Pedidos com Kanban.
* Pós-venda.
* Financeiro básico.
* Estrutura preparada para Supabase/PostgreSQL.

Ainda é necessário validar completamente:

* Autenticação em ambiente de produção.
* Regras críticas no backend.
* Auditoria de segurança.
* Deploy final.

---

## Próximos passos sugeridos

* Validar conexão real com Supabase.
* Confirmar quais telas ainda usam mock.
* Garantir que todas as ações críticas passam pelo backend.
* Revisar rotas protegidas.
* Adicionar logs/auditoria em ações importantes.
* Testar criação de venda completa.
* Testar confirmação de pagamento.
* Testar criação automática de pedido.
* Testar movimentação no Kanban.
* Testar criação e resolução de pós-venda.
* Preparar deploy.
