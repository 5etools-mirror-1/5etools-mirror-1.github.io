"use strict";

class Ro_Token {
	constructor (type, value, asString, line) {
		this.type = type;
		this.value = value;
		this._asString = asString;
		this.line = line;
	}

	static _new (type, asString) { return new Ro_Token(type, null, asString); }

	/**
	 * Create a copy of this token, with additional line information.
	 * @param line The line of code.
	 */
	_ (line) { return new Ro_Token(this.type, this.value, this._asString, line); }

	eq (other) { return other && other.type === this.type; }

	toString () {
		if (this._asString) return this._asString;
		return this.toDebugString();
	}

	toDebugString () { return `${this.type}${this.value ? ` :: ${this.value}` : ""}`; }

	static NUMBER (val, line) { return new Ro_Token(Ro_Token.TYP_NUMBER, val, null, line); }
	static IDENTIFIER (val, line) { return new Ro_Token(Ro_Token.TYP_IDENTIFIER, val, null, line); }
	static DYNAMIC (val, line) { return new Ro_Token(Ro_Token.TYP_DYNAMIC, val, null, line); }
	static SYMBOL () {}
	static UNPARSED (val, line) { return new Ro_Token(Ro_Token.TYP_UNPARSED, val, null, line); }
}
Ro_Token.TYP_NUMBER = "NUMBER";
Ro_Token.TYP_IDENTIFIER = "IDENTIFIER";
Ro_Token.TYP_DYNAMIC = "DYNAMIC";
Ro_Token.TYP_SYMBOL = "SYMBOL"; // Cannot be created by lexing, only parsing
Ro_Token.TYP_UNPARSED = "UNPARSED"; // Only used when lexing in alternate modes
Ro_Token.NEWLINE = Ro_Token._new("NEWLINE", "&lt;newline&gt;");
Ro_Token.INDENT = Ro_Token._new("INDENT", "&lt;line_indent&gt;");
Ro_Token.DEDENT = Ro_Token._new("DEDENT", "&lt;line_dedent&gt;");
Ro_Token.PAREN_OPEN = Ro_Token._new("PAREN_OPEN", "(");
Ro_Token.PAREN_CLOSE = Ro_Token._new("PAREN_CLOSE", ")");
Ro_Token.IF = Ro_Token._new("IF", "if");
Ro_Token.ELSE = Ro_Token._new("ELSE", "else");
Ro_Token.ELIF = Ro_Token._new("ELIF", "elif");
Ro_Token.EQ = Ro_Token._new("EQ", "==");
Ro_Token.NE = Ro_Token._new("NE", "!=");
Ro_Token.GT = Ro_Token._new("GT", ">");
Ro_Token.LT = Ro_Token._new("LT", "<");
Ro_Token.GTEQ = Ro_Token._new("GTEQ", ">=");
Ro_Token.LTEQ = Ro_Token._new("LTEQ", "<=");
Ro_Token.NOT = Ro_Token._new("NOT", "not");
Ro_Token.ADD = Ro_Token._new("ADD", "+");
Ro_Token.SUB = Ro_Token._new("SUB", "-");
Ro_Token.MULT = Ro_Token._new("MULT", "*");
Ro_Token.DIV = Ro_Token._new("DIV", "/");
Ro_Token.POW = Ro_Token._new("POW", "^");
Ro_Token.COLON = Ro_Token._new("COLON", ":");
Ro_Token.ASSIGN = Ro_Token._new("ASSIGN", "=");

class Ro_Lexer {
	constructor () {
		this._indentStack = null;
		this._tokenStack = [];
	}

	/**
	 * @param ipt Input text.
	 * @param [opts] Options object.
	 * @param [opts.isDynamicsOnly] If the lexer should only return dynamic tokens, and leave the rest of the input as
	 * unparsed-type tokens.
	 */
	lex (ipt, opts) {
		opts = opts || {};

		const lines = ipt
			.trimRight()
			.split("\n")
			.map(it => it.trimRight())
			.filter(Boolean)
			.filter(it => !it.startsWith("#")) // remove comments
		;

		this._indentStack = [];
		this._tokenStack = [];

		for (const l of lines) {
			this._lexLine(l, opts);
			this._tokenStack.push(Ro_Token.NEWLINE._(l)); // program should always end in a newline
		}

		[...new Array(this._indentStack.length)].forEach(() => this._tokenStack.push(Ro_Token.DEDENT));

		return this._tokenStack;
	}

	_lexLine (l, opts) {
		opts = opts || {};

		let indent = 0;
		let isBOL = true;
		let token = "";
		let attribParenCount = 0;
		let parenCount = 0;
		let braceCount = 0;
		let mode = null;

		const outputToken = () => {
			if (token) {
				if (opts.isDynamicsOnly) {
					if (token.startsWith("@") || token.startsWith("(@")) this._tokenStack.push(Ro_Token.DYNAMIC(token, l));
					else this._tokenStack.push(Ro_Token.UNPARSED(token, l));
				} else {
					switch (token) {
						case "(": this._tokenStack.push(Ro_Token.PAREN_OPEN._(l)); break;
						case ")": this._tokenStack.push(Ro_Token.PAREN_CLOSE._(l)); break;
						case "if": this._tokenStack.push(Ro_Token.IF._(l)); break;
						case "else": this._tokenStack.push(Ro_Token.ELSE._(l)); break;
						case "elif": this._tokenStack.push(Ro_Token.ELIF._(l)); break;
						case "==": this._tokenStack.push(Ro_Token.EQ._(l)); break;
						case "!=": this._tokenStack.push(Ro_Token.NE._(l)); break;
						case ">": this._tokenStack.push(Ro_Token.GT._(l)); break;
						case "<": this._tokenStack.push(Ro_Token.LT._(l)); break;
						case ">=": this._tokenStack.push(Ro_Token.GTEQ._(l)); break;
						case "<=": this._tokenStack.push(Ro_Token.LTEQ._(l)); break;
						case "not": this._tokenStack.push(Ro_Token.NOT._(l)); break;
						case "+": case "--": this._tokenStack.push(Ro_Token.ADD._(l)); break;
						case "-": case "+-": case "-+": this._tokenStack.push(Ro_Token.SUB._(l)); break;
						case "*": this._tokenStack.push(Ro_Token.MULT._(l)); break;
						case "/": this._tokenStack.push(Ro_Token.DIV._(l)); break;
						case "^": this._tokenStack.push(Ro_Token.POW._(l)); break;
						case ":": this._tokenStack.push(Ro_Token.COLON._(l)); break;
						case "=": this._tokenStack.push(Ro_Token.ASSIGN._(l)); break;
						default: {
							if (token.startsWith("@") || token.startsWith("(@")) this._tokenStack.push(Ro_Token.DYNAMIC(token, l));
							else if (Ro_Lexer._M_IDENT.test(token)) this._tokenStack.push(Ro_Token.IDENTIFIER(token, l));
							else if (Ro_Lexer._M_NUMBER.test(token)) this._tokenStack.push(Ro_Token.NUMBER(token, l));
							else throw new Error(`Syntax error: unexpected token <code>${token}</code> (line <code>${l}</code>)`);
						}
					}
				}

				token = "";
			}
		};

		outer: for (let i = 0; i < l.length; ++i) {
			const c = l[i];
			const d = l[i + 1];

			// handle "beginning of line" case
			if (isBOL) {
				if (c === " " || c === "\t") indent++;
				else {
					isBOL = false;
					// If the indent has changed
					const lastIndent = this._indentStack.last();
					if (lastIndent != null) {
						if (indent > lastIndent) {
							this._indentStack.push(indent);
							this._tokenStack.push(Ro_Token.INDENT._(l));
						} else {
							// pop the stack until we find an opening indent that matches ours
							let nxtIndent;
							let dedentCount = 0;

							while (this._indentStack.length) {
								this._indentStack.pop();
								dedentCount++;
								nxtIndent = this._indentStack.last() || 0;
								if (nxtIndent === indent) break;
							}

							if (nxtIndent === indent) {
								[...new Array(dedentCount)].forEach(() => this._tokenStack.push(Ro_Token.DEDENT._(l)));
							} else {
								// we broke the loop without finding an indent partner; this is a syntax error
								throw new Error(`Syntax error: no matching indent found for line <code>${l}</code>`);
							}
						}
					} else {
						if (indent > 0) {
							this._indentStack.push(indent);
							this._tokenStack.push(Ro_Token.INDENT._(l));
						}
					}
				}
			}

			// handle everything else
			switch (c) {
				case "#": { // comments
					if (opts.isDynamicsOnly) {
						token += c;
						break;
					} else break outer;
				}
				case " ": {
					if (attribParenCount) token += c;
					else if (opts.isDynamicsOnly) token += c;
					else outputToken();
					break;
				}
				case ":": {
					if (attribParenCount) token += c;
					else if (opts.isDynamicsOnly) token += c;
					else {
						outputToken();
						token = c;
						outputToken();
					}
					break;
				}
				case "(":
					if (attribParenCount) {
						attribParenCount++;
						token += c;
					} else {
						if (d === "@") { // the start of a dynamic
							attribParenCount++;
							outputToken();
							token += c;
						} else { // the start of some parentheses
							if (opts.isDynamicsOnly) token += c;
							else {
								parenCount++;
								outputToken();
								token = "(";
								outputToken();
							}
						}
					}
					break;
				case ")":
					if (attribParenCount) {
						attribParenCount--;
						token += c;
						if (!attribParenCount) outputToken();
					} else if (opts.isDynamicsOnly) token += c;
					else {
						parenCount--;
						if (parenCount < 0) throw new Error(`Syntax error: closing <code>)</code> without opening <code>(</code> in line <code>${l}</code>`);
						outputToken();
						token = ")";
						outputToken();
					}
					break;
				case "{": {
					if (attribParenCount) token += c;
					else if (opts.isDynamicsOnly) token += c;
					else {
						braceCount++;
						outputToken();
						token = "{";
						outputToken();
					}
					break;
				}
				case "}": {
					if (attribParenCount) token += c;
					else if (opts.isDynamicsOnly) token += c;
					else {
						braceCount--;
						if (braceCount < 0) throw new Error(`Syntax error: closing <code>}</code> without opening <code>{</code> in line <code>${l}</code>`);
						outputToken();
						token = "}";
						outputToken();
					}
					break;
				}
				default: {
					if (attribParenCount) token += c;
					else if (opts.isDynamicsOnly) {
						if (c === "@" && token.last() !== "(") {
							outputToken();
							token = "@";
						} else token += c;
					} else {
						if (Ro_Lexer._M_TEXT_CHAR.test(c)) {
							if (mode === "symbol") outputToken();
							token += c;
							mode = "text";
						} else if (Ro_Lexer._M_SYMBOL_CHAR.test(c)) {
							if (mode === "text") outputToken();
							token += c;
							mode = "symbol";
						} else throw new Error(`Syntax error: unexpected character <code>${c}</code> in line <code>${l}</code>`);
					}
					break;
				}
			}
		}

		// empty the stack of any remaining content
		outputToken();
	}
}
Ro_Lexer._M_TEXT_CHAR = /[a-zA-Z0-9_@]/;
Ro_Lexer._M_SYMBOL_CHAR = /[-+/*^=!:><]/;

Ro_Lexer._M_NUMBER = /^\d+$/;
Ro_Lexer._M_IDENT = /^[a-zA-Z]\w*$/;

class Ro_Parser {
	constructor (lexed) {
		this._ixSym = -1;
		this._syms = lexed;
		this._sym = null;

		this._lastAccepted = null;
	}

	_nextSym () {
		const cur = this._syms[this._ixSym];
		this._ixSym++;
		this._sym = this._syms[this._ixSym];
		return cur;
	}

	_peek () { return this._syms[this._ixSym + 1]; }

	parse () {
		this._nextSym();
		return this._block();
	}

	_match (symbol) {
		if (this._sym == null) return false;
		if (symbol.type) symbol = symbol.type; // If it's a Ro_Token, convert it to its underlying type
		return this._sym.type === symbol;
	}

	_accept (symbol) {
		if (this._match(symbol)) {
			const out = this._sym;
			this._nextSym();
			this._lastAccepted = out;
			return out;
		}
		return false;
	}

	_expect (symbol) {
		const accepted = this._accept(symbol);
		if (accepted) return accepted;
		if (this._sym) throw new Error(`Unexpected input: Expected <code>${symbol}</code> but found <code>${this._sym}</code> (line <code>${this._sym.line}</code>)`);
		else throw new Error(`Unexpected end of input: Expected <code>${symbol}</code>`);
	}

	_factor () {
		if (this._accept(Ro_Token.TYP_IDENTIFIER)) return new Ro_Parser._Factor(this._lastAccepted);
		else if (this._accept(Ro_Token.TYP_NUMBER)) return new Ro_Parser._Factor(this._lastAccepted);
		else if (this._accept(Ro_Token.TYP_DYNAMIC)) return new Ro_Parser._Factor(this._lastAccepted);
		else if (this._accept(Ro_Token.PAREN_OPEN)) {
			const exp = this._expression();
			this._expect(Ro_Token.PAREN_CLOSE);
			return new Ro_Parser._Factor(exp, {hasParens: true});
		} else {
			if (this._sym) throw new Error(`Unexpected input: <code>${this._sym}</code> (line <code>${this._sym.line}</code>)`);
			else throw new Error(`Unexpected end of input (line <code>${this._sym.line}</code>)`);
		}
	}

	_exponent () {
		const children = [];
		children.push(this._factor());
		while (this._match(Ro_Token.POW)) {
			this._nextSym(); // don't bother pushing the "^" as we only deal with one operator type
			children.push(this._factor());
		}
		return new Ro_Parser._Exponent(children);
	}

	_term () {
		const children = [];
		children.push(this._exponent());
		while (this._match(Ro_Token.MULT) || this._match(Ro_Token.DIV)) {
			children.push(this._nextSym());
			children.push(this._exponent());
		}
		return new Ro_Parser._Term(children);
	}

	_expression () {
		const children = [];
		if (this._match(Ro_Token.ADD) || this._match(Ro_Token.SUB)) children.push(this._nextSym());
		children.push(this._term());
		while (this._match(Ro_Token.ADD) || this._match(Ro_Token.SUB)) {
			children.push(this._nextSym());
			children.push(this._term());
		}
		return new Ro_Parser._Expression(children);
	}

	_condition () {
		const children = [];
		if (this._match(Ro_Token.NOT)) children.push(this._nextSym());
		children.push(this._expression());
		// any expression can be evaluated as true/false, so the operator + second expression is optional
		if (this._match(Ro_Token.EQ) || this._match(Ro_Token.NE) || this._match(Ro_Token.GT) || this._match(Ro_Token.LT) || this._match(Ro_Token.GTEQ) || this._match(Ro_Token.LTEQ)) {
			children.push(this._nextSym());
			children.push(this._expression());
		}
		return new Ro_Parser._Condition(children);
	}

	_statement () {
		const children = [];

		if (this._match(Ro_Token.TYP_NUMBER) || this._match(Ro_Token.ADD) || this._match(Ro_Token.SUB) || this._match(Ro_Token.PAREN_OPEN)) { // e.g. `4` or `1 + 2` etc; all valid stage labels
			children.push(this._expression());
			this._expect(Ro_Token.NEWLINE);
		} else if (this._match(Ro_Token.TYP_IDENTIFIER)) {
			if (this._peek() === Ro_Token.ASSIGN) { // a = 1
				children.push(this._accept(Ro_Token.TYP_IDENTIFIER));
				this._expect(Ro_Token.ASSIGN);
				children.push(this._expression());
			} else { // a (a valid expression)
				children.push(this._expression());
			}
			this._expect(Ro_Token.NEWLINE);
		} else if (this._accept(Ro_Token.IF)) {
			children.push(this._lastAccepted);
			children.push(this._condition());
			this._expect(Ro_Token.COLON);

			if (this._accept(Ro_Token.NEWLINE)) {
				children.push(this._block());
			} else { // one-liner if
				children.push(this._statement());
			}

			while (this._accept(Ro_Token.ELIF)) {
				children.push(this._lastAccepted);
				children.push(this._condition());
				this._expect(Ro_Token.COLON);
				if (this._accept(Ro_Token.NEWLINE)) {
					children.push(this._block());
				} else { // one-liner elif
					children.push(this._statement());
				}
			}

			if (this._accept(Ro_Token.ELSE)) {
				children.push(this._lastAccepted);
				this._expect(Ro_Token.COLON);
				if (this._accept(Ro_Token.NEWLINE)) {
					children.push(this._block());
				} else { // one-liner else
					children.push(this._statement());
				}
			}
		} else throw new Error(`Syntax error: <code>${this._sym}</code> (line <code>${this._sym.line}</code>)`);

		return new Ro_Parser._Statement(children);
	}

	_block () {
		if (!this._syms.length) { // empty block
			return new Ro_Parser._Block([]);
		} else if (this._accept(Ro_Token.INDENT)) {
			const children = [];
			while (!this._match(Ro_Token.DEDENT)) {
				children.push(this._statement());
				if (this._match(Ro_Token.INDENT)) children.push(this._block());
			}
			this._expect(Ro_Token.DEDENT);
			return new Ro_Parser._Block(children);
		} else {
			// the root block
			const children = [];
			while (this._sym) {
				children.push(this._statement());
				if (this._match(Ro_Token.INDENT)) children.push(this._block());
			}
			return new Ro_Parser._Block(children);
		}
	}
}

Ro_Parser._AbstractSymbol = class {
	static _indent (str, depth) {
		return `${" ".repeat(depth * 2)}${str}`;
	}

	constructor () {
		this.type = Ro_Token.TYP_SYMBOL;
	}

	eq (symbol) { return symbol && this.type === symbol.type; }
	pEvl () { throw new Error("Unimplemented!"); }
	toString () { throw new Error("Unimplemented!"); }
};

Ro_Parser._Factor = class extends Ro_Parser._AbstractSymbol {
	/**
	 * @param node
	 * @param [opts]
	 * @param [opts.hasParens]
	 */
	constructor (node, opts) {
		super();
		opts = opts || {};
		this._node = node;
		this._hasParens = !!opts.hasParens;
	}

	pEvl (ctx, resolver) {
		switch (this._node.type) {
			case Ro_Token.TYP_IDENTIFIER: return {val: Number(ctx[this._node.value])};
			case Ro_Token.TYP_NUMBER: return {val: Number(this._node.value)};
			case Ro_Token.TYP_DYNAMIC: return Ro_Lang.pResolveDynamic(this._node, resolver);
			case Ro_Token.TYP_SYMBOL: return this._node.pEvl(ctx, resolver);
			default: throw new Error(`Unimplemented!`);
		}
	}

	toString (indent = 0) {
		let out;
		switch (this._node.type) {
			case Ro_Token.TYP_IDENTIFIER: out = this._node.value; break;
			case Ro_Token.TYP_NUMBER: out = this._node.value; break;
			case Ro_Token.TYP_DYNAMIC: out = `await Char_Lang.pResolveDynamic("${(this._node.value || "").replace(/"/g, `\\"`)}")`; break;
			case Ro_Token.TYP_SYMBOL: out = this._node.toString(indent); break;
			default: throw new Error(`Unimplemented!`);
		}
		return this._hasParens ? `(${out})` : out;
	}
};

Ro_Parser._Exponent = class extends Ro_Parser._AbstractSymbol {
	constructor (nodes) {
		super();
		this._nodes = nodes;
	}

	async pEvl (ctx, resolver) {
		// `3 ^ 3 ^ 2` is `3 ^ (3 ^ 2)`, not `(3 ^ 3) ^ 2`
		// i.e. unlike other operators, power is right-associative instead of left-
		const view = this._nodes.slice();
		const out = await view.pop().pEvl(ctx, resolver);
		if (out.isCancelled) return out;

		let tmp = null;
		while (view.length) {
			tmp = await view.pop().pEvl(ctx, resolver);
			if (tmp.isCancelled) return tmp;
			out.val = tmp.val ** out.val;
		}

		return out;
	}

	toString (indent = 0) {
		const view = this._nodes.slice();
		let out = view.pop().toString(indent);
		while (view.length) out = `${view.pop().toString(indent)} ** ${out}`;
		return out;
	}
};

Ro_Parser._Term = class extends Ro_Parser._AbstractSymbol {
	constructor (nodes) {
		super();
		this._nodes = nodes;
	}

	async pEvl (ctx, resolver) {
		const out = await this._nodes[0].pEvl(ctx, resolver);
		if (out.isCancelled) return out;

		let tmp;
		for (let i = 1; i < this._nodes.length; i += 2) {
			if (this._nodes[i].eq(Ro_Token.MULT)) {
				tmp = await this._nodes[i + 1].pEvl(ctx, resolver);
				if (tmp.isCancelled) return tmp;
				out.val *= tmp.val;
			} else if (this._nodes[i].eq(Ro_Token.DIV)) {
				tmp = await this._nodes[i + 1].pEvl(ctx, resolver);
				if (tmp.isCancelled) return tmp;
				out.val /= tmp.val;
			} else throw new Error(`Unimplemented!`);
		}

		return out;
	}

	toString (indent = 0) {
		let out = this._nodes[0].toString(indent);
		for (let i = 1; i < this._nodes.length; i += 2) {
			if (this._nodes[i].eq(Ro_Token.MULT)) out += ` * ${this._nodes[i + 1].toString(indent)}`;
			else if (this._nodes[i].eq(Ro_Token.DIV)) out += ` / ${this._nodes[i + 1].toString(indent)}`;
			else throw new Error(`Unimplemented!`);
		}
		return out;
	}
};

Ro_Parser._Expression = class extends Ro_Parser._AbstractSymbol {
	constructor (nodes) {
		super();
		this._nodes = nodes;
	}

	async pEvl (ctx, resolver) {
		const view = this._nodes.slice();

		let isNeg = false;
		if (view[0].eq(Ro_Token.ADD) || view[0].eq(Ro_Token.SUB)) {
			isNeg = view.shift().eq(Ro_Token.SUB);
		}

		const out = await view[0].pEvl(ctx, resolver);
		if (out.isCancelled) return out;
		if (isNeg) out.val = -out.val;

		let tmp;
		for (let i = 1; i < view.length; i += 2) {
			if (view[i].eq(Ro_Token.ADD)) {
				tmp = await view[i + 1].pEvl(ctx, resolver);
				if (tmp.isCancelled) return tmp;
				out.val += tmp.val;
			} else if (view[i].eq(Ro_Token.SUB)) {
				tmp = await view[i + 1].pEvl(ctx, resolver);
				if (tmp.isCancelled) return tmp;
				out.val -= tmp.val;
			} else throw new Error(`Unimplemented!`);
		}

		return out;
	}

	toString (indent = 0) {
		let out = "";
		const view = this._nodes.slice();

		let isNeg = false;
		if (view[0].eq(Ro_Token.ADD) || view[0].eq(Ro_Token.SUB)) {
			isNeg = view.shift().eq(Ro_Token.SUB);
			if (isNeg) out += "-";
		}

		out += view[0].toString(indent);
		for (let i = 1; i < view.length; i += 2) {
			if (view[i].eq(Ro_Token.ADD)) out += ` + ${view[i + 1].toString(indent)}`;
			else if (view[i].eq(Ro_Token.SUB)) out += ` - ${view[i + 1].toString(indent)}`;
			else throw new Error(`Unimplemented!`);
		}
		return out;
	}
};

Ro_Parser._Condition = class extends Ro_Parser._AbstractSymbol {
	constructor (nodes) {
		super();
		this._nodes = nodes;
		this._isNegated = this._nodes[0].eq(Ro_Token.NOT);
		this._cleanNodes = this._nodes.slice();
		if (this._isNegated) this._cleanNodes.shift();
	}

	async pEvl (ctx, resolver) {
		const out = {isCancelled: false, val: null};

		if (this._cleanNodes.length === 3) {
			const [lhs, op, rhs] = this._cleanNodes;
			const resultLhs = await lhs.pEvl(ctx, resolver);
			if (resultLhs.isCancelled) return resultLhs;
			const resultRhs = await rhs.pEvl(ctx, resolver);
			if (resultRhs.isCancelled) return resultRhs;
			switch (op.type) {
				case Ro_Token.EQ.type: out.val = resultLhs.val === resultRhs.val; break;
				case Ro_Token.NE.type: out.val = resultLhs.val !== resultRhs.val; break;
				case Ro_Token.GT.type: out.val = resultLhs.val > resultRhs.val; break;
				case Ro_Token.LT.type: out.val = resultLhs.val < resultRhs.val; break;
				case Ro_Token.GTEQ.type: out.val = resultLhs.val >= resultRhs.val; break;
				case Ro_Token.LTEQ.type: out.val = resultLhs.val <= resultRhs.val; break;
				default: throw new Error(`Unimplemented!`);
			}
		} else if (this._cleanNodes.length === 1) {
			const resultSub = await this._cleanNodes[0].pEvl(ctx, resolver);
			if (resultSub.isCancelled) return resultSub;
			out.val = resultSub.val;
		} else throw new Error(`Invalid node count!`);

		if (this._isNegated) out.val = !out.val;
		return out;
	}

	toString (indent = 0) {
		let out = "";

		if (this._cleanNodes.length === 3) {
			const [lhs, op, rhs] = this._nodes;
			const lhVal = lhs.toString(indent);
			const rhVal = rhs.toString(indent);
			switch (op.type) {
				case Ro_Token.EQ.type: out += `${lhVal} === ${rhVal}`; break;
				case Ro_Token.NE.type: out += `${lhVal} !== ${rhVal}`; break;
				case Ro_Token.GT.type: out += `${lhVal} > ${rhVal}`; break;
				case Ro_Token.LT.type: out += `${lhVal} < ${rhVal}`; break;
				case Ro_Token.GTEQ.type: out += `${lhVal} >= ${rhVal}`; break;
				case Ro_Token.LTEQ.type: out += `${lhVal} <= ${rhVal}`; break;
				default: throw new Error(`Unimplemented!`);
			}
		} else if (this._cleanNodes.length === 1) out += this._cleanNodes[0].toString(indent);
		else throw new Error(`Invalid node count!`);

		return this._isNegated ? `!${out}` : out;
	}
};

Ro_Parser._Statement = class extends Ro_Parser._AbstractSymbol {
	constructor (nodes) {
		super();
		this._nodes = nodes;
	}

	async pEvl (ctx, resolver) {
		switch (this._nodes[0].type) {
			case Ro_Token.TYP_SYMBOL: return this._nodes[0].pEvl(ctx, resolver);
			case Ro_Token.TYP_IDENTIFIER: {
				const [tokIdentifier, expression] = this._nodes;
				const result = await expression.pEvl(ctx, resolver);
				if (result.isCancelled) return result;
				ctx[tokIdentifier.value] = result.val;
				return result;
			}
			case Ro_Token.IF.type: return this._pEvl_pIfElse(ctx, resolver);
			default: throw new Error(`Unimplemented!`);
		}
	}

	async _pEvl_pIfElse (ctx, resolver) {
		const parts = [];

		for (let i = 0; i < this._nodes.length; ++i) {
			switch (this._nodes[i].type) {
				case Ro_Token.IF.type:
				case Ro_Token.ELIF.type: {
					parts.push({condition: this._nodes[i + 1], toEvl: this._nodes[i + 2]});
					i += 2;
					break;
				}
				case Ro_Token.ELSE.type: {
					parts.push({toEvl: this._nodes[i + 1]});
					i += 1; // (not really required since the "else" has to be the last block anyway)
					break;
				}
			}
		}

		// find the first of the if-elif-else where the condition is true
		//  (or the condition is null, i.e. for the "else" case)
		for (const part of parts) {
			if (part.condition == null) {
				return part.toEvl.pEvl(ctx, resolver);
			} else {
				const result = await part.condition.pEvl(ctx, resolver);
				if (result.isCancelled) return result;
				if (result.val) return part.toEvl.pEvl(ctx, resolver);
			}
		}
		return {isCancelled: false, val: null};
	}

	toString (indent = 0) {
		switch (this._nodes[0].type) {
			case Ro_Token.TYP_SYMBOL: return Ro_Parser._AbstractSymbol._indent(`return ${this._nodes[0].toString()}\n`, indent);
			case Ro_Token.TYP_IDENTIFIER: {
				const [tokIdentifier, expression] = this._nodes;
				return Ro_Parser._AbstractSymbol._indent(`var ${tokIdentifier.value} = ${expression.toString(indent)}\n`, indent);
			}
			case Ro_Token.IF.type: return this._toString_ifElse(indent);
			default: throw new Error(`Unimplemented!`);
		}
	}

	_toString_ifElse (indent) {
		let out = "";

		for (let i = 0; i < this._nodes.length; ++i) {
			switch (this._nodes[i].type) {
				case Ro_Token.IF.type:
				case Ro_Token.ELIF.type: {
					out += `${this._nodes[i].eq(Ro_Token.IF) ? "if " : "else if "}`;
					out += `(${this._nodes[i + 1].toString(indent)}) {\n`;
					out += `${this._nodes[i + 2].toString(indent + 1)}`;
					out += `}\n`;
					i += 2;
					break;
				}
				case Ro_Token.ELSE.type: {
					out += `else {\n`;
					out += `${this._nodes[i + 1].toString(indent + 1)}`;
					out += `}\n`;
					i += 1; // (not really required since the "else" has to be the last block anyway)
					break;
				}
			}
		}

		return out;
	}
};

Ro_Parser._Block = class extends Ro_Parser._AbstractSymbol {
	constructor (nodes) {
		super();
		this._nodes = nodes; // a list of statements/blocks
	}

	async pEvl (ctx, resolver) {
		// go through our child statements/blocks, and return the first value we find
		for (const node of this._nodes) {
			const result = await node.pEvl(ctx, resolver);
			if (result.isCancelled) return result;
			if (result.val != null) return result;
		}
		return {isCancelled: false, val: null};
	}

	toString (indent = 0) {
		return this._nodes.map(it => it.toString(indent)).join("");
	}
};

class Ro_Lang {
	/**
	 * Validate a program. Returns an error string on error, or null otherwise.
	 * @param ipt
	 * @param resolver Dynamic resolver.
	 */
	static async pValidate (ipt, resolver) {
		// region Lexing
		const lexer = new Ro_Lexer();
		let lexed;
		try {
			lexed = lexer.lex(ipt);
		} catch (e) {
			return e.message;
		}
		// endregion

		// region Dynamics
		for (const token of lexed) {
			if (token.type === Ro_Token.TYP_DYNAMIC) {
				try {
					await Ro_Lang.pResolveDynamic(token, resolver, {isValidateOnly: true});
				} catch (e) {
					return e.message;
				}
			}
		}
		// endregion

		// region Parsing
		const parser = new Ro_Parser(lexed);
		try {
			parser.parse();
		} catch (e) {
			return e.message;
		}
		// endregion

		return null;
	}

	static pRun (ipt, ctx, resolver) {
		const ctxCpy = MiscUtil.copyFast(ctx);
		const lexer = new Ro_Lexer();
		const lexed = lexer.lex(ipt);
		const parser = new Ro_Parser(lexed);
		const parsed = parser.parse();
		return parsed.pEvl(ctxCpy, resolver);
	}

	static async pResolveDynamics (ipt, resolver) {
		const lexer = new Ro_Lexer();
		const lexed = lexer.lex(ipt, {isDynamicsOnly: true});
		let out = "";
		for (const tkn of lexed) {
			switch (tkn.type) {
				case Ro_Token.TYP_UNPARSED: out += tkn.value; break;
				case Ro_Token.TYP_DYNAMIC: out += (await this.pResolveDynamic(tkn, resolver)).val; break;
				case Ro_Token.NEWLINE.type: out += "\n"; break;
				default: throw new Error(`Unhandled token type: ${tkn.type}`); // should never occur
			}
		}
		return out;
	}

	static async pValidateDynamics (ipt, resolver) {
		const lexer = new Ro_Lexer();
		const lexed = lexer.lex(ipt, {isDynamicsOnly: true});
		for (const tkn of lexed) {
			if (tkn.type === Ro_Token.TYP_DYNAMIC) {
				const msgInvalid = await this.pResolveDynamic(tkn, resolver, {isValidateOnly: true});
				if (msgInvalid) return msgInvalid;
			}
		}
		return null;
	}

	/**
	 * @param token The dynamic Ro_Token to resolve.
	 * @param resolver Dynamic name resolver. Should have a `.has()` method and a `.get()` method.
	 * @param [opts] Options object
	 * @param [opts.isValidateOnly] If the run should validate only, and avoid fetching data.
	 */
	static pResolveDynamic (token, resolver, opts) {
		opts = opts || {};

		const getInvalidMessage = (type) => `Unknown property: <code>${type}</code> (line <code>${token.line}</code>)`;

		const clean = token.value.replace(/^\(?@(.*?)\)?$/, "$1");
		const [type, ...labelParts] = clean.split("|").map(it => it.trim());
		while (labelParts.length && !labelParts.last()) labelParts.pop(); // pop empty strings from the end of the array
		switch (type) {
			case "user_int": return this._pResolveDynamic_getUserInt(token, labelParts, opts);
			case "user_bool": return this._pResolveDynamic_getUserBool(token, labelParts, opts);
			default: {
				if (opts.isValidateOnly) {
					if (resolver.has(type)) return null;
					else return getInvalidMessage(type);
				} else {
					if (resolver.has(type)) return {isCancelled: false, val: resolver.get(type)};
					throw new Error(getInvalidMessage(type));
				}
			}
		}
	}

	static async _pResolveDynamic_getUserInt (token, labelParts, opts) {
		opts = opts || {};
		const out = {isCancelled: false, val: null};

		if (labelParts.length <= 1) {
			if (opts.isValidateOnly) return;

			const nxtOpts = {int: true};
			if (labelParts.length) nxtOpts.title = labelParts[0].trim();
			const val = await InputUiUtil.pGetUserNumber(nxtOpts);
			if (val == null) out.isCancelled = true;
			else out.val = val;
		} else {
			// Format: ...|Window Title|1=Label One|2=Label Two|3|4|...
			const titlePart = labelParts[0].trim();

			const choices = labelParts.slice(1).map(it => {
				const spl = it.split("=").map(it => it.trim());

				const asNum = Number(spl[0]);
				if (isNaN(asNum)) throw new Error(`Syntax error: Option <code>${spl[0]}</code> was not a number (line <code>${token.line}</code>)`);

				if (spl.length === 1) return {label: asNum, val: asNum};
				else if (spl.length === 2) return {label: spl[1], val: asNum};
				else throw new Error(`Syntax error: option <code>${it}</code> was not formatted correctly (line ${token.line})`);
			});

			if (opts.isValidateOnly) return;

			const ixOut = await InputUiUtil.pGetUserEnum({
				fnDisplay: it => it.label,
				values: choices,
				title: titlePart,
			});

			if (ixOut == null) out.isCancelled = true;
			else out.val = choices[ixOut].val;
		}

		return out;
	}

	static async _pResolveDynamic_getUserBool (token, labelParts, opts) {
		opts = opts || {};
		const out = {isCancelled: false, val: null};

		if (labelParts.length <= 1) {
			if (opts.isValidateOnly) return;

			const nxtOpts = {};
			if (labelParts.length) nxtOpts.title = labelParts[0].trim();
			const val = await InputUiUtil.pGetUserBoolean(nxtOpts);
			if (val == null) out.isCancelled = true;
			else out.val = val;
		} else if (labelParts.length === 3) {
			// Format: ...|Window title|True Label|False Label
			if (opts.isValidateOnly) return;

			const nxtOpts = {
				title: labelParts[0].trim(),
				textYes: labelParts[1].trim(),
				textNo: labelParts[2].trim(),
			};

			const val = await InputUiUtil.pGetUserBoolean(nxtOpts);
			if (val == null) out.isCancelled = true;
			else out.val = val;
		} else {
			// Format: ...|Window title|true=Label One|false=Label Two|true|false|...
			const titlePart = labelParts[0].trim();

			const choices = labelParts.slice(1).map(it => {
				const spl = it.split("=").map(it => it.trim());

				const asBool = UiUtil.strToBool(spl[0], null);
				if (asBool == null) throw new Error(`Syntax error: Option <code>${spl[0]}</code> was not a boolean (line <code>${token.line}</code>`);

				if (spl.length === 1) return {label: asBool, val: asBool};
				else if (spl.length === 2) return {label: spl[1], val: asBool};
				else throw new Error(`Syntax error: option <code>${it}</code> was not formatted correctly (line ${token.line})`);
			});

			if (opts.isValidateOnly) return;

			const ixOut = await InputUiUtil.pGetUserEnum({
				fnDisplay: it => it.label,
				values: choices,
				title: titlePart,
			});

			if (ixOut == null) out.isCancelled = true;
			else out.val = choices[ixOut].val;
		}

		return out;
	}
}

export {Ro_Token, Ro_Lexer, Ro_Parser, Ro_Lang};
