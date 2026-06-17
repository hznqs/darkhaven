---
name: figma-darkhaven-ui
description: Use esta skill quando receber link do Figma ou quando a tarefa pedir implementação visual a partir de frame, componente, design system ou referência visual do DarkHaven CRM.
---

# Figma to DarkHaven UI

Use esta skill quando houver link do Figma ou tarefa visual baseada em design.

## Antes de codar

1. Usar Figma MCP para analisar o frame/layer.
2. Identificar layout, hierarquia, espaçamento, componentes e estados.
3. Comparar com componentes existentes no projeto.
4. Reutilizar componentes existentes sempre que possível.
5. Listar arquivos prováveis antes de alterar.

## Regras

- Não alterar backend.
- Não alterar regra de negócio.
- Não criar mock.
- Não refazer projeto.
- Não mudar sidebar sem pedido.
- Não duplicar componente se já existir equivalente.
- Manter identidade DarkHaven.

## Implementação

- Criar componente novo apenas se necessário.
- Manter responsividade.
- Corrigir overflow.
- Garantir modais/drawers com scroll correto.
- Garantir tabelas utilizáveis.
- Garantir gráficos estáveis.

## Depois de implementar

Rodar:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

Retornar:

- arquivos alterados
- componentes reutilizados
- diferenças em relação ao Figma
- pendências visuais