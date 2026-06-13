/**
 * Безопасный вычислитель арифметики для поля суммы: + - * / и скобки.
 * Без eval — токенизация + сортировочная станция (shunting-yard) → RPN.
 * Возвращает null, если выражение некорректно.
 */

type Token = { type: 'num'; value: number } | { type: 'op'; value: string } | { type: 'paren'; value: '(' | ')' };

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const s = input.replace(/,/g, '.').replace(/\s+/g, '');
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      if ((num.match(/\./g)?.length ?? 0) > 1) return null;
      const value = Number(num);
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: 'num', value });
      continue;
    }
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }
    return null; // недопустимый символ
  }
  return tokens;
}

function toRpn(tokens: Token[]): Token[] | null {
  const output: Token[] = [];
  const ops: Token[] = [];
  for (const tok of tokens) {
    if (tok.type === 'num') {
      output.push(tok);
    } else if (tok.type === 'op') {
      while (
        ops.length &&
        ops[ops.length - 1].type === 'op' &&
        PRECEDENCE[(ops[ops.length - 1] as { value: string }).value] >= PRECEDENCE[tok.value]
      ) {
        output.push(ops.pop()!);
      }
      ops.push(tok);
    } else if (tok.value === '(') {
      ops.push(tok);
    } else {
      // ')'
      while (ops.length && !(ops[ops.length - 1].type === 'paren')) {
        output.push(ops.pop()!);
      }
      if (!ops.length) return null; // несбалансированные скобки
      ops.pop(); // убрать '('
    }
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op.type === 'paren') return null;
    output.push(op);
  }
  return output;
}

function evalRpn(rpn: Token[]): number | null {
  const stack: number[] = [];
  for (const tok of rpn) {
    if (tok.type === 'num') {
      stack.push(tok.value);
      continue;
    }
    if (tok.type !== 'op') return null;
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) return null;
    switch (tok.value) {
      case '+': stack.push(a + b); break;
      case '-': stack.push(a - b); break;
      case '*': stack.push(a * b); break;
      case '/':
        if (b === 0) return null;
        stack.push(a / b);
        break;
      default: return null;
    }
  }
  if (stack.length !== 1) return null;
  return stack[0];
}

/** Вычисляет выражение. Возвращает число или null при ошибке/пустом вводе. */
export function evalExpression(input: string): number | null {
  if (!input.trim()) return null;
  const tokens = tokenize(input);
  if (!tokens || tokens.length === 0) return null;
  const rpn = toRpn(tokens);
  if (!rpn) return null;
  const result = evalRpn(rpn);
  if (result == null || !Number.isFinite(result)) return null;
  return Math.round(result * 100) / 100;
}

/** Есть ли в строке оператор (чтобы показать превью результата). */
export function looksLikeExpression(input: string): boolean {
  return /[+\-*/]/.test(input.replace(/^\s*-/, ''));
}
