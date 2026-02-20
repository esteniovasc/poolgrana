# Poolgrana

Uma ferramenta de planejamento financeiro pessoal focada em agilidade e privacidade. O Poolgrana permite visualizar e manipular suas finanças como blocos de tempo, misturando conceitos de Kanban (para gastos variáveis) e Swimlanes (para despesas fixas), tudo rodando 100% no seu navegador sem enviar dados para nuvem.

## Objetivo
Oferecer uma visão clara do "Fluxo de Caixa" futuro. Diferente de apps tradicionais que apenas registram o passado, o Poolgrana é desenhado para *projetar* o futuro, permitindo arrastar despesas, duplicar previsões e ajustar valores rapidamente para ver o impacto no saldo acumulado.

## Funcionalidades e Uso

### 1. Adicionar Transações (Omnibox)
A barra superior é o centro de comando.
- **Formato**: Digite `Nome do Gasto Valor`.
  - Exemplo: `Mercado -500` (Despesa de R$ 500)
  - Exemplo: `Salário 3000` (Receita de R$ 3000)
- **Atalho Rápido**: Pressione `/` (barra) para focar na barra de digitação instantaneamente.
- **Sair do Foco**: Pressione `Esc` para sair da barra de digitação.

### 2. Manipulação Visual (Drag & Drop)
- **Mover**: Arraste qualquer card para mudar o mês ou a categoria.
- **Duplicar**: Segure a tecla `Alt` (Windows/Linux) ou `Option` (Mac) enquanto arrasta um card para criar uma cópia dele no destino. Útil para replicar gastos recorrentes que não são fixos (ex: compras semanais).
- **Consolidar**: Itens arrastados mantêm seus valores.

### 3. Edição
- Clique em qualquer card para abrir o modal de edição.
- Altere descrição, valor, data ou converta entre Fixo e Variável.
- **Excluir**: Botão disponível dentro do modal de edição.

### 4. Navegação
- **Scroll Horizontal**: Navegue pelos meses (Passado e Futuro).
- **Totais Dinâmicos**: O cabeçalho mostra o saldo do **Mês Atual** (visível na primeira coluna) e o **Acumulado Visível** (saldo somado do mês atual até o último mês visível na tela).

### 5. Backup e Dados (Privacidade)
- **Dados Locais**: Tudo é salvo no `localStorage` do seu navegador. Nada sai do seu PC.
- **Salvar Projeto**: Botão "Salvar" (`💾`) na barra superior baixa um arquivo `.json` com todos os dados.
- **Abrir Projeto**: Botão "Abrir" (`📂`) carrega um arquivo `.json`, restaurando seus dados. **Importante**: Faça backup antes de carregar, pois os dados atuais serão substituídos.

---

## Documentação Técnica (Para Desenvolvedores e IAs)

A aplicação é construída com **Vanilla JavaScript (ES6 Modules)**, HTML5 e CSS3 Moderno. Não há frameworks (React, Vue, etc.) para garantir leveza, facilidade de manutenção e zero dependências de build complexas.

### Estrutura de Arquivos

- `index.html`: Estrutura base. Contém o layout principal (`#board-wrapper`), a Omnibox e os Templates de Modal (`<dialog>`).
- `style.css`: Estilização completa. Usa Variáveis CSS (`--primary`, `--expense`, etc.) para ntematização e CSS Grid para o layout da timeline (`#fixed-timeline`).
- `app.js`: Ponto de entrada (`entry point`). Inicializa a aplicação, configura os listeners globais (atalhos de teclado, botões de salvar/abrir, parser da Omnibox).

### Arquitetura de Classes (Modules)

#### 1. `Store` (`js/model.js`)
Gerenciador de Estado (State Management).
- **Responsabilidade**: Manter a lista de transações (`this.transactions`), salvar/carregar do `localStorage` e fornecer métodos CRUD (`addTransaction`, `updateTransaction`, `removeTransaction`, `getTransaction`).
- **Dados**: As transações são objetos simples: `{ id, description, value, date, type, groupId, status }`.
- **Persistência**: Toda alteração dispara um método interno de save, que serializa o JSON para o chavedo `localStorage`.

#### 2. `View` (`js/view.js`)
Camada de Apresentação e Lógica de UI.
- **Renderização**: O método `render()` reconstrói o grid baseando-se no estado atual da Store.
- **Cálculos**: `computeMonthlyTotals()` itera sobre as transações para calcular saldos mensais e acumulados em tempo real.
- **Virtualização/Visibilidade**: `updateRowVisibility()` é chamado no evento de `scroll` do board. Ele detecta quais colunas estão visíveis para calcular dinamicamente qual é o "Mês Atual" visualmente e atualizar os totais no header.
- **Estrutura Visual**: Separa **Despesas Fixas** (Swimlanes, layout de linhas onde cada categoria tem sua raia) de **Variáveis** (Kanban, layout de colunas verticais por mês).

#### 3. `DragDrop` (`js/dragdrop.js`)
Lógica de Interação.
- Gerencia os eventos nativos de Drag and Drop (`dragstart`, `dragover`, `drop`).
- **Lógica de Duplicação**: No evento `drop`, verifica `e.altKey`. 
  - Se `true` (com Alt): Chama `store.addTransaction` criando um novo ID, efetivamente duplicando o item.
  - Se `false` (sem Alt): Chama `store.updateTransaction`, apenas movendo o item (alterando sua data).
- **Feedback Visual**: Adiciona classes CSS (`drag-over`) para indicar visualmente onde o item será solto.

### Boas Práticas Adotadas
- **Imutabilidade (Parcial)**: A Store tenta retornar cópias de objetos para evitar mutação acidental.
- **Intl.NumberFormat**: Toda formatação de moeda usa a API nativa do navegador (`pt-BR`, `BRL`).
- **Modularidade**: Código separado por responsabilidade (Model, View, Controller/App) usando ES Modules nativos (`import`/`export`).

---
*Desenvolvido em pair programming com Antigravity Agent.*
