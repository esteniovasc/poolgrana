export class View {
	constructor(container, store) {
		this.store = store;
		this.currentDate = new Date();

		// Configuração de Range: -2 Meses (Passado) a +12 Meses (Futuro)
		this.pastMonths = 2;
		this.futureMonths = 12;

		this.timelineHeader = document.getElementById('timeline-header');
		this.fixedTimeline = document.getElementById('fixed-timeline');
		this.variableBoard = document.getElementById('variable-board');
		this.boardWrapper = document.getElementById('board-wrapper');
		// this.totalDisplay = document.getElementById('total-display'); // Removido

		// Elementos de Totais
		this.elCurrentMonthLabel = document.getElementById('current-month-label');
		this.elCurrentMonthBalance = document.getElementById('current-month-balance');
		this.elFutureBalance = document.getElementById('future-balance');

		// Observer para ocultar linhas vazias ao scrollar
		// Usaremos o evento de scroll para checar colunas visíveis
		if (this.boardWrapper) {
			this.boardWrapper.addEventListener('scroll', this.handleScroll.bind(this));
		}

		// Cache de referências para elementos de linha (Otimização)
		this.rowElements = {}; // { groupId: HTMLElement }
		this.rowTransactions = {}; // { groupId: { monthKey: bool(hasTx) } }
		this.columnMonthKeys = []; // Array ordenado de monthKeys das colunas

		// Elementos do Modal
		this.editModal = document.getElementById('edit-modal');
		this.editForm = document.getElementById('edit-form');
		this.btnDelete = document.getElementById('btn-delete');
		this.btnCancel = document.getElementById('btn-cancel');

		// Listeners do Modal
		this.btnCancel.addEventListener('click', () => this.editModal.close());
		this.editModal.addEventListener('click', (e) => {
			if (e.target === this.editModal) this.editModal.close(); // Fechar ao clicar fora
		});

		this.currentEditId = null;

		this.editForm.addEventListener('submit', (e) => {
			e.preventDefault();
			this.saveEdit();
		});

		this.btnDelete.addEventListener('click', () => {
			if (confirm('Tem certeza que deseja excluir?')) {
				this.deleteTransaction();
			}
		});
	}

	initScroll() {
		if (!this.boardWrapper) return;
		// Scroll Inicial: Ir para o Mês Atual
		// Queremos que o Mês Atual (Index = pastMonths) seja o primeiro visível após o Label.
		// Para isso, precisamos scrollar os meses anteriores (0 a pastMonths-1).
		// Quantidade = pastMonths * 200px.

		const initialScroll = this.pastMonths * 200;
		this.boardWrapper.scrollLeft = initialScroll;
		this.updateRowVisibility();
	}

	render() {
		this.clearContainers();

		const dateRange = this.getDateRange();
		this.columnMonthKeys = dateRange.map(d => this.getMonthKey(d));

		// 1. Renderizar Headers e Colunas Vazias de Variáveis
		this.renderHeaders(dateRange);

		// 2. Processar e Renderizar Dados
		const { fixedGroups, variableByMonth } = this.processTransactions(dateRange);

		// 3. Calcular Totais
		this.monthlyTotals = this.computeMonthlyTotals(dateRange, fixedGroups, variableByMonth);

		// Armazenar dados para lógica de visibilidade
		this.cacheRowData(fixedGroups, dateRange);

		this.renderFixedGrid(dateRange, fixedGroups);
		this.renderVariableBoard(dateRange, variableByMonth);

		// 3. Restaurar visibilidade sem pular scroll
		requestAnimationFrame(() => {
			this.updateRowVisibility();
		});
	}

	computeMonthlyTotals(dateRange, fixedGroups, variableByMonth) {
		return dateRange.map(date => {
			const monthKey = this.getMonthKey(date);
			let balance = 0;
			let income = 0;
			let expense = 0;

			// Somar Fixos
			Object.values(fixedGroups).forEach(groupData => {
				const transactions = groupData[monthKey];
				if (transactions) {
					transactions.forEach(t => {
						balance += t.value;
						if (t.value >= 0) income += t.value; else expense += t.value;
					});
				}
			});

			// Somar Variáveis
			const vars = variableByMonth[monthKey] || [];
			vars.forEach(t => {
				balance += t.value;
				if (t.value >= 0) income += t.value; else expense += t.value;
			});

			return { balance, income, expense, date };
		});
	}

	clearContainers() {
		this.timelineHeader.innerHTML = '<div class="header-spacer"></div>';
		this.fixedTimeline.innerHTML = '';
		this.variableBoard.innerHTML = '';

		const totalMonths = this.pastMonths + 1 + this.futureMonths;
		this.fixedTimeline.style.gridTemplateColumns = `200px repeat(${totalMonths}, 200px)`;

		this.rowElements = {};
		this.rowTransactions = {};
	}

	getDateRange() {
		const months = [];
		// Começa em -2 meses
		const startMonth = this.currentDate.getMonth() - this.pastMonths;
		const totalMonths = this.pastMonths + 1 + this.futureMonths;

		for (let i = 0; i < totalMonths; i++) {
			months.push(new Date(this.currentDate.getFullYear(), startMonth + i, 1));
		}
		return months;
	}

	renderHeaders(months) {
		months.forEach(date => {
			const year = date.getFullYear();
			const month = date.getMonth();
			const monthName = date.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();

			const cell = document.createElement('div');
			cell.className = 'month-header-cell';

			// Destaque para mês atual
			const isCurrent = (year === this.currentDate.getFullYear() && month === this.currentDate.getMonth());
			if (isCurrent) cell.style.color = 'var(--accent)';

			cell.textContent = `${monthName} ${year}`;
			this.timelineHeader.appendChild(cell);
		});
	}

	processTransactions(dateRange) {
		const transactions = this.store.transactions;
		const fixedGroups = {};
		const variableByMonth = {};

		dateRange.forEach(d => {
			variableByMonth[this.getMonthKey(d)] = [];
		});

		transactions.forEach(t => {
			const tDate = new Date(t.date);
			const tDateFixed = new Date(tDate.getUTCFullYear(), tDate.getUTCMonth(), tDate.getUTCDate());
			const monthKey = this.getMonthKey(tDateFixed);

			// Verifica se o mês está no range (fallback simples)
			if (variableByMonth[monthKey] === undefined && (t.type !== 'fixed' && t.type !== 'installment')) return;

			if (t.type === 'fixed' || t.type === 'installment') {
				const groupId = t.groupId || t.description;
				if (!fixedGroups[groupId]) fixedGroups[groupId] = {};

				// Inicializar array se não existir
				if (!fixedGroups[groupId][monthKey]) fixedGroups[groupId][monthKey] = [];
				fixedGroups[groupId][monthKey].push(t);
			} else {
				if (variableByMonth[monthKey]) variableByMonth[monthKey].push(t);
			}
		});

		return { fixedGroups, variableByMonth };
	}

	cacheRowData(fixedGroups, dateRange) {
		Object.keys(fixedGroups).forEach(groupId => {
			this.rowTransactions[groupId] = {};
			const groupData = fixedGroups[groupId];
			dateRange.forEach(d => {
				const key = this.getMonthKey(d);
				this.rowTransactions[groupId][key] = !!groupData[key];
			});
		});
	}

	renderFixedGrid(dateRange, fixedGroups) {
		Object.keys(fixedGroups).sort().forEach(groupId => {
			const groupData = fixedGroups[groupId];

			// Wrapper da Linha (Virtual, no display grid elements are flattened)
			// Mas para esconder, precisamos selecionar todos os elementos dessa linha.
			// Solução: Adicionar uma classe com o groupId em todos os elementos da linha 
			// ou criar uma referência e gerenciar estilo.

			// Label
			const label = document.createElement('div');
			label.className = `grid-row-label row-${groupId.replace(/\s+/g, '-')}`;
			label.textContent = groupId;
			label.title = groupId;
			this.fixedTimeline.appendChild(label);

			// Store references
			if (!this.rowElements[groupId]) this.rowElements[groupId] = [];
			this.rowElements[groupId].push(label);

			dateRange.forEach(date => {
				const monthKey = this.getMonthKey(date);
				const cell = document.createElement('div');
				cell.className = `grid-cell row-${groupId.replace(/\s+/g, '-')}`;
				cell.dataset.year = date.getFullYear();
				cell.dataset.month = date.getMonth() + 1;
				cell.dataset.type = 'fixed';

				const transactions = groupData[monthKey];
				if (transactions) {
					transactions.forEach(t => {
						cell.appendChild(this.createCard(t));
					});
				}
				this.fixedTimeline.appendChild(cell);
				this.rowElements[groupId].push(cell);
			});
		});
	}

	renderVariableBoard(dateRange, variableByMonth) {
		dateRange.forEach(date => {
			const monthKey = this.getMonthKey(date);
			const year = date.getFullYear();
			const month = date.getMonth() + 1;

			const col = document.createElement('div');
			col.className = 'variable-col';
			col.dataset.year = year;
			col.dataset.month = month;
			col.dataset.type = 'variable';

			const body = document.createElement('div');
			body.className = 'variable-col-body';

			const transactions = variableByMonth[monthKey] || [];
			transactions.forEach(t => {
				body.appendChild(this.createCard(t));
			});

			col.appendChild(body);
			this.variableBoard.appendChild(col);
		});
	}

	handleScroll() {
		// Debounce simples ou executar direto? Direto para feedback imediato é melhor, mas pode pesar.
		// Vamos tentar direto primeiro.
		this.updateRowVisibility();
	}

	updateRowVisibility() {
		if (!this.boardWrapper) return;

		const wrapper = this.boardWrapper;
		const scrollLeft = wrapper.scrollLeft;
		const width = wrapper.clientWidth;

		const colWidth = 200;
		const labelWidth = 200;

		// Índice da primeira coluna 'ativamente visualizada' (aquela logo após o label sticky)
		// Debug: console.log(`Scroll: ${scrollLeft}`);
		const rawIndex = scrollLeft / colWidth;
		const colIndex = Math.floor(rawIndex + 0.5); // Snap visual

		// Clampar
		const activeIndex = Math.max(0, Math.min(this.columnMonthKeys.length - 1, colIndex));

		// Visibilidade das Linhas
		const firstVisibleColIndex = Math.floor((scrollLeft - labelWidth) / colWidth);
		const lastVisibleColIndex = Math.ceil((scrollLeft + width) / colWidth);
		const start = Math.max(0, firstVisibleColIndex);
		const end = Math.min(this.columnMonthKeys.length - 1, lastVisibleColIndex);
		const visibleKeys = this.columnMonthKeys.slice(start, end + 1);

		Object.keys(this.rowElements).forEach(groupId => {
			const hasTransactionVisible = visibleKeys.some(key => this.rowTransactions[groupId][key]);
			const els = this.rowElements[groupId];
			const currentDisplay = els[0].style.display;

			if (hasTransactionVisible && currentDisplay === 'none') {
				els.forEach(el => el.style.display = '');
			} else if (!hasTransactionVisible && currentDisplay !== 'none') {
				els.forEach(el => el.style.display = 'none');
			}
		});

		// Atualizar Totais
		this.updateStatusDisplay(activeIndex);
	}

	updateStatusDisplay(activeIndex) {
		if (!this.monthlyTotals || !this.monthlyTotals[activeIndex]) return;

		const currentData = this.monthlyTotals[activeIndex];
		const monthName = currentData.date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

		// Atualizar Mês Atual
		if (this.elCurrentMonthLabel) this.elCurrentMonthLabel.textContent = monthName.toUpperCase();

		const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

		if (this.elCurrentMonthBalance) {
			this.elCurrentMonthBalance.textContent = fmt.format(currentData.balance);
			this.elCurrentMonthBalance.className = currentData.balance >= 0 ? 'value-positive' : 'value-negative';
		}

		// Calcular Acumulado (Do mês ativo até o fim do futuro)
		let futureSum = 0;
		for (let i = activeIndex; i < this.monthlyTotals.length; i++) {
			futureSum += this.monthlyTotals[i].balance;
		}

		if (this.elFutureBalance) {
			this.elFutureBalance.textContent = fmt.format(futureSum);
			this.elFutureBalance.className = futureSum >= 0 ? 'value-positive' : 'value-negative';
		}
	}

	openEditModal(id) {
		const t = this.store.getTransaction(id);
		if (!t) return;

		this.currentEditId = id;

		document.getElementById('edit-desc').value = t.description;
		document.getElementById('edit-value').value = t.value;
		document.getElementById('edit-date').value = t.date; // YYYY-MM-DD
		document.getElementById('edit-type').value = (t.type === 'installment') ? 'fixed' : t.type;

		this.editModal.showModal();
	}

	saveEdit() {
		if (!this.currentEditId) return;

		const updates = {
			description: document.getElementById('edit-desc').value,
			value: parseFloat(document.getElementById('edit-value').value),
			date: document.getElementById('edit-date').value,
			type: document.getElementById('edit-type').value
		};

		// Se mudou para variável, limpa o groupId para desagrupar visualmente (opcional)
		if (updates.type === 'variable') {
			updates.groupId = null;
		}

		this.store.updateTransaction(this.currentEditId, updates);
		this.render();
		this.editModal.close();
	}

	deleteTransaction() {
		if (!this.currentEditId) return;
		this.store.removeTransaction(this.currentEditId);
		this.render();
		this.editModal.close();
	}

	createCard(transaction) {
		const card = document.createElement('div');
		card.className = `card ${transaction.value >= 0 ? 'income' : 'expense'}`;
		if (transaction.status === 'projected') card.classList.add('projected');

		card.draggable = true;
		card.dataset.id = transaction.id;

		const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.value);

		card.innerHTML = `
            <span class="card-desc">${transaction.description}</span>
            <span class="card-value ${transaction.value >= 0 ? 'positive' : 'negative'}">${formattedValue}</span>
        `;

		// Click para Editar
		card.addEventListener('click', (e) => {
			// Evitar conflito com Drag (simples check, pode ser melhorado)
			this.openEditModal(transaction.id);
		});

		return card;
	}

	getMonthKey(date) {
		return `${date.getFullYear()}-${date.getMonth()}`;
	}
}
