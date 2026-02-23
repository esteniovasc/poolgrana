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
		this.elCurrentMonthFixedExpenses = document.getElementById('current-month-fixed-expenses');
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
		this.editValueInput = document.getElementById('edit-value');

		// Listeners do Modal
		// Interceptar setas no campo de valor para pular de R$ 1 em R$ 1 (ao invés dos centavos definidos no step HTML)
		if (this.editValueInput) {
			this.editValueInput.addEventListener('keydown', (e) => {
				if (e.key === 'ArrowUp') {
					e.preventDefault();
					const val = parseFloat(this.editValueInput.value) || 0;
					// Mantém os centavos mas aumenta a parte inteira
					this.editValueInput.value = (val + 1).toFixed(2);
				} else if (e.key === 'ArrowDown') {
					e.preventDefault();
					const val = parseFloat(this.editValueInput.value) || 0;
					// Mantém os centavos mas diminui a parte inteira
					this.editValueInput.value = (val - 1).toFixed(2);
				}
			});
		}
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

		// Elementos da Linha do Tempo (Modal)
		this.timelineModal = document.getElementById('timeline-modal');
		this.tlBtnClose = document.getElementById('tl-btn-close');
		this.tlBtnPrev = document.getElementById('tl-btn-prev');
		this.tlBtnNext = document.getElementById('tl-btn-next');
		this.tlMonthTitle = document.getElementById('tl-month-title');
		this.tlStartBalanceContainer = document.getElementById('tl-start-balance-container');
		this.tlStartBalance = document.getElementById('tl-start-balance');
		this.timelineContent = document.getElementById('timeline-content');
		this.tlToggleCarryover = document.getElementById('tl-toggle-carryover');

		this.tlCurrentYear = this.currentDate.getFullYear();
		this.tlCurrentMonth = this.currentDate.getMonth();

		if (this.timelineModal) {
			this.tlBtnClose.addEventListener('click', () => this.timelineModal.close());
			this.timelineModal.addEventListener('click', (e) => {
				if (e.target === this.timelineModal) this.timelineModal.close();
			});

			this.tlToggleCarryover.addEventListener('change', () => {
				this.tlToggleCarryover.blur(); // Remove do foco para evitar interferência na seta
				this.renderTimeline(); // Re-renderizar com ou sem o saldo acumulado
			});

			this.tlBtnPrev.addEventListener('click', () => {
				this.tlCurrentMonth--;
				if (this.tlCurrentMonth < 0) {
					this.tlCurrentMonth = 11;
					this.tlCurrentYear--;
				}
				this.renderTimeline();
			});

			this.tlBtnNext.addEventListener('click', () => {
				this.tlCurrentMonth++;
				if (this.tlCurrentMonth > 11) {
					this.tlCurrentMonth = 0;
					this.tlCurrentYear++;
				}
				this.renderTimeline();
			});
		}
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
			let fixedExpense = 0; // Somente gastos fixos e negativos

			// Somar Fixos
			Object.values(fixedGroups).forEach(groupData => {
				const transactions = groupData[monthKey];
				if (transactions) {
					transactions.forEach(t => {
						balance += t.value;
						if (t.value >= 0) {
							income += t.value;
						} else {
							expense += t.value;
							fixedExpense += t.value;
						}
					});
				}
			});

			// Somar Variáveis
			const vars = variableByMonth[monthKey] || [];
			vars.forEach(t => {
				balance += t.value;
				if (t.value >= 0) income += t.value; else expense += t.value;
			});

			return { balance, income, expense, fixedExpense, date };
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

			// Destaque visual
			// Inicia sem a cor blue acentuada se não for explicitamente ativada no scroll
			// (A gestão do destaque agora está dentro do updateStatusDisplay)

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

		// Manter em cache para que a Timeline Diária saiba qual mês abrir
		this.tlCurrentYear = currentData.date.getFullYear();
		this.tlCurrentMonth = currentData.date.getMonth();

		// Atualizar Header Destaques: remover var(--accent) de todos, botar no activeIndex
		const headers = this.timelineHeader.querySelectorAll('.month-header-cell');
		headers.forEach((h, index) => {
			if (index === activeIndex) {
				h.style.color = 'var(--accent)';
			} else {
				h.style.color = ''; // resetar
			}
		});

		// Atualizar Mês Atual (Barra Superior)
		if (this.elCurrentMonthLabel) this.elCurrentMonthLabel.textContent = monthName.toUpperCase();

		const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

		if (this.elCurrentMonthBalance) {
			this.elCurrentMonthBalance.textContent = fmt.format(currentData.balance);
			this.elCurrentMonthBalance.className = currentData.balance >= 0 ? 'value-positive' : 'value-negative';
		}

		if (this.elCurrentMonthFixedExpenses) {
			this.elCurrentMonthFixedExpenses.textContent = fmt.format(currentData.fixedExpense);
			// como é gasto, sempre será negativo, então mantemos a classe value-negative fixada no HTML
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

		// Verifica se a data do cartão já passou para aplicar a classe 'is-past'
		const today = new Date();
		const yyyy = today.getFullYear();
		const mm = String(today.getMonth() + 1).padStart(2, '0');
		const dd = String(today.getDate()).padStart(2, '0');
		const todayStr = `${yyyy}-${mm}-${dd}`;

		if (transaction.date < todayStr) {
			card.classList.add('is-past');
		}

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

	// --- LÓGICA DA LINHA DO TEMPO DIÁRIA ---
	openTimelineModal() {
		// Abre na data que está atualmente visível na tela central (atualizado pelo scroll via this.tlCurrentYear e Month)
		this.renderTimeline();
		this.timelineModal.showModal();
	}

	renderTimeline() {
		if (!this.timelineModal) return;

		// 1. Atualizar Header
		const targetDate = new Date(this.tlCurrentYear, this.tlCurrentMonth, 1);
		const monthName = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
		this.tlMonthTitle.textContent = monthName.toUpperCase();

		// O formatador de moeda
		const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

		// 2. Coletar Todas as Transações até o fim desse mês
		// Precisamos do saldo acumulado do começo dos tempos até o dia 1 do mês selecionado
		// Observação: Isso requer somar tudo que tem data MENOR que dia 1.
		let initialBalance = 0;
		const startOfThisMonthStr = `${this.tlCurrentYear}-${String(this.tlCurrentMonth + 1).padStart(2, '0')}-01`;

		// As transações do mês em questão (já considerando as fixas do view cache)
		// O cache do store contem todas, mas para transações fixas que valem todos os meses,
		// precisamos replicar a lógica de 'monthKey'

		const currentMonthKey = `${this.tlCurrentYear}-${this.tlCurrentMonth}`;

		// Coletar as variáveis brutas do mês:
		const monthlyTransactions = [];

		this.store.transactions.forEach(t => {
			// Calculando saldo inicial:
			// Tudo que tem t.type='variable' com data < startOfThisMonthStr
			if (t.type === 'variable' && t.date < startOfThisMonthStr) {
				initialBalance += t.value;
			}
			// Transações variáveis do mês exato
			if (t.type === 'variable' && t.date.startsWith(`${this.tlCurrentYear}-${String(this.tlCurrentMonth + 1).padStart(2, '0')}`)) {
				monthlyTransactions.push({ ...t, tlDate: t.date }); // salva para listar
			}
		});

		// E os fixos? Fixos valem pros meses a partir da data de criação (ou onde foram alocados).
		// O `processTransactions` gerencia isso criando 'groupData'. Mas e o initial balance?
		// Para simplificar: A view já chamou `this.monthlyTotals`! Podemos usar this.monthlyTotals
		// pra puxar a soma acumulada de todos os meses antes e o "fixed groups" pra puxar do mês atual!

		let computedInitBalance = 0;
		if (this.monthlyTotals) {
			for (let mt of this.monthlyTotals) {
				const mtKey = this.getMonthKey(mt.date);
				if (mt.date < targetDate) { // meses passados visíveis
					computedInitBalance += mt.balance;
				}
			}
			// Mas isso só cobre os meses visíveis (-2). Para cobrir tudo perfeitamente precisaríamos iterar do início.
			// Como o Poolgrana foca na visualização da viewport de meses...
			// Vamos adotar computedInitBalance calculado a partir do acumulado passado,
			// ou, se quisermos precisão total para o "saldo em conta real", usamos o `initialBalance` mais
			// iteração de transações fixas passadas.
			//
			// Por enquanto, faremos a iteração completa pelo db:
		}

		// Método Definitivo para Saldo Inicial e Listagem:
		// Verificar o toggle para ver se deve calcular do começo ou se deve começar com R$ 0,00 explícito
		let accumBalance = 0;

		if (this.tlToggleCarryover && this.tlToggleCarryover.checked) {
			const dRange = this.getDateRange();
			// Puxa e soma acumulado baseado em todos os cache dos views calculados
			const viewCalc = this.computeMonthlyTotals(dRange, this.processTransactions(dRange).fixedGroups, this.processTransactions(dRange).variableByMonth);
			for (let i = 0; i < viewCalc.length; i++) {
				if (viewCalc[i].date < targetDate) {
					accumBalance += viewCalc[i].balance;
				}
			}

			this.tlStartBalanceContainer.style.display = 'inline-block';
			this.tlStartBalance.textContent = fmt.format(accumBalance);
			this.tlStartBalance.className = accumBalance >= 0 ? 'value-positive' : 'value-negative';
		} else {
			// Não soma o saldoHerdado
			this.tlStartBalanceContainer.style.display = 'none';
		}

		const { fixedGroups, variableByMonth } = this.processTransactions([targetDate]);

		// Monta Eventos
		const events = []; // Array de { day: int, transactions: [] }
		const tlData = {}; // day -> []

		// Se tem saldo herdado, vamos simular que ele caiu na conta no Dia 1 do Mês corrente
		if (this.tlToggleCarryover && this.tlToggleCarryover.checked && accumBalance !== 0) {
			tlData[1] = [{
				id: 'simulated-carryover',
				description: 'Saldo Herdado Anterior',
				value: accumBalance,
				date: `${this.tlCurrentYear}-${String(this.tlCurrentMonth + 1).padStart(2, '0')}-01`,
				type: 'variable',
				isSimulatedCarryover: true
			}];
		}

		// Injeta Vars
		const vars = variableByMonth[currentMonthKey] || [];
		vars.forEach(t => {
			const d = parseInt(t.date.split('-')[2]); // extrai dd
			if (!tlData[d]) tlData[d] = [];

			// Somente adiciona se for transação real, para não duplicar saldo inicial por acidente na renderização bruta do view vars.
			// Na verdade vars já tem só as transações do Store, então tá seguro.
			tlData[d].push(t);
		});

		// Injeta Fixos
		Object.values(fixedGroups).forEach(groupData => {
			const arr = groupData[currentMonthKey];
			if (arr) {
				arr.forEach(t => {
					// Pega o mesmo DD da data original do fixo pra repetir 'no mesmo dia' mas pro mês atual
					const d = parseInt(t.date.split('-')[2]);
					if (!tlData[d]) tlData[d] = [];
					tlData[d].push({ ...t, isFixedInstance: true }); // marca
				});
			}
		});

		// Render HTMl
		this.timelineContent.innerHTML = '';
		// A variavel runningTotal inicia com 0 porque o accumBalance (Saldo Herdado)
		// agora é contabilizado somando como um evento injetado no tlData[1]
		let runningTotal = 0;

		// Ordenar dias
		const sortedDays = Object.keys(tlData).map(Number).sort((a, b) => a - b);

		if (sortedDays.length === 0) {
			this.timelineContent.innerHTML = '<div style="text-align:center; padding: 20px; color: #999;">Nenhuma transação neste mês.</div>';
			return;
		}

		sortedDays.forEach(day => {
			const dayTx = tlData[day];
			// Calcula totais do dia para o running balance
			let daySum = 0;
			dayTx.forEach(t => daySum += t.value);
			runningTotal += daySum;

			const rowDiv = document.createElement('div');
			rowDiv.className = 'tl-row';

			const dateDiv = document.createElement('div');
			dateDiv.className = 'tl-date';
			dateDiv.textContent = `${String(day).padStart(2, '0')}/${targetDate.toLocaleDateString('pt-BR', { month: 'short' })}`;

			const evDiv = document.createElement('div');
			evDiv.className = 'tl-events';

			dayTx.forEach(t => {
				const tDiv = document.createElement('div');
				tDiv.className = `tl-item ${t.value >= 0 ? 'income' : 'expense'}`;

				// Se for o saldo simulado, aplicar um estilo extra sutil se desejar
				if (t.isSimulatedCarryover) {
					tDiv.style.background = '#f8f9fa';
					tDiv.style.borderStyle = 'dashed';
					tDiv.style.borderWidth = '1px';
					tDiv.style.borderColor = '#ccc';
					tDiv.style.borderLeft = `3px solid ${t.value >= 0 ? 'var(--green)' : 'var(--red)'}`;
				}

				const vStr = fmt.format(t.value);
				tDiv.innerHTML = `<span class="tl-item-desc">${t.description}</span><span style="color: ${t.value >= 0 ? 'var(--green)' : 'var(--red)'}">${t.value > 0 ? '+' + vStr : vStr}</span>`;
				evDiv.appendChild(tDiv);
			});

			const balDiv = document.createElement('div');
			balDiv.className = 'tl-balance-box';
			balDiv.innerHTML = `
				<span class="tl-balance-label">Saldo do Dia</span>
				<span class="tl-balance-val ${runningTotal >= 0 ? 'positive' : 'negative'}">${fmt.format(runningTotal)}</span>
			`;

			rowDiv.appendChild(dateDiv);
			rowDiv.appendChild(evDiv);
			rowDiv.appendChild(balDiv);
			this.timelineContent.appendChild(rowDiv);
		});
	}
}
