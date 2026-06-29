import { TileBoard } from './board.js?v=11';
import { WhackGame } from './games/whack.js?v=6';
import { EquationGame } from './games/equation.js?v=7';
import { MemoryGame } from './games/memory.js?v=3';
import { PuzzleGame } from './games/puzzle.js?v=13';

export class SmartTilesApp {
	constructor() {
		this.elements = {
			tray: document.querySelector('.tray'),
			grid: document.querySelector('.grid'),
			graphList: document.querySelector('#graphList'),
			tileCount: document.querySelector('#tileCount'),
			linkCount: document.querySelector('#linkCount'),
			scoreValue: document.querySelector('#scoreValue'),
			quickTileCount: document.querySelector('#quickTileCount'),
			quickLinkCount: document.querySelector('#quickLinkCount'),
			quickScoreValue: document.querySelector('#quickScoreValue'),
			metricOneLabel: document.querySelector('#metricOneLabel'),
			metricTwoLabel: document.querySelector('#metricTwoLabel'),
			metricThreeLabel: document.querySelector('#metricThreeLabel'),
			quickMetricOneLabel: document.querySelector('#quickMetricOneLabel'),
			quickMetricTwoLabel: document.querySelector('#quickMetricTwoLabel'),
			quickMetricThreeLabel: document.querySelector('#quickMetricThreeLabel'),
			modeTitle: document.querySelector('#modeTitle'),
			modePrompt: document.querySelector('#modePrompt'),
			gameName: document.querySelector('#gameName'),
			setupInstructions: document.querySelector('#setupInstructions'),
			startGameButton: document.querySelector('#startGame'),
			checkGameButton: document.querySelector('#checkGame'),
			equationAnswerPanel: document.querySelector('#equationAnswerPanel'),
			equationAnswerInput: document.querySelector('#equationAnswerInput'),
			equationCheckButton: document.querySelector('#equationCheckBoard'),
			memoryControls: document.querySelector('#memoryControls'),
			memoryTileCount: document.querySelector('#memoryTileCount'),
			memorySpeedControls: document.querySelector('#memorySpeedControls'),
			memorySpeedMode: document.querySelector('#memorySpeedMode'),
			puzzleDifficultyControls: document.querySelector('#puzzleDifficultyControls'),
			puzzleDifficulty: document.querySelector('#puzzleDifficulty'),
			puzzleControls: document.querySelector('#puzzleControls'),
			puzzleTileCount: document.querySelector('#puzzleTileCount'),
			puzzleHintButton: document.querySelector('#puzzleHint'),
			puzzleAutoSolveButton: document.querySelector('#puzzleAutoSolve'),
			puzzleHintPanel: document.querySelector('#puzzleHintPanel'),
			saveStatus: document.querySelector('#saveStatus'),
		};
		this.statusMessage = '';
		this.mode = 'whack';
		this.board = new TileBoard(this.elements, {
			isLocked: () => this.currentGame().isLocked(),
			canPlace: (source, row, col) => this.currentGame().canPlace(source, row, col),
			cellState: (row, col) => (this.currentGame().cellState ? this.currentGame().cellState(row, col) : ''),
			cellLabel: (row, col) => (this.currentGame().cellLabel ? this.currentGame().cellLabel(row, col) : ''),
			onCellClick: (row, col) => (this.currentGame().handleCellClick ? this.currentGame().handleCellClick(row, col) : false),
			onCellKey: (row, col, event) => {
				if (this.currentGame().handleCellKey) this.currentGame().handleCellKey(row, col, event);
			},
			onChange: () => this.render(),
			onTileClick: (tile) => this.currentGame().handleTileClick(tile),
			onMessage: (message) => this.setStatus(message),
		});
		this.games = {
			whack: new WhackGame(this, this.board),
			equation: new EquationGame(this, this.board),
			memory: new MemoryGame(this, this.board),
			puzzle: new PuzzleGame(this, this.board),
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
		document.querySelector('#resetBoard').addEventListener('click', () => {
			if (this.currentGame().reset) {
				this.currentGame().reset();
				return;
			}
			this.switchMode(this.mode);
		});
		this.elements.startGameButton.addEventListener('click', () => this.currentGame().start());
		this.elements.checkGameButton.addEventListener('click', () => this.currentGame().check());
		this.elements.equationCheckButton.addEventListener('click', () => this.games.equation.check());
		this.elements.equationAnswerInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') this.games.equation.check();
		});
		this.elements.equationAnswerInput.addEventListener('input', () => {
			this.elements.equationAnswerInput.value = this.elements.equationAnswerInput.value.replace(/\D/g, '').slice(0, 3);
		});
		this.elements.memoryTileCount.addEventListener('change', () => this.games.memory.setTileCount(Number(this.elements.memoryTileCount.value)));
		this.elements.memorySpeedMode.addEventListener('change', () => this.games.memory.setSpeedMode(this.elements.memorySpeedMode.value));
		this.elements.puzzleDifficulty.addEventListener('change', () => this.games.puzzle.setDifficulty(this.elements.puzzleDifficulty.value));
		this.elements.puzzleTileCount.addEventListener('change', () => this.games.puzzle.setTileCount(Number(this.elements.puzzleTileCount.value)));
		this.elements.puzzleHintButton.addEventListener('click', () => this.games.puzzle.toggleHint());
		this.elements.puzzleAutoSolveButton.addEventListener('click', () => this.games.puzzle.autoSolve());
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
		this.board.refreshCellStates();
		if (this.currentGame().autoStartOnEnter) {
			this.currentGame().start();
			return;
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
		this.elements.setupInstructions.textContent = this.statusMessage ? `${game.instructions()} ${this.statusMessage}` : game.instructions();
		this.elements.modePrompt.textContent = this.statusMessage || game.prompt();
		if (game.render) game.render();
		this.elements.startGameButton.textContent = this.mode === 'puzzle' && game.solved ? 'Play Again' : 'Start Game';

		this.elements.startGameButton.classList.toggle('hidden', this.mode === 'equation');
		this.elements.checkGameButton.classList.toggle('hidden', true);
		this.elements.equationAnswerPanel.classList.toggle('hidden', this.mode !== 'equation');
		this.elements.memoryControls.classList.toggle('hidden', this.mode !== 'memory');
		this.elements.memorySpeedControls.classList.toggle('hidden', this.mode !== 'memory');
		this.elements.puzzleDifficultyControls.classList.toggle('hidden', this.mode !== 'puzzle');
		this.elements.puzzleControls.classList.toggle('hidden', this.mode !== 'puzzle');
		this.elements.puzzleHintButton.classList.toggle('hidden', this.mode !== 'puzzle');
		this.elements.puzzleAutoSolveButton.classList.toggle('hidden', this.mode !== 'puzzle');
		this.elements.puzzleHintPanel.classList.toggle(
			'hidden',
			this.mode !== 'puzzle' || !(game.shouldShowPuzzlePanel ? game.shouldShowPuzzlePanel() : game.showHint),
		);

		document.querySelectorAll('.mode-tab').forEach((button) => {
			button.classList.toggle('active', button.dataset.mode === this.mode);
		});

		this.renderGraph();
		this.renderMetrics(game.metrics());
	}

	renderMetrics(metrics) {
		const [first, second, third] = metrics;
		const metricValues = [
			this.elements.tileCount,
			this.elements.linkCount,
			this.elements.scoreValue,
			this.elements.quickTileCount,
			this.elements.quickLinkCount,
			this.elements.quickScoreValue,
		];
		metricValues.forEach((element) => {
			element.classList.remove('running-time', 'stopped-time', 'normal-score', 'complete-score');
		});
		this.elements.metricOneLabel.textContent = first[0];
		this.elements.tileCount.textContent = first[1];
		this.elements.metricTwoLabel.textContent = second[0];
		this.elements.linkCount.textContent = second[1];
		if (second[2]) this.elements.linkCount.classList.add(second[2]);
		this.elements.metricThreeLabel.textContent = third[0];
		this.elements.scoreValue.textContent = third[1];
		if (third[2]) this.elements.scoreValue.classList.add(third[2]);
		this.elements.quickMetricOneLabel.textContent = first[0];
		this.elements.quickTileCount.textContent = first[1];
		this.elements.quickMetricTwoLabel.textContent = second[0];
		this.elements.quickLinkCount.textContent = second[1];
		if (second[2]) this.elements.quickLinkCount.classList.add(second[2]);
		this.elements.quickMetricThreeLabel.textContent = third[0];
		this.elements.quickScoreValue.textContent = third[1];
		if (third[2]) this.elements.quickScoreValue.classList.add(third[2]);
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
