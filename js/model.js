export class Transaction {
	constructor({ id, description, value, date, type = 'variable', status = 'projected', parentId = null, groupId = null }) {
		this.id = id || crypto.randomUUID();
		this.description = description;
		this.value = value;
		this.date = date; // YYYY-MM-DD
		this.type = type; // 'fixed', 'variable', 'installment'
		this.status = status; // 'projected', 'consolidated'
		this.parentId = parentId;
		this.groupId = groupId; // groupId: Identifica a linha na timeline. Se nulo, usa a descrição como fallback p/ agrupamento ou é variável pura.
	}
}

export class Store {
	constructor() {
		this.transactions = this.load() || this.getMockData();
	}

	load() {
		const data = localStorage.getItem('fluxo-local-data');
		return data ? JSON.parse(data).map(t => new Transaction(t)) : null;
	}

	save() {
		localStorage.setItem('fluxo-local-data', JSON.stringify(this.transactions));
	}

	addTransaction(data) {
		const transaction = new Transaction(data);
		this.transactions.push(transaction);
		this.save();
		return transaction;
	}

	removeTransaction(id) {
		this.transactions = this.transactions.filter(t => t.id !== id);
		this.save();
	}

	updateTransaction(id, updates) {
		const index = this.transactions.findIndex(t => t.id === id);
		if (index !== -1) {
			this.transactions[index] = { ...this.transactions[index], ...updates };
			this.save();
		}
	}

	getTransaction(id) {
		return this.transactions.find(t => t.id === id);
	}

	getTransactionsByMonth(year, month) {
		// month is 0-indexed (0 = Jan, 1 = Feb)
		return this.transactions.filter(t => {
			const d = new Date(t.date);
			// Ajuste de fuso horário simples (considerando data string YYYY-MM-DD)
			const [y, m] = t.date.split('-').map(Number);
			return y === year && (m - 1) === month;
		});
	}

	duplicateTransaction(id, newDate) {
		const original = this.getTransaction(id);
		if (!original) return;

		const copy = new Transaction({
			...original,
			id: null, // New ID generated in constructor
			date: newDate
		});

		this.transactions.push(copy);
		this.save();
		return copy;
	}

	getMockData() {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');

		return [
			new Transaction({ description: 'Salário', value: 3500, date: `${year}-${month}-05`, type: 'fixed', status: 'consolidated' }),
			new Transaction({ description: 'Aluguel', value: -1200, date: `${year}-${month}-10`, type: 'fixed', status: 'projected' }),
			new Transaction({ description: 'Mercado', value: -450, date: `${year}-${month}-15`, type: 'variable' }),
			new Transaction({ description: 'Netflix', value: -55.90, date: `${year}-${month}-20`, type: 'fixed' }),
			new Transaction({ description: 'Café', value: -12, date: `${year}-${month}-02`, type: 'variable' }),
			new Transaction({ description: 'Luz (Est)', value: -150, date: `${year}-${month}-25`, type: 'variable', status: 'projected' })
		];
	}
}
