import { Store } from './js/model.js';
import { View } from './js/view.js';
import { DragDrop } from './js/dragdrop.js';

document.addEventListener('DOMContentLoaded', () => {

	// Inicializar Store com dados de exemplo (Mock inicial)
	const store = new Store();

	// Inicializar View
	const view = new View(document.getElementById('board'), store);

	// Inicializar Drag & Drop
	const dragDrop = new DragDrop(store, view);

	// Inicializar Omnibox (Simples por enquanto)
	const input = document.getElementById('cmd-input');
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			input.blur();
			return;
		}

		if (e.key === 'Enter') {
			const command = input.value;
			// TODO: Implementar parser real
			console.log("Comando recebido:", command);

			// Regex para capturar "Descrição Valor" (ex: "Netflix -50", "Salário 3000")
			// Aceita valores com + ou - opcional, e decimais com ponto ou vírgula
			const match = command.match(/^(.+?)\s+([+-]?\d+(?:[.,]\d+)?)$/);

			if (match) {
				const description = match[1].trim();
				let valueStr = match[2].replace(',', '.');
				const value = parseFloat(valueStr);

				store.addTransaction({
					description: description,
					value: value,
					date: new Date().toISOString().split('T')[0],
					type: 'variable', // Default
					status: 'consolidated'
				});

				console.log(`Adicionado: ${description} | R$ ${value}`);
			} else {
				console.log("Comando não reconhecido. Tente: 'Descrição Valor'");
			}

			input.value = '';
			view.render();
		}
	});

	// Render inicial
	view.render();
	view.initScroll();
	view.initScroll();

	console.log("Poolgrana iniciado.");

	// Atalho de Teclado: '/' para focar na Omnibox
	document.addEventListener('keydown', (e) => {
		// Ignorar se já estiver em um input ou textarea ou contenteditable
		const activeTag = document.activeElement.tagName.toLowerCase();
		if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) {
			return;
		}

		// Ignorar se o modal estiver aberto
		// Check simples: O elemento <dialog> tem a propriedade open
		const editModal = document.getElementById('edit-modal');
		if (editModal && editModal.open) {
			return;
		}

		if (e.key === '/') {
			e.preventDefault(); // Evitar digitar a barra
			const cmdInput = document.getElementById('cmd-input');
			if (cmdInput) {
				cmdInput.focus();
			}
		}
	});

	// --- Lógica de Salvar / Abrir ---
	const btnSave = document.getElementById('btn-save');
	const btnLoad = document.getElementById('btn-load');
	const fileInput = document.getElementById('file-input');

	if (btnSave) {
		btnSave.addEventListener('click', () => {
			const data = JSON.stringify(store.transactions, null, 2);
			const blob = new Blob([data], { type: 'application/json' });
			const url = URL.createObjectURL(blob);

			const now = new Date();
			const dateStr = now.toISOString().split('T')[0];
			const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
			const filename = `fluxo-local-backup-${dateStr}-${timeStr}.json`;

			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		});
	}

	if (btnLoad) {
		btnLoad.addEventListener('click', () => {
			if (confirm("ATENÇÃO: Carregar um arquivo irá SUBSTITUIR todos os dados atuais.\n\nRecomendamos Salvar o projeto atual antes de continuar.\n\nDeseja prosseguir?")) {
				fileInput.click();
			}
		});
	}

	if (fileInput) {
		fileInput.addEventListener('change', (e) => {
			const file = e.target.files[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = (event) => {
				try {
					const json = JSON.parse(event.target.result);
					if (Array.isArray(json)) {
						store.transactions = json;
						store.save(); // Salva no LocalStorage
						view.render();
						alert("Projeto carregado com sucesso!");
					} else {
						alert("Erro: O arquivo não parece conter uma lista válida de transações.");
					}
				} catch (err) {
					console.error(err);
					alert("Erro ao ler o arquivo JSON.");
				}
				// Reset input para permitir carregar o mesmo arquivo novamente se necessário
				fileInput.value = '';
			};
			reader.readAsText(file);
		});
	}
});
