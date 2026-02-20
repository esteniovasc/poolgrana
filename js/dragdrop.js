export class DragDrop {
	constructor(store, view) {
		this.store = store;
		this.view = view;
		this.draggedId = null;
		this.init();
	}

	init() {
		document.addEventListener('dragstart', this.handleDragStart.bind(this));
		document.addEventListener('dragover', this.handleDragOver.bind(this));
		document.addEventListener('dragleave', this.handleDragLeave.bind(this));
		document.addEventListener('drop', this.handleDrop.bind(this));
		document.addEventListener('dragend', this.handleDragEnd.bind(this));
	}

	handleDragStart(e) {
		const card = e.target.closest('.card');
		if (!card) return;

		this.draggedId = card.dataset.id;
		card.classList.add('dragging');
		e.dataTransfer.effectAllowed = 'copyMove';
		e.dataTransfer.setData('text/plain', this.draggedId);
	}

	handleDragOver(e) {
		e.preventDefault();
		// Pode ser dropado em: .grid-cell (Fixed) OU .variable-col (Variable)
		const dropTarget = e.target.closest('.grid-cell, .variable-col-body');

		if (dropTarget) {
			// Visual feedback could be improved, but for now browser default or simple usage
			// Poderíamos adicionar classe 'drag-over' se quiséssemos estilo custom
			e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
		}
	}

	handleDragLeave(e) {
		// Cleanup visuals if needed
	}

	handleDrop(e) {
		e.preventDefault();

		// Tentamos achar o container alvo
		// No grid: o target é a .grid-cell
		// No variable: o target é o .variable-col-body, que precisamos subir para .variable-col para pegar ano/mes

		let targetEl = e.target.closest('.grid-cell');
		let isFixedGrid = true;

		if (!targetEl) {
			targetEl = e.target.closest('.variable-col'); // Pega a coluna inteira para ter acesso aos dados
			isFixedGrid = false;
		}

		if (!targetEl || !this.draggedId) return;

		const targetYear = parseInt(targetEl.dataset.year);
		const targetMonth = parseInt(targetEl.dataset.month); // 1-based

		const originalTx = this.store.getTransaction(this.draggedId);
		if (!originalTx) return;

		// Manter o dia original
		const originalDay = originalTx.date.split('-')[2];
		const newDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${originalDay}`;

		// Lógica de Tipo: 
		// Se soltou no Fixed Grid -> Vira 'fixed' (ou installment, manter logica original?? Por enquanto forçar fixed se simples)
		// Se soltou no Variable -> Vira 'variable'
		// E lidar com groupId

		const typeUpdate = isFixedGrid ? (originalTx.type === 'variable' ? 'fixed' : originalTx.type) : 'variable';
		// Se for para variável, nulificar groupId para "desagrupar" da linha, a menos que queiramos manter? 
		// Spec: Variable flow é avulso.
		const groupUpdate = isFixedGrid ? (originalTx.groupId || originalTx.description) : null;

		if (e.altKey) {
			// DUPLICAR
			this.store.duplicateTransaction(this.draggedId, newDateStr);
			// Nota: duplicate nao aplica as mudanças de tipo/grupo automaticamente na copia ainda, 
			// precisaria refatorar duplicate ou atualizar a copia logo em seguida.
			// Por simplicidade: Duplicar apenas cria na nova data com propriedades originais. 
			// O ideal seria criar já com o tipo correto do destino.

		} else {
			// MOVER
			this.store.updateTransaction(this.draggedId, {
				date: newDateStr,
				type: typeUpdate,
				groupId: groupUpdate
			});
		}

		this.view.render();
		this.draggedId = null;
	}

	handleDragEnd(e) {
		const card = e.target.closest('.card');
		if (card) {
			card.classList.remove('dragging');
		}
		// document.querySelectorAll('.month-col').forEach(c => c.classList.remove('drag-over'));
		this.draggedId = null;
	}
}
