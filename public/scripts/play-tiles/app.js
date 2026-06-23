import { TileBoard } from './board.js?v=3';
import { WhackGame } from './games/whack.js?v=3';
import { EquationGame } from './games/equation.js?v=3';
import { MemoryGame } from './games/memory.js?v=3';

export class SmartTilesApp {
	constructor() {
		this.elements = {
			tray: document.querySelector('.tray'),
			grid: document.querySelector('.grid'),
			graphList: document.querySelector('#graphList'),
			tileCount: document.querySelector('#tileCount'),
			linkCount: document.querySelector('#linkCount'),
			scoreValue: document.querySelector('#scoreValue'),
			metricOneLabel: document.querySelector('#metricOneLabel'),
			metricTwoLabel: document.querySelector('#metricTwoLabel'),
			metricThreeLabel: document.querySelector('#metricThreeLabel'),
			modeTitle: document.querySelector('#modeTitle'),
			modePrompt: document.querySelector('#modePrompt'),
			gameName: document.querySelector('#gameName'),
			setupInstructions: document.querySelector('#setupInstructions'),
			startGameButton: document.querySelector('#startGame'),
			checkGameButton: document.querySelector('#checkGame'),
			memoryControls: document.querySelector('#memoryControls'),
			memoryTileCount: document.querySelector('#memoryTileCount'),
			saveStatus: document.querySelector('#saveStatus'),
		};
		this.statusMessage = '';
		this.mode = 'whack';
		this.board = new TileBoard(this.elements, {
			isLocked: () => this.currentGame().isLocked(),
			onChange: () => this.render(),
			onTileClick: (tile) => this.currentGame().handleTileClick(tile),
			onMessage: (message) => this.setStatus(message),
		});
		this.games = {
			whack: new WhackGame(this, this.board),
			equation: new EquationGame(this, this.board),
			memory: new MemoryGame(this, this.board),
		};
	}

	start() {
		this.bindEvents();
		this.switchMode('whack');
	}

	currentGame() {
		return this.games[this.mode];
	}

	bindEvents() {
		document.querySelectorAll('.mode-tab').forEach((button) => {
			button.addEventListener('click', () => this.switchMode(button.dataset.mode));
		});
		document.querySelector('#resetBoard').addEventListener('click', () => this.switchMode(this.mode));
		this.elements.startGameButton.addEventListener('click', () => this.currentGame().start());
		this.elements.checkGameButton.addEventListener('click', () => this.currentGame().check());
		this.elements.memoryTileCount.addEventListener('change', () => this.games.memory.setTileCount(Number(this.elements.memoryTileCount.value)));
		document.querySelector('#saveSignal').addEventListener('click', () => this.saveInterest());
	}

	switchMode(mode) {
		if (this.games[this.mode]) this.games[this.mode].exit();
		this.mode = mode;
		this.statusMessage = '';
		const packItems = this.currentGame().enter();
		this.board.reset(packItems);
		if (this.currentGame().autoArrange) {
			this.currentGame().autoArrange({ silent: true });
		}
		this.render();
	}

	setStatus(message) {
		this.statusMessage = message;
		this.render();
	}

	render() {
		const game = this.currentGame();
		this.elements.modeTitle.textContent = game.title;
		this.elements.gameName.textContent = game.title;
		this.elements.setupInstructions.textContent = game.instructions();
		this.elements.modePrompt.textContent = this.statusMessage || game.prompt();

		this.elements.startGameButton.classList.toggle('hidden', this.mode === 'equation');
		this.elements.checkGameButton.classList.toggle('hidden', this.mode !== 'equation');
		this.elements.memoryControls.classList.toggle('hidden', this.mode !== 'memory');

		document.querySelectorAll('.mode-tab').forEach((button) => {
			button.classList.toggle('active', button.dataset.mode === this.mode);
		});

		this.renderGraph();
		this.renderMetrics(game.metrics());
	}

	renderMetrics(metrics) {
		const [first, second, third] = metrics;
		this.elements.metricOneLabel.textContent = first[0];
		this.elements.tileCount.textContent = first[1];
		this.elements.metricTwoLabel.textContent = second[0];
		this.elements.linkCount.textContent = second[1];
		this.elements.metricThreeLabel.textContent = third[0];
		this.elements.scoreValue.textContent = third[1];
	}

	renderGraph() {
		const compactEdges = this.board.adjacencyGraph().filter((edge) => edge.tile.id < edge.other.id);
		this.elements.graphList.innerHTML = '';

		if (compactEdges.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'graph-line';
			empty.textContent = 'No side contacts yet';
			this.elements.graphList.appendChild(empty);
			return;
		}

		compactEdges.forEach((edge) => {
			const line = document.createElement('div');
			line.className = 'graph-line';
			line.textContent = `Tile ${edge.tile.label || edge.tile.id.replace('tile-', '')} ${edge.fromSide} touches Tile ${
				edge.other.label || edge.other.id.replace('tile-', '')
			} ${edge.toSide}`;
			this.elements.graphList.appendChild(line);
		});
	}

	saveInterest() {
		const payload = {
			role: document.querySelector('#audienceRole').value,
			favoriteMode: document.querySelector('#favoriteMode').value,
			interestLevel: Number(document.querySelector('#interestLevel').value),
			email: document.querySelector('#email').value.trim(),
			mode: this.mode,
			score: this.elements.scoreValue.textContent,
			boardTiles: this.board.placedTileList().map((tile) => ({
				label: tile.label,
				row: tile.row,
				col: tile.col,
			})),
			graph: this.board.adjacencyGraph().map((edge) => ({
				from: edge.tile.label || edge.tile.id,
				fromSide: edge.fromSide,
				to: edge.other.label || edge.other.id,
				toSide: edge.toSide,
			})),
			createdAt: new Date().toISOString(),
		};
		const existing = JSON.parse(localStorage.getItem('smart_tiles_interest') || '[]');
		existing.push(payload);
		localStorage.setItem('smart_tiles_interest', JSON.stringify(existing));
		this.elements.saveStatus.textContent = 'Saved locally for this prototype.';
	}
}
