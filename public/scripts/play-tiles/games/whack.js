import { blankTilePack, squareLayout } from '../config.js?v=3';

const molePixels = [
	['off', 'off', 'brown', 'brown', 'brown', 'brown', 'off', 'off'],
	['off', 'brown', 'tan', 'brown', 'brown', 'tan', 'brown', 'off'],
	['brown', 'tan', 'black', 'tan', 'tan', 'black', 'tan', 'brown'],
	['brown', 'tan', 'tan', 'pink', 'pink', 'tan', 'tan', 'brown'],
	['brown', 'tan', 'black', 'tan', 'tan', 'black', 'tan', 'brown'],
	['off', 'brown', 'tan', 'tan', 'tan', 'tan', 'brown', 'off'],
	['off', 'off', 'brown', 'brown', 'brown', 'brown', 'off', 'off'],
	['off', 'soil', 'soil', 'soil', 'soil', 'soil', 'soil', 'off'],
];

export class WhackGame {
	constructor(app, board) {
		this.app = app;
		this.board = board;
		this.title = 'Whack-a-Mole';
		this.setupCount = 16;
		this.roundSeconds = 45;
		this.score = 0;
		this.remaining = this.roundSeconds;
		this.running = false;
		this.tickTimer = null;
		this.spawnTimer = null;
		this.activeTimeouts = [];
	}

	enter() {
		this.score = 0;
		this.remaining = this.roundSeconds;
		this.running = false;
		return blankTilePack('whack');
	}

	exit() {
		this.stop();
	}

	isLocked() {
		return this.running;
	}

	instructions() {
		return 'Drag all 16 white tiles from the Tile Pack into the board, or place them with software. Start the round, then click each mole picture before it disappears.';
	}

	autoArrange({ silent = false } = {}) {
		this.stop();
		this.board.resetBoardTiles();
		const positions = squareLayout(this.setupCount);
		const blankItems = this.board.availablePackItems('blank').slice(0, this.setupCount);
		blankItems.forEach((item, index) => {
			this.board.addTileFromPack(item.key, positions[index].row, positions[index].col);
		});
		if (!silent) this.app.setStatus('16 white tiles placed by software.');
	}

	start() {
		const count = this.board.placedTileList().length;
		if (count < this.setupCount) {
			this.autoArrange({ silent: true });
		}

		this.stop();
		this.running = true;
		this.score = 0;
		this.remaining = this.roundSeconds;
		this.clearMoles();
		this.app.setStatus('Round running.');
		this.tickTimer = setInterval(() => this.tick(), 1000);
		this.scheduleMoles();
		this.app.render();
	}

	stop() {
		this.running = false;
		if (this.tickTimer) clearInterval(this.tickTimer);
		if (this.spawnTimer) clearTimeout(this.spawnTimer);
		this.activeTimeouts.forEach((timer) => clearTimeout(timer));
		this.tickTimer = null;
		this.spawnTimer = null;
		this.activeTimeouts = [];
		this.clearMoles();
	}

	tick() {
		this.remaining -= 1;
		if (this.remaining <= 0) {
			const finalScore = this.score;
			this.stop();
			this.remaining = 0;
			this.app.setStatus(`Round complete. Score: ${finalScore}.`);
		}
		this.app.render();
	}

	scheduleMoles() {
		if (!this.running) return;
		const elapsed = this.roundSeconds - this.remaining;
		const interval = Math.max(800, 1800 - elapsed * 18 - this.score * 6);
		const visibleMs = Math.max(700, interval - 180);
		const moleCount = Math.min(3, 1 + Math.floor(elapsed / 15));

		this.spawnMoles(moleCount, visibleMs);
		this.spawnTimer = setTimeout(() => this.scheduleMoles(), interval);
	}

	spawnMoles(count, visibleMs) {
		const boardTiles = this.board.placedTileList();
		this.clearMoles();
		const shuffled = [...boardTiles].sort(() => Math.random() - 0.5);
		shuffled.slice(0, count).forEach((tile) => {
			tile.gameData.activeMole = true;
			this.board.setTileDisplay(tile, molePixels, 'mole');
			const timer = setTimeout(() => {
				if (!this.running || !tile.gameData.activeMole) return;
				tile.gameData.activeMole = false;
				this.board.setTileDisplay(tile, '', 'blank');
			}, visibleMs);
			this.activeTimeouts.push(timer);
		});
	}

	clearMoles() {
		this.board.placedTileList().forEach((tile) => {
			tile.gameData.activeMole = false;
			if (tile.element.classList.contains('mole')) this.board.setTileDisplay(tile, '', 'blank');
		});
	}

	handleTileClick(tile) {
		if (!this.running) return false;
		if (tile.gameData.activeMole) {
			this.score += 1;
			tile.gameData.activeMole = false;
			this.board.setTileDisplay(tile, '', 'blank');
			this.app.setStatus('Hit. Keep going.');
			this.app.render();
		}
		return true;
	}

	metrics() {
		return [
			['Tiles', this.board.placedTileList().length],
			['Time', this.running ? this.remaining : this.roundSeconds],
			['Score', this.score],
		];
	}
}
