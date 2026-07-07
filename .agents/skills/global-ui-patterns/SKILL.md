---
name: global-ui-patterns
description: Use quando a tarefa envolver design system, componentes React, modais, formulários, tabelas, notificações toast, responsividade, acessibilidade, loading states, error states ou experiência do usuário em projetos web modernos com Tailwind.
---

# Global UI Patterns

Use esta skill para aplicar padrões de UI/UX testados em qualquer projeto web com React + Tailwind.

## 1. Gerenciamento de Estado Visual

### Padrão Modal/Drawer com early return

```typescript
function Component() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null);

  const openCreate = useCallback(() => { setSelectedItem(null); setIsOpen(true); }, []);
  const openEdit = useCallback((item: ItemType) => { setSelectedItem(item); setIsOpen(true); }, []);
  const close = useCallback(() => { setIsOpen(false); setSelectedItem(null); }, []);

  // Loading state
  if (loading) return <LoadingSkeleton />;
  // Empty state
  if (!data?.length) return <EmptyState onCreate={openCreate} />;

  return (
    <>
      {/* Conteúdo principal */}
      <ModalForm isOpen={isOpen} onClose={close} item={selectedItem}
        onSaved={() => { close(); refresh(); }} />
    </>
  );
}
```

### Regras de estado

- **Loading**: skeleton ou spinner. Nunca "Carregando..." texto puro.
- **Empty**: ilustração + mensagem + CTA. Nunca "Nenhum registro encontrado" sem ação.
- **Error**: mensagem amigável + botão de retry. Nunca tela branca.
- **Success**: toast + fechar modal. Nunca alert().
- **404**: página dedicada com link de volta.

## 2. Notificações (Toast)

```typescript
const toast = useToast(); // hook do Chakra ou custom
toast({ title: "Sucesso", description: "Item criado", status: "success" });
toast({ title: "Erro", description: error, status: "error" });
```

- Sucesso: após POST/PATCH/DELETE bem-sucedido
- Erro: após falha de API
- Info: para eventos não-críticos
- Posição: top-right (padrão)
- Auto-close: ~3s para sucesso, ~5s para erro

## 3. Formulários

### Padrão de componentes

```typescript
function FormInput({
  label, error, ...props
}: { label: string; error?: string } & InputProps) {
  return (
    <FormControl isInvalid={!!error}>
      <FormLabel>{label}</FormLabel>
      <Input {...props} />
      <FormErrorMessage>{error}</FormErrorMessage>
    </FormControl>
  );
}
```

### Regras

- Todo input com label. Nunca input sem label.
- Erro de validação exibido no campo específico, não em alerta genérico.
- Botão de submit desabilitado durante loading (evitar dupla submissão).
- Botão de cancelar para fechar modal/drawer.
- Confirmar antes de deletar (modal de confirmação).
- Teclado: Enter submete, Escape fecha modal.

## 4. Paginação

```typescript
// Server retorna:
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Cliente renderiza controles
<PaginationControls
  page={page} totalPages={totalPages}
  onPageChange={setPage}
  total={total} pageSize={pageSize}
/>
```

- Loading por página, não tela toda (evitar flash)
- Manter filtros ao mudar de página
- Mostrar total de resultados
- Input para ir para página específica (quando muitas páginas)

## 5. Responsividade

### Breakpoints (Tailwind)

| Breakpoint | Largura   |
|------------|-----------|
| sm         | 640px     |
| md         | 768px     |
| lg         | 1024px    |
| xl         | 1280px    |
| 2xl        | 1536px    |

### Regras

- Mobile first: `flex-col md:flex-row`
- Tabelas: `overflow-x-auto` + `min-w-[600px]` ou cards em mobile
- Modais: full screen em mobile, centralizado em desktop
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Sidebar: collapsible em mobile, fixa em desktop
- Drawer: `placement="left"` para sidebar-like, `placement="right"` para detalhes
- Nunca overflow horizontal no body

## 6. Tabelas

- `overflow-x-auto` obrigatório
- Colunas: as mais importantes primeiro, colunas de ação no fim
- Ordenação: clicar no header (indicar direção com ícone)
- Seleção: checkbox na primeira coluna (ações em massa no topo)
- Linha clicável para detalhes/drawer
- Estado vazio com CTA
- Loading com skeleton rows
- Paginação integrada

## 7. Acessibilidade

- Todo input com label (não placeholder como label)
- Botões com texto descritivo (nunca só ícone sem aria-label)
- Modais com `trapFocus`
- Drawers com `closeOnOverlayClick`
- Cores com contraste suficiente
- `role` e `aria-*` para elementos não-nativos
- Teclado navegável (Tab, Enter, Escape)
- Loading states não escondem conteúdo anterior abruptamente

## 8. Temas

### Dark theme

- Fundo: `#0f0f13` ou similar
- Cards: `bg-zinc-900/60 backdrop-blur-xl`
- Bordas: `border-zinc-800/50`
- Texto primário: `text-zinc-100`
- Texto secundário: `text-zinc-400`
- Inputs: `bg-zinc-900 border-zinc-700`
- Primary: azul (indigo, blue) ou verde
- Danger: vermelho (red-500)

### Light theme (quando aplicável)

- Fundo: `bg-gray-50`
- Cards: `bg-white`
- Bordas: `border-gray-200`
- Manter coerência com dark theme

## 9. Loading Skeleton

```typescript
function SkeletonTable() {
  return Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="h-12 bg-zinc-800/50 rounded animate-pulse mb-2" />
  ));
}
```

- Usar `animate-pulse` do Tailwind
- Dimensões próximas do conteúdo real
- Sempre substituir por conteúdo real (não overlay)

## 10. Erro inesperado

```typescript
// error.tsx (Next.js error boundary)
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <p className="text-zinc-400 mb-4">Algo deu errado</p>
      <button onClick={reset}>Tentar novamente</button>
    </div>
  );
}
```
