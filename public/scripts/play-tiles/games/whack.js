import { blankTilePack, squareLayout } from '../config.js?v=6';

const moleFace = { type: 'lcd', scene: 'mole' };

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
		this.roundComplete = false;
		this.tickTimer = null;
		this.spawnTimer = null;
		this.activeTimeouts = [];
	}

	enter() {
		this.score = 0;
		this.remaining = this.roundSeconds;
		this.running = false;
		this.roundComplete = false;
		return blankTilePack('whack');
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
		return 'The board starts with 16 tiles. Start the round and watch for moles that pop up for a short time. Tap each mole before it disappears; as the round goes on, multiple moles can appear at once.';
	}

	prompt() {
		return 'Click Start Game when you are ready.';
	}

	autoArrange({ silent = false } = {}) {
		this.stop();
		this.board.resetBoardTiles();
		const positions = squareLayout(this.setupCount);
		const blankItems = this.board.availablePackItems('blank').slice(0, this.setupCount);
		blankItems.forEach((item, index) => {
			this.board.addTileFromPack(item.key, positions[index].row, positions[index].col);
		});
		if (!silent) this.app.setStatus('16 tiles placed by software.');
	}

	start() {
		const count = this.board.placedTileList().length;
		if (count < this.setupCount) {
			this.autoArrange({ silent: true });
		}

		this.stop();
		this.running = true;
		this.roundComplete = false;
		this.score = 0;
		this.remaining = this.roundSeconds;
		this.clearMoles();
		this.app.setStatus('');
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
			this.stop();
			this.remaining = 0;
			this.roundComplete = true;
			this.app.setStatus('Round complete.');
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
			this.board.setTileDisplay(tile, moleFace, 'mole');
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
			['Time', this.remaining, this.running ? 'running-time' : 'stopped-time'],
			['Score', this.score, this.roundComplete ? 'complete-score' : 'normal-score'],
		];
	}
}
