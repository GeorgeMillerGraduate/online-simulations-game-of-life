class PatternFormats {
  static rule(text, fallback = "B3/S23") {
    const r = String(text || fallback).trim();
    if (/^wireworld$/i.test(r)) return "WireWorld";
    if (/^life$/i.test(r)) return "B3/S23";
    if (/^B[1-8]*\/S[0-8]*$/i.test(r)) return r.toUpperCase();
    if (/^23\/3$/.test(r)) return "B3/S23";
    throw Error("Unsupported rule or bounded topology: " + r);
  }
  static read(text, name = "Imported pattern") {
    if (text.length > 30000000) throw Error("Pattern file exceeds 30 MB.");
    text = text.replace(/\r/g, "").trim();
    const lines = text.split("\n");
    let rule,
      body = "",
      format = "rle";
    if (text.startsWith("[M2]")) {
      rule = this.rule((lines.find((l) => /^#R\s/.test(l)) || "").slice(3));
      const h = new HashLife(rule),
        nodes = [null];
      let root = null;
      for (const raw of lines.slice(1)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        if (nodes.length > 400000)
          throw Error("Macrocell file has too many nodes.");
        let n;
        if (/^[.*$]+$/.test(line)) {
          if (h.wire)
            throw Error("Binary macrocell leaf in multistate pattern.");
          const states = Array(64).fill(0);
          let x = 0,
            y = 0;
          for (const c of line) {
            if (c === "$") {
              x = 0;
              y++;
            } else {
              if (x >= 8 || y >= 8) throw Error("Invalid macrocell leaf.");
              states[y * 8 + x++] = c === "*" ? 1 : 0;
            }
          }
          const build = (x, y, s) =>
            s === 1
              ? h.leaves[states[y * 8 + x]]
              : h.join(
                  build(x, y, s / 2),
                  build(x + s / 2, y, s / 2),
                  build(x, y + s / 2, s / 2),
                  build(x + s / 2, y + s / 2, s / 2),
                );
          n = build(0, 0, 8);
        } else {
          const v = line.split(/\s+/).map(Number);
          if (
            v.length !== 5 ||
            v.some((x) => !Number.isSafeInteger(x) || x < 0)
          )
            throw Error("Invalid macrocell record.");
          const [level, ...refs] = v;
          if (level < 1 || level > 44)
            throw Error("Macrocell level out of range.");
          const children = refs.map((i) =>
            level === 1 ? h.leaves[i] : i === 0 ? h.empty(level - 1) : nodes[i],
          );
          if (children.some((c) => !c || c.level !== level - 1))
            throw Error("Invalid macrocell reference.");
          n = h.join(...children);
        }
        nodes.push(n);
        root = n;
      }
      if (!root) root = h.empty(4);
      while (root.level < 2)
        root = h.join(
          root,
          h.empty(root.level),
          h.empty(root.level),
          h.empty(root.level),
        );
      h.root = root;
      h.x = h.y = 0;
      return {
        engine: h,
        name,
        description: lines.filter((l) => /^#/.test(l)).join("\n"),
        format: "mc",
      };
    }
    if (text.startsWith("#MCell")) {
      format = "mcl";
      const id = (lines.find((l) => l.startsWith("#GOLLY ")) || "").slice(7);
      rule = this.rule(id);
      if (rule !== "WireWorld")
        throw Error("Only WireWorld MCell files are supported.");
      if (lines.some((l) => /^#WRAP\s+1/.test(l)))
        throw Error("Wrapped MCell boards are not supported.");
      body = lines
        .filter((l) => l.startsWith("#L "))
        .map((l) => l.slice(3))
        .join("");
    } else if (text.startsWith("#Life 1.05") || text.startsWith("#Life 1.06")) {
      rule = "B3/S23";
      const h = new HashLife(rule);
      let ox = 0,
        oy = 0,
        y = 0,
        count = 0;
      for (const line of lines.slice(1)) {
        if (line.startsWith("#R")) rule = this.rule(line.slice(2).trim());
        if (line.startsWith("#P")) {
          [ox, oy] = line.slice(2).trim()
            ? line.slice(2).trim().split(/\s+/).map(Number)
            : [0, 0];
          y = 0;
        } else if (line.startsWith("#") || !line.trim()) continue;
        else if (text.startsWith("#Life 1.06")) {
          const v = line.trim().split(/\s+/).map(Number);
          if (v.length !== 2) throw Error("Invalid Life coordinates.");
          h.set(v[0], v[1], 1);
        } else {
          for (let x = 0; x < line.length; x++)
            if (line[x] === "*") {
              if (++count > 1000000) throw Error("Too many explicit cells.");
              h.set(ox + x, oy + y, 1);
            }
          y++;
        }
      }
      if (rule !== h.rule)
        throw Error("Only Conway Life coordinate files are supported.");
      return {
        engine: h,
        name,
        description: lines.filter((l) => l.startsWith("#")).join("\n"),
        format: "lif",
      };
    } else {
      const header = lines.find((l) => /^\s*x\s*=/i.test(l));
      if (!header)
        throw Error("Expected RLE, macrocell, WireWorld MCell or Life format.");
      const match = header.match(/rule\s*=\s*(.+)$/i);
      rule = this.rule(match ? match[1] : null);
      body = lines.filter((l) => l !== header && !/^\s*#/.test(l)).join("");
    }
    const h = new HashLife(rule);
    let x = 0,
      y = 0,
      count = "",
      cells = 0,
      ended = false,
      cellList = [];
    for (const c of body.replace(/\s/g, "")) {
      if (/[0-9]/.test(c)) {
        count += c;
        if (count.length > 10) throw Error("Run length too large.");
        continue;
      }
      const n = count ? Number(count) : 1;
      count = "";
      if (!Number.isSafeInteger(n) || n < 1 || n > 1000000000)
        throw Error("Invalid run length.");
      if (c === "!") {
        ended = true;
        break;
      }
      if (c === "$") {
        y += n;
        x = 0;
        continue;
      }
      let state;
      if (c === "b" || c === ".") state = 0;
      else if (c === "o") state = 1;
      else if (c >= "A" && c <= "C") state = c.charCodeAt(0) - 64;
      else throw Error("Unsupported state token: " + c);
      if (state) {
        if (cells + n > 1000000)
          throw Error(
            "More than one million explicit cells; use macrocell format.",
          );
        for (let i = 0; i < n; i++) cellList.push([x + i, y, state]);
        cells += n;
      }
      x += n;
    }
    h.loadCells(cellList);
    if (format === "rle" && !ended) throw Error("RLE pattern must end with !.");
    return {
      engine: h,
      name,
      description: lines.filter((l) => l.startsWith("#")).join("\n"),
      format,
    };
  }
  static writeRLE(h, name) {
    const cells = [];
    h.each((x, y, s) => cells.push({ x, y, s }), 500000);
    const b = h.bounds();
    cells.sort((a, b) => a.y - b.y || a.x - b.x);
    let x = 0,
      y = 0,
      body = "",
      last = "",
      run = 0;
    const append = (n, t) => {
      if (n <= 0) return;
      if (last === t) run += n;
      else {
        if (run) body += (run > 1 ? run : "") + last;
        last = t;
        run = n;
      }
    };
    for (const c of cells) {
      const cx = c.x - b.x,
        cy = c.y - b.y;
      if (cy > y) {
        append(cy - y, "$");
        x = 0;
        y = cy;
      }
      append(cx - x, "b");
      append(1, h.wire ? String.fromCharCode(64 + c.s) : "o");
      x = cx + 1;
    }
    if (run) body += (run > 1 ? run : "") + last;
    body += "!";
    const tokens = body.match(/\d*[A-Cob$!]/g) || ["!"];
    let wrapped = "",
      line = "";
    for (const t of tokens) {
      if (line.length + t.length > 68) {
        wrapped += line + "\n";
        line = "";
      }
      line += t;
    }
    return (
      "#N " +
      name.replace(/[\r\n]/g, " ") +
      "\nx = " +
      (cells.length ? b.w : 0) +
      ", y = " +
      (cells.length ? b.h : 0) +
      ", rule = " +
      h.rule +
      "\n" +
      wrapped +
      line +
      "\n"
    );
  }
  static writeMacro(h, name) {
    const records = [],
      ids = new Map();
    let root = h.root;
    while (root.level < 3)
      root = h.join(
        root,
        h.empty(root.level),
        h.empty(root.level),
        h.empty(root.level),
      );
    const emit = (n) => {
      if (!n.pop) return 0;
      if (ids.has(n.id)) return ids.get(n.id);
      let record;
      if (h.wire && n.level === 1)
        record = "1 " + [n.a, n.b, n.c, n.d].map((c) => c.state).join(" ");
      else if (!h.wire && n.level === 3) {
        record = "";
        for (let y = 0; y < 8; y++) {
          let row = "";
          for (let x = 0; x < 8; x++) row += h.get(x, y, n, 0, 0) ? "*" : ".";
          record += row.replace(/\.+$/, "") + "$";
        }
        record = record.replace(/\$+$/, "") || "$";
      } else {
        const refs = [n.a, n.b, n.c, n.d].map(emit);
        record = n.level + " " + refs.join(" ");
      }
      records.push(record);
      const id = records.length;
      ids.set(n.id, id);
      return id;
    };
    if (root.pop) emit(root);
    else records.push(h.wire ? "1 0 0 0 0" : "$");
    return (
      "[M2] (Jenga-Code Cellular Studio)\n#N " +
      name.replace(/[\r\n]/g, " ") +
      "\n#R " +
      h.rule +
      "\n" +
      records.join("\n") +
      "\n"
    );
  }
}
if (typeof module !== "undefined") module.exports = PatternFormats;
