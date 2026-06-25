export class PuzzleGame {
	constructor(app, board) {
		this.app = app;
		this.board = board;
		this.title = 'Puzzle';
		this.selectedCount = 9;
		this.moves = 0;
		this.solved = false;
		this.gridSize = 3;
		this.showHint = false;
		this.autoSolving = false;
		this.solveTimers = [];
	}

	enter() {
		this.moves = 0;
		this.solved = false;
		this.showHint = false;
		this.clearSolveTimers();
		this.gridSize = Math.sqrt(this.selectedCount);
		return this.makePuzzlePack();
	}

	exit() {
		this.clearSolveTimers();
	}

	isLocked() {
		return this.solved || this.autoSolving;
	}

	canPlace(_source, row, col) {
		return row < this.gridSize && col < this.gridSize;
	}

	cellState(row, col) {
		return row < this.gridSize && col < this.gridSize ? '' : 'inactive';
	}

	instructions() {
		return 'Place the LED pattern pieces on the board. Click a placed piece to rotate it until the colored paths connect.';
	}

	prompt() {
		return `${this.selectedCount}-piece puzzle selected. Drag pieces from the pack, or click Start Game to shuffle them onto the board.`;
	}

	setTileCount(count) {
		this.selectedCount = count;
		this.app.statusMessage = '';
		this.clearSolveTimers();
		const packItems = this.enter();
		this.board.reset(packItems);
		this.board.refreshCellStates();
		this.app.render();
	}

	start() {
		this.moves = 0;
		this.solved = false;
		this.clearSolveTimers();
		this.board.resetBoardTiles();
		const positions = this.shuffled(this.puzzleLayout());
		const pieces = this.shuffled(this.board.availablePackItems('puzzle').slice(0, this.selectedCount));
		pieces.forEach((piece, index) => {
			const tile = this.board.addTileFromPack(piece.key, positions[index].row, positions[index].col);
			if (!tile) return;
			tile.gameData.rotation = this.randomRotation();
			this.updateTile(tile);
		});
		this.app.setStatus('Puzzle shuffled. Click pieces to rotate, then drag them into place.');
	}

	handleTileClick(tile) {
		if (tile.kind !== 'puzzle' || this.solved) return false;
		tile.gameData.rotation = (Number(tile.gameData.rotation || 0) + 90) % 360;
		this.moves += 1;
		this.updateTile(tile);
		this.checkSolved();
		this.app.render();
		return true;
	}

	render() {
		this.board.placedTileList()
			.filter((tile) => tile.kind === 'puzzle')
			.forEach((tile) => this.updateTile(tile));
		if (this.app.elements.puzzleHintButton) {
			this.app.elements.puzzleHintButton.textContent = this.showHint ? 'Hide Hint' : 'Hint';
		}
		this.renderHint();
		if (!this.solved) this.checkSolved({ silent: true });
	}

	metrics() {
		return [
			['Pieces', `${this.board.placedTileList().filter((tile) => tile.kind === 'puzzle').length}/${this.selectedCount}`],
			['Moves', this.moves],
			['Status', this.solved ? 'Solved' : 'Play'],
		];
	}

	makePuzzlePack() {
		this.gridSize = Math.sqrt(this.selectedCount);
		return Array.from({ length: this.selectedCount }, (_, index) => {
			const row = Math.floor(index / this.gridSize);
			const col = index % this.gridSize;
			return {
				key: `puzzle-${this.selectedCount}-${index}`,
				label: String(index + 1),
				face: {
					type: 'puzzle',
					pixels: makePuzzlePixels(this.gridSize, row, col),
					rotation: 0,
				},
				kind: 'puzzle',
				reusable: false,
				puzzle: {
					index,
					row,
					col,
					gridSize: this.gridSize,
					pixels: makePuzzlePixels(this.gridSize, row, col),
				},
			};
		});
	}

	toggleHint() {
		this.showHint = !this.showHint;
		this.app.setStatus(this.showHint ? 'Hint shown. Match this connected LED pattern.' : 'Hint hidden.');
	}

	autoSolve() {
		this.clearSolveTimers();
		this.autoSolving = true;
		this.solved = false;
		this.showHint = true;
		this.app.setStatus('Auto solving the puzzle one tile at a time.');
		const targets = this.puzzleLayout();

		targets.forEach((target, index) => {
			const timer = setTimeout(() => {
				const tile = this.findOrCreateTileForPiece(index);
				if (!tile) return;
				this.board.moveTileToCell(tile.id, target.row, target.col);
				tile.gameData.rotation = 0;
				this.updateTile(tile);
				this.moves += 1;

				if (index === targets.length - 1) {
					this.autoSolving = false;
					this.checkSolved();
				}
				this.app.render();
			}, index * 260);
			this.solveTimers.push(timer);
		});
	}

	updateTile(tile) {
		const source = this.board.packItems.find((item) => item.key === tile.sourceKey);
		if (!source?.puzzle) return;
		tile.gameData.puzzle = source.puzzle;
		if (tile.gameData.rotation === undefined) tile.gameData.rotation = this.randomRotation();
		this.board.setTileDisplay(
			tile,
			{
				type: 'puzzle',
				pixels: source.puzzle.pixels,
				rotation: tile.gameData.rotation,
			},
			this.solved ? 'puzzle-solved' : 'puzzle-tile',
		);
	}

	checkSolved({ silent = false } = {}) {
		const pieces = this.board.placedTileList().filter((tile) => tile.kind === 'puzzle');
		if (pieces.length !== this.selectedCount) return false;
		const targets = this.puzzleLayout();
		const solved = pieces.every((tile) => {
			const puzzle = tile.gameData.puzzle;
			if (!puzzle) return false;
			const target = targets[puzzle.index];
			return tile.row === target.row && tile.col === target.col && Number(tile.gameData.rotation || 0) === 0;
		});
		if (solved && !this.solved) {
			this.solved = true;
			pieces.forEach((tile) => this.updateTile(tile));
			if (!silent) this.app.setStatus(`Puzzle solved in ${this.moves} moves.`);
		}
		return solved;
	}

	randomRotation() {
		const rotations = [0, 90, 180, 270];
		return rotations[Math.floor(Math.random() * rotations.length)];
	}

	shuffled(items) {
		return [...items].sort(() => Math.random() - 0.5);
	}

	puzzleLayout() {
		return Array.from({ length: this.selectedCount }, (_, index) => ({
			row: Math.floor(index / this.gridSize),
			col: index % this.gridSize,
		}));
	}

	findOrCreateTileForPiece(index) {
		const placed = this.board.placedTileList().find((tile) => tile.kind === 'puzzle' && tile.gameData.puzzle?.index === index);
		if (placed) return placed;

		const source = this.board.availablePackItems('puzzle').find((item) => item.puzzle.index === index);
		if (!source) return null;
		const target = this.puzzleLayout()[index];
		return this.board.addTileFromPack(source.key, target.row, target.col);
	}

	renderHint() {
		const panel = this.app.elements.puzzleHintPanel;
		if (!panel) return;
		panel.replaceChildren();
		if (!this.showHint) return;

		const title = document.createElement('div');
		title.className = 'puzzle-hint-title';
		title.textContent = 'Hint: solved LED pattern';
		panel.appendChild(title);

		const preview = document.createElement('div');
		preview.className = 'puzzle-preview';
		preview.style.setProperty('--puzzle-preview-size', this.gridSize);
		this.puzzleLayout().forEach(({ row, col }) => {
			const cell = document.createElement('div');
			cell.className = 'puzzle-preview-tile';
			cell.appendChild(this.board.makePixelMatrix(makePuzzlePixels(this.gridSize, row, col)));
			preview.appendChild(cell);
		});
		panel.appendChild(preview);
	}

	clearSolveTimers() {
		this.solveTimers.forEach((timer) => clearTimeout(timer));
		this.solveTimers = [];
		this.autoSolving = false;
	}
}

function makePuzzlePixels(gridSize, pieceRow, pieceCol) {
	const canvasSize = gridSize * 8;
	const canvas = Array.from({ length: canvasSize }, () => Array.from({ length: canvasSize }, () => 'off'));

	drawPuzzlePaths(canvas, gridSize);

	return Array.from({ length: 8 }, (_, y) =>
		Array.from({ length: 8 }, (_, x) => canvas[pieceRow * 8 + y][pieceCol * 8 + x]),
	);
}

function drawPuzzlePaths(canvas, gridSize) {
	if (gridSize === 2) {
		drawLine(canvas, 'blue', 0, 3, 7, 3);
		drawLine(canvas, 'blue', 7, 3, 7, 11);
		drawLine(canvas, 'blue', 7, 11, 15, 11);
		drawLine(canvas, 'green', 3, 15, 3, 8);
		drawLine(canvas, 'green', 3, 8, 11, 8);
		drawLine(canvas, 'green', 11, 8, 11, 0);
		drawRing(canvas, 'yellow', 11, 3, 3);
		drawLine(canvas, 'magenta', 0, 14, 15, 14);
		return;
	}

	drawLine(canvas, 'blue', 0, 3, 10, 3);
	drawLine(canvas, 'blue', 10, 3, 10, 10);
	drawLine(canvas, 'blue', 10, 10, 15, 10);
	drawLine(canvas, 'red', 8, 6, 8, 1);
	drawLine(canvas, 'red', 8, 1, 15, 1);
	drawLine(canvas, 'red', 15, 1, 15, 6);
	drawRing(canvas, 'red', 12, 4, 3);
	drawLine(canvas, 'yellow', 16, 4, 23, 4);
	drawLine(canvas, 'yellow', 20, 4, 20, 12);
	drawLine(canvas, 'yellow', 14, 12, 20, 12);
	drawLine(canvas, 'magenta', 0, 13, 8, 13);
	drawLine(canvas, 'magenta', 8, 13, 8, 19);
	drawLine(canvas, 'magenta', 8, 19, 3, 19);
	drawLine(canvas, 'white', 6, 15, 14, 15);
	drawLine(canvas, 'white', 12, 9, 12, 20);
	drawLine(canvas, 'green', 18, 9, 18, 18);
	drawLine(canvas, 'green', 18, 18, 23, 18);
	drawRing(canvas, 'green', 21, 14, 3);
	drawLine(canvas, 'cyan', 8, 20, 16, 20);
	drawLine(canvas, 'cyan', 16, 20, 16, 23);
	drawLine(canvas, 'orange', 16, 8, 16, 16);
	drawLine(canvas, 'orange', 16, 16, 12, 16);
}

function drawLine(canvas, color, x1, y1, x2, y2) {
	const dx = Math.sign(x2 - x1);
	const dy = Math.sign(y2 - y1);
	let x = x1;
	let y = y1;
	while (true) {
		setPixel(canvas, x, y, color);
		if (x === x2 && y === y2) break;
		if (x !== x2) x += dx;
		if (y !== y2) y += dy;
	}
}

function drawRing(canvas, color, centerX, centerY, radius) {
	drawLine(canvas, color, centerX - radius, centerY - radius, centerX + radius, centerY - radius);
	drawLine(canvas, color, centerX + radius, centerY - radius, centerX + radius, centerY + radius);
	drawLine(canvas, color, centerX + radius, centerY + radius, centerX - radius, centerY + radius);
	drawLine(canvas, color, centerX - radius, centerY + radius, centerX - radius, centerY - radius);
}

function setPixel(canvas, x, y, color) {
	if (!canvas[y] || canvas[y][x] === undefined) return;
	canvas[y][x] = color;
}
