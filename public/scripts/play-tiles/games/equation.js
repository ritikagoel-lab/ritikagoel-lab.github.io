import { equationTilePack } from '../config.js';
import { makeQuestion, levelForScore } from '../equations.js';

export class EquationGame {
	constructor(app, board) {
		this.app = app;
		this.board = board;
		this.title = 'Equation Builder';
		this.score = 0;
		this.question = makeQuestion(this.score);
	}

	enter() {
		this.question = makeQuestion(this.score);
		return equationTilePack();
	}

	exit() {}

	isLocked() {
		return false;
	}

	instructions() {
		return `Solve: ${this.question.left} ${this.question.op} ${this.question.right} = ?. Drag the question onto one horizontal row, or use Place Question. Then place answer digit tiles after the equals sign.`;
	}

	autoArrange() {
		this.board.resetBoardTiles();
		const row = 2;
		[this.question.left, this.question.op, this.question.right, '='].forEach((label, index) => {
			const tile = this.board.placeCustomTile(
				{
					key: `question-${index}`,
					label,
					kind: 'equation',
					reusable: true,
				},
				row,
				index,
			);
			if (tile) {
				tile.element.classList.add('question-tile');
				this.board.setTileDisplay(tile, label, 'question-tile');
			}
		});
		this.app.setStatus('Question placed. Add answer digits after the equals sign.');
	}

	start() {}

	check() {
		const answer = this.readAnswer();
		if (!answer) {
			this.app.setStatus('Place answer digits after the equals sign.');
			this.app.render();
			return;
		}

		if (answer === this.question.answer) {
			this.score += 10;
			this.question = makeQuestion(this.score);
			this.board.resetBoardTiles();
			this.app.setStatus(`Correct. Score ${this.score}. New question ready.`);
		} else {
			this.app.setStatus(`Not quite. You entered ${answer}. Try again.`);
		}
		this.app.render();
	}

	readAnswer() {
		for (let row = 0; row < 6; row += 1) {
			const rowTiles = this.board
				.placedTileList()
				.filter((tile) => tile.row === row)
				.sort((a, b) => a.col - b.col);
			const equalsIndex = rowTiles.findIndex((tile) => tile.label === '=');
			if (equalsIndex === -1) continue;
			const answerTiles = rowTiles.slice(equalsIndex + 1).filter((tile) => /^\d$/.test(tile.label));
			if (answerTiles.length > 0) return answerTiles.map((tile) => tile.label).join('');
		}
		return '';
	}

	handleTileClick() {
		return false;
	}

	metrics() {
		return [
			['Level', levelForScore(this.score)],
			['Tiles', this.board.placedTileList().length],
			['Score', this.score],
		];
	}
}
