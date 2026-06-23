import { equationTilePack } from '../config.js?v=3';
import { makeQuestion, levelForScore } from '../equations.js?v=3';

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
		return `Solve: ${this.question.left} ${this.question.op} ${this.question.right} = ?. Add up to 3 answer digit tiles in the answer row.`;
	}

	prompt() {
		return 'Place the answer digits in the row below the equals sign, then press Check Answer.';
	}

	autoArrange({ silent = false } = {}) {
		this.board.resetBoardTiles();
		const row = 0;
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
		if (!silent) this.app.setStatus('Question placed. Add answer digits after the equals sign.');
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
			this.autoArrange({ silent: true });
			this.app.setStatus(`Correct. Score ${this.score}. New question ready.`);
		} else {
			this.app.setStatus(`Not quite. You entered ${answer}. Try again.`);
		}
		this.app.render();
	}

	readAnswer() {
		const answerTiles = this.board
			.placedTileList()
			.filter((tile) => tile.row === 1 && tile.col >= 1 && tile.col <= 3 && /^\d$/.test(tile.label))
			.sort((a, b) => a.col - b.col);
		return answerTiles.map((tile) => tile.label).join('');
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
