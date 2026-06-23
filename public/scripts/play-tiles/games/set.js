import { squareLayout } from '../config.js?v=3';

const COLORS = ['red', 'green', 'blue'];
const SHAPES = ['circle', 'triangle', 'diamond'];
const COUNTS = [1, 2, 3];

export class SetGame {
	constructor(app, board) {
		this.app = app;
		this.board = board;
		this.title = 'Set Match';
		this.setupCount = 12;
		this.score = 0;
		this.attempts = 0;
		this.selected = [];
	}

	enter() {
		this.score = 0;
		this.attempts = 0;
		this.selected = [];
		return [];
	}

	exit() {
		this.selected = [];
	}

	isLocked() {
		return false;
	}

	instructions() {
		return 'Find 3 tiles where color, shape, and count are each all the same or all different. Tap 3 tiles to check the set.';
	}

	autoArrange() {
		this.selected = [];
		this.board.resetBoardTiles();
		const cards = this.makeBoardCards();
		const positions = squareLayout(this.setupCount);
		cards.forEach((card, index) => {
			const tile = this.board.placeCustomTile(
				{
					key: `set-${index}`,
					label: card,
					kind: 'set',
					reusable: true,
				},
				positions[index].row,
				positions[index].col,
			);
			if (tile) tile.gameData.setCard = card;
		});
		this.app.setStatus('12 Set tiles placed. Tap any 3 that make a set.');
	}

	start() {
		if (this.board.placedTileList().length < this.setupCount) {
			this.autoArrange();
			return;
		}
		this.app.setStatus('Tap any 3 tiles that make a set.');
	}

	check() {}

	makeBoardCards() {
		const allCards = [];
		COLORS.forEach((color) => {
			SHAPES.forEach((shape) => {
				COUNTS.forEach((count) => {
					allCards.push({ type: 'set', color, shape, count });
				});
			});
		});
		for (let attempt = 0; attempt < 40; attempt += 1) {
			const board = [...allCards].sort(() => Math.random() - 0.5).slice(0, this.setupCount);
			if (this.boardHasSet(board)) return board;
		}
		return allCards.slice(0, this.setupCount);
	}

	boardHasSet(cards) {
		for (let first = 0; first < cards.length; first += 1) {
			for (let second = first + 1; second < cards.length; second += 1) {
				for (let third = second + 1; third < cards.length; third += 1) {
					if (this.isSet([cards[first], cards[second], cards[third]])) return true;
				}
			}
		}
		return false;
	}

	handleTileClick(tile) {
		if (!tile.gameData.setCard) return false;
		if (this.selected.includes(tile)) {
			this.selected = this.selected.filter((candidate) => candidate.id !== tile.id);
			tile.element.classList.remove('set-selected');
			this.app.render();
			return true;
		}

		this.selected.push(tile);
		tile.element.classList.add('set-selected');
		if (this.selected.length === 3) this.scoreSelection();
		this.app.render();
		return true;
	}

	scoreSelection() {
		this.attempts += 1;
		const cards = this.selected.map((tile) => tile.gameData.setCard);
		const isSet = this.isSet(cards);

		if (isSet) {
			this.score += 1;
			this.selected.forEach((tile) => this.board.returnTileToPack(tile.id));
			this.selected = [];
			this.app.setStatus('Set found. Nice.');
			if (this.board.placedTileList().length < 3) this.autoArrange();
		} else {
			this.selected.forEach((tile) => tile.element.classList.remove('set-selected'));
			this.selected = [];
			this.app.setStatus('Not a set. Try another 3.');
		}
	}

	featureIsValid(values) {
		const uniqueCount = new Set(values).size;
		return uniqueCount === 1 || uniqueCount === 3;
	}

	isSet(cards) {
		return ['color', 'shape', 'count'].every((feature) => this.featureIsValid(cards.map((card) => card[feature])));
	}

	metrics() {
		return [
			['Selected', `${this.selected.length}/3`],
			['Attempts', this.attempts],
			['Sets', this.score],
		];
	}
}
