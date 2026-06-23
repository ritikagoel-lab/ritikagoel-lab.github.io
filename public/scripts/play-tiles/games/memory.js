import { blankTilePack, memoryFaces, squareLayout } from '../config.js?v=3';

export class MemoryGame {
	constructor(app, board) {
		this.app = app;
		this.board = board;
		this.title = 'Memory Match';
		this.selectedCount = 16;
		this.running = false;
		this.locked = false;
		this.attempts = 0;
		this.matches = 0;
		this.selection = [];
		this.turnToken = 0;
		this.speedMode = 'regular';
		this.autoStartOnEnter = true;
	}

	enter() {
		this.stop();
		return blankTilePack('memory');
	}

	exit() {
		this.stop();
	}

	isLocked() {
		return this.running;
	}

	canPlace() {
		return true;
	}

	instructions() {
		return 'Choose tile count and Regular or Challenge mode. Matching images turn gray immediately.';
	}

	prompt() {
		return `Memory is set to ${this.selectedCount} tiles in ${this.speedMode === 'regular' ? 'Regular' : 'Challenge'} mode. Click Start Game when you are ready.`;
	}

	setTileCount(count) {
		this.selectedCount = count;
		this.stop();
		this.board.reset(blankTilePack('memory'));
		this.autoArrange({ silent: true });
		this.start();
	}

	setSpeedMode(mode) {
		this.speedMode = mode;
		this.app.setStatus(`${mode === 'regular' ? 'Regular' : 'Challenge'} mode selected.`);
		this.app.render();
	}

	autoArrange({ silent = false } = {}) {
		this.stop();
		this.board.resetBoardTiles();
		const positions = squareLayout(this.selectedCount);
		const blankItems = this.board.availablePackItems('blank').slice(0, this.selectedCount);
		blankItems.forEach((item, index) => {
			this.board.addTileFromPack(item.key, positions[index].row, positions[index].col);
		});
		if (!silent) this.app.setStatus(`${this.selectedCount} white tiles placed by software.`);
	}

	start() {
		const boardTiles = this.board.placedTileList();
		if (boardTiles.length < this.selectedCount) {
			this.autoArrange({ silent: true });
		}

		const readyTiles = this.board.placedTileList();
		this.running = true;
		this.locked = false;
		this.attempts = 0;
		this.matches = 0;
		this.selection = [];
		this.turnToken += 1;
		const faces = this.makeFaceSet();
		readyTiles.slice(0, this.selectedCount).forEach((tile, index) => {
			tile.gameData.memoryKey = faces[index].key;
			tile.gameData.memoryFace = faces[index].face;
			tile.gameData.matched = false;
			this.board.setTileDisplay(tile, '', 'blank');
		});
		this.app.setStatus('Click 2 tiles at a time.');
		this.app.render();
	}

	stop() {
		this.running = false;
		this.locked = false;
		this.selection = [];
		this.turnToken += 1;
	}

	makeFaceSet() {
		const pairCount = this.selectedCount / 2;
		const pairs = memoryFaces.slice(0, pairCount);
		return pairs
			.flatMap((pair) => [
				{ key: pair.key, face: pair.image },
				{ key: pair.key, face: pair.image },
			])
			.sort(() => Math.random() - 0.5);
	}

	handleTileClick(tile) {
		if (!this.running) return false;
		if (this.locked || tile.gameData.matched || this.selection.includes(tile)) return true;

		this.selection.push(tile);
		this.board.setTileDisplay(tile, tile.gameData.memoryFace, 'revealed');

		if (this.selection.length !== 2) {
			this.app.render();
			return true;
		}

		this.attempts += 1;
		const [first, second] = this.selection;
		const matched = first.gameData.memoryKey === second.gameData.memoryKey;

		if (matched) {
			first.gameData.matched = true;
			second.gameData.matched = true;
			this.matches += 1;
			this.board.setTileDisplay(first, first.gameData.memoryFace, 'matched');
			this.board.setTileDisplay(second, second.gameData.memoryFace, 'matched');
			this.selection = [];
			this.app.setStatus('Match found.');
			if (this.matches === this.selectedCount / 2) {
				this.running = false;
				this.app.setStatus(`Memory complete in ${this.attempts} attempts.`);
			}
			this.app.render();
			return true;
		}

		this.locked = true;
		const turnToken = this.turnToken;
		setTimeout(() => {
			if (turnToken !== this.turnToken) return;
			this.board.setTileDisplay(first, '', 'blank');
			this.board.setTileDisplay(second, '', 'blank');
			this.selection = [];
			this.locked = false;
			this.app.setStatus('Try another pair.');
			this.app.render();
		}, this.speedMode === 'regular' ? 4000 : 2500);
		this.app.render();
		return true;
	}

	metrics() {
		return [
			['Matches', `${this.matches}/${this.selectedCount / 2}`],
			['Attempts', this.attempts],
			['Score', this.matches * 10],
		];
	}
}
