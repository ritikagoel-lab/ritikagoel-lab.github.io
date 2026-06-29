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
		this.puzzleSeed = 0;
		this.difficulty = 'medium';
		this.hintMode = null;
		this.hintIndex = null;
		this.flashSolved = false;
		this.flashTimer = null;
	}

	enter() {
		this.moves = 0;
		this.solved = false;
		this.showHint = false;
		this.hintMode = null;
		this.hintIndex = null;
		this.clearSolveTimers();
		this.clearFlashTimer();
		this.flashSolved = false;
		this.gridSize = Math.sqrt(this.selectedCount);
		return this.makePuzzlePack();
	}

	exit() {
		this.clearSolveTimers();
		this.clearFlashTimer();
	}

	isLocked() {
		return this.solved || this.autoSolving;
	}

	canPlace(_source, row, col) {
		if (this.shouldAnchorPiece()) {
			const anchorIndex = this.anchorIndex();
			const sourceIndex = _source?.puzzle?.index ?? _source?.gameData?.puzzle?.index;
			const isAnchorCell = this.isAnchorCell(row, col);
			if (isAnchorCell && !_source?.gameData?.lockedAnchor && sourceIndex !== anchorIndex) return false;
			if ((sourceIndex === anchorIndex || _source?.gameData?.lockedAnchor) && !isAnchorCell) return false;
		}
		return row < this.gridSize && col < this.gridSize;
	}

	cellState(row, col) {
		return row < this.gridSize && col < this.gridSize ? '' : 'inactive';
	}

	instructions() {
		if (this.difficulty === 'difficult') {
			return 'Straws puzzle. Place the LED pattern pieces on the board. Click a placed piece to rotate it until the straw-like edge clues connect.';
		}
		return 'Regular puzzle. Place the picture pieces on the board. Click a placed piece to rotate it until the image comes together.';
	}

	prompt() {
		return `${this.selectedCount}-piece ${this.difficultyLabel().toLowerCase()} puzzle selected. Drag pieces from the pack, or use New Puzzle for a fresh layout.`;
	}

	setTileCount(count) {
		this.selectedCount = count;
		this.app.statusMessage = '';
		this.clearSolveTimers();
		const packItems = this.enter();
		this.board.reset(packItems);
		this.placeAnchorPiece();
		if (this.shouldAnchorPiece()) this.app.statusMessage = 'Anchor tile placed on the board. Solve with the remaining pieces.';
		this.board.refreshCellStates();
		this.app.render();
	}

	setDifficulty(difficulty) {
		this.difficulty = difficulty === 'difficult' ? 'difficult' : 'medium';
		this.app.statusMessage = '';
		this.clearSolveTimers();
		this.puzzleSeed += 1;
		const packItems = this.enter();
		this.board.reset(packItems);
		this.placeAnchorPiece();
		if (this.shouldAnchorPiece()) this.app.statusMessage = 'Anchor tile placed on the board. Solve with the remaining pieces.';
		this.board.refreshCellStates();
		this.app.render();
	}

	start() {
		this.changePuzzle();
	}

	changePuzzle() {
		this.puzzleSeed += 1;
		this.resetCurrentPuzzle();
	}

	resetCurrentPuzzle() {
		this.moves = 0;
		this.solved = false;
		this.showHint = false;
		this.hintMode = null;
		this.hintIndex = null;
		this.clearSolveTimers();
		this.clearFlashTimer();
		this.flashSolved = false;
		this.gridSize = Math.sqrt(this.selectedCount);
		this.board.reset(this.makePuzzlePack());
		this.placeAnchorPiece();
		this.board.refreshCellStates();
		this.app.setStatus('');
	}

	handleTileClick(tile) {
		if (tile.kind !== 'puzzle' || this.solved) return false;
		if (tile.gameData.lockedAnchor) return true;
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
			this.app.elements.puzzleHintButton.textContent = this.difficulty === 'difficult' && this.showHint ? 'Hide Hint' : 'Hint';
		}
		this.renderHint();
		if (!this.solved) this.checkSolved();
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
		const pack = Array.from({ length: this.selectedCount }, (_, index) => {
			const row = Math.floor(index / this.gridSize);
			const col = index % this.gridSize;
			const rotation = this.randomRotation();
			const pixels = makePuzzlePixels(this.gridSize, row, col, this.puzzleSeed, this.difficulty);
			return {
				key: `puzzle-${this.difficulty}-${this.selectedCount}-${this.puzzleSeed}-${index}`,
				label: String(index + 1),
				face: {
					type: 'puzzle',
					pixels,
					rotation,
				},
				kind: 'puzzle',
				reusable: false,
				puzzle: {
					index,
					row,
					col,
					gridSize: this.gridSize,
					pixels,
					rotation,
					difficulty: this.difficulty,
				},
			};
		});
		return this.shuffled(pack);
	}

	autoArrange() {
		this.placeAnchorPiece();
	}

	toggleHint() {
		if (this.difficulty !== 'difficult') {
			this.app.setStatus('Reference image is shown. Match the board to that picture.');
			return;
		}
		this.showHint = !this.showHint;
		if (!this.showHint) {
			this.hintMode = null;
			this.hintIndex = null;
		}
		this.app.setStatus(this.showHint ? 'Hint shown. Pick one hidden tile to peek.' : 'Hint hidden.');
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
		if (tile.gameData.rotation === undefined) tile.gameData.rotation = source.puzzle.rotation;
		this.board.setTileDisplay(
			tile,
			{
				type: 'puzzle',
				pixels: source.puzzle.pixels,
				rotation: tile.gameData.rotation,
			},
			this.solved ? 'puzzle-solved' : 'puzzle-tile',
		);
		tile.element.classList.toggle('puzzle-anchor', Boolean(tile.gameData.lockedAnchor && !this.solved));
	}

	checkSolved({ silent = false } = {}) {
		const pieces = this.board.placedTileList().filter((tile) => tile.kind === 'puzzle');
		if (pieces.length !== this.selectedCount) return false;
		const solved = canvasesMatch(
			this.assembledCanvas(pieces),
			makeSolvedCanvas(this.gridSize, this.puzzleSeed, this.difficulty),
		);
		if (solved && !this.solved) {
			this.solved = true;
			this.flashSolved = true;
			this.clearFlashTimer();
			this.flashTimer = setTimeout(() => {
				this.flashSolved = false;
				this.app.render();
			}, 2000);
			pieces.forEach((tile) => this.updateTile(tile));
			if (!silent) this.app.setStatus(`Correct. Puzzle complete in ${this.moves} moves.`);
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

	shouldShowPuzzlePanel() {
		return this.difficulty !== 'difficult' || this.showHint || this.solved;
	}

	difficultyLabel() {
		return {
			medium: 'Regular',
			difficult: 'Straws',
		}[this.difficulty];
	}

	shouldAnchorPiece() {
		return this.difficulty === 'difficult' && (this.selectedCount === 9 || this.selectedCount === 4);
	}

	anchorIndex() {
		if (!this.shouldAnchorPiece()) return null;
		return this.selectedCount === 9 ? 4 : 0;
	}

	anchorCell() {
		if (!this.shouldAnchorPiece()) return null;
		if (this.selectedCount === 9) return { row: 1, col: 1 };
		return { row: 0, col: 0 };
	}

	isAnchorCell(row, col) {
		const anchor = this.anchorCell();
		return Boolean(anchor && row === anchor.row && col === anchor.col);
	}

	placeAnchorPiece() {
		if (!this.shouldAnchorPiece()) return;
		const anchor = this.anchorCell();
		const anchorIndex = this.anchorIndex();
		const existing = this.board.placedTileList().find((tile) => tile.kind === 'puzzle' && tile.gameData.puzzle?.index === anchorIndex);
		if (existing) {
			existing.gameData.rotation = 0;
			existing.gameData.lockedAnchor = true;
			existing.element.draggable = false;
			this.board.moveTileToCell(existing.id, anchor.row, anchor.col);
			this.updateTile(existing);
			return;
		}

		const source = this.board.availablePackItems('puzzle').find((item) => item.puzzle.index === anchorIndex);
		if (!source) return;
		const tile = this.board.addTileFromPack(source.key, anchor.row, anchor.col);
		if (!tile) return;
		tile.gameData.rotation = 0;
		tile.gameData.lockedAnchor = true;
		tile.element.draggable = false;
		this.updateTile(tile);
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
		if (!this.shouldShowPuzzlePanel()) return;

		if (this.solved) {
			panel.appendChild(this.makeSolvedCelebration());
			return;
		}

		if (this.difficulty !== 'difficult') {
			panel.appendChild(this.makeReferenceImage());
			return;
		}

		const title = document.createElement('div');
		title.className = 'puzzle-hint-title';
		title.textContent = 'Hint: choose one hidden tile to reveal';
		panel.appendChild(title);

		const preview = document.createElement('div');
		preview.className = 'puzzle-preview puzzle-hint-grid';
		preview.style.setProperty('--puzzle-preview-size', this.gridSize);
		this.puzzleLayout().forEach(({ row, col }, index) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'puzzle-preview-tile puzzle-hint-tile';
			button.classList.toggle('active', this.hintMode === 'tile' && this.hintIndex === index);
			button.setAttribute('aria-label', `Reveal hint tile at row ${row + 1}, column ${col + 1}`);
			button.addEventListener('click', () => {
				this.hintMode = 'tile';
				this.hintIndex = index;
				this.app.render();
			});
			if (this.hintMode === 'tile' && this.hintIndex === index) {
				button.appendChild(this.board.makePixelMatrix(makePuzzlePixels(this.gridSize, row, col, this.puzzleSeed, this.difficulty)));
			} else {
				button.appendChild(this.board.makePixelMatrix(makeBlankCanvas(8)));
			}
			preview.appendChild(button);
		});
		panel.appendChild(preview);
	}

	makeReferenceImage() {
		const wrapper = document.createElement('div');
		wrapper.className = 'puzzle-reference';

		const copy = document.createElement('div');
		copy.className = 'puzzle-reference-copy';
		const title = document.createElement('div');
		title.className = 'puzzle-hint-title';
		title.textContent = 'Reference image';
		const text = document.createElement('p');
		text.textContent = 'Build this picture on the tile board using the jumbled pieces from the pack.';
		copy.append(title, text);

		const image = document.createElement('div');
		image.className = 'puzzle-reference-image';
		image.appendChild(makeLargePixelMatrix(makeSolvedCanvas(this.gridSize, this.puzzleSeed, this.difficulty)));

		wrapper.append(image, copy);
		return wrapper;
	}

	makeSolvedCelebration() {
		const wrapper = document.createElement('div');
		wrapper.className = 'puzzle-celebration';

		const badge = document.createElement('div');
		badge.className = `puzzle-solved-badge${this.flashSolved ? ' flashing' : ''}`;
		badge.textContent = 'Solved';
		wrapper.appendChild(badge);

		const zoom = document.createElement('div');
		zoom.className = 'puzzle-complete-zoom';
		zoom.appendChild(makeLargePixelMatrix(makeSolvedCanvas(this.gridSize, this.puzzleSeed, this.difficulty)));
		wrapper.appendChild(zoom);

		const playAgain = document.createElement('button');
		playAgain.type = 'button';
		playAgain.className = 'primary-button puzzle-play-again';
		playAgain.textContent = 'Play Again';
		playAgain.addEventListener('click', () => this.start());
		wrapper.appendChild(playAgain);

		return wrapper;
	}

	clearSolveTimers() {
		this.solveTimers.forEach((timer) => clearTimeout(timer));
		this.solveTimers = [];
		this.autoSolving = false;
	}

	clearFlashTimer() {
		if (this.flashTimer) clearTimeout(this.flashTimer);
		this.flashTimer = null;
	}

	assembledCanvas(pieces) {
		const size = this.gridSize * 8;
		const canvas = makeBlankCanvas(size);
		pieces.forEach((tile) => {
			const puzzle = tile.gameData.puzzle;
			if (!puzzle) return;
			const pixels = rotatePixels(puzzle.pixels, Number(tile.gameData.rotation || 0));
			paintPiece(canvas, pixels, tile.row, tile.col);
		});
		return canvas;
	}
}

function makePuzzlePixels(gridSize, pieceRow, pieceCol, seed = 0, difficulty = 'medium') {
	const canvasSize = gridSize * 8;
	const canvas = makeSolvedCanvas(gridSize, seed, difficulty);

	return Array.from({ length: 8 }, (_, y) =>
		Array.from({ length: 8 }, (_, x) => canvas[pieceRow * 8 + y][pieceCol * 8 + x]),
	);
}

function makeSolvedCanvas(gridSize, seed = 0, difficulty = 'medium') {
	const canvasSize = gridSize * 8;
	const canvas = makeBlankCanvas(canvasSize);
	drawPuzzlePaths(canvas, gridSize, seed, difficulty);
	return canvas;
}

function makeBlankCanvas(size) {
	return Array.from({ length: size }, () => Array.from({ length: size }, () => 'off'));
}

function makeLargePixelMatrix(pixelRows) {
	const matrix = document.createElement('span');
	matrix.className = 'puzzle-complete-matrix';
	matrix.style.setProperty('--complete-pixels', pixelRows.length);
	pixelRows.flat().forEach((color) => {
		const pixel = document.createElement('span');
		pixel.className = 'pixel';
		pixel.dataset.color = color;
		matrix.appendChild(pixel);
	});
	return matrix;
}

function drawPuzzlePaths(canvas, gridSize, seed = 0, difficulty = 'medium') {
	if (difficulty === 'difficult') {
		drawDifficultConnectors(canvas, gridSize, seed);
		return;
	}
	drawMediumScene(canvas, gridSize, seed);
}

function drawEasyPuzzle(canvas, gridSize, seed = 0) {
	if (gridSize === 2) {
		if (seed % 2 === 0) drawFriendlyFishScene(canvas, gridSize);
		else drawDuckScene(canvas, gridSize);
		return;
	}
	const variant = seed % 3;
	if (variant === 0) {
		drawFriendlyFishScene(canvas, gridSize);
		return;
	}
	if (variant === 1) {
		drawDuckScene(canvas, gridSize);
		return;
	}
	drawButterflyScene(canvas, gridSize);
}

function drawSimpleOutside(canvas, gridSize, horizonRatio = 0.66) {
	const size = gridSize * 8;
	const horizon = Math.floor(size * horizonRatio);
	fillRect(canvas, 'blue', 0, 0, size - 1, horizon);
	fillRect(canvas, 'green', 0, horizon, size - 1, size - 1);
	drawLine(canvas, 'cyan', 0, horizon, size - 1, horizon);
	drawLine(canvas, 'yellow', 0, size - 2, size - 1, size - 2);
}

function drawMediumScene(canvas, gridSize, seed = 0) {
	const variant = seed % (gridSize === 3 ? 4 : 3);
	if (gridSize === 3 && variant === 0) {
		drawHotAirBalloonScene(canvas);
		return;
	}
	if (variant === 1 || (gridSize === 2 && variant === 0)) {
		drawRocketScene(canvas, gridSize);
		return;
	}
	if (variant === 2 || (gridSize === 2 && variant === 1)) {
		drawMediumHouseScene(canvas, gridSize);
		return;
	}
	drawMediumBoatScene(canvas, gridSize);
}

function drawHotAirBalloonScene(canvas) {
	const size = 24;
	fillRect(canvas, 'blue', 0, 0, size - 1, size - 1);

	fillRect(canvas, 'magenta', 0, 12, size - 1, 23);
	fillRect(canvas, 'pink', 0, 15, size - 1, 23);
	fillRect(canvas, 'cyan', 0, 18, size - 1, 23);
	fillRect(canvas, 'blue', 0, 20, size - 1, 23);

	drawCloud(canvas, 4, 4);
	drawCloud(canvas, 19, 5);
	drawCloud(canvas, 4, 12);
	drawCloud(canvas, 20, 13);

	const cx = 12;
	const cy = 6;
	const rx = 6;
	const ry = 6;
	for (let y = cy - ry; y <= cy + ry; y += 1) {
		for (let x = cx - rx; x <= cx + rx; x += 1) {
			const dx = (x - cx) / rx;
			const dy = (y - cy) / ry;
			if (dx * dx + dy * dy <= 1.05) {
				let color = 'orange';
				if (Math.abs(x - cx) <= 2) color = 'yellow';
				if (y <= cy - 4) color = 'red';
				if (x <= cx - 5 || x >= cx + 5) color = 'red';
				setPixel(canvas, x, y, color);
			}
		}
	}

	drawLine(canvas, 'yellow', cx, cy - 4, cx, cy + 5);
	drawLine(canvas, 'orange', cx - 4, cy + 5, cx + 4, cy + 5);
	drawLine(canvas, 'white', cx - 3, cy + 6, cx - 3, cy + 10);
	drawLine(canvas, 'white', cx + 3, cy + 6, cx + 3, cy + 10);
	fillRect(canvas, 'tan', cx - 3, cy + 10, cx + 3, cy + 10);
	fillRect(canvas, 'soil', cx - 3, cy + 11, cx + 3, cy + 15);
	fillRect(canvas, 'tan', cx - 2, cy + 12, cx - 2, cy + 14);
	fillRect(canvas, 'tan', cx + 2, cy + 12, cx + 2, cy + 14);
	drawLine(canvas, 'orange', cx - 3, cy + 13, cx + 3, cy + 13);
}

function drawFriendlyFishScene(canvas, gridSize) {
	const size = gridSize * 8;
	fillRect(canvas, 'blue', 0, 0, size - 1, size - 1);
	for (let y = 2; y < size; y += 7) drawLine(canvas, 'cyan', 0, y, size - 1, y);

	const cx = Math.floor(size * 0.58);
	const cy = Math.floor(size * 0.5);
	const rx = gridSize === 2 ? 5 : 8;
	const ry = gridSize === 2 ? 3 : 5;
	const tailBaseX = cx - rx + 1;
	const tailTipX = Math.max(1, tailBaseX - (gridSize === 2 ? 5 : 7));
	fillFishTail(canvas, 'green', tailTipX, tailBaseX, cy, ry + 1);
	fillEllipse(canvas, 'orange', cx, cy, rx, ry);
	fillEllipse(canvas, 'yellow', cx + 1, cy, Math.max(2, rx - 3), Math.max(2, ry - 2));
	fillEllipse(canvas, 'orange', cx - 2, cy - ry, 2, 1);
	fillEllipse(canvas, 'orange', cx - 1, cy + ry, 2, 1);
	setPixel(canvas, cx + Math.floor(rx * 0.45), cy - 1, 'black');
	drawLine(canvas, 'white', cx + Math.floor(rx * 0.2), cy + 2, cx + Math.floor(rx * 0.55), cy + 2);
	setPixel(canvas, Math.max(1, cx - rx - 2), Math.max(1, cy - ry - 3), 'white');
	setPixel(canvas, Math.max(2, cx - rx - 4), Math.max(1, cy - ry - 1), 'white');
	setPixel(canvas, Math.min(size - 3, cx + rx + 3), Math.min(size - 3, cy + ry + 2), 'white');
}

function drawDuckScene(canvas, gridSize) {
	const size = gridSize * 8;
	const waterY = Math.floor(size * 0.64);
	fillRect(canvas, 'blue', 0, 0, size - 1, waterY - 1);
	fillRect(canvas, 'cyan', 0, waterY, size - 1, size - 1);
	drawLine(canvas, 'white', 0, waterY - 1, size - 1, waterY - 1);
	drawLine(canvas, 'blue', 0, size - 3, size - 1, size - 3);
	drawSun(canvas, size - 4, 4, 'yellow');

	const bodyCx = Math.floor(size * 0.48);
	const bodyCy = Math.floor(size * 0.64);
	const bodyRx = gridSize === 2 ? 5 : 7;
	const bodyRy = gridSize === 2 ? 3 : 5;
	fillEllipse(canvas, 'yellow', bodyCx, bodyCy, bodyRx, bodyRy);
	fillEllipse(canvas, 'orange', bodyCx + Math.floor(bodyRx * 0.25), bodyCy + Math.floor(bodyRy * 0.15), Math.max(2, bodyRx - 3), Math.max(1, bodyRy - 3));
	const headCx = bodyCx - Math.floor(bodyRx * 0.5);
	const headCy = bodyCy - bodyRy - 2;
	fillEllipse(canvas, 'yellow', headCx, headCy, gridSize === 2 ? 3 : 4, gridSize === 2 ? 3 : 4);
	drawLine(canvas, 'orange', headCx - 3, headCy, headCx - 6, headCy);
	drawLine(canvas, 'orange', headCx - 3, headCy + 1, headCx - 5, headCy + 1);
	setPixel(canvas, headCx + 1, headCy - 1, 'black');
	drawLine(canvas, 'white', bodyCx - bodyRx, bodyCy + bodyRy + 2, bodyCx + bodyRx, bodyCy + bodyRy + 2);
}

function drawButterflyScene(canvas, gridSize) {
	const size = gridSize * 8;
	drawSimpleOutside(canvas, gridSize, 0.72);
	const cx = Math.floor(size / 2);
	const cy = Math.floor(size * 0.44);
	fillEllipse(canvas, 'magenta', cx - 4, cy - 2, gridSize === 2 ? 3 : 5, gridSize === 2 ? 4 : 6);
	fillEllipse(canvas, 'orange', cx + 4, cy - 2, gridSize === 2 ? 3 : 5, gridSize === 2 ? 4 : 6);
	fillEllipse(canvas, 'blue', cx - 4, cy + 4, gridSize === 2 ? 3 : 5, gridSize === 2 ? 3 : 5);
	fillEllipse(canvas, 'green', cx + 4, cy + 4, gridSize === 2 ? 3 : 5, gridSize === 2 ? 3 : 5);
	drawLine(canvas, 'white', cx, cy - 6, cx, cy + 7);
	fillEllipse(canvas, 'yellow', cx, cy - 7, 2, 2);
	drawLine(canvas, 'yellow', cx - 1, cy - 8, cx - 4, cy - 11);
	drawLine(canvas, 'yellow', cx + 1, cy - 8, cx + 4, cy - 11);
	setPixel(canvas, cx - 4, cy - 2, 'cyan');
	setPixel(canvas, cx + 4, cy - 2, 'yellow');
	setPixel(canvas, cx - 4, cy + 4, 'white');
	setPixel(canvas, cx + 4, cy + 4, 'cyan');
}

function drawRocketScene(canvas, gridSize) {
	const size = gridSize * 8;
	fillRect(canvas, 'blue', 0, 0, size - 1, size - 1);
	for (let index = 0; index < size; index += 5) {
		setPixel(canvas, (index * 3 + 2) % size, (index * 5 + 1) % Math.max(1, size - 4), 'yellow');
	}
	const cx = Math.floor(size / 2);
	const top = gridSize === 2 ? 2 : 3;
	const bottom = size - (gridSize === 2 ? 4 : 5);
	fillTriangle(canvas, 'red', cx, top, cx - (gridSize === 2 ? 3 : 4), top + 5, cx + (gridSize === 2 ? 3 : 4), top + 5);
	for (let y = top + 3; y <= bottom; y += 1) {
		const half = y < top + 6 ? Math.floor((y - top) / 2) + 1 : gridSize === 2 ? 2 : 3;
		drawLine(canvas, 'white', cx - half, y, cx + half, y);
	}
	fillEllipse(canvas, 'cyan', cx, top + 9, 2, 2);
	drawLine(canvas, 'red', cx - 5, bottom - 2, cx - 2, bottom - 4);
	drawLine(canvas, 'red', cx + 5, bottom - 2, cx + 2, bottom - 4);
	drawLine(canvas, 'orange', cx - 2, bottom + 1, cx, size - 1);
	drawLine(canvas, 'yellow', cx, bottom + 1, cx, size - 1);
	drawLine(canvas, 'orange', cx + 2, bottom + 1, cx, size - 1);
}

function drawDifficultConnectors(canvas, gridSize, seed = 0) {
	const markerPalettes = [
		['red', 'blue', 'yellow', 'magenta', 'white', 'green', 'cyan', 'orange', 'green'],
		['cyan', 'yellow', 'red', 'orange', 'white', 'blue', 'green', 'magenta', 'yellow'],
		['green', 'magenta', 'cyan', 'blue', 'white', 'orange', 'red', 'yellow', 'green'],
	];
	const markerShapes = seed % 2 === 0
		? ['plus', 'box', 'corner', 'zig', 'ladder', 'fork', 'slash', 'gate', 'steps']
		: ['corner', 'slash', 'gate', 'box', 'plus', 'steps', 'fork', 'zig', 'ladder'];
	const palette = markerPalettes[seed % markerPalettes.length];

	Array.from({ length: gridSize * gridSize }, (_, index) => {
		drawCellMarker(canvas, Math.floor(index / gridSize), index % gridSize, palette[index % palette.length], markerShapes[index % markerShapes.length]);
	});

	const horizontalKeys = rotatedSignatures([
		{ color: 'blue', offsets: [1], accent: 'dot' },
		{ color: 'red', offsets: [2, 5], accent: 'bar' },
		{ color: 'yellow', offsets: [6], accent: 'cap' },
		{ color: 'magenta', offsets: [3], accent: 'bar' },
		{ color: 'cyan', offsets: [1, 4], accent: 'cap' },
		{ color: 'orange', offsets: [5], accent: 'dot' },
		{ color: 'green', offsets: [2], accent: 'cap' },
		{ color: 'white', offsets: [4, 6], accent: 'bar' },
	], seed);
	const verticalKeys = rotatedSignatures([
		{ color: 'cyan', offsets: [2], accent: 'dot' },
		{ color: 'orange', offsets: [5], accent: 'bar' },
		{ color: 'green', offsets: [1, 6], accent: 'cap' },
		{ color: 'white', offsets: [4], accent: 'dot' },
		{ color: 'blue', offsets: [3, 5], accent: 'cap' },
		{ color: 'yellow', offsets: [2], accent: 'bar' },
		{ color: 'magenta', offsets: [6], accent: 'dot' },
		{ color: 'red', offsets: [1, 4], accent: 'cap' },
	], seed + 3);

	let keyIndex = 0;
	for (let row = 0; row < gridSize; row += 1) {
		for (let col = 0; col < gridSize - 1; col += 1) {
			drawHorizontalConnector(canvas, row, col, horizontalKeys[keyIndex % horizontalKeys.length]);
			keyIndex += 1;
		}
	}

	keyIndex = 0;
	for (let row = 0; row < gridSize - 1; row += 1) {
		for (let col = 0; col < gridSize; col += 1) {
			drawVerticalConnector(canvas, row, col, verticalKeys[keyIndex % verticalKeys.length]);
			keyIndex += 1;
		}
	}
}

function rotatedSignatures(signatures, seed = 0) {
	const offset = seed % signatures.length;
	return [...signatures.slice(offset), ...signatures.slice(0, offset)];
}

function drawHorizontalConnector(canvas, row, col, signature) {
	const boundaryX = (col + 1) * 8 - 1;
	const baseY = row * 8;
	signature.offsets.forEach((offset, index) => {
		const y = baseY + offset;
		drawLine(canvas, signature.color, boundaryX - 3, y, boundaryX + 4, y);
		if (signature.accent === 'dot') {
			setPixel(canvas, boundaryX - 1, y + (index % 2 === 0 ? 1 : -1), signature.color);
			setPixel(canvas, boundaryX + 2, y + (index % 2 === 0 ? 1 : -1), signature.color);
		}
		if (signature.accent === 'bar') {
			setPixel(canvas, boundaryX, y - 1, signature.color);
			setPixel(canvas, boundaryX + 1, y - 1, signature.color);
			setPixel(canvas, boundaryX, y + 1, signature.color);
			setPixel(canvas, boundaryX + 1, y + 1, signature.color);
		}
		if (signature.accent === 'cap') {
			setPixel(canvas, boundaryX - 3, y - 1, signature.color);
			setPixel(canvas, boundaryX - 3, y + 1, signature.color);
			setPixel(canvas, boundaryX + 4, y - 1, signature.color);
			setPixel(canvas, boundaryX + 4, y + 1, signature.color);
		}
	});
}

function drawVerticalConnector(canvas, row, col, signature) {
	const boundaryY = (row + 1) * 8 - 1;
	const baseX = col * 8;
	signature.offsets.forEach((offset, index) => {
		const x = baseX + offset;
		drawLine(canvas, signature.color, x, boundaryY - 3, x, boundaryY + 4);
		if (signature.accent === 'dot') {
			setPixel(canvas, x + (index % 2 === 0 ? 1 : -1), boundaryY - 1, signature.color);
			setPixel(canvas, x + (index % 2 === 0 ? 1 : -1), boundaryY + 2, signature.color);
		}
		if (signature.accent === 'bar') {
			setPixel(canvas, x - 1, boundaryY, signature.color);
			setPixel(canvas, x + 1, boundaryY, signature.color);
			setPixel(canvas, x - 1, boundaryY + 1, signature.color);
			setPixel(canvas, x + 1, boundaryY + 1, signature.color);
		}
		if (signature.accent === 'cap') {
			setPixel(canvas, x - 1, boundaryY - 3, signature.color);
			setPixel(canvas, x + 1, boundaryY - 3, signature.color);
			setPixel(canvas, x - 1, boundaryY + 4, signature.color);
			setPixel(canvas, x + 1, boundaryY + 4, signature.color);
		}
	});
}

function drawFish(canvas) {
	const body = [
		[6, 6],
		[7, 5],
		[8, 5],
		[9, 5],
		[10, 6],
		[11, 7],
		[10, 8],
		[9, 9],
		[8, 9],
		[7, 9],
		[6, 8],
		[5, 7],
		[7, 6],
		[8, 6],
		[9, 6],
		[8, 7],
		[9, 7],
		[7, 8],
		[8, 8],
		[9, 8],
	];
	body.forEach(([x, y]) => setPixel(canvas, x, y, 'orange'));
	drawLine(canvas, 'yellow', 4, 7, 1, 4);
	drawLine(canvas, 'yellow', 4, 7, 1, 10);
	drawLine(canvas, 'yellow', 1, 4, 1, 10);
	drawLine(canvas, 'green', 8, 9, 8, 12);
	drawLine(canvas, 'cyan', 0, 2, 15, 2);
	drawLine(canvas, 'cyan', 0, 13, 15, 13);
	setPixel(canvas, 10, 6, 'black');
}

function drawBigFish(canvas) {
	drawLine(canvas, 'cyan', 0, 2, 23, 2);
	drawLine(canvas, 'cyan', 0, 21, 23, 21);
	drawLine(canvas, 'blue', 2, 5, 5, 5);
	drawLine(canvas, 'blue', 18, 18, 21, 18);

	const bodyPoints = [
		[9, 8],
		[10, 7],
		[11, 7],
		[12, 7],
		[13, 7],
		[14, 8],
		[15, 9],
		[16, 10],
		[16, 11],
		[16, 12],
		[15, 13],
		[14, 14],
		[13, 15],
		[12, 15],
		[11, 15],
		[10, 15],
		[9, 14],
		[8, 13],
		[7, 12],
		[7, 11],
		[7, 10],
		[8, 9],
	];
	bodyPoints.forEach(([x, y]) => setPixel(canvas, x, y, 'orange'));
	for (let y = 9; y <= 13; y += 1) {
		for (let x = 9; x <= 14; x += 1) setPixel(canvas, x, y, 'yellow');
	}
	drawLine(canvas, 'green', 7, 11, 3, 7);
	drawLine(canvas, 'green', 7, 11, 3, 15);
	drawLine(canvas, 'green', 3, 7, 3, 15);
	drawLine(canvas, 'red', 11, 15, 9, 19);
	drawLine(canvas, 'red', 12, 15, 14, 19);
	setPixel(canvas, 14, 9, 'black');
}

function drawCatFace(canvas) {
	const center = canvas.length / 2;
	for (let y = center - 6; y <= center + 5; y += 1) {
		for (let x = center - 7; x <= center + 7; x += 1) {
			if (Math.abs(x - center) + Math.abs(y - center) < 10) setPixel(canvas, x, y, 'yellow');
		}
	}
	drawLine(canvas, 'orange', center - 7, center - 5, center - 10, center - 10);
	drawLine(canvas, 'orange', center - 10, center - 10, center - 4, center - 7);
	drawLine(canvas, 'orange', center + 7, center - 5, center + 10, center - 10);
	drawLine(canvas, 'orange', center + 10, center - 10, center + 4, center - 7);
	setPixel(canvas, center - 4, center - 1, 'green');
	setPixel(canvas, center + 4, center - 1, 'green');
	setPixel(canvas, center, center + 2, 'pink');
	drawLine(canvas, 'white', center - 6, center + 3, center - 11, center + 2);
	drawLine(canvas, 'white', center - 6, center + 5, center - 11, center + 6);
	drawLine(canvas, 'white', center + 6, center + 3, center + 11, center + 2);
	drawLine(canvas, 'white', center + 6, center + 5, center + 11, center + 6);
}

function drawBird(canvas) {
	const body = [
		[5, 5],
		[6, 4],
		[7, 4],
		[8, 4],
		[9, 5],
		[10, 6],
		[10, 7],
		[9, 8],
		[8, 9],
		[7, 9],
		[6, 8],
		[5, 7],
		[5, 6],
		[6, 5],
		[7, 5],
		[8, 5],
		[9, 6],
		[9, 7],
		[8, 8],
		[7, 8],
		[6, 7],
		[6, 6],
		[7, 6],
		[8, 6],
		[8, 7],
		[7, 7],
	];
	body.forEach(([x, y]) => setPixel(canvas, x, y, 'yellow'));
	drawLine(canvas, 'blue', 4, 7, 2, 9);
	drawLine(canvas, 'blue', 4, 8, 2, 10);
	drawLine(canvas, 'green', 10, 5, 14, 3);
	drawLine(canvas, 'green', 10, 6, 14, 4);
	drawLine(canvas, 'orange', 10, 7, 14, 7);
	drawLine(canvas, 'orange', 14, 7, 12, 5);
	setPixel(canvas, 8, 5, 'black');
	drawLine(canvas, 'red', 5, 10, 5, 13);
	drawLine(canvas, 'red', 8, 10, 8, 13);
	drawLine(canvas, 'cyan', 2, 14, 12, 14);
}

function drawCellMarker(canvas, row, col, color, shape) {
	const x = col * 8;
	const y = row * 8;
	const points = {
		plus: [
			[3, 3],
			[4, 3],
			[5, 3],
			[4, 2],
			[4, 4],
			[4, 5],
		],
		box: [
			[2, 2],
			[3, 2],
			[4, 2],
			[5, 2],
			[2, 3],
			[5, 3],
			[2, 4],
			[5, 4],
			[2, 5],
			[3, 5],
			[4, 5],
			[5, 5],
		],
		corner: [
			[2, 2],
			[2, 3],
			[2, 4],
			[2, 5],
			[3, 5],
			[4, 5],
			[5, 5],
		],
		zig: [
			[2, 2],
			[3, 2],
			[3, 3],
			[4, 3],
			[4, 4],
			[5, 4],
			[5, 5],
		],
		ladder: [
			[2, 2],
			[5, 2],
			[2, 3],
			[3, 3],
			[4, 3],
			[5, 3],
			[2, 4],
			[5, 4],
			[2, 5],
			[3, 5],
			[4, 5],
			[5, 5],
		],
		fork: [
			[3, 2],
			[3, 3],
			[3, 4],
			[3, 5],
			[4, 3],
			[5, 3],
			[4, 5],
			[5, 5],
		],
		slash: [
			[5, 2],
			[4, 3],
			[3, 4],
			[2, 5],
			[2, 2],
			[3, 2],
		],
		gate: [
			[2, 5],
			[2, 4],
			[2, 3],
			[3, 3],
			[4, 3],
			[5, 3],
			[5, 4],
			[5, 5],
		],
		steps: [
			[2, 2],
			[3, 2],
			[3, 3],
			[4, 3],
			[4, 4],
			[5, 4],
			[5, 5],
		],
	};
	points[shape].forEach(([pointX, pointY]) => setPixel(canvas, x + pointX, y + pointY, color));
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

function drawSun(canvas, centerX, centerY, color) {
	const body = [
		[0, -2],
		[-1, -1],
		[0, -1],
		[1, -1],
		[-2, 0],
		[-1, 0],
		[0, 0],
		[1, 0],
		[2, 0],
		[-1, 1],
		[0, 1],
		[1, 1],
		[0, 2],
	];
	body.forEach(([x, y]) => setPixel(canvas, centerX + x, centerY + y, color));
	[
		[0, -4],
		[0, 4],
		[-4, 0],
		[4, 0],
		[-3, -3],
		[3, -3],
		[-3, 3],
		[3, 3],
	].forEach(([x, y]) => setPixel(canvas, centerX + x, centerY + y, 'yellow'));
}

function drawCloud(canvas, centerX, centerY) {
	[
		[-3, 0],
		[-2, 0],
		[-1, -1],
		[-1, 0],
		[0, -1],
		[0, 0],
		[1, -1],
		[1, 0],
		[2, 0],
		[3, 0],
		[-2, 1],
		[-1, 1],
		[0, 1],
		[1, 1],
		[2, 1],
	].forEach(([x, y]) => setPixel(canvas, centerX + x, centerY + y, 'white'));
}

function drawMediumHouseScene(canvas, gridSize) {
	const size = gridSize * 8;
	const groundY = Math.floor(size * 0.68);
	drawSimpleOutside(canvas, gridSize, 0.68);
	drawSun(canvas, size - 5, 5, 'yellow');
	drawCloud(canvas, Math.max(4, Math.floor(size * 0.2)), 5);
	const cx = Math.floor(size / 2);
	const bodyW = gridSize === 2 ? 8 : 10;
	const bodyH = gridSize === 2 ? 6 : 8;
	const bodyLeft = cx - Math.floor(bodyW / 2);
	const bodyTop = groundY - bodyH;
	fillRect(canvas, 'yellow', bodyLeft, bodyTop, bodyLeft + bodyW, groundY - 1);
	fillTriangle(canvas, 'red', cx, bodyTop - 6, bodyLeft - 2, bodyTop, bodyLeft + bodyW + 2, bodyTop);
	fillRect(canvas, 'orange', cx - 1, groundY - 4, cx + 1, groundY - 1);
	fillRect(canvas, 'white', bodyLeft + 2, bodyTop + 2, bodyLeft + 3, bodyTop + 3);
	fillRect(canvas, 'white', bodyLeft + bodyW - 3, bodyTop + 2, bodyLeft + bodyW - 2, bodyTop + 3);
	const treeX = gridSize === 2 ? 3 : size - 5;
	drawLine(canvas, 'orange', treeX, groundY - 1, treeX, size - 3);
	fillCircle(canvas, 'green', treeX, groundY - 5, gridSize === 2 ? 3 : 4);
}

function drawMediumBoatScene(canvas, gridSize) {
	const size = gridSize * 8;
	const waterY = Math.floor(size * 0.58);
	fillRect(canvas, 'blue', 0, 0, size - 1, waterY - 1);
	fillRect(canvas, 'cyan', 0, waterY, size - 1, size - 1);
	drawSun(canvas, size - 5, 5, 'orange');
	drawCloud(canvas, Math.floor(size * 0.2), 4);
	drawLine(canvas, 'white', 0, waterY, size - 1, waterY);
	drawLine(canvas, 'blue', 0, size - 3, size - 1, size - 3);

	const mastX = Math.floor(size / 2);
	const mastTop = gridSize === 2 ? 3 : 4;
	const deckY = waterY + (gridSize === 2 ? 4 : 5);
	drawLine(canvas, 'white', mastX, mastTop, mastX, deckY);
	fillTriangle(canvas, 'yellow', mastX + 1, mastTop + 1, mastX + 1, deckY - 1, Math.min(size - 2, mastX + 8), deckY - 1);
	fillTriangle(canvas, 'white', mastX - 1, mastTop + 2, mastX - 1, deckY - 1, Math.max(1, mastX - 7), deckY - 1);
	drawLine(canvas, 'orange', Math.max(1, mastX - 6), deckY, Math.min(size - 2, mastX + 7), deckY);
	drawLine(canvas, 'orange', Math.max(2, mastX - 5), deckY + 1, Math.min(size - 3, mastX + 6), deckY + 1);
	drawLine(canvas, 'red', Math.max(3, mastX - 4), deckY + 2, Math.min(size - 4, mastX + 5), deckY + 2);
}

function drawMediumFlowerScene(canvas, gridSize) {
	const size = gridSize * 8;
	const grassY = Math.floor(size * 0.68);
	fillRect(canvas, 'blue', 0, 0, size - 1, grassY - 1);
	drawPlayField(canvas, grassY, size);
	drawSun(canvas, size - 5, 5, 'yellow');
	drawLine(canvas, 'cyan', 0, grassY - 1, size - 1, grassY - 1);

	const cx = Math.floor(size / 2);
	const cy = Math.floor(size * 0.42);
	drawLine(canvas, 'green', cx, cy + 3, cx, size - 2);
	drawLine(canvas, 'green', cx, grassY + 2, cx - 5, grassY - 2);
	drawLine(canvas, 'green', cx, grassY + 3, cx + 5, grassY - 1);
	drawLine(canvas, 'yellow', 1, size - 3, size - 2, size - 3);
	drawLine(canvas, 'orange', 2, size - 2, size - 3, size - 2);
	fillCircle(canvas, 'yellow', cx, cy, gridSize === 2 ? 2 : 3);
	[
		[0, -5, 'magenta'],
		[0, 5, 'magenta'],
		[-5, 0, 'orange'],
		[5, 0, 'orange'],
		[-4, -4, 'red'],
		[4, -4, 'red'],
		[-4, 4, 'pink'],
		[4, 4, 'pink'],
	].forEach(([dx, dy, color]) => fillCircle(canvas, color, cx + dx, cy + dy, 2));
	drawCloud(canvas, Math.max(4, Math.floor(size * 0.18)), 5);
}

function drawPlayField(canvas, horizonY, size) {
	fillRect(canvas, 'soil', 0, horizonY, size - 1, size - 1);
	drawLine(canvas, 'green', 0, horizonY, size - 1, horizonY);
	drawLine(canvas, 'green', 0, horizonY + 1, size - 1, horizonY + 1);
	for (let x = 0; x < size; x += 3) {
		drawLine(canvas, 'green', x, horizonY + 2, Math.min(size - 1, x + 1), horizonY + 4);
	}
	for (let x = 1; x < size; x += 5) {
		setPixel(canvas, x, size - 4, 'yellow');
	}
}

function fillFishTail(canvas, color, tipX, baseX, centerY, halfHeight) {
	for (let dy = -halfHeight; dy <= halfHeight; dy += 1) {
		const scale = 1 - Math.abs(dy) / Math.max(1, halfHeight + 1);
		const x = Math.round(baseX + (tipX - baseX) * scale);
		drawLine(canvas, color, x, centerY + dy, baseX, centerY);
	}
}

function fillEllipse(canvas, color, centerX, centerY, radiusX, radiusY) {
	for (let y = centerY - radiusY; y <= centerY + radiusY; y += 1) {
		for (let x = centerX - radiusX; x <= centerX + radiusX; x += 1) {
			const dx = (x - centerX) / Math.max(1, radiusX);
			const dy = (y - centerY) / Math.max(1, radiusY);
			if (dx * dx + dy * dy <= 1.05) setPixel(canvas, x, y, color);
		}
	}
}

function fillTriangle(canvas, color, x1, y1, x2, y2, x3, y3) {
	const minX = Math.floor(Math.min(x1, x2, x3));
	const maxX = Math.ceil(Math.max(x1, x2, x3));
	const minY = Math.floor(Math.min(y1, y2, y3));
	const maxY = Math.ceil(Math.max(y1, y2, y3));
	const area = edgeValue(x1, y1, x2, y2, x3, y3);
	if (area === 0) return;
	for (let y = minY; y <= maxY; y += 1) {
		for (let x = minX; x <= maxX; x += 1) {
			const w1 = edgeValue(x2, y2, x3, y3, x, y);
			const w2 = edgeValue(x3, y3, x1, y1, x, y);
			const w3 = edgeValue(x1, y1, x2, y2, x, y);
			const hasNegative = w1 < 0 || w2 < 0 || w3 < 0;
			const hasPositive = w1 > 0 || w2 > 0 || w3 > 0;
			if (!(hasNegative && hasPositive)) setPixel(canvas, x, y, color);
		}
	}
}

function edgeValue(x1, y1, x2, y2, px, py) {
	return (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
}

function fillCircle(canvas, color, centerX, centerY, radius) {
	for (let y = centerY - radius; y <= centerY + radius; y += 1) {
		for (let x = centerX - radius; x <= centerX + radius; x += 1) {
			const dx = x - centerX;
			const dy = y - centerY;
			if (dx * dx + dy * dy <= radius * radius + 1) setPixel(canvas, x, y, color);
		}
	}
}

function fillRect(canvas, color, x1, y1, x2, y2) {
	for (let y = y1; y <= y2; y += 1) {
		for (let x = x1; x <= x2; x += 1) {
			setPixel(canvas, x, y, color);
		}
	}
}

function rotatePixels(pixels, degrees) {
	const turns = (((degrees / 90) % 4) + 4) % 4;
	let result = pixels.map((row) => [...row]);
	for (let turn = 0; turn < turns; turn += 1) {
		result = result[0].map((_, col) => result.map((row) => row[col]).reverse());
	}
	return result;
}

function paintPiece(canvas, pixels, pieceRow, pieceCol) {
	pixels.forEach((row, y) => {
		row.forEach((color, x) => {
			setPixel(canvas, pieceCol * 8 + x, pieceRow * 8 + y, color);
		});
	});
}

function canvasesMatch(left, right) {
	if (left.length !== right.length) return false;
	return left.every((row, y) => row.length === right[y].length && row.every((color, x) => color === right[y][x]));
}

function setPixel(canvas, x, y, color) {
	if (!canvas[y] || canvas[y][x] === undefined) return;
	canvas[y][x] = color;
}
