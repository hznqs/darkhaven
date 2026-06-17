---

name: darkhaven-business-rules
description: Use esta skill sempre que a tarefa envolver regras de negócio, fluxo operacional, módulos, entidades, validações, vendas, pedidos, pagamentos, clientes, leads, produtos, pós-venda, histórico recente, saleNumber, orderNumber ou qualquer alteração funcional do DarkHaven CRM.
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# DarkHaven CRM — Business Rules

Use esta skill para qualquer alteração funcional no DarkHaven CRM.

Esta skill define as regras de negócio obrigatórias do sistema.
Se houver conflito entre esta skill e uma sugestão genérica de implementação, esta skill vence.

O objetivo é construir o DarkHaven CRM como um CRM real, funcional, seguro, consistente e manutenível, sem gambiarra, sem mock e sem lógica crítica falsa no frontend.

---

## 1. Contexto do projeto

O DarkHaven CRM é um CRM interno/manual para uma loja de roupas de academia sob demanda.

O sistema deve controlar:

* Leads
* Clientes
* Produtos do catálogo
* Vendas
* Pagamentos
* Pedidos
* Financeiro
* Pós-venda
* Usuários
* Dashboard

Fluxo principal do negócio:

Lead → Cliente → Produto do catálogo → Venda manual → Pagamento → Pedido sob demanda → Entrega → Pós-venda

O sistema não é um e-commerce completo.
O sistema não é controle de estoque.
O sistema não é plataforma de campanhas.
O sistema é um CRM operacional interno.

---

## 2. Regras absolutas

Nunca desobedecer:

* Não adicionar estoque.
* Não adicionar baixa de estoque.
* Não adicionar quantidade disponível.
* Não adicionar alerta de estoque.
* Não adicionar campanhas.
* Não adicionar integrações externas sem pedido explícito.
* Não usar WhatsApp API sem pedido explícito.
* Não usar gateway de pagamento sem pedido explícito.
* Não usar transportadora sem pedido explícito.
* Não usar mock como fonte real.
* Não voltar para `lib/mock-data.ts`.
* Não refazer o projeto do zero.
* Não apagar dados reais.
* Não rodar `prisma migrate reset`.
* Não rodar `drop`.
* Não rodar `truncate`.
* Não fazer gambiarra.
* Não mascarar erro sem corrigir a causa.
* Não hardcodar usuário.
* Não hardcodar senha.
* Não usar userId fake.
* Não usar admin fake.
* Não confiar no frontend para regra crítica.
* Não deixar botão visual sem função real ou indicação clara.
* Não deixar código quebrado passar escondido.
* Não expor credenciais.
* Não imprimir `DATABASE_URL`.
* Não imprimir `DIRECT_URL`.
* Não imprimir senha.
* Não retornar `passwordHash`.

---

## 3. Backend como fonte da verdade

O backend sempre decide regras críticas.

O frontend pode:

* ajudar o usuário
* aplicar máscaras
* mostrar preview
* melhorar experiência
* validar antes do envio
* exibir estados de loading, erro e vazio

O frontend não pode ser a fonte da verdade para:

* total da venda
* subtotal
* custo
* lucro
* margem
* desconto final
* status financeiro crítico
* status de pedido crítico
* permissão de usuário
* criação de usuário
* número sequencial de venda
* número sequencial de pedido
* snapshot de produto
* validação final de produto/cliente/pagamento

O backend deve:

* validar entrada
* normalizar dados
* consultar o banco
* calcular valores
* aplicar regras
* persistir
* retornar dados seguros
* proteger rotas
* impedir ações inválidas

---

## 4. Produtos

Produto é catálogo, não estoque.

Produto deve ter:

* nome
* SKU opcional
* categoria
* preço de venda manual
* custo manual
* descrição
* cores opcionais
* tamanhos opcionais
* status ativo/inativo

Regras:

* Produto não tem estoque.
* Produto não tem quantidade disponível.
* Produto não baixa estoque.
* Produto pode ter cor e tamanho.
* Produto pode ter só cor.
* Produto pode ter só tamanho.
* Produto pode não ter cor nem tamanho.
* Cores e tamanhos são apenas opções do catálogo.
* Produto inativo não deve ser usado em nova venda.
* SKU é opcional, mas deve ser único quando informado.
* Preço não pode ser negativo.
* Custo não pode ser negativo.
* Backend valida preço e custo.
* Backend normaliza cores e tamanhos.

---

## 5. Nova venda

A criação de venda deve funcionar como um carrinho manual.

A venda deve permitir:

* selecionar cliente
* adicionar um ou mais produtos
* escolher quantidade por produto
* escolher cor somente se o produto tiver cores cadastradas
* escolher tamanho somente se o produto tiver tamanhos cadastrados
* informar desconto, se permitido
* informar observações da venda
* informar observações por item
* selecionar canal de venda
* salvar venda

Regras:

* Venda exige cliente existente.
* Venda exige pelo menos um produto ativo.
* Quantidade mínima: 1.
* Quantidade máxima: 999.
* Cor só aparece se o produto tiver cores.
* Tamanho só aparece se o produto tiver tamanhos.
* Se trocar produto, limpar cor/tamanho anteriores.
* Não enviar `selectedColor` se o produto não tiver cor.
* Não enviar `selectedSize` se o produto não tiver tamanho.
* Backend valida se a cor/tamanho enviado realmente existe no produto.
* Desconto não pode deixar total negativo.
* Frontend mostra preview, backend calcula o valor real.

---

## 6. Snapshot de venda

Cada venda deve salvar os dados do produto no momento da compra.

O backend deve salvar no item da venda:

* `productId`
* `productNameSnapshot`
* `productSkuSnapshot`
* `productCategorySnapshot`
* `unitPriceSnapshot`
* `unitCostSnapshot`
* `selectedColor`
* `selectedSize`
* `quantity`
* `discount`
* `subtotal`
* `customizationNotes`

Regras:

* Backend busca preço atual do produto.
* Backend busca custo atual do produto.
* Backend calcula subtotal.
* Backend calcula desconto.
* Backend calcula total final.
* Backend calcula custo estimado.
* Backend calcula lucro estimado.
* Backend calcula margem estimada.
* Se o produto mudar preço depois, venda antiga não muda.
* Se o produto mudar custo depois, venda antiga não muda.
* Frontend não decide snapshot.

Fórmulas esperadas:

subtotalItem = unitPriceSnapshot * quantity

costItem = unitCostSnapshot * quantity

profitItem = subtotalItem - discount - costItem

totalSale = soma dos subtotais - descontos

estimatedCost = soma dos custos

estimatedProfit = totalSale - estimatedCost

estimatedMargin = estimatedProfit / totalSale

Se totalSale for 0, margem deve ser 0.

---

## 7. Vendas

Vendas são visão comercial.

A página de vendas deve mostrar:

* vendas de hoje
* vendas da semana
* vendas do mês
* ticket médio geral
* filtros por período
* lista de vendas
* detalhe da venda
* cliente
* produtos
* canal
* valor total
* status da venda
* status do pagamento apenas como informação

Vendas não devem concentrar ações financeiras.

Ações permitidas em Vendas:

* ver detalhes
* copiar resumo
* abrir WhatsApp
* criar pós-venda
* ver pedido relacionado
* ir para pagamento relacionado

Ações proibidas em Vendas:

* confirmar pagamento
* estornar pagamento
* cancelar pagamento
* gerenciar cobrança

Essas ações pertencem ao módulo Pagamentos.

---

## 8. saleNumber

Toda venda deve ter um número sequencial amigável.

Exibição esperada:

* Venda #1
* Venda #2
* Venda #3

Regras:

* Não substituir o ID interno.
* O ID interno continua sendo UUID/CUID ou equivalente.
* Criar campo separado `saleNumber`.
* `saleNumber` deve ser único.
* `saleNumber` deve ser sequencial.
* `saleNumber` deve ser gerado pelo banco/backend.
* Frontend apenas exibe.
* Usuário não pode editar.
* Não usar `count + 1` no frontend.
* Não reutilizar número de venda cancelada.
* Não renumerar vendas antigas.
* Se Venda #3 for cancelada, a próxima continua sendo Venda #4.
* Migrations devem fazer backfill seguro para vendas antigas.
* Usar sequence/autoincrement seguro no banco.

Exibir `saleNumber` em:

* página de vendas
* detalhe da venda
* pagamentos relacionados
* pedidos relacionados
* histórico do cliente
* pós-venda relacionado
* dashboard/financeiro quando houver referência de venda

---

## 9. Pagamentos

Pagamentos concentram ações financeiras.

A página de pagamentos deve controlar:

* pagamentos pendentes
* pagamentos confirmados
* pagamentos estornados
* pagamentos cancelados
* forma de pagamento
* valor
* venda relacionada
* cliente relacionado

Ações de pagamento:

* criar pagamento
* confirmar pagamento
* estornar pagamento
* cancelar pagamento
* ver venda relacionada
* ver cliente relacionado

Regras:

* Pagamento exige venda existente.
* Pagamento confirmado não confirma de novo.
* Estorno exige motivo.
* Cancelamento exige motivo.
* POST/PATCH não deve ter retry automático.
* Impedir duplo clique.
* Backend valida valor, venda e status.
* Confirmação de pagamento pode criar pedido, conforme regra atual do projeto.

---

## 10. Pedidos

Pedidos representam produção e entrega.

Pedidos não são estoque.

Status sugeridos:

* Novo
* Em produção
* Pronto
* Enviado
* Entregue
* Cancelado

Regras:

* Pedido nasce de venda confirmada/paga, conforme regra atual.
* Pedido deve estar vinculado a uma venda.
* Pedido deve mostrar cliente.
* Pedido deve mostrar produtos.
* Pedido deve mostrar endereço.
* Pedido deve mostrar status.
* Drag and drop deve persistir no backend.
* Backend valida status permitido.
* Backend valida transição quando necessário.
* Se backend falhar, frontend reverte visual.
* Não duplicar pedido para mesma venda.

---

## 11. orderNumber

Todo pedido deve ter número sequencial amigável.

Exibição esperada:

* Pedido #1
* Pedido #2
* Pedido #3

Regras:

* Não substituir o ID interno.
* O ID interno continua sendo UUID/CUID ou equivalente.
* Criar campo separado `orderNumber`.
* `orderNumber` deve ser único.
* `orderNumber` deve ser sequencial.
* `orderNumber` deve ser gerado pelo banco/backend.
* Frontend apenas exibe.
* Usuário não pode editar.
* Não usar `count + 1` no frontend.
* Não reutilizar número de pedido cancelado.
* Não renumerar pedidos antigos.
* Se Pedido #3 for cancelado, o próximo continua sendo Pedido #4.
* Migrations devem fazer backfill seguro para pedidos antigos.
* Usar sequence/autoincrement seguro no banco.

Exibir `orderNumber` em:

* Kanban de pedidos
* detalhe do pedido
* detalhe da venda
* pagamentos relacionados
* pós-venda relacionado
* dashboard/financeiro quando houver referência de pedido

---

## 12. Leads

Leads representam o funil comercial.

Status sugeridos:

* Novo
* Contato feito
* Qualificado
* Negociação
* Convertido
* Perdido

Regras:

* Lead deve carregar automaticamente.
* Lead pode ser arrastado entre colunas.
* Drag and drop deve persistir no backend.
* Backend valida status.
* Se backend falhar, frontend reverte visual.
* Lead convertido vira cliente.
* Conversão não pode duplicar cliente se WhatsApp já existir.
* Lead convertido deve manter referência ao cliente quando existir campo.
* Lead perdido deve preservar histórico.
* Não apagar lead sem necessidade.

---

## 13. Clientes

Clientes representam a base real de compradores.

Cliente deve ter:

* nome
* WhatsApp
* e-mail opcional
* endereço
* cidade
* estado
* observações

Regras:

* Nome obrigatório.
* WhatsApp obrigatório.
* WhatsApp normalizado.
* WhatsApp único.
* E-mail válido quando informado.
* Cliente com histórico não deve ser apagado fisicamente.
* Preferir soft delete/inativação quando houver relações.
* Detalhe do cliente deve mostrar compras recentes, vendas, pedidos e pós-venda relacionados.

---

## 14. Histórico recente de compras

Cliente deve ter histórico recente de compras dos últimos 30 dias.

Regra importante:

Não apagar vendas oficiais após 30 dias.

Nunca apagar automaticamente:

* Sale
* SaleItem
* Payment
* Order
* AuditLog

O que pode expirar é apenas uma tabela de histórico recente, se existir.

Modelo recomendado:

CustomerPurchaseHistory:

* id
* customerId
* saleId
* purchasedAt
* expiresAt
* summary
* total
* createdAt

Regras:

* Ao criar venda, registrar compra recente.
* `expiresAt = purchasedAt + 30 dias`.
* Perfil do cliente mostra apenas `expiresAt > now`.
* Compras antigas não aparecem no histórico recente.
* Vendas oficiais continuam salvas.
* Financeiro continua preservado.
* Dashboard continua preservado.

---

## 15. Pós-venda

Pós-venda representa relacionamento após a compra.

Tipos sugeridos:

* feedback
* reclamação
* troca
* devolução
* recompra
* reativação
* follow-up

Regras:

* Pós-venda exige cliente.
* Pode vincular venda.
* Pode vincular pedido.
* Pode ser criado a partir de venda.
* Pode ser criado a partir de pedido entregue.
* Resolver atendimento deve persistir.
* Troca/devolução não movimenta estoque.
* Abrir WhatsApp pode usar mensagem pronta.
* Envio automático real só deve ser implementado se for pedido explicitamente.

---

## 16. Usuários e permissões

O sistema deve ter admin principal.

Regras:

* Apenas admin principal cria usuários.
* Usuário comum não cria usuários.
* Usuário comum não altera permissões.
* Usuário comum não vê `passwordHash`.
* Senha sempre com hash.
* Não hardcodar senha.
* Não hardcodar admin.
* Não permitir remover/desativar último admin principal.
* Não permitir admin principal desativar a si mesmo sem proteção.
* Backend valida permissões.
* Frontend apenas esconde/mostra UI, mas não é a fonte da permissão.

---

## 17. Dashboard e Financeiro

Dashboard e Financeiro devem usar dados reais.

Dashboard deve mostrar:

* vendas hoje
* vendas da semana
* vendas do mês
* receita
* pedidos em andamento
* leads por status
* clientes
* pós-venda pendente
* indicadores relevantes do negócio

Financeiro deve mostrar:

* receita confirmada
* pendentes
* estornos
* ticket médio
* formas de pagamento
* receita por período
* lucro estimado
* margem estimada

Regras:

* Backend calcula.
* Frontend exibe.
* Banco vazio mostra zero.
* Vendas canceladas/estornadas não contam como receita ativa.
* Gráficos não podem quebrar com dados vazios.

---

## 18. Migrations e banco

Toda alteração de banco deve ser segura.

Regras:

* Não usar `prisma migrate reset`.
* Não apagar dados.
* Não rodar `drop`.
* Não rodar `truncate`.
* Não editar migration já aplicada sem diagnóstico.
* Não aplicar migration às cegas se o banco já possui tabelas/colunas.
* Se houver drift, diagnosticar antes.
* Se o banco já possui estrutura e `_prisma_migrations` não registra, usar baseline com `migrate resolve --applied` apenas após confirmar que as tabelas/colunas existem.
* Sequence de `saleNumber` e `orderNumber` deve ser segura.
* Não usar `count + 1`.
* Não deixar código exigindo coluna que a migration ainda não aplicou.

Antes de qualquer migration:

* Rodar `npx prisma validate`.
* Verificar `schema.prisma`.
* Verificar migrations existentes.
* Verificar se a migration é aditiva.
* Verificar risco de dados.
* Parar se houver risco destrutivo.

---

## 19. Erros e AuditLog

AuditLog não pode derrubar operação principal.

Regras:

* Se userId for válido, gravar userId.
* Se userId estiver ausente/inválido, gravar null.
* Se AuditLog falhar, não retornar 500 falso.
* Registrar warn seguro apenas em dev.
* Não usar userId fake.
* Não inventar usuário.
* Não expor stack trace ao frontend.

---

## 20. Validações e máscaras

Frontend deve ajudar, backend deve garantir.

Telefone/WhatsApp:

* aceitar apenas números
* formatar visualmente como 19 99283-7929
* salvar normalizado
* mínimo 10 dígitos
* máximo 11 dígitos

Moeda:

* formatar como R$ 12,00
* formatar como R$ 1.250,50
* backend recebe decimal correto
* não permitir negativo salvo campo específico

Limites básicos:

Cliente:

* nome 2 a 100
* WhatsApp 10 a 11
* e-mail até 120
* observações até 500

Lead:

* nome 2 a 100
* WhatsApp 10 a 11
* origem até 60
* observações até 500

Produto:

* nome 2 a 120
* SKU até 40
* categoria até 60
* descrição até 600
* preço >= 0
* custo >= 0

Venda:

* quantidade 1 a 999
* observações até 500
* personalização até 500
* desconto não deixa total negativo

Pagamento:

* valor > 0
* motivo de estorno/cancelamento 5 a 300

Pós-venda:

* descrição 5 a 800
* resolução até 800

Usuário:

* nome 2 a 100
* e-mail válido
* senha forte
* role válida

---

## 21. Critério de pronto

Antes de considerar uma alteração funcional concluída, verificar:

* Persistiu no banco?
* Recarregou e continuou correto?
* Backend validou?
* Frontend não está fingindo?
* Não usou mock?
* Não criou gambiarra?
* Não adicionou estoque?
* Não adicionou campanha?
* Não quebrou outro módulo?
* Não expôs dados sensíveis?
* Não criou duplicidade?
* Não deixou botão sem ação?
* Não deixou migration quebrada?
* Não deixou código exigindo coluna inexistente?
* Typecheck passou?
* Lint passou?
* Build passou?
* APIs críticas continuam respondendo?

---

## 22. Comandos obrigatórios

Ao final de alterações funcionais relevantes, rodar:

```bash
npx prisma validate
npx prisma generate
npm run typecheck
npm run lint
npm run build
```

Quando houver alteração de banco, também rodar conforme o caso:

```bash
npx prisma migrate status
npx prisma migrate dev
```

ou, para aplicar migrations existentes em ambiente remoto/controlado:

```bash
npx prisma migrate deploy
```

Nunca rodar comandos destrutivos sem autorização explícita.

---

## 23. Relatório esperado

Ao concluir uma tarefa funcional, informar:

* workflow/skill usada
* arquivos alterados
* regra de negócio afetada
* rotas alteradas
* migrations criadas/aplicadas
* se houve risco de dados
* como foi evitada duplicidade
* como o backend validou
* como o frontend apenas exibiu/ajudou
* comandos executados
* comandos que passaram
* comandos que falharam
* pendências reais
* se pode avançar para a próxima etapa
