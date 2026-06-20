const gridSize = 6;
const cells = new Map();
const placedTiles = new Map();

const modes = {
	equation: {
		title: 'Equation Builder',
		prompt: 'Arrange 3 + 4 = 7 in a line.',
		target: ['3', '+', '4', '=', '7'],
	},
	maze: {
		title: 'Maze Runner',
		prompt: 'Make a connected path from S to G.',
		target: ['S', '1', '2', '3', 'G'],
	},
	memory: {
		title: 'Memory Match',
		prompt: 'Place matching colors next to each other.',
		target: [],
	},
	story: {
		title: 'Story Builder',
		prompt: 'Build a chain of character, place, object, and action.',
		target: [],
	},
};

const tileSets = {
	equation: [
		['1', 'number'],
		['2', 'number'],
		['3', 'number'],
		['4', 'number'],
		['7', 'number'],
		['+', 'operator'],
		['-', 'operator'],
		['=', 'operator'],
	],
	maze: [
		['S', 'path'],
		['1', 'path'],
		['2', 'path'],
		['3', 'path'],
		['4', 'path'],
		['G', 'path'],
	],
	memory: [
		['R', 'operator'],
		['R', 'operator'],
		['B', 'number'],
		['B', 'number'],
		['Y', 'path'],
		['Y', 'path'],
	],
	story: [
		['Kid', 'story'],
		['Moon', 'story'],
		['Key', 'story'],
		['Run', 'story'],
		['Door', 'story'],
		['Map', 'story'],
	],
};

let currentMode = 'equation';
let dragTileId = null;
let selectedTileId = null;

const tray = document.querySelector('.tray');
const grid = document.querySelector('.grid');
const graphList = document.querySelector('#graphList');
const tileCount = document.querySelector('#tileCount');
const linkCount = document.querySelector('#linkCount');
const scoreValue = document.querySelector('#scoreValue');
const modeTitle = document.querySelector('#modeTitle');
const modePrompt = document.querySelector('#modePrompt');
const saveStatus = document.querySelector('#saveStatus');

function cellKey(row, col) {
	return `${row},${col}`;
}

function makeTile(label, kind, id) {
	const tile = document.createElement('div');
	tile.className = 'tile';
	tile.draggable = true;
	tile.dataset.tileId = id;
	tile.dataset.label = label;
	tile.dataset.kind = kind;
	tile.innerHTML = `<span class="tile-face">${label}</span>`;
	tile.addEventListener('dragstart', () => {
		dragTileId = id;
	});
	tile.addEventListener('dragend', () => {
		dragTileId = null;
		document.querySelectorAll('.drop-ready').forEach((cell) => cell.classList.remove('drop-ready'));
	});
	tile.addEventListener('click', () => selectTile(id));
	return tile;
}

function selectTile(id) {
	selectedTileId = selectedTileId === id ? null : id;
	document.querySelectorAll('.tile').forEach((tile) => {
		tile.classList.toggle('selected', tile.dataset.tileId === selectedTileId);
	});
}

function buildGrid() {
	grid.innerHTML = '';
	cells.clear();
	for (let row = 0; row < gridSize; row += 1) {
		for (let col = 0; col < gridSize; col += 1) {
			const cell = document.createElement('div');
			cell.className = 'cell';
			cell.dataset.row = row;
			cell.dataset.col = col;
			cell.addEventListener('dragover', (event) => {
				event.preventDefault();
				cell.classList.add('drop-ready');
			});
			cell.addEventListener('dragleave', () => cell.classList.remove('drop-ready'));
			cell.addEventListener('drop', (event) => {
				event.preventDefault();
				cell.classList.remove('drop-ready');
				placeTile(dragTileId, row, col);
			});
			cell.addEventListener('click', () => {
				if (selectedTileId) {
					placeTile(selectedTileId, row, col);
					selectTile(null);
				}
			});
			cells.set(cellKey(row, col), cell);
			grid.appendChild(cell);
		}
	}
}

function buildTray() {
	tray.innerHTML = '';
	placedTiles.clear();
	tileSets[currentMode].forEach(([label, kind], index) => {
		const id = `${currentMode}-${index}-${label}`;
		const tile = makeTile(label, kind, id);
		placedTiles.set(id, { id, label, kind, row: null, col: null, element: tile });
		tray.appendChild(tile);
	});
}

function placeTile(id, row, col) {
	if (!id || !placedTiles.has(id)) return;

	const existing = Array.from(placedTiles.values()).find((tile) => tile.row === row && tile.col === col);
	if (existing) {
		existing.row = null;
		existing.col = null;
		tray.appendChild(existing.element);
	}

	const tile = placedTiles.get(id);
	tile.row = row;
	tile.col = col;
	cells.get(cellKey(row, col)).appendChild(tile.element);
	renderGraph();
}

function resetBoard() {
	buildGrid();
	buildTray();
	renderMode();
	renderGraph();
}

function sideFor(deltaRow, deltaCol) {
	if (deltaRow === -1 && deltaCol === 0) return ['north', 'south'];
	if (deltaRow === 1 && deltaCol === 0) return ['south', 'north'];
	if (deltaRow === 0 && deltaCol === 1) return ['east', 'west'];
	if (deltaRow === 0 && deltaCol === -1) return ['west', 'east'];
	return null;
}

function adjacencyGraph() {
	const positioned = Array.from(placedTiles.values()).filter((tile) => tile.row !== null);
	const edges = [];
	for (const tile of positioned) {
		for (const other of positioned) {
			if (tile.id === other.id) continue;
			const sides = sideFor(other.row - tile.row, other.col - tile.col);
			if (sides) {
				edges.push({ tile, other, fromSide: sides[0], toSide: sides[1] });
			}
		}
	}
	return edges;
}

function scoreMode() {
	const positioned = Array.from(placedTiles.values())
		.filter((tile) => tile.row !== null)
		.sort((a, b) => a.row - b.row || a.col - b.col);

	if (currentMode === 'equation') {
		const rows = new Map();
		positioned.forEach((tile) => {
			const rowTiles = rows.get(tile.row) || [];
			rowTiles.push(tile);
			rows.set(tile.row, rowTiles);
		});
		for (const rowTiles of rows.values()) {
			const sequence = rowTiles.sort((a, b) => a.col - b.col).map((tile) => tile.label);
			if (modes.equation.target.every((label, index) => sequence[index] === label)) return 100;
		}
		return Math.min(80, positioned.length * 12);
	}

	if (currentMode === 'maze') {
		const labels = new Set(positioned.map((tile) => tile.label));
		return labels.has('S') && labels.has('G') ? Math.min(100, adjacencyGraph().length * 12) : adjacencyGraph().length * 8;
	}

	if (currentMode === 'memory') {
		return adjacencyGraph().filter((edge) => edge.tile.label === edge.other.label).length * 20;
	}

	return Math.min(100, adjacencyGraph().length * 10);
}

function renderMode() {
	modeTitle.textContent = modes[currentMode].title;
	modePrompt.textContent = modes[currentMode].prompt;
	document.querySelectorAll('.mode-tab').forEach((button) => {
		button.classList.toggle('active', button.dataset.mode === currentMode);
	});
}

function renderGraph() {
	const positioned = Array.from(placedTiles.values()).filter((tile) => tile.row !== null);
	const edges = adjacencyGraph();
	const compactEdges = edges.filter((edge) => edge.tile.id < edge.other.id);
	graphList.innerHTML = '';

	if (compactEdges.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'graph-line';
		empty.textContent = 'No side contacts yet';
		graphList.appendChild(empty);
	} else {
		compactEdges.forEach((edge) => {
			const line = document.createElement('div');
			line.className = 'graph-line';
			line.textContent = `Tile ${edge.tile.label} ${edge.fromSide} touches Tile ${edge.other.label} ${edge.toSide}`;
			graphList.appendChild(line);
		});
	}

	tileCount.textContent = positioned.length;
	linkCount.textContent = compactEdges.length;
	scoreValue.textContent = scoreMode();
}

function saveInterest() {
	const payload = {
		role: document.querySelector('#audienceRole').value,
		favoriteMode: document.querySelector('#favoriteMode').value,
		interestLevel: Number(document.querySelector('#interestLevel').value),
		email: document.querySelector('#email').value.trim(),
		mode: currentMode,
		score: Number(scoreValue.textContent),
		graph: adjacencyGraph().map((edge) => ({
			from: edge.tile.label,
			fromSide: edge.fromSide,
			to: edge.other.label,
			toSide: edge.toSide,
		})),
		createdAt: new Date().toISOString(),
	};
	const existing = JSON.parse(localStorage.getItem('smart_tiles_interest') || '[]');
	existing.push(payload);
	localStorage.setItem('smart_tiles_interest', JSON.stringify(existing));
	saveStatus.textContent = 'Saved locally for this prototype.';
}

document.querySelectorAll('.mode-tab').forEach((button) => {
	button.addEventListener('click', () => {
		currentMode = button.dataset.mode;
		resetBoard();
	});
});

document.querySelector('#resetBoard').addEventListener('click', resetBoard);
document.querySelector('#saveSignal').addEventListener('click', saveInterest);

buildGrid();
buildTray();
renderMode();
renderGraph();
