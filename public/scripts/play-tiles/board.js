import { DIRECTIONS, GRID_COLS, GRID_ROWS, TILE_LIMIT } from './config.js?v=6';

export class TileBoard {
	constructor(elements, hooks) {
		this.elements = elements;
		this.hooks = hooks;
		this.cells = new Map();
		this.placedTiles = new Map();
		this.packItems = [];
		this.nextTileId = 1;
		this.dragPayload = null;
		this.dragHandled = false;
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
				cell.tabIndex = -1;
				cell.addEventListener('dragover', (event) => {
					if (this.hooks.isLocked()) return;
					if (this.dragPayload && !this.canPlaceDragPayload(row, col)) return;
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
				cell.addEventListener('keydown', (event) => {
					if (!this.hooks.isLocked()) this.hooks.onCellKey?.(row, col, event);
				});
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
				this.dragHandled = true;
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
		tile.innerHTML = '<span class="tile-face"></span>';
		this.renderTileFace(tile, item.face);
		tile.addEventListener('dragstart', () => {
			this.dragPayload = { source: 'pack', key: item.key };
			this.dragHandled = false;
		});
		tile.addEventListener('dragend', () => {
			this.dragPayload = null;
			this.dragHandled = false;
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
			gameData: source.puzzle
				? {
						puzzle: source.puzzle,
						rotation: source.puzzle.rotation,
					}
				: {},
		};

		tile.addEventListener('dragstart', (event) => {
			if (this.hooks.isLocked()) {
				event.preventDefault();
				return;
			}
			this.dragPayload = { source: 'board', id };
			this.dragHandled = false;
		});
		tile.addEventListener('dragend', () => {
			if (this.dragPayload?.source === 'board' && !this.dragHandled) {
				const draggedTile = this.placedTiles.get(this.dragPayload.id);
				if (draggedTile && this.hooks.shouldDiscardOnDragEnd?.(draggedTile)) {
					this.returnTileToPack(draggedTile.id);
				}
			}
			this.dragPayload = null;
			this.dragHandled = false;
			this.clearDropTargets();
		});
		tile.addEventListener('click', (event) => {
			event.stopPropagation();
			this.handleBoardTileClick(id);
		});

		this.placedTiles.set(id, model);
		this.setTileDisplay(model, source.face ?? source.label, source.kind === 'puzzle' ? 'puzzle-tile' : 'blank');
		return model;
	}

	handleCellDrop(row, col) {
		if (!this.dragPayload) return;
		if (this.dragPayload.source === 'pack') {
			if (this.addTileFromPack(this.dragPayload.key, row, col)) this.dragHandled = true;
		}
		if (this.dragPayload.source === 'board') {
			if (this.moveTileToCell(this.dragPayload.id, row, col)) {
				this.dragHandled = true;
				return;
			}
			const tile = this.placedTiles.get(this.dragPayload.id);
			if (tile && this.hooks.shouldDiscardOnDragEnd?.(tile)) {
				this.dragHandled = true;
				this.returnTileToPack(tile.id);
			}
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
		} else if (this.hooks.onCellClick?.(row, col)) {
			this.cells.get(this.cellKey(row, col))?.focus();
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
		if (!this.hooks.canPlace(source, row, col)) {
			this.hooks.onMessage('Use one of the highlighted answer slots.');
			return null;
		}

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
		if (!tile) return false;
		if (!this.hooks.canPlace(tile, row, col)) {
			this.hooks.onMessage('Use one of the highlighted answer slots.');
			return false;
		}
		const existing = this.placedTileList().find((candidate) => candidate.row === row && candidate.col === col);
		if (existing && existing.id !== id) this.returnTileToPack(existing.id);
		tile.row = row;
		tile.col = col;
		this.cells.get(this.cellKey(row, col)).appendChild(tile.element);
		this.hooks.onChange();
		return true;
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
		tile.element.classList.remove(
			'mole',
			'revealed',
			'matched',
			'wrong',
			'question-tile',
			'question-checked',
			'question-correct',
			'question-wrong',
			'long-label',
			'extra-long-label',
			'pixel-display',
			'lcd-display',
			'lcd-puzzle-display',
			'set-tile',
			'set-selected',
			'puzzle-tile',
			'puzzle-anchor',
			'puzzle-solved',
		);
		tile.element.dataset.state = state;
		if (state) tile.element.classList.add(state);
		this.renderTileFace(tile.element, label);
	}

	renderTileFace(tileElement, label) {
		const face = tileElement.querySelector('.tile-face');
		face.replaceChildren();

		if (Array.isArray(label)) {
			tileElement.classList.add('pixel-display');
			face.appendChild(this.makePixelMatrix(label));
			return;
		}

		if (label && typeof label === 'object' && label.type === 'set') {
			tileElement.classList.add('set-tile');
			face.appendChild(this.makeSetFace(label));
			return;
		}

		if (label && typeof label === 'object' && label.type === 'lcd') {
			tileElement.classList.add('lcd-display');
			face.appendChild(this.makeLcdFace(label));
			return;
		}

		if (label && typeof label === 'object' && label.type === 'puzzle') {
			tileElement.classList.add('puzzle-tile');
			tileElement.style.setProperty('--puzzle-rotation', `${label.rotation}deg`);
			face.appendChild(this.makePuzzleFace(label));
			return;
		}

		tileElement.classList.toggle('long-label', String(label).length > 1);
		tileElement.classList.toggle('extra-long-label', String(label).length > 3);
		face.textContent = label;
	}

	makePuzzleFace(piece) {
		const wrapper = document.createElement('span');
		wrapper.className = 'puzzle-face';
		if (piece.render === 'lcd-puzzle') {
			wrapper.classList.add('lcd-puzzle-face');
			wrapper.appendChild(this.makeLcdPuzzleFragment(piece));
			return wrapper;
		}
		wrapper.appendChild(this.makePixelMatrix(piece.pixels));
		return wrapper;
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

	makeLcdFace(lcdFace) {
		const wrapper = document.createElement('span');
		wrapper.className = `lcd-face lcd-${lcdFace.scene || 'word'}`;
		if (lcdFace.tone) wrapper.dataset.tone = lcdFace.tone;
		if (lcdFace.word) {
			const word = document.createElement('span');
			word.className = 'lcd-word';
			word.textContent = lcdFace.word;
			wrapper.appendChild(word);
		} else {
			wrapper.appendChild(this.svgFromMarkup(this.lcdSceneSvg(lcdFace.scene)));
		}
		return wrapper;
	}

	makeLcdPuzzleFragment(piece) {
		const gridSize = Number(piece.gridSize || 3);
		const row = Number(piece.row || 0);
		const col = Number(piece.col || 0);
		const tileSize = 64;
		const viewSize = gridSize * tileSize;
		const svg = this.svgFromMarkup(this.lcdPuzzleSvg(piece.seed || 0, gridSize));
		svg.setAttribute('viewBox', `${col * tileSize} ${row * tileSize} ${tileSize} ${tileSize}`);
		svg.classList.add('lcd-puzzle-svg');
		return svg;
	}

	svgFromMarkup(markup) {
		const template = document.createElement('template');
		template.innerHTML = markup.trim();
		return template.content.firstElementChild;
	}

	lcdSceneSvg(scene = 'star') {
		const scenes = {
			cat: `
				<svg class="lcd-svg" viewBox="0 0 64 64" aria-hidden="true">
					<rect width="64" height="64" rx="10" fill="#bdeeff"/>
					<circle cx="32" cy="34" r="19" fill="#f59e0b"/>
					<path d="M17 24 19 9 30 21ZM47 24 45 9 34 21Z" fill="#d97706"/>
					<circle cx="25" cy="32" r="3" fill="#111827"/><circle cx="39" cy="32" r="3" fill="#111827"/>
					<path d="M31 38h2l-1 2Z" fill="#111827"/>
					<path d="M24 43c4 4 12 4 16 0" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round"/>
				</svg>`,
			fish: `
				<svg class="lcd-svg" viewBox="0 0 64 64" aria-hidden="true">
					<rect width="64" height="64" rx="10" fill="#bfdbfe"/>
					<path d="M7 18h50M3 31h58M8 45h49" stroke="#60a5fa" stroke-width="4" stroke-linecap="round"/>
					<path d="M14 33 4 22v22Z" fill="#22c55e"/>
					<ellipse cx="35" cy="33" rx="22" ry="14" fill="#f97316"/>
					<ellipse cx="39" cy="33" rx="14" ry="9" fill="#facc15"/>
					<circle cx="48" cy="29" r="3" fill="#111827"/>
				</svg>`,
			tree: `
				<svg class="lcd-svg" viewBox="0 0 64 64" aria-hidden="true">
					<rect width="64" height="64" rx="10" fill="#dcfce7"/>
					<rect x="27" y="34" width="10" height="21" rx="2" fill="#92400e"/>
					<circle cx="25" cy="28" r="14" fill="#22c55e"/><circle cx="39" cy="28" r="14" fill="#16a34a"/>
					<circle cx="32" cy="17" r="13" fill="#4ade80"/>
					<path d="M12 55h40" stroke="#166534" stroke-width="5" stroke-linecap="round"/>
				</svg>`,
			car: `
				<svg class="lcd-svg" viewBox="0 0 64 64" aria-hidden="true">
					<rect width="64" height="64" rx="10" fill="#dbeafe"/>
					<path d="M13 36h38l-5-13H23Z" fill="#ef4444"/>
					<rect x="8" y="34" width="48" height="15" rx="5" fill="#dc2626"/>
					<path d="M25 26h18l3 8H21Z" fill="#bfdbfe"/>
					<circle cx="20" cy="50" r="6" fill="#111827"/><circle cx="44" cy="50" r="6" fill="#111827"/>
					<circle cx="20" cy="50" r="2" fill="#e5e7eb"/><circle cx="44" cy="50" r="2" fill="#e5e7eb"/>
				</svg>`,
			star: `
				<svg class="lcd-svg" viewBox="0 0 64 64" aria-hidden="true">
					<rect width="64" height="64" rx="10" fill="#312e81"/>
					<path d="m32 7 7 17 18 1-14 12 4 18-15-10-15 10 4-18L7 25l18-1Z" fill="#fde047"/>
					<path d="m32 14 4 12 13 1-10 8 3 12-10-7-10 7 3-12-10-8 13-1Z" fill="#facc15"/>
				</svg>`,
			house: `
				<svg class="lcd-svg" viewBox="0 0 64 64" aria-hidden="true">
					<rect width="64" height="64" rx="10" fill="#bfdbfe"/>
					<path d="M9 33 32 13l23 20" fill="#ef4444"/>
					<rect x="15" y="31" width="34" height="24" rx="3" fill="#fde68a"/>
					<rect x="28" y="41" width="8" height="14" rx="1" fill="#92400e"/>
					<rect x="20" y="36" width="7" height="7" fill="#60a5fa"/><rect x="38" y="36" width="7" height="7" fill="#60a5fa"/>
				</svg>`,
			flower: `
				<svg class="lcd-svg" viewBox="0 0 64 64" aria-hidden="true">
					<rect width="64" height="64" rx="10" fill="#dcfce7"/>
					<path d="M32 34v22" stroke="#15803d" stroke-width="5" stroke-linecap="round"/>
					<ellipse cx="25" cy="50" rx="11" ry="5" fill="#22c55e" transform="rotate(-25 25 50)"/>
					<ellipse cx="32" cy="22" rx="8" ry="15" fill="#f472b6"/><ellipse cx="32" cy="22" rx="8" ry="15" fill="#f472b6" transform="rotate(72 32 22)"/>
					<ellipse cx="32" cy="22" rx="8" ry="15" fill="#f472b6" transform="rotate(144 32 22)"/>
					<circle cx="32" cy="22" r="7" fill="#facc15"/>
				</svg>`,
			balloon: `
				<svg class="lcd-svg" viewBox="0 0 64 64" aria-hidden="true">
					<rect width="64" height="64" rx="10" fill="#bfdbfe"/>
					<path d="M13 15h13M39 17h12M8 30h15M43 32h13" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
					<ellipse cx="32" cy="24" rx="16" ry="20" fill="#f97316"/>
					<path d="M32 5c7 8 8 28 0 38C24 33 25 13 32 5Z" fill="#facc15"/>
					<path d="M17 23c3-9 9-15 15-18 6 3 12 9 15 18" fill="#ef4444"/>
					<path d="M24 43 21 52M40 43l3 9" stroke="#fff" stroke-width="2"/>
					<rect x="23" y="51" width="18" height="9" rx="2" fill="#92400e"/>
				</svg>`,
			mole: `
				<svg class="lcd-svg" viewBox="0 0 64 64" aria-hidden="true">
					<rect width="64" height="64" rx="10" fill="#fde047"/>
					<path d="M0 43h64v21H0Z" fill="#5a341d"/>
					<ellipse cx="32" cy="45" rx="26" ry="8" fill="#2f1b12"/>
					<ellipse cx="32" cy="34" rx="19" ry="17" fill="#2b211d"/>
					<ellipse cx="32" cy="39" rx="13" ry="10" fill="#171412"/>
					<path d="M21 24c-5 1-8 5-9 10 5-2 9-1 12 2Z" fill="#201713"/>
					<path d="M43 24c5 1 8 5 9 10-5-2-9-1-12 2Z" fill="#201713"/>
					<circle cx="25" cy="31" r="2" fill="#05070c"/><circle cx="39" cy="31" r="2" fill="#05070c"/>
					<ellipse cx="32" cy="37" rx="6" ry="4" fill="#111827"/>
					<path d="M24 43c-4 1-7 3-10 5M40 43c4 1 7 3 10 5" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round"/>
					<path d="M19 50l-4 4M25 51l-2 5M45 50l4 4M39 51l2 5" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round"/>
				</svg>`,
		};
		return scenes[scene] || scenes.star;
	}

	lcdPuzzleSvg(seed = 0, gridSize = 3) {
		const viewSize = gridSize * 64;
		const scenes = [
			() => this.hotAirBalloonPuzzleSvg(viewSize),
			() => this.rocketPuzzleSvg(viewSize),
			() => this.housePuzzleSvg(viewSize),
			() => this.boatPuzzleSvg(viewSize),
			() => this.fishPuzzleSvg(viewSize),
			() => this.duckPuzzleSvg(viewSize),
			() => this.butterflyPuzzleSvg(viewSize),
			() => this.flowerPuzzleSvg(viewSize),
		];
		return scenes[seed % scenes.length]();
	}

	puzzleSvgShell(viewSize, body) {
		return `<svg class="lcd-svg" viewBox="0 0 ${viewSize} ${viewSize}" aria-hidden="true">${body}${this.puzzleTileToneLayer(viewSize)}</svg>`;
	}

	puzzleTileToneLayer(viewSize) {
		const tileSize = 64;
		const gridSize = Math.round(viewSize / tileSize);
		const tones = [
			['#ffffff', 0.04],
			['#bae6fd', 0.08],
			['#fef3c7', 0.07],
			['#bbf7d0', 0.07],
			['#fecdd3', 0.06],
			['#dbeafe', 0.08],
			['#ffffff', 0.02],
			['#fed7aa', 0.06],
			['#cffafe', 0.07],
		];
		const panels = [];
		for (let index = 0; index < gridSize * gridSize; index += 1) {
			const row = Math.floor(index / gridSize);
			const col = index % gridSize;
			const x = col * tileSize;
			const y = row * tileSize;
			const [color, opacity] = tones[index % tones.length];
			panels.push(`<rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}" fill="${color}" opacity="${opacity}"/>`);
		}
		return `<g style="mix-blend-mode:soft-light">${panels.join('')}</g>`;
	}

	hotAirBalloonPuzzleSvg(viewSize) {
		const scale = viewSize / 24;
		return this.puzzleSvgShell(viewSize, `
			<rect width="${viewSize}" height="${viewSize}" fill="#60a5fa"/>
			<path d="M0 0h${viewSize}v${9 * scale}H0Z" fill="#3b82f6" opacity=".18"/>
			<path d="M0 ${12 * scale}h${viewSize}v${12 * scale}H0Z" fill="#f0abfc"/>
			<path d="M0 ${15 * scale}h${viewSize}v${9 * scale}H0Z" fill="#f9a8d4"/>
			<path d="M0 ${18 * scale}h${viewSize}v${6 * scale}H0Z" fill="#67e8f9"/>
			<path d="M0 ${20.2 * scale}c${4 * scale}-${1.2 * scale} ${7 * scale}-${0.7 * scale} ${11 * scale} ${0.3 * scale}c${4.2 * scale} ${1.1 * scale} ${7.2 * scale} ${0.5 * scale} ${13 * scale}-${1.3 * scale}v${5 * scale}H0Z" fill="#22c5c9" opacity=".72"/>
			<path d="M${1.2 * scale} ${23.2 * scale}c${3.2 * scale}-${1.5 * scale} ${6.3 * scale}-${1.7 * scale} ${10 * scale}-${0.5 * scale}" fill="none" stroke="#c084fc" stroke-width="${0.8 * scale}" stroke-linecap="round" opacity=".86"/>
			<path d="M${16.3 * scale} ${20.9 * scale}c${2.2 * scale}-${0.8 * scale} ${4.2 * scale}-${0.8 * scale} ${6.1 * scale} .1" fill="none" stroke="#0891b2" stroke-width="${0.75 * scale}" stroke-linecap="round" opacity=".65"/>
			<g fill="#fde047" opacity=".9">
				<circle cx="${3.4 * scale}" cy="${21.1 * scale}" r="${0.28 * scale}"/>
				<circle cx="${6.2 * scale}" cy="${22.5 * scale}" r="${0.24 * scale}"/>
				<circle cx="${19.4 * scale}" cy="${21.5 * scale}" r="${0.26 * scale}"/>
			</g>
			<g fill="#fff" opacity=".95">
				<ellipse cx="${4 * scale}" cy="${4 * scale}" rx="${3.3 * scale}" ry="${1.4 * scale}"/>
				<ellipse cx="${19 * scale}" cy="${5 * scale}" rx="${3.5 * scale}" ry="${1.5 * scale}"/>
				<ellipse cx="${4 * scale}" cy="${12 * scale}" rx="${3.1 * scale}" ry="${1.3 * scale}"/>
				<ellipse cx="${21 * scale}" cy="${11.5 * scale}" rx="${2.4 * scale}" ry="${1 * scale}"/>
			</g>
			<ellipse cx="${11 * scale}" cy="${6.3 * scale}" rx="${5.7 * scale}" ry="${6.3 * scale}" fill="#f97316"/>
			<path d="M${11 * scale} ${0.5 * scale}c${2.9 * scale} ${3 * scale} ${3.1 * scale} ${8.6 * scale} 0 ${11.4 * scale}c${-3.1 * scale}-${2.8 * scale}-${2.9 * scale}-${8.4 * scale} 0-${11.4 * scale}Z" fill="#facc15"/>
			<path d="M${5.6 * scale} ${5.6 * scale}c${1.1 * scale}-${3.1 * scale} ${3.1 * scale}-${4.7 * scale} ${5.4 * scale}-${4.9 * scale}c${2.7 * scale} ${0.2 * scale} ${4.6 * scale} ${1.8 * scale} ${5.2 * scale} ${4.7 * scale}" fill="#ef4444"/>
			<path d="M${8 * scale} ${12.2 * scale} ${8.5 * scale} ${16 * scale}M${14 * scale} ${11.8 * scale} ${14.8 * scale} ${16 * scale}" stroke="#fff" stroke-width="${0.55 * scale}"/>
			<rect x="${8.3 * scale}" y="${16 * scale}" width="${6 * scale}" height="${4.5 * scale}" rx="${0.7 * scale}" fill="#92400e"/>
		`);
	}

	rocketPuzzleSvg(viewSize) {
		const scale = viewSize / 24;
		return this.puzzleSvgShell(viewSize, `
			<rect width="${viewSize}" height="${viewSize}" fill="#1e3a8a"/>
			<path d="M0 ${18 * scale}c${7 * scale}-${2 * scale} ${13 * scale}-${1 * scale} ${24 * scale}-${4 * scale}v${10 * scale}H0Z" fill="#172554" opacity=".7"/>
			<circle cx="${4 * scale}" cy="${4 * scale}" r="${0.8 * scale}" fill="#fde047"/><circle cx="${18 * scale}" cy="${5 * scale}" r="${0.7 * scale}" fill="#f8fafc"/>
			<circle cx="${21 * scale}" cy="${14 * scale}" r="${0.6 * scale}" fill="#fde047"/><circle cx="${6 * scale}" cy="${19 * scale}" r="${0.6 * scale}" fill="#f8fafc"/>
			<path d="M${10.5 * scale} ${2 * scale}c${4.2 * scale} ${4.4 * scale} ${4.1 * scale} ${12.5 * scale}-${0.6 * scale} ${16.4 * scale}c${-3.6 * scale}-${4.5 * scale}-${3.2 * scale}-${12.4 * scale} ${0.6 * scale}-${16.4 * scale}Z" fill="#f8fafc"/>
			<path d="M${10.5 * scale} ${2 * scale}c${2.1 * scale} ${2 * scale} ${3.1 * scale} ${4 * scale} ${3.4 * scale} ${6 * scale}h-${6.6 * scale}c${0.6 * scale}-${2 * scale} ${1.6 * scale}-${4 * scale} ${3.2 * scale}-${6 * scale}Z" fill="#ef4444"/>
			<circle cx="${10.7 * scale}" cy="${11 * scale}" r="${2 * scale}" fill="#38bdf8"/>
			<path d="M${7 * scale} ${17 * scale} ${4 * scale} ${21 * scale}h${5 * scale}Z M${14 * scale} ${16.8 * scale} ${18.5 * scale} ${20.2 * scale}h-${5.2 * scale}Z" fill="#ef4444"/>
			<path d="M${8.7 * scale} ${20 * scale}h${4 * scale}l-${2.5 * scale} ${4 * scale}Z" fill="#facc15"/>
		`);
	}

	housePuzzleSvg(viewSize) {
		const scale = viewSize / 24;
		return this.puzzleSvgShell(viewSize, `
			<rect width="${viewSize}" height="${viewSize}" fill="#93c5fd"/>
			<path d="M0 0h${viewSize}v${7.8 * scale}H0Z" fill="#bfdbfe" opacity=".7"/>
			<path d="M0 ${8.5 * scale}c${5 * scale}-${1.4 * scale} ${9 * scale}-${1.1 * scale} ${13 * scale}.2c${3.5 * scale} 1 ${6.3 * scale}.7 ${11 * scale}-${1.1 * scale}v${4 * scale}H0Z" fill="#60a5fa" opacity=".34"/>
			<path d="M${1.5 * scale} ${4.2 * scale}c${2 * scale}-.8 ${3.5 * scale}-.8 ${5.7 * scale}.1M${12.5 * scale} ${2.8 * scale}c${2.2 * scale}-.7 ${4.1 * scale}-.5 ${6.4 * scale}.4" fill="none" stroke="#e0f2fe" stroke-width="${0.9 * scale}" stroke-linecap="round" opacity=".86"/>
			<circle cx="${19 * scale}" cy="${5 * scale}" r="${2.5 * scale}" fill="#fde047"/>
			<path d="M0 ${18 * scale}c${6 * scale}-${3 * scale} ${12 * scale}-${2 * scale} ${24 * scale}-${5 * scale}v${11 * scale}H0Z" fill="#22c55e"/>
			<path d="M${4 * scale} ${13 * scale} ${12 * scale} ${6 * scale} ${20 * scale} ${13 * scale}Z" fill="#ef4444"/>
			<rect x="${6 * scale}" y="${13 * scale}" width="${12 * scale}" height="${8 * scale}" rx="${1 * scale}" fill="#fde68a"/>
			<rect x="${10.5 * scale}" y="${16 * scale}" width="${3 * scale}" height="${5 * scale}" fill="#92400e"/>
			<rect x="${7.5 * scale}" y="${14.5 * scale}" width="${2.5 * scale}" height="${2.5 * scale}" fill="#60a5fa"/>
			<rect x="${14 * scale}" y="${14.5 * scale}" width="${2.5 * scale}" height="${2.5 * scale}" fill="#60a5fa"/>
		`);
	}

	boatPuzzleSvg(viewSize) {
		const scale = viewSize / 24;
		return this.puzzleSvgShell(viewSize, `
			<rect width="${viewSize}" height="${viewSize}" fill="#7dbfff"/>
			<path d="M0 ${7 * scale}h${viewSize}v${9 * scale}H0Z" fill="#60a5fa" opacity=".82"/>
			<path d="M0 ${13 * scale}c${4 * scale}-${1.1 * scale} ${7 * scale}-${0.7 * scale} ${10 * scale} 0c${4 * scale} ${1.1 * scale} ${8 * scale} ${0.8 * scale} ${14 * scale}-${1.1 * scale}v${4.1 * scale}H0Z" fill="#93c5fd" opacity=".52"/>
			<g fill="#f8fafc" opacity=".96">
				<ellipse cx="${3.1 * scale}" cy="${3.2 * scale}" rx="${2.4 * scale}" ry="${0.9 * scale}"/>
				<ellipse cx="${3.8 * scale}" cy="${2.7 * scale}" rx="${1.3 * scale}" ry="${0.8 * scale}"/>
				<ellipse cx="${2 * scale}" cy="${3.5 * scale}" rx="${1.2 * scale}" ry="${0.7 * scale}"/>
				<ellipse cx="${4.2 * scale}" cy="${10.9 * scale}" rx="${2.1 * scale}" ry="${0.85 * scale}"/>
				<ellipse cx="${3.3 * scale}" cy="${10.5 * scale}" rx="${1.1 * scale}" ry="${0.65 * scale}"/>
				<ellipse cx="${21 * scale}" cy="${3.8 * scale}" rx="${2.2 * scale}" ry="${0.85 * scale}"/>
				<ellipse cx="${20.2 * scale}" cy="${3.4 * scale}" rx="${1.1 * scale}" ry="${0.65 * scale}"/>
			</g>
			<path d="M0 ${16 * scale}h${viewSize}v${8 * scale}H0Z" fill="#2563eb"/>
			<path d="M${5 * scale} ${15 * scale}h${14 * scale}l-${3 * scale} ${5 * scale}H${8 * scale}Z" fill="#92400e"/>
			<path d="M${12 * scale} ${4 * scale}v${11 * scale}" stroke="#78350f" stroke-width="${0.7 * scale}"/>
			<path d="M${12 * scale} ${5 * scale} ${12 * scale} ${14 * scale} ${5 * scale} ${14 * scale}Z" fill="#f8fafc"/>
			<path d="M${13 * scale} ${6 * scale} ${13 * scale} ${14 * scale} ${20 * scale} ${14 * scale}Z" fill="#facc15"/>
			<path d="M0 ${19 * scale}c${3 * scale} ${1.5 * scale} ${5 * scale} ${1.5 * scale} ${8 * scale} 0c${3 * scale}-${1.5 * scale} ${5 * scale}-${1.5 * scale} ${8 * scale} 0c${3 * scale} ${1.5 * scale} ${5 * scale} ${1.5 * scale} ${8 * scale} 0" fill="none" stroke="#bfdbfe" stroke-width="${0.8 * scale}"/>
		`);
	}

	fishPuzzleSvg(viewSize) {
		const scale = viewSize / 24;
		return this.puzzleSvgShell(viewSize, `
			<rect width="${viewSize}" height="${viewSize}" fill="#38bdf8"/>
			<path d="M0 ${5 * scale}h${viewSize}v${19 * scale}H0Z" fill="#2563eb" opacity=".52"/>
			<path d="M0 ${18 * scale}c${5 * scale}-${2 * scale} ${9 * scale}-${1 * scale} ${14 * scale} .6c${3 * scale} 1 ${6 * scale} .7 ${10 * scale}-${1.2 * scale}v${6.6 * scale}H0Z" fill="#0f766e" opacity=".45"/>
			<path d="M${5 * scale} ${12 * scale} ${1.5 * scale} ${7 * scale}v${10 * scale}Z" fill="#22c55e"/>
			<ellipse cx="${13.5 * scale}" cy="${12 * scale}" rx="${7.5 * scale}" ry="${4.8 * scale}" fill="#f97316"/>
			<ellipse cx="${15.2 * scale}" cy="${12.2 * scale}" rx="${4.6 * scale}" ry="${3 * scale}" fill="#facc15"/>
			<path d="M${11 * scale} ${7.8 * scale}c${2 * scale}-${2 * scale} ${4.4 * scale}-${2.5 * scale} ${7 * scale}-${1.2 * scale}c${-1 * scale} ${2.8 * scale}-${3.5 * scale} ${3.9 * scale}-${7 * scale} ${3.2 * scale}Z" fill="#fb923c"/>
			<circle cx="${18.5 * scale}" cy="${10.7 * scale}" r="${0.6 * scale}" fill="#111827"/>
			<path d="M${2 * scale} ${4 * scale}c${2 * scale} 1 ${4 * scale} 1 ${6 * scale} 0M${16 * scale} ${19 * scale}c${2.5 * scale} 1.2 ${4.5 * scale} 1 ${6.5 * scale}-.3" fill="none" stroke="#bfdbfe" stroke-width="${0.75 * scale}" stroke-linecap="round"/>
		`);
	}

	duckPuzzleSvg(viewSize) {
		const scale = viewSize / 24;
		return this.puzzleSvgShell(viewSize, `
			<rect width="${viewSize}" height="${viewSize}" fill="#93c5fd"/>
			<path d="M0 ${12 * scale}h${viewSize}v${12 * scale}H0Z" fill="#38bdf8"/>
			<path d="M0 ${17 * scale}c${3 * scale} ${1.2 * scale} ${5 * scale} ${1.2 * scale} ${8 * scale} 0c${3 * scale}-${1.2 * scale} ${5 * scale}-${1.2 * scale} ${8 * scale} 0c${3 * scale} ${1.2 * scale} ${5 * scale} ${1.2 * scale} ${8 * scale} 0" fill="none" stroke="#dbeafe" stroke-width="${0.85 * scale}"/>
			<circle cx="${19 * scale}" cy="${4 * scale}" r="${2.4 * scale}" fill="#fde047"/>
			<ellipse cx="${10.8 * scale}" cy="${14.4 * scale}" rx="${6 * scale}" ry="${3.6 * scale}" fill="#facc15"/>
			<ellipse cx="${7.2 * scale}" cy="${10.3 * scale}" rx="${3 * scale}" ry="${3.1 * scale}" fill="#facc15"/>
			<path d="M${4.4 * scale} ${10.5 * scale}h-${3.3 * scale}l${2.8 * scale}-${1.4 * scale}Z" fill="#f97316"/>
			<path d="M${10 * scale} ${14.2 * scale}c${2.5 * scale}-${1.6 * scale} ${5.5 * scale}-${1 * scale} ${7 * scale} ${1.3 * scale}c-${2.5 * scale} .8-${5 * scale} .6-${7}-${1.3}Z" fill="#f59e0b"/>
			<circle cx="${7.8 * scale}" cy="${9.5 * scale}" r="${0.55 * scale}" fill="#111827"/>
			<path d="M0 ${22 * scale}c${4 * scale}-${1 * scale} ${7 * scale}-.8 ${10 * scale} .2c${4 * scale} 1.2 ${8 * scale}.8 ${14 * scale}-${1}" fill="none" stroke="#2563eb" stroke-width="${0.8 * scale}"/>
		`);
	}

	butterflyPuzzleSvg(viewSize) {
		const scale = viewSize / 24;
		return this.puzzleSvgShell(viewSize, `
			<rect width="${viewSize}" height="${viewSize}" fill="#86efac"/>
			<path d="M0 ${17 * scale}c${6 * scale}-${2.5 * scale} ${12 * scale}-${1 * scale} ${24 * scale}-${4 * scale}v${11 * scale}H0Z" fill="#22c55e"/>
			<path d="M${5 * scale} ${5 * scale}c${-2.5 * scale} ${1.8 * scale}-${2.4 * scale} ${7.2 * scale} ${1.3 * scale} ${8.7 * scale}c${2.4 * scale}-${1.4 * scale} ${3.4 * scale}-${4.3 * scale} ${3 * scale}-${7.5 * scale}c-${1.1 * scale}-${1.4 * scale}-${2.4 * scale}-${1.8 * scale}-${4.3 * scale}-${1.2 * scale}Z" fill="#ec4899"/>
			<path d="M${16 * scale} ${4 * scale}c${3.8 * scale} ${1.2 * scale} ${4.3 * scale} ${7.1 * scale} .4 ${9.2 * scale}c-${2.9 * scale}-${1.1 * scale}-${4.2 * scale}-${4.1 * scale}-${3.4 * scale}-${7.3 * scale}c.6-1.2 1.5-1.8 3-1.9Z" fill="#f97316"/>
			<path d="M${8.4 * scale} ${13 * scale}c-${2.4 * scale} ${2.1 * scale}-${1.6 * scale} ${5.2 * scale} ${1.4 * scale} ${6.2 * scale}c${1.2 * scale}-${1.8 * scale} ${1.1 * scale}-${4.1}-${1.4}-${6.2}Z" fill="#60a5fa"/>
			<path d="M${14 * scale} ${12.2 * scale}c${3.5 * scale} ${1.5 * scale} ${4 * scale} ${5.1 * scale} ${0.8 * scale} ${6.6 * scale}c-${1.7 * scale}-${1.5 * scale}-${2.1 * scale}-${4.1 * scale}-${0.8 * scale}-${6.6 * scale}Z" fill="#a855f7"/>
			<path d="M${11.8 * scale} ${5.5 * scale}c${1.1 * scale} ${3.5 * scale} ${1.1 * scale} ${9.7 * scale}-.2 ${15 * scale}" stroke="#111827" stroke-width="${0.75 * scale}" stroke-linecap="round"/>
			<path d="M${11.4 * scale} ${5.5 * scale} ${8.7 * scale} ${2.6 * scale}M${12.3 * scale} ${5.5 * scale} ${15.7 * scale} ${2.3 * scale}" stroke="#111827" stroke-width="${0.45 * scale}" stroke-linecap="round"/>
		`);
	}

	flowerPuzzleSvg(viewSize) {
		const scale = viewSize / 24;
		return this.puzzleSvgShell(viewSize, `
			<rect width="${viewSize}" height="${viewSize}" fill="#bfdbfe"/>
			<path d="M0 ${15 * scale}c${6 * scale}-${2 * scale} ${11 * scale}-${1 * scale} ${24 * scale}-${3.5 * scale}v${12.5 * scale}H0Z" fill="#4ade80"/>
			<path d="M0 ${22 * scale}c${4.5 * scale}-${1.5 * scale} ${8 * scale}-${0.8 * scale} ${12 * scale} ${0.4 * scale}c${4 * scale} ${1.2 * scale} ${7 * scale} ${0.7 * scale} ${12 * scale}-${1.4 * scale}v${3 * scale}H0Z" fill="#22c55e" opacity=".62"/>
			<path d="M${1.2 * scale} ${23.2 * scale}c${4.5 * scale}-${2.6 * scale} ${8.5 * scale}-${2.4 * scale} ${13 * scale}-${0.4 * scale}" fill="none" stroke="#d6a15a" stroke-width="${1.1 * scale}" stroke-linecap="round" opacity=".78"/>
			<path d="M${1.5 * scale} ${19 * scale}l${0.9 * scale}-${2 * scale} ${0.6 * scale} ${2.3 * scale} ${1.2 * scale}-${1.4 * scale}M${5 * scale} ${21 * scale}l${0.8 * scale}-${2.4 * scale} ${0.8 * scale} ${2.6 * scale} ${1.1 * scale}-${1.6 * scale}M${13.5 * scale} ${18.8 * scale}l${0.7 * scale}-${2.1 * scale} ${0.9 * scale} ${2.3 * scale} ${1.1 * scale}-${1.7 * scale}M${20 * scale} ${20.5 * scale}l${0.7 * scale}-${2.2 * scale} ${0.8 * scale} ${2.4 * scale} ${1.1 * scale}-${1.4 * scale}" fill="none" stroke="#15803d" stroke-width="${0.45 * scale}" stroke-linecap="round"/>
			<g fill="#fde047">
				<circle cx="${3.4 * scale}" cy="${18.4 * scale}" r="${0.35 * scale}"/>
				<circle cx="${6.8 * scale}" cy="${22.1 * scale}" r="${0.32 * scale}"/>
				<circle cx="${18.7 * scale}" cy="${18.6 * scale}" r="${0.32 * scale}"/>
				<circle cx="${22.1 * scale}" cy="${21.9 * scale}" r="${0.35 * scale}"/>
			</g>
			<path d="M${8 * scale} ${13 * scale}v${9 * scale}M${16.5 * scale} ${10 * scale}v${11 * scale}" stroke="#15803d" stroke-width="${0.9 * scale}" stroke-linecap="round"/>
			<ellipse cx="${7 * scale}" cy="${10 * scale}" rx="${2.5 * scale}" ry="${4.4 * scale}" fill="#f472b6" transform="rotate(-25 ${7 * scale} ${10 * scale})"/>
			<ellipse cx="${10 * scale}" cy="${8.8 * scale}" rx="${2.5 * scale}" ry="${4.2 * scale}" fill="#fb7185" transform="rotate(32 ${10 * scale} ${8.8 * scale})"/>
			<ellipse cx="${9.2 * scale}" cy="${12 * scale}" rx="${2.4 * scale}" ry="${3.7 * scale}" fill="#e879f9" transform="rotate(104 ${9.2 * scale} ${12 * scale})"/>
			<circle cx="${8.5 * scale}" cy="${10.3 * scale}" r="${1.4 * scale}" fill="#facc15"/>
			<ellipse cx="${15.2 * scale}" cy="${7 * scale}" rx="${2 * scale}" ry="${3.4 * scale}" fill="#f97316" transform="rotate(-38 ${15.2 * scale} ${7 * scale})"/>
			<ellipse cx="${18.5 * scale}" cy="${7.4 * scale}" rx="${2 * scale}" ry="${3.4 * scale}" fill="#fde047" transform="rotate(42 ${18.5 * scale} ${7.4 * scale})"/>
			<ellipse cx="${16.7 * scale}" cy="${9.4 * scale}" rx="${2.2 * scale}" ry="${3.3 * scale}" fill="#fb923c" transform="rotate(110 ${16.7 * scale} ${9.4 * scale})"/>
			<circle cx="${16.8 * scale}" cy="${8 * scale}" r="${1.2 * scale}" fill="#7c2d12"/>
			<path d="M${3 * scale} ${20 * scale}c${4 * scale}-${1.4 * scale} ${7 * scale}-${1.2 * scale} ${11 * scale}.3c${2.5 * scale}.9 ${5 * scale}.6 ${8 * scale}-.8" fill="none" stroke="#166534" stroke-width="${0.7 * scale}"/>
		`);
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

	canPlaceDragPayload(row, col) {
		if (this.dragPayload?.source === 'pack') {
			const source = this.packItems.find((item) => item.key === this.dragPayload.key);
			return source ? this.hooks.canPlace(source, row, col) : false;
		}
		if (this.dragPayload?.source === 'board') {
			const tile = this.placedTiles.get(this.dragPayload.id);
			if (!tile) return false;
			return this.hooks.canPlace(tile, row, col) || Boolean(this.hooks.shouldDiscardOnDragEnd?.(tile));
		}
		return false;
	}

	refreshCellStates() {
		this.cells.forEach((cell) => {
			const row = Number(cell.dataset.row);
			const col = Number(cell.dataset.col);
			const hasTile = Boolean(this.placedTileList().find((tile) => tile.row === row && tile.col === col));
			const state = hasTile ? '' : this.hooks.cellState(row, col);
			const label = hasTile ? '' : this.hooks.cellLabel?.(row, col) || '';
			cell.classList.toggle('answer-slot', state === 'answer');
			cell.classList.toggle('inactive-slot', state === 'inactive');
			cell.tabIndex = state === 'answer' ? 0 : -1;
			if (label) cell.dataset.slotLabel = label;
			else delete cell.dataset.slotLabel;
		});
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
		this.refreshCellStates();
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
