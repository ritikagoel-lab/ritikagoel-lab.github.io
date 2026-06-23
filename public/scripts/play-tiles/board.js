import { DIRECTIONS, GRID_COLS, GRID_ROWS, TILE_LIMIT } from './config.js?v=3';

export class TileBoard {
	constructor(elements, hooks) {
		this.elements = elements;
		this.hooks = hooks;
		this.cells = new Map();
		this.placedTiles = new Map();
		this.packItems = [];
		this.nextTileId = 1;
		this.dragPayload = null;
		this.selectedPackKey = null;
		this.selectedBoardTileId = null;
	}

	reset(packItems) {
		this.nextTileId = 1;
		this.placedTiles.clear();
		this.clearSelection();
		this.buildGrid();
		this.setPack(packItems);
	}

	resetBoardTiles() {
		this.placedTiles.forEach((tile) => tile.element.remove());
		this.placedTiles.clear();
		this.nextTileId = 1;
		this.packItems.forEach((item) => {
			item.available = true;
		});
		this.clearSelection();
		this.renderPack();
		this.hooks.onChange();
	}

	setPack(packItems) {
		this.packItems = packItems.map((item) => ({
			...item,
			available: true,
			reusable: Boolean(item.reusable),
		}));
		this.renderPack();
	}

	buildGrid() {
		this.elements.grid.innerHTML = '';
		this.cells.clear();
		for (let row = 0; row < GRID_ROWS; row += 1) {
			for (let col = 0; col < GRID_COLS; col += 1) {
				const cell = document.createElement('div');
				cell.className = 'cell';
				cell.dataset.row = row;
				cell.dataset.col = col;
				cell.addEventListener('dragover', (event) => {
					if (this.hooks.isLocked()) return;
					event.preventDefault();
					cell.classList.add('drop-ready');
				});
				cell.addEventListener('dragleave', () => cell.classList.remove('drop-ready'));
				cell.addEventListener('drop', (event) => {
					event.preventDefault();
					cell.classList.remove('drop-ready');
					if (!this.hooks.isLocked()) this.handleCellDrop(row, col);
				});
				cell.addEventListener('click', () => this.handleCellClick(row, col));
				this.cells.set(this.cellKey(row, col), cell);
				this.elements.grid.appendChild(cell);
			}
		}
	}

	renderPack() {
		this.elements.tray.innerHTML = '';
		this.packItems
			.filter((item) => item.reusable || item.available)
			.forEach((item) => this.elements.tray.appendChild(this.makePackTile(item)));

		this.elements.tray.ondragover = (event) => {
			if (this.dragPayload?.source === 'board' && !this.hooks.isLocked()) {
				event.preventDefault();
				this.elements.tray.classList.add('drop-ready');
			}
		};
		this.elements.tray.ondragleave = () => this.elements.tray.classList.remove('drop-ready');
		this.elements.tray.ondrop = (event) => {
			event.preventDefault();
			this.elements.tray.classList.remove('drop-ready');
			if (this.dragPayload?.source === 'board' && !this.hooks.isLocked()) {
				this.returnTileToPack(this.dragPayload.id);
			}
		};
		this.elements.tray.onclick = () => {
			if (this.selectedBoardTileId && !this.hooks.isLocked()) {
				this.returnTileToPack(this.selectedBoardTileId);
				this.clearSelection();
			}
		};
	}

	makePackTile(item) {
		const tile = document.createElement('div');
		tile.className = 'tile pack-tile';
		tile.draggable = true;
		tile.dataset.packKey = item.key;
		tile.dataset.kind = item.kind;
		tile.innerHTML = `<span class="tile-face">${item.face}</span>`;
		tile.addEventListener('dragstart', () => {
			this.dragPayload = { source: 'pack', key: item.key };
		});
		tile.addEventListener('dragend', () => {
			this.dragPayload = null;
			this.clearDropTargets();
		});
		tile.addEventListener('click', (event) => {
			event.stopPropagation();
			this.selectedPackKey = this.selectedPackKey === item.key ? null : item.key;
			this.selectedBoardTileId = null;
			this.updateSelectionUi();
		});
		return tile;
	}

	makeBoardTile(source) {
		const id = `tile-${this.nextTileId}`;
		this.nextTileId += 1;
		const tile = document.createElement('div');
		tile.className = 'tile board-tile';
		tile.draggable = true;
		tile.dataset.tileId = id;
		tile.dataset.kind = source.kind;
		tile.innerHTML = `<span class="tile-face"></span>`;

		const model = {
			id,
			sourceKey: source.key ?? null,
			sourceReusable: Boolean(source.reusable),
			label: source.label,
			kind: source.kind,
			row: null,
			col: null,
			element: tile,
			gameData: {},
		};

		tile.addEventListener('dragstart', (event) => {
			if (this.hooks.isLocked()) {
				event.preventDefault();
				return;
			}
			this.dragPayload = { source: 'board', id };
		});
		tile.addEventListener('dragend', () => {
			this.dragPayload = null;
			this.clearDropTargets();
		});
		tile.addEventListener('click', (event) => {
			event.stopPropagation();
			this.handleBoardTileClick(id);
		});

		this.placedTiles.set(id, model);
		this.setTileDisplay(model, source.label, 'blank');
		return model;
	}

	handleCellDrop(row, col) {
		if (!this.dragPayload) return;
		if (this.dragPayload.source === 'pack') {
			this.addTileFromPack(this.dragPayload.key, row, col);
		}
		if (this.dragPayload.source === 'board') {
			this.moveTileToCell(this.dragPayload.id, row, col);
		}
	}

	handleCellClick(row, col) {
		if (this.hooks.isLocked()) return;
		if (this.selectedPackKey) {
			this.addTileFromPack(this.selectedPackKey, row, col);
			this.clearSelection();
		} else if (this.selectedBoardTileId) {
			this.moveTileToCell(this.selectedBoardTileId, row, col);
			this.clearSelection();
		}
	}

	handleBoardTileClick(id) {
		const tile = this.placedTiles.get(id);
		if (!tile) return;
		if (this.hooks.onTileClick(tile)) return;

		this.selectedBoardTileId = this.selectedBoardTileId === id ? null : id;
		this.selectedPackKey = null;
		this.updateSelectionUi();
	}

	addTileFromPack(key, row, col) {
		if (this.placedTileList().length >= TILE_LIMIT) {
			this.hooks.onMessage('The board already has 16 tiles.');
			return null;
		}
		const source = this.packItems.find((item) => item.key === key && (item.reusable || item.available));
		if (!source) return null;

		const tile = this.makeBoardTile(source);
		if (!source.reusable) {
			source.available = false;
			this.renderPack();
		}
		this.moveTileToCell(tile.id, row, col);
		return tile;
	}

	placeCustomTile(source, row, col) {
		if (this.placedTileList().length >= TILE_LIMIT) {
			this.hooks.onMessage('The board already has 16 tiles.');
			return null;
		}
		const tile = this.makeBoardTile({ ...source, reusable: true });
		this.moveTileToCell(tile.id, row, col);
		return tile;
	}

	moveTileToCell(id, row, col) {
		const tile = this.placedTiles.get(id);
		if (!tile) return;
		const existing = this.placedTileList().find((candidate) => candidate.row === row && candidate.col === col);
		if (existing && existing.id !== id) this.returnTileToPack(existing.id);
		tile.row = row;
		tile.col = col;
		this.cells.get(this.cellKey(row, col)).appendChild(tile.element);
		this.hooks.onChange();
	}

	returnTileToPack(id) {
		const tile = this.placedTiles.get(id);
		if (!tile) return;
		if (!tile.sourceReusable && tile.sourceKey) {
			const source = this.packItems.find((item) => item.key === tile.sourceKey);
			if (source) source.available = true;
		}
		tile.element.remove();
		this.placedTiles.delete(id);
		this.renderPack();
		this.hooks.onChange();
	}

	setTileDisplay(tile, label, state = 'blank') {
		tile.element.classList.remove('mole', 'revealed', 'matched', 'wrong', 'question-tile', 'long-label', 'extra-long-label', 'pixel-display', 'set-tile', 'set-selected');
		tile.element.dataset.state = state;
		if (state) tile.element.classList.add(state);
		const face = tile.element.querySelector('.tile-face');
		face.replaceChildren();

		if (Array.isArray(label)) {
			tile.element.classList.add('pixel-display');
			face.appendChild(this.makePixelMatrix(label));
			return;
		}

		if (label && typeof label === 'object' && label.type === 'set') {
			tile.element.classList.add('set-tile');
			face.appendChild(this.makeSetFace(label));
			return;
		}

		tile.element.classList.toggle('long-label', String(label).length > 1);
		tile.element.classList.toggle('extra-long-label', String(label).length > 3);
		face.textContent = label;
	}

	makeSetFace(setCard) {
		const wrapper = document.createElement('span');
		wrapper.className = 'set-face';
		wrapper.dataset.color = setCard.color;
		wrapper.dataset.shape = setCard.shape;
		for (let index = 0; index < setCard.count; index += 1) {
			const mark = document.createElement('span');
			mark.className = 'set-mark';
			mark.textContent = setCard.shape === 'circle' ? '●' : setCard.shape === 'triangle' ? '▲' : '◆';
			wrapper.appendChild(mark);
		}
		return wrapper;
	}

	makePixelMatrix(pixelRows) {
		const matrix = document.createElement('span');
		matrix.className = 'pixel-matrix';
		pixelRows.flat().forEach((color) => {
			const pixel = document.createElement('span');
			pixel.className = 'pixel';
			pixel.dataset.color = color;
			matrix.appendChild(pixel);
		});
		return matrix;
	}

	placedTileList() {
		return Array.from(this.placedTiles.values()).filter((tile) => tile.row !== null);
	}

	availablePackItems(kind = null) {
		return this.packItems.filter((item) => (item.reusable || item.available) && (!kind || item.kind === kind));
	}

	cellKey(row, col) {
		return `${row},${col}`;
	}

	clearDropTargets() {
		document.querySelectorAll('.drop-ready').forEach((cell) => cell.classList.remove('drop-ready'));
	}

	clearSelection() {
		this.selectedPackKey = null;
		this.selectedBoardTileId = null;
		this.updateSelectionUi();
	}

	updateSelectionUi() {
		document.querySelectorAll('.tile').forEach((tile) => {
			tile.classList.toggle('selected', tile.dataset.packKey === this.selectedPackKey || tile.dataset.tileId === this.selectedBoardTileId);
		});
	}

	adjacencyGraph() {
		const positioned = this.placedTileList();
		const edges = [];
		for (const tile of positioned) {
			for (const other of positioned) {
				if (tile.id === other.id) continue;
				const direction = DIRECTIONS.find((candidate) => other.row - tile.row === candidate.deltaRow && other.col - tile.col === candidate.deltaCol);
				if (direction) edges.push({ tile, other, fromSide: direction.from, toSide: direction.to });
			}
		}
		return edges;
	}
}
