function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(items) {
	return items[randomInt(0, items.length - 1)];
}

export function levelForScore(score) {
	return Math.min(8, 1 + Math.floor(score / 30));
}

export function makeQuestion(score, requestedLevel = null) {
	const level = requestedLevel ?? levelForScore(score);

	if (level === 1) {
		const left = randomInt(1, 9);
		const right = randomInt(1, 9);
		return question(left, '+', right);
	}

	if (level === 2) {
		const op = pick(['+', '-']);
		const left = randomInt(10, 49);
		const right = op === '+' ? randomInt(10, 49) : randomInt(1, left);
		return question(left, op, right);
	}

	if (level === 3) {
		return question(randomInt(2, 9), 'x', randomInt(2, 9));
	}

	if (level === 4) {
		const answer = randomInt(2, 12);
		const right = randomInt(2, 9);
		return question(answer * right, '/', right);
	}

	if (level <= 6) {
		const op = pick(['+', '-', 'x']);
		if (op === 'x') return question(randomInt(10, 24), 'x', randomInt(2, 9));
		const left = randomInt(20, 99);
		const right = op === '+' ? randomInt(10, 99) : randomInt(1, left);
		return question(left, op, right);
	}

	const op = pick(['+', '-', 'x', '/']);
	if (op === '/') {
		const answer = randomInt(10, 30);
		const right = randomInt(2, 9);
		return question(answer * right, '/', right);
	}
	if (op === 'x') return question(randomInt(12, 40), 'x', randomInt(2, 9));
	const left = randomInt(100, 400);
	const right = op === '+' ? randomInt(25, 300) : randomInt(1, left);
	return question(left, op, right);
}

function question(left, op, right) {
	const answer = calculate(left, op, right);
	return {
		left: String(left),
		op,
		right: String(right),
		answer: String(answer),
	};
}

function calculate(left, op, right) {
	if (op === '+') return left + right;
	if (op === '-') return left - right;
	if (op === 'x') return left * right;
	return left / right;
}
