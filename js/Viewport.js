class CellularViewport {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.x = 0;
    this.y = 0;
    this.scale = 12;
    this.theme = "dark";
    this.history = new Map();
    this.colourHistory = true;
    this.historyGeneration = -1;
    this.historyWorld = null;
    this.grid = true;
    this.dpr = 1;
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * this.dpr)),
      h = Math.max(1, Math.round(r.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }
  cell(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: Math.floor((clientX - r.left - r.width / 2) / this.scale + this.x),
      y: Math.floor((clientY - r.top - r.height / 2) / this.scale + this.y),
    };
  }
  zoom(factor, cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    cx = cx ?? r.left + r.width / 2;
    cy = cy ?? r.top + r.height / 2;
    const before = {
      x: (cx - r.left - r.width / 2) / this.scale + this.x,
      y: (cy - r.top - r.height / 2) / this.scale + this.y,
    };
    this.scale = Math.max(1e-11, Math.min(70, this.scale * factor));
    this.x = before.x - (cx - r.left - r.width / 2) / this.scale;
    this.y = before.y - (cy - r.top - r.height / 2) / this.scale;
  }
  fit(h) {
    const b = h.bounds(),
      r = this.canvas.getBoundingClientRect();
    this.x = b.x + b.w / 2;
    this.y = b.y + b.h / 2;
    this.scale = Math.max(
      1e-11,
      Math.min(32, Math.min((r.width - 55) / b.w, (r.height - 55) / b.h)),
    );
  }
  render(h) {
    this.resize();
    const c = this.ctx,
      w = this.canvas.width,
      H = this.canvas.height,
      d = this.dpr,
      s = this.scale * d,
      dark = this.theme === "dark",
      bg = h.wire ? "#090d12" : dark ? "#131d25" : "#292724",
      colours = h.wire
        ? [bg, "#c4f3ff", "#f28d78", "#25435f"]
        : [bg, "#fff5dc"];
    if (this.historyWorld !== h || h.generation < this.historyGeneration ||
        (h.generation === this.historyGeneration && this.historyRoot !== h.root)) {
      this.history.clear();
    }
    const fresh = h.generation !== this.historyGeneration || this.historyWorld !== h;
    this.historyWorld = h;
    this.historyGeneration = h.generation;
    this.historyRoot = h.root;
    c.fillStyle = bg;
    c.fillRect(0, 0, w, H);
    const ox = w / 2 - this.x * s,
      oy = H / 2 - this.y * s;
    // Trails are display samples, not a reconstruction of skipped generations.
    if (this.colourHistory && !h.wire && s >= 2) {
      c.fillStyle = "#415a65";
      for (const [key, record] of this.history) {
        const [x, y] = key.split(",").map(Number);
        const px = ox + x * s, py = oy + y * s;
        if (px + s < 0 || py + s < 0 || px > w || py > H) continue;
        if (!h.get(x, y)) c.fillRect(Math.floor(px), Math.floor(py), Math.ceil(s), Math.ceil(s));
      }
    }
    if (this.grid && s >= 8) {
      c.strokeStyle = dark ? "#26343e" : "#403d36";
      c.lineWidth = 1;
      c.beginPath();
      for (let px = ((ox % s) + s) % s; px < w; px += s) {
        c.moveTo(Math.floor(px) + 0.5, 0);
        c.lineTo(Math.floor(px) + 0.5, H);
      }
      for (let py = ((oy % s) + s) % s; py < H; py += s) {
        c.moveTo(0, Math.floor(py) + 0.5);
        c.lineTo(w, Math.floor(py) + 0.5);
      }
      c.stroke();
    }
    const draw = (n, x, y) => {
      if (!n.pop) return;
      const size = 2 ** n.level,
        pw = size * s,
        px = ox + x * s,
        py = oy + y * s;
      if (px + pw < 0 || py + pw < 0 || px > w || py > H) return;
      if (!n.level || pw < 1.2) {
        const state = n.level
          ? n.counts[0]
            ? 1
            : n.counts[1]
              ? 2
              : 3
          : n.state;
        c.fillStyle = colours[state] || colours[1];
        if (!h.wire && !n.level && this.colourHistory && s >= 2) {
          const key = x + "," + y;
          let record = this.history.get(key);
          if (!record) {
            record = { visits: 0 };
            this.history.set(key, record);
          }
          if (fresh) record.visits++;
          c.fillStyle = record.visits < 3 ? "#fff5dc" : record.visits < 12 ? "#f2d48d" : "#9fe5d9";
          if (this.history.size > 100000) this.history.delete(this.history.keys().next().value);
        }
        const gap = pw >= 5 ? Math.min(d * 0.4, pw * 0.08) : 0;
        c.fillRect(
          Math.floor(px + gap),
          Math.floor(py + gap),
          Math.max(1, Math.ceil(pw - gap * 2)),
          Math.max(1, Math.ceil(pw - gap * 2)),
        );
        return;
      }
      const half = size / 2;
      draw(n.a, x, y);
      draw(n.b, x + half, y);
      draw(n.c, x, y + half);
      draw(n.d, x + half, y + half);
    };
    draw(h.root, h.x, h.y);
  }
}
