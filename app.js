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
		const tlModalOpen = document.getElementById('timeline-modal')?.open;

		// Se a timeline estivér aberta, ignore os atalhos de input para não bugar!
		if (!tlModalOpen) {
			// Ignorar se já estiver em um input ou textarea ou contenteditable
			const activeTag = document.activeElement.tagName.toLowerCase();
			if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) {
				return;
			}
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

		// Novo atalho: 'p' para alternar o esmaecimento de contas antigas/pagas
		if (e.key.toLowerCase() === 'p') {
			e.preventDefault();
			document.body.classList.toggle('fade-past-active');
		}

		// Novo atalho: 't' para abrir a linha do tempo (timeline)
		if (e.key.toLowerCase() === 't') {
			e.preventDefault();
			const tlModal = document.getElementById('timeline-modal');
			if (tlModal) {
				if (tlModal.open) {
					tlModal.close();
				} else {
					view.openTimelineModal();
					document.activeElement?.blur(); // Tira o foco do doc active p/ as setas funcionarem direto na timeline
				}
			}
		}

		// Atalhos rápidos seta para direita/esquerda dentro da timeline
		const tlModal = document.getElementById('timeline-modal');
		// O `document.activeElement` pode estar contido no modal, 
		// mas mesmo focado indiretamente ou em document.body, a seta funciona.
		if (tlModal && tlModal.open) {
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				document.getElementById('tl-btn-next').click();
			} else if (e.key === 'ArrowLeft') {
				e.preventDefault();
				document.getElementById('tl-btn-prev').click();
			}
		}

		// Novo atalho: 'c' para adicionar Cartão de Crédito
		if (e.key.toLowerCase() === 'c') {
			e.preventDefault();
			const ccModal = document.getElementById('cc-modal');
			if (ccModal && !ccModal.open) {
				ccModal.showModal();
				const nomeInput = document.getElementById('cc-name');
				if (nomeInput) nomeInput.focus();
			}
		}

	});

	// --- Lógica de Salvar / Abrir ---
	const btnSave = document.getElementById('btn-save');
	const btnLoad = document.getElementById('btn-load');
	const fileInput = document.getElementById('file-input');

	if (btnSave) {
		btnSave.addEventListener('click', () => {
			const data = JSON.stringify({
				transactions: store.transactions,
				creditCards: store.creditCards
			}, null, 2);
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
						store.creditCards = [];
						store.save(); // Salva no LocalStorage
						view.render();
						alert("Projeto carregado com sucesso!");
					} else if (json.transactions) {
						store.transactions = json.transactions;
						store.creditCards = json.creditCards || [];
						store.save();
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

	// Adicionar listener do form de Cartão de Crédito
	const ccForm = document.getElementById('cc-form');
	if (ccForm) {
		ccForm.addEventListener('submit', (e) => {
			e.preventDefault();
			store.addCreditCard({
				name: document.getElementById('cc-name').value,
				color: document.getElementById('cc-color').value,
				closingDay: parseInt(document.getElementById('cc-closing').value),
				dueDay: parseInt(document.getElementById('cc-due').value)
			});
			document.getElementById('cc-modal').close();
			ccForm.reset();
			view.render();
		});
	}

	// Botões e Lógica de Gerenciar Cartões Clicando na Ilha
	const btnManageCc = document.getElementById('btn-manage-cc');
	const ccManagerModal = document.getElementById('cc-manager-modal');
	const ccManagerContent = document.getElementById('cc-manager-content');

	if (btnManageCc && ccManagerModal) {
		btnManageCc.addEventListener('click', () => {
			renderCcManager();
			ccManagerModal.showModal();
			document.activeElement?.blur();
		});
	}

	function renderCcManager() {
		ccManagerContent.innerHTML = '';

		if (!store.creditCards || store.creditCards.length === 0) {
			ccManagerContent.innerHTML = '<div style="text-align:center; padding: 20px; color: #999;">Nenhum cartão cadastrado.</div>';
			return;
		}

		store.creditCards.forEach(cc => {
			const item = document.createElement('div');
			item.className = 'cc-manager-item';

			item.innerHTML = `
				<div class="cc-manager-info">
					<div class="cc-color-dot" style="background-color: ${cc.color};"></div>
					<div>
						<strong>${cc.name}</strong>
						<div class="tl-balance-label" style="margin-top:2px;">Fatura: Fecha ${cc.closingDay} | Vence ${cc.dueDay}</div>
					</div>
				</div>
				<div class="cc-manager-actions">
					<button class="btn-danger" style="padding: 5px 10px; font-size: 0.8rem;">Remover</button>
				</div>
			`;

			const btnRemove = item.querySelector('.btn-danger');
			btnRemove.addEventListener('click', () => {
				if (confirm(`Tem certeza que deseja remover o cartão ${cc.name}? As transações antigas ficarão sem cartão.`)) {
					store.removeCreditCard(cc.id);
					renderCcManager(); // Atualiza painel
					view.render();     // Atualiza background
				}
			});

			ccManagerContent.appendChild(item);
		});
	}
});
