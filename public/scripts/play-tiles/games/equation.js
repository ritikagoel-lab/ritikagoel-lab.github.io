import { equationTilePack } from '../config.js?v=3';
import { makeQuestion, levelForScore } from '../equations.js?v=3';

export class EquationGame {
	constructor(app, board) {
		this.app = app;
		this.board = board;
		this.title = 'Equation Builder';
		this.score = 0;
		this.question = makeQuestion(this.score);
		this.wrongAttempts = 0;
		this.feedbackTimer = null;
		this.awaitingFeedback = false;
	}

	enter() {
		this.question = makeQuestion(this.score);
		this.wrongAttempts = 0;
		this.clearFeedbackTimer();
		return equationTilePack();
	}

	exit() {
		this.clearFeedbackTimer();
	}

	isLocked() {
		return this.awaitingFeedback;
	}

	canPlace(source, row, col) {
		if (source.sourceKey?.startsWith('question-') || source.key?.startsWith('question-')) return row === 0;
		return source.kind === 'equation' && /^\d$/.test(source.label) && row === 1 && col >= 0 && col <= 2;
	}

	cellState(row, col) {
		if (row === 0 && col >= 0 && col <= 3) return '';
		if (row === 1 && col >= 0 && col <= 2) return 'answer';
		return 'inactive';
	}

	instructions() {
		return `Solve: ${this.question.left} ${this.question.op} ${this.question.right} = ?. Fill the 3 highlighted answer slots.`;
	}

	prompt() {
		return 'Place answer digits only in the 3 highlighted slots, then press Check Answer.';
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
		this.setQuestionFeedback('active');
		if (!silent) this.app.setStatus('Question placed. Add answer digits after the equals sign.');
	}

	start() {}

	reset() {
		this.clearFeedbackTimer();
		this.wrongAttempts = 0;
		this.clearAnswerTiles();
		this.setQuestionFeedback('active');
		this.app.setStatus('Answer cleared. Same question kept.');
		this.app.render();
	}

	check() {
		if (this.awaitingFeedback) return;
		const answer = this.readAnswer();
		if (!answer) {
			this.setQuestionFeedback('active');
			this.app.setStatus('Place answer digits in the row below the question.');
			this.app.render();
			return;
		}

		if (answer === this.question.answer) {
			this.score += 10;
			this.wrongAttempts = 0;
			this.setQuestionFeedback('correct');
			this.app.setStatus(`Correct. Score ${this.score}.`);
			this.app.render();
			this.scheduleFeedback(() => this.advanceQuestion('New question ready.'));
		} else {
			this.wrongAttempts += 1;
			this.setQuestionFeedback('wrong');
			this.app.setStatus(
				this.wrongAttempts >= 2
					? `Not quite. You entered ${answer}. Moving to the next question.`
					: `Not quite. You entered ${answer}. Try once more.`,
			);
			this.app.render();
			this.scheduleFeedback(() => {
				if (this.wrongAttempts >= 2) {
					this.advanceQuestion('New question ready.');
					return;
				}
				this.clearAnswerTiles();
				this.setQuestionFeedback('active');
				this.app.setStatus('Try again. Same question kept.');
				this.app.render();
			});
		}
	}

	clearAnswerTiles() {
		this.board
			.placedTileList()
			.filter((tile) => tile.row === 1 && /^\d$/.test(tile.label))
			.forEach((tile) => this.board.returnTileToPack(tile.id));
	}

	setQuestionFeedback(state = 'active') {
		this.board
			.placedTileList()
			.filter((tile) => tile.row === 0)
			.forEach((tile) => {
				tile.element.classList.remove('question-checked', 'question-correct', 'question-wrong');
				tile.element.classList.add('question-tile');
				if (state === 'correct') tile.element.classList.add('question-correct');
				if (state === 'wrong') tile.element.classList.add('question-wrong');
			});
	}

	scheduleFeedback(callback) {
		this.clearFeedbackTimer();
		this.awaitingFeedback = true;
		this.feedbackTimer = setTimeout(() => {
			this.awaitingFeedback = false;
			this.feedbackTimer = null;
			callback();
		}, 1000);
	}

	clearFeedbackTimer() {
		if (!this.feedbackTimer) return;
		clearTimeout(this.feedbackTimer);
		this.feedbackTimer = null;
		this.awaitingFeedback = false;
	}

	advanceQuestion(status) {
		this.wrongAttempts = 0;
		this.question = makeQuestion(this.score);
		this.board.resetBoardTiles();
		this.autoArrange({ silent: true });
		this.setQuestionFeedback('active');
		this.app.setStatus(status);
		this.app.render();
	}

	readAnswer() {
		const answerTiles = this.board
			.placedTileList()
			.filter((tile) => tile.row === 1 && /^\d$/.test(tile.label))
			.sort((a, b) => a.col - b.col);
		return answerTiles
			.slice(0, 3)
			.map((tile) => tile.label)
			.join('');
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
