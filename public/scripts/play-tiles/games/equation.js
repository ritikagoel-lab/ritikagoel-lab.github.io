import { equationTilePack } from '../config.js?v=3';
import { makeQuestion } from '../equations.js?v=4';

export class EquationGame {
	constructor(app, board) {
		this.app = app;
		this.board = board;
		this.title = 'Equation Builder';
		this.score = 0;
		this.level = 1;
		this.question = makeQuestion(this.score, this.level);
		this.wrongAttempts = 0;
		this.feedbackTimer = null;
		this.awaitingFeedback = false;
		this.badgeEarned = false;
	}

	enter() {
		this.question = makeQuestion(this.score, this.level);
		this.wrongAttempts = 0;
		this.clearFeedbackTimer();
		this.clearTypedAnswer();
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

	cellLabel(row, col) {
		if (row === 1 && col >= 0 && col <= 2) return `Digit ${col + 1}`;
		return '';
	}

	instructions() {
		return `Solve: ${this.question.left} ${this.question.op} ${this.question.right} = ?. Drag digit tiles into the numbered answer slots, or type the answer below.`;
	}

	prompt() {
		return 'Use the leftmost slots first for the answer digits, then press Check Answer beside the board.';
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
		if (!silent) this.app.setStatus('Question placed. Add answer digits in the numbered slots or type the answer.');
	}

	start() {}

	reset() {
		this.clearFeedbackTimer();
		this.wrongAttempts = 0;
		this.clearAnswerTiles();
		this.clearTypedAnswer();
		this.setQuestionFeedback('active');
		this.app.setStatus('Answer cleared. Same question kept.');
		this.app.render();
	}

	check() {
		if (this.awaitingFeedback) return;
		const answer = this.readAnswer();
		if (!answer) {
			this.setQuestionFeedback('active');
			this.app.setStatus('Drag digits into the numbered answer slots, or type the answer.');
			this.app.render();
			return;
		}

		if (answer === this.question.answer) {
			this.score += 10;
			this.level = Math.min(8, this.level + 1);
			this.wrongAttempts = 0;
			this.badgeEarned = this.score >= 100;
			this.setQuestionFeedback('correct');
			this.app.setStatus(this.badgeEarned ? `Correct. Score ${this.score}. Badge earned!` : `Correct. Score ${this.score}.`);
			this.app.render();
			this.scheduleFeedback(() => this.advanceQuestion('New question ready.'));
		} else {
			this.wrongAttempts += 1;
			const secondMiss = this.wrongAttempts >= 2;
			if (secondMiss) {
				this.score = Math.max(0, this.score - 5);
				this.level = Math.max(1, this.level - 1);
			}
			this.setQuestionFeedback('wrong');
			this.app.setStatus(
				secondMiss
					? `Not quite. You entered ${answer}. Minus 5 points. Moving to the next question.`
					: `Not quite. You entered ${answer}. Try once more.`,
			);
			this.app.render();
			this.scheduleFeedback(() => {
				if (secondMiss) {
					this.advanceQuestion('New question ready.');
					return;
				}
				this.clearAnswerTiles();
				this.clearTypedAnswer();
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

	clearAnswerSlot(col) {
		const existing = this.board.placedTileList().find((tile) => tile.row === 1 && tile.col === col && /^\d$/.test(tile.label));
		if (existing) this.board.returnTileToPack(existing.id);
	}

	setAnswerDigit(col, digit) {
		if (col < 0 || col > 2 || !/^\d$/.test(digit)) return;
		this.clearTypedAnswer();
		this.clearAnswerSlot(col);
		const tile = this.board.placeCustomTile(
			{
				key: `typed-answer-${col}-${Date.now()}`,
				label: digit,
				kind: 'equation',
				reusable: true,
			},
			1,
			col,
		);
		if (tile) this.board.setTileDisplay(tile, digit, 'blank');
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
		this.question = makeQuestion(this.score, this.level);
		this.clearTypedAnswer();
		this.board.resetBoardTiles();
		this.autoArrange({ silent: true });
		this.setQuestionFeedback('active');
		this.app.setStatus(status);
		this.app.render();
	}

	readAnswer() {
		const typedAnswer = this.app.elements.equationAnswerInput?.value.trim();
		if (typedAnswer) return typedAnswer;
		const answerTiles = this.board
			.placedTileList()
			.filter((tile) => tile.row === 1 && /^\d$/.test(tile.label))
			.sort((a, b) => a.col - b.col);
		return answerTiles
			.slice(0, 3)
			.map((tile) => tile.label)
			.join('');
	}

	clearTypedAnswer() {
		if (this.app.elements.equationAnswerInput) this.app.elements.equationAnswerInput.value = '';
	}

	handleTileClick(tile) {
		if (tile.row === 1 && tile.col >= 0 && tile.col <= 2 && /^\d$/.test(tile.label)) {
			this.focusAnswerSlot(tile.col);
			return true;
		}
		return false;
	}

	handleCellClick(row, col) {
		return row === 1 && col >= 0 && col <= 2;
	}

	handleCellKey(row, col, event) {
		if (row !== 1 || col < 0 || col > 2 || this.awaitingFeedback) return;
		if (/^\d$/.test(event.key)) {
			event.preventDefault();
			this.setAnswerDigit(col, event.key);
			this.focusAnswerSlot(Math.min(2, col + 1));
			this.app.render();
			return;
		}
		if (event.key === 'Backspace' || event.key === 'Delete') {
			event.preventDefault();
			const hasCurrent = Boolean(this.board.placedTileList().find((tile) => tile.row === 1 && tile.col === col && /^\d$/.test(tile.label)));
			const targetCol = hasCurrent || event.key === 'Delete' ? col : Math.max(0, col - 1);
			this.clearAnswerSlot(targetCol);
			this.focusAnswerSlot(targetCol);
			this.app.render();
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			this.check();
		}
	}

	focusAnswerSlot(col) {
		requestAnimationFrame(() => {
			const cell = this.board.cells.get(this.board.cellKey(1, col));
			cell?.focus();
		});
	}

	metrics() {
		return [
			['Score', this.score],
			['Try', `${Math.min(this.wrongAttempts + 1, 2)}/2`],
			['Badge', this.badgeEarned ? 'Won' : '-'],
		];
	}
}
