export const GRID_ROWS = 4;
export const GRID_COLS = 4;
export const TILE_LIMIT = 16;

export const DIRECTIONS = [
	{ deltaRow: -1, deltaCol: 0, from: 'north', to: 'south' },
	{ deltaRow: 1, deltaCol: 0, from: 'south', to: 'north' },
	{ deltaRow: 0, deltaCol: 1, from: 'east', to: 'west' },
	{ deltaRow: 0, deltaCol: -1, from: 'west', to: 'east' },
];

export const memoryFaces = [
	{ key: 'cat', word: 'Cat', image: { type: 'lcd', scene: 'cat' } },
	{ key: 'fish', word: 'Fish', image: { type: 'lcd', scene: 'fish' } },
	{ key: 'tree', word: 'Tree', image: { type: 'lcd', scene: 'tree' } },
	{ key: 'car', word: 'Car', image: { type: 'lcd', scene: 'car' } },
	{ key: 'star', word: 'Star', image: { type: 'lcd', scene: 'star' } },
	{ key: 'house', word: 'House', image: { type: 'lcd', scene: 'house' } },
	{ key: 'flower', word: 'Flower', image: { type: 'lcd', scene: 'flower' } },
	{ key: 'balloon', word: 'Balloon', image: { type: 'lcd', scene: 'balloon' } },
];

export function blankTilePack(prefix = 'blank') {
	return Array.from({ length: TILE_LIMIT }, (_, index) => ({
		key: `${prefix}-${index + 1}`,
		label: '',
		face: '',
		kind: 'blank',
		reusable: false,
	}));
}

export function equationTilePack() {
	const digits = Array.from({ length: 10 }, (_, value) => ({
		key: `digit-${value}`,
		label: String(value),
		face: String(value),
		kind: 'equation',
		reusable: true,
	}));
	const operators = [
		['plus', '+'],
		['minus', '-'],
		['multiply', 'x'],
		['divide', '/'],
		['equals', '='],
		['blank-equation', '?'],
	].map(([key, label]) => ({
		key,
		label,
		face: label,
		kind: 'equation',
		reusable: true,
	}));
	return [...digits, ...operators];
}

export function squareLayout(count) {
	const width = Math.ceil(Math.sqrt(count));
	const startRow = Math.max(0, Math.floor((GRID_ROWS - width) / 2));
	const startCol = Math.max(0, Math.floor((GRID_COLS - width) / 2));
	return Array.from({ length: count }, (_, index) => ({
		row: startRow + Math.floor(index / width),
		col: startCol + (index % width),
	}));
}
