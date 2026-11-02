/* Jenga-Code: original multistate HashLife implementation.
 * Canonical immutable quadtrees share equal regions. Cached center-half
 * evolution skips powers of two generations; caches are isolated per rule.
 */
class HashLife {
  constructor(rule = "B3/S23") {
    this.rule = rule;
    this.nodes = new Map();
    this.cache = new Map();
    this.zeros = [];
    this.nextId = 0;
    this.calls = 0;
    this.hits = 0;
    this.deadline = Infinity;
    this.maxNodes = 900000;
    this.wire = rule === "WireWorld";
    if (!this.wire) {
      const m = /^B([0-8]*)\/S([0-8]*)$/i.exec(rule);
      if (!m || m[1].includes("0"))
        throw Error(
          "This engine supports B/S rules without B0, and WireWorld.",
        );
      this.birth = new Set([...m[1]].map(Number));
      this.survive = new Set([...m[2]].map(Number));
    }
    this.leaves = Array.from({ length: this.wire ? 4 : 2 }, (_, state) => ({
      id: this.nextId++,
      level: 0,
      state,
      pop: state ? 1 : 0,
      counts: [state === 1 ? 1 : 0, state === 2 ? 1 : 0, state === 3 ? 1 : 0],
      minX: state ? 0 : Infinity,
      minY: state ? 0 : Infinity,
      maxX: state ? 0 : -Infinity,
      maxY: state ? 0 : -Infinity,
    }));
    this.root = this.empty(4);
    this.x = -8;
    this.y = -8;
    this.generation = 0;
  }
  empty(level) {
    if (!this.zeros[level])
      this.zeros[level] = level
        ? this.join(...Array(4).fill(this.empty(level - 1)))
        : this.leaves[0];
    return this.zeros[level];
  }
  join(a, b, c, d) {
    if (a.level !== b.level || a.level !== c.level || a.level !== d.level)
      throw Error("Invalid quadtree levels.");
    const key = [a.id, b.id, c.id, d.id].join(",");
    let node = this.nodes.get(key);
    if (node) return node;
    if (this.nodes.size > this.maxNodes)
      throw Error(
        "Engine memory limit reached. Undo or start a smaller pattern.",
      );
    const half = 2 ** a.level;
    node = {
      id: this.nextId++,
      level: a.level + 1,
      a,
      b,
      c,
      d,
      pop: a.pop + b.pop + c.pop + d.pop,
      counts: [0, 1, 2].map(
        (i) => a.counts[i] + b.counts[i] + c.counts[i] + d.counts[i],
      ),
      minX: Math.min(a.minX, b.minX + half, c.minX, d.minX + half),
      minY: Math.min(a.minY, b.minY, c.minY + half, d.minY + half),
      maxX: Math.max(a.maxX, b.maxX + half, c.maxX, d.maxX + half),
      maxY: Math.max(a.maxY, b.maxY, c.maxY + half, d.maxY + half),
    };
    this.nodes.set(key, node);
    return node;
  }
  expand() {
    const n = this.root,
      z = this.empty(n.level - 1),
      quarter = 2 ** (n.level - 1);
    if (n.level >= 45) throw Error("Coordinate range limit reached.");
    this.root = this.join(
      this.join(z, z, z, n.a),
      this.join(z, z, n.b, z),
      this.join(z, n.c, z, z),
      this.join(n.d, z, z, z),
    );
    this.x -= quarter;
    this.y -= quarter;
  }
  loadCells(cells) {
    if (!cells.length) {
      this.root = this.empty(4);
      this.x = this.y = -8;
      return;
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y, state] of cells) {
      if (
        !Number.isSafeInteger(x) ||
        !Number.isSafeInteger(y) ||
        !this.leaves[state] ||
        Math.abs(x) > 2 ** 43 ||
        Math.abs(y) > 2 ** 43
      )
        throw Error("Invalid pattern cell.");
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const level = Math.max(
      2,
      Math.ceil(Math.log2(Math.max(maxX - minX + 1, maxY - minY + 1))),
    );
    const build = (list, l, x, y) => {
      if (!list.length) return this.empty(l);
      if (!l) return this.leaves[list[list.length - 1][2]];
      const half = 2 ** (l - 1),
        q = [[], [], [], []];
      for (const c of list)
        q[(c[0] >= x + half ? 1 : 0) + (c[1] >= y + half ? 2 : 0)].push(c);
      return this.join(
        build(q[0], l - 1, x, y),
        build(q[1], l - 1, x + half, y),
        build(q[2], l - 1, x, y + half),
        build(q[3], l - 1, x + half, y + half),
      );
    };
    this.root = build(cells, level, minX, minY);
    this.x = minX;
    this.y = minY;
  }
  get(x, y, n = this.root, ox = this.x, oy = this.y) {
    const s = 2 ** n.level;
    if (x < ox || y < oy || x >= ox + s || y >= oy + s) return 0;
    if (!n.level) return n.state;
    const half = s / 2,
      right = x >= ox + half,
      bottom = y >= oy + half;
    return this.get(
      x,
      y,
      bottom ? (right ? n.d : n.c) : right ? n.b : n.a,
      ox + (right ? half : 0),
      oy + (bottom ? half : 0),
    );
  }
  set(x, y, state) {
    if (
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y) ||
      Math.abs(x) > 2 ** 43 ||
      Math.abs(y) > 2 ** 43
    )
      throw Error("Cell coordinate is out of range.");
    if (!this.leaves[state]) throw Error("Invalid cell state for this rule.");
    while (
      x < this.x ||
      y < this.y ||
      x >= this.x + 2 ** this.root.level ||
      y >= this.y + 2 ** this.root.level
    )
      this.expand();
    const edit = (n, ox, oy) => {
      if (!n.level) return this.leaves[state];
      const h = 2 ** (n.level - 1),
        r = x >= ox + h,
        b = y >= oy + h,
        k = b ? (r ? "d" : "c") : r ? "b" : "a",
        v = edit(n[k], ox + (r ? h : 0), oy + (b ? h : 0));
      return this.join(
        k === "a" ? v : n.a,
        k === "b" ? v : n.b,
        k === "c" ? v : n.c,
        k === "d" ? v : n.d,
      );
    };
    this.root = edit(this.root, this.x, this.y);
  }
  transition(state, neighbours) {
    if (this.wire) {
      if (state === 1) return 2;
      if (state === 2) return 3;
      if (state === 3) return neighbours === 1 || neighbours === 2 ? 1 : 3;
      return 0;
    }
    return (state ? this.survive : this.birth).has(neighbours) ? 1 : 0;
  }
  evolve(n, exponent) {
    if ((++this.calls & 2047) === 0 && performance.now() > this.deadline)
      throw Error("Calculation time limit reached. Try a smaller jump.");
    if (!n.pop) return this.empty(n.level - 1);
    const key = n.id + ":" + exponent,
      cached = this.cache.get(key);
    if (cached) {
      this.hits++;
      return cached;
    }
    let out;
    if (n.level === 2) {
      const cells = [];
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) cells.push(this.get(x, y, n, 0, 0));
      const v = [];
      for (let y = 1; y <= 2; y++)
        for (let x = 1; x <= 2; x++) {
          let count = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              if (dx || dy) count += cells[(y + dy) * 4 + x + dx] === 1 ? 1 : 0;
          v.push(this.leaves[this.transition(cells[y * 4 + x], count)]);
        }
      out = this.join(...v);
    } else {
      const { a, b, c, d } = n,
        J = (...v) => this.join(...v),
        nine = [
          a,
          J(a.b, b.a, a.d, b.c),
          b,
          J(a.c, a.d, c.a, c.b),
          J(a.d, b.c, c.b, d.a),
          J(b.c, b.d, d.a, d.b),
          c,
          J(c.b, d.a, c.d, d.c),
          d,
        ],
        e = Math.min(exponent, n.level - 3),
        r = nine.map((q) => this.evolve(q, e)),
        quarters = [
          J(r[0], r[1], r[3], r[4]),
          J(r[1], r[2], r[4], r[5]),
          J(r[3], r[4], r[6], r[7]),
          J(r[4], r[5], r[7], r[8]),
        ];
      out =
        exponent === n.level - 2
          ? J(...quarters.map((q) => this.evolve(q, e)))
          : J(...quarters.map((q) => J(q.a.d, q.b.c, q.c.b, q.d.a)));
    }
    this.cache.set(key, out);
    return out;
  }
  advancePower(exponent) {
    const time = 2 ** exponent;
    if (!Number.isSafeInteger(this.generation + time))
      throw Error("Generation number limit reached.");
    const snapshot = this.snapshot();
    try {
      if (!this.root.pop) {
        this.generation += time;
        return;
      }
      while (true) {
        const n = this.root,
          s = 2 ** n.level,
          q = s / 4;
        if (
          n.level >= exponent + 2 &&
          n.minX >= q + time &&
          n.minY >= q + time &&
          n.maxX < 3 * q - time &&
          n.maxY < 3 * q - time
        )
          break;
        this.expand();
      }
      const quarter = 2 ** (this.root.level - 2);
      this.deadline = performance.now() + 2500;
      this.root = this.evolve(this.root, exponent);
      this.x += quarter;
      this.y += quarter;
      this.generation += time;
    } catch (e) {
      this.restore(snapshot);
      throw e;
    } finally {
      this.deadline = Infinity;
    }
  }
  snapshot() {
    return {
      root: this.root,
      x: this.x,
      y: this.y,
      generation: this.generation,
    };
  }
  restore(s) {
    this.root = s.root;
    this.x = s.x;
    this.y = s.y;
    this.generation = s.generation;
  }
  bounds() {
    const n = this.root;
    return n.pop
      ? {
          x: this.x + n.minX,
          y: this.y + n.minY,
          w: n.maxX - n.minX + 1,
          h: n.maxY - n.minY + 1,
        }
      : { x: 0, y: 0, w: 1, h: 1 };
  }
  each(fn, limit = 1000000) {
    let count = 0;
    const visit = (n, x, y) => {
      if (!n.pop) return;
      if (!n.level) {
        if (++count > limit)
          throw Error(
            "This pattern has too many cells for this operation. Use macrocell export instead.",
          );
        fn(x, y, n.state);
        return;
      }
      const h = 2 ** (n.level - 1);
      visit(n.a, x, y);
      visit(n.b, x + h, y);
      visit(n.c, x, y + h);
      visit(n.d, x + h, y + h);
    };
    visit(this.root, this.x, this.y);
  }
}
if (typeof module !== "undefined") module.exports = HashLife;
