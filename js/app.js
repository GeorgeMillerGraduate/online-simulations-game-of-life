document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id),
    canvas = $("universeCanvas"),
    view = new CellularViewport(canvas),
    undo = [],
    redo = [];
  let world = new HashLife("WireWorld"),
    catalogue = [],
    personal = [],
    selected = null,
    running = false,
    busy = false,
    cancel = false,
    timer = null,
    tool = "draw",
    state = 3,
    drag = null,
    loadTicket = 0,
    lastNote = "";
  const uid = () =>
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  const storageKey = "jenga-cellular-patterns-v2",
    rules = {
      "B3/S23": "Conway Life",
      WireWorld: "Wireworld",
      "B36/S23": "HighLife",
      "B2/S": "Seeds",
      "B3678/S34678": "Day & Night",
    };
  const notice = (text) => {
    $("status").textContent = text;
    lastNote = text;
  };
  function snapshot() {
    return {
      engine: world,
      ...world.snapshot(),
      name: selected?.name || "My pattern",
      selected,
    };
  }
  function capture() {
    undo.push(snapshot());
    if (undo.length > 24) undo.shift();
    redo.length = 0;
  }
  function restore(s) {
    world = s.engine;
    world.restore(s);
    selected = s.selected;
    syncRule();
    view.render(world);
    update();
  }
  function update() {
    const wire = world.wire;
    $("generation").textContent = world.generation.toLocaleString();
    $("populationLabel").textContent = wire ? "Active heads" : "Population";
    const n = wire ? world.root.counts[0] : world.root.pop;
    $("population").textContent =
      (Number.isSafeInteger(n) ? "" : "≈ ") + n.toLocaleString();
    $("engineLabel").textContent =
      $("engine").value === "hash"
        ? wire
          ? "Multistate HashLife"
          : "HashLife"
        : "Sparse";
    $("ruleLabel").textContent =
      (rules[world.rule] || world.rule) +
      " · " +
      (wire ? "4 states" : "2 states");
    $("zoomText").textContent =
      view.scale >= 0.01
        ? Math.round((view.scale / 12) * 100) + "%"
        : view.scale.toExponential(1) + " px/cell";
    $("undo").disabled = busy || !undo.length;
    $("redo").disabled = busy || !redo.length;
    $("pause").disabled = busy || !running;
    $("run").disabled = busy || running;
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.mode === world.rule)),
      );
    $("engineStats").textContent =
      world.nodes.size.toLocaleString() +
      " shared nodes · " +
      world.cache.size.toLocaleString() +
      " cached evolutions · " +
      world.hits.toLocaleString() +
      " cache hits";
    $("patternName").textContent =
      (selected?.name || "Untitled") +
      " · " +
      world.root.pop.toLocaleString() +
      " nonempty cells";
  }
  function render() {
    view.render(world);
    update();
  }
  function syncRule() {
    if (![...$("rule").options].some((o) => o.value === world.rule))
      $("rule").add(new Option(world.rule, world.rule));
    $("rule").value = world.rule;
    state = world.wire ? 3 : 1;
    const names = world.wire
        ? ["Empty", "Head", "Tail", "Wire"]
        : ["Empty", "Alive"],
      colours = world.wire
        ? ["#090d12", "#c4f3ff", "#f28d78", "#25435f"]
        : ["#131d25", "#fff5dc"];
    $("states").replaceChildren();
    names.forEach((name, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-pressed", String(i === state));
      const swatch = document.createElement("b");
      swatch.style.background = colours[i];
      b.append(swatch, document.createTextNode(name));
      b.onclick = () => {
        if (busy) return;
        state = i;
        setTool("draw");
        [...$("states").children].forEach((e, k) =>
          e.setAttribute("aria-pressed", String(k === i)),
        );
      };
      $("states").append(b);
    });
    $("canvasLegend").replaceChildren();
    names.slice(1).forEach((name, j) => {
      const span = document.createElement("span"),
        i = document.createElement("i");
      i.style.background = colours[j + 1];
      span.append(i, document.createTextNode(name));
      $("canvasLegend").append(span);
    });
  }
  function stop() {
    running = false;
    clearTimeout(timer);
    timer = null;
    update();
  }
  function lock(value) {
    busy = value;
    document.body.classList.toggle("is-busy", value);
    for (const id of [
      "step",
      "clear",
      "advance",
      "rule",
      "engine",
      "stride",
      "randomise",
      "confirmSave",
      "rotateLeft",
      "rotateRight",
      "flipX",
      "flipY",
      "savePattern",
      "export",
      "openFile",
      "openFolder",
      "downloadPattern",
    ])
      $(id).disabled = value;
    $("cancel").hidden = !value;
    update();
  }
  function sparse() {
    const cells = new Map();
    world.each((x, y, s) => cells.set(x + "," + y, s), 200000);
    const counts = new Map();
    for (const [k, s] of cells) {
      if (s !== 1) continue;
      const [x, y] = k.split(",").map(Number);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (dx || dy) {
            const key = x + dx + "," + (y + dy);
            counts.set(key, (counts.get(key) || 0) + 1);
          }
    }
    const out = [];
    for (const k of new Set([...cells.keys(), ...counts.keys()])) {
      const s = world.transition(cells.get(k) || 0, counts.get(k) || 0);
      if (s) {
        const [x, y] = k.split(",").map(Number);
        out.push([x, y, s]);
      }
    }
    const next = new HashLife(world.rule);
    next.loadCells(out);
    next.generation = world.generation + 1;
    world = next;
  }
  async function advance(total, save = true) {
    if (busy) return;
    stop();
    if (save) capture();
    cancel = false;
    lock(true);
    let done = 0;
    try {
      if (!Number.isSafeInteger(total) || total < 1 || total > 1e9)
        throw Error("Choose a whole-number jump from 1 to 1,000,000,000.");
      while (done < total && !cancel) {
        if ($("engine").value === "hash") {
          const e = Math.min(29, Math.floor(Math.log2(total - done)));
          world.advancePower(e);
          done += 2 ** e;
        } else {
          const batch = Math.min(20, total - done);
          for (let i = 0; i < batch; i++) {
            sparse();
            done++;
          }
        }
        render();
        notice(
          "Advanced " +
            done.toLocaleString() +
            " / " +
            total.toLocaleString() +
            " generations…",
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if ($("autoFit").checked) view.fit(world);
      notice(
        (cancel ? "Cancelled after " : "Advanced ") +
          done.toLocaleString() +
          " generations.",
      );
    } catch (e) {
      notice(
        e.message +
          " Last completed jump is retained; Undo restores the starting pattern.",
      );
    } finally {
      lock(false);
      render();
    }
  }
  async function tick() {
    if (!running || busy) return;
    try {
      const exp = +$("stride").value;
      if ($("engine").value === "hash") world.advancePower(exp);
      else sparse();
      render();
      timer = setTimeout(tick, 1000 / +$("speed").value);
    } catch (e) {
      stop();
      notice(e.message + " Try a smaller stride or sparse mode.");
    }
  }
  function start() {
    if (busy || running) return;
    capture();
    running = true;
    notice("Running " + (rules[world.rule] || world.rule) + ".");
    update();
    tick();
  }
  function setTool(value) {
    tool = value;
    document
      .querySelectorAll("[data-tool]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.tool === tool)),
      );
    canvas.style.cursor = tool === "move" ? "grab" : "crosshair";
  }
  function patternTree() {
    const q = $("search").value.toLowerCase(),
      filter = $("filter").value,
      items = [...catalogue, ...personal].filter(
        (p) =>
          (filter === "all" ||
            (filter === "mine" && p.personal) ||
            (filter === "wire" && p.rule === "WireWorld") ||
            (filter === "life" && p.rule === "B3/S23") ||
            (filter === "other" &&
              !["WireWorld", "B3/S23"].includes(p.rule))) &&
          (p.name + " " + p.folder).toLowerCase().includes(q),
      );
    $("catalogueCount").textContent =
      items.length + " patterns · names from source files";
    $("patternTree").replaceChildren();
    const root = { children: new Map(), patterns: [], contains: false };
    for (const p of items) {
      const path = (
        p.personal
          ? p.folder === "My patterns"
            ? "My patterns"
            : "My patterns/" + (p.folder || "Saved")
          : p.folder
      ).split("/");
      let node = root;
      for (const part of path) {
        if (!node.children.has(part))
          node.children.set(part, {
            children: new Map(),
            patterns: [],
            contains: false,
          });
        node = node.children.get(part);
        if (p === selected) node.contains = true;
      }
      node.patterns.push(p);
    }
    const build = (node, parent) => {
      for (const [name, child] of [...node.children].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const d = document.createElement("details");
        d.className = "folder";
        d.open = !!q || child.contains || name === "WireWorld";
        const summary = document.createElement("summary");
        summary.textContent = "▱ " + name;
        const div = document.createElement("div");
        build(child, div);
        d.append(summary, div);
        parent.append(d);
      }
      for (const p of node.patterns.sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        const button = document.createElement("button");
        button.className = "pattern-link";
        button.textContent = "▯ " + p.name;
        button.title = p.rule + " · " + (p.source || "Saved in this browser");
        button.setAttribute("aria-current", String(p === selected));
        button.onclick = () => loadPattern(p);
        parent.append(button);
      }
    };
    build(root, $("patternTree"));
    if (!items.length) $("patternTree").textContent = "No matching patterns.";
  }
  async function textFromFile(file) {
    if (file.size > 30000000) throw Error("File exceeds 30 MB.");
    if (file.name.endsWith(".gz")) {
      if (typeof DecompressionStream === "undefined")
        throw Error("This browser cannot open gzip files. Unzip it first.");
      const reader = file
        .stream()
        .pipeThrough(new DecompressionStream("gzip"))
        .getReader();
      let length = 0,
        chunks = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 30000000) {
          await reader.cancel();
          throw Error("Decompressed file exceeds 30 MB.");
        }
        chunks.push(value);
      }
      return new Blob(chunks).text();
    }
    return file.text();
  }
  async function loadPattern(p) {
    if (busy) return;
    stop();
    const ticket = ++loadTicket;
    notice("Opening " + p.name + "…");
    lock(true);
    try {
      let text = p.text;
      if (!text) {
        const response = await fetch(p.file);
        if (!response.ok)
          throw Error(
            "Could not fetch pattern file (" + response.status + ").",
          );
        text = await response.text();
      }
      const parsed = PatternFormats.read(text, p.name);
      if (ticket !== loadTicket) return;
      capture();
      world = parsed.engine;
      selected = p;
      syncRule();
      view.fit(world);
      $("description").textContent =
        parsed.description || "No description supplied.";
      notice(p.name + " · " + world.rule + " loaded.");
      patternTree();
    } catch (e) {
      notice("Could not open " + p.name + ": " + e.message);
    } finally {
      lock(false);
      render();
    }
  }
  function savePersonal() {
    localStorage.setItem(storageKey, JSON.stringify(personal));
  }
  async function imports(files, folders = false) {
    if (busy) return;
    stop();
    lock(true);
    let imported = 0,
      errors = [];
    for (const file of files) {
      if (!/\.(rle|mc|mcl|lif)(\.gz)?$/i.test(file.name)) continue;
      try {
        const text = await textFromFile(file),
          name = file.name.replace(/\.(rle|mc|mcl|lif)(\.gz)?$/i, ""),
          parsed = PatternFormats.read(text, name),
          parts = (file.webkitRelativePath || "").split("/"),
          p = {
            name,
            rule: parsed.engine.rule,
            folder: folders
              ? parts.slice(0, -1).join("/") || "Imported"
              : "Imported",
            text,
            personal: true,
            id: uid(),
          };
        personal.push(p);
        try {
          savePersonal();
        } catch (e) {
          personal.pop();
          throw Error(
            "Browser storage is full. Export or remove stored files before importing more.",
          );
        }
        imported++;
      } catch (e) {
        errors.push(file.name + ": " + e.message);
      }
    }
    patternTree();
    notice(
      "Imported " +
        imported +
        " pattern" +
        (imported === 1 ? "" : "s") +
        (errors.length
          ? ". " + errors.length + " skipped; see Pattern details."
          : "."),
    );
    if (errors.length) $("description").textContent = errors.join("\n");
    lock(false);
  }
  function download(name, text) {
    const u = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
  }
  $("run").onclick = start;
  $("pause").onclick = () => {
    stop();
    notice("Paused.");
  };
  $("step").onclick = () => {
    if (busy) return;
    stop();
    capture();
    try {
      if ($("engine").value === "hash") world.advancePower(0);
      else sparse();
      render();
      notice("Advanced one generation.");
    } catch (e) {
      notice(e.message);
    }
  };
  $("advance").onclick = () => advance(Number($("jump").value));
  $("cancel").onclick = () => {
    cancel = true;
    notice("Cancelling after the current power-of-two calculation…");
  };
  $("clear").onclick = () => {
    if (busy) return;
    stop();
    capture();
    world = new HashLife(world.rule);
    selected = null;
    render();
    notice("Universe cleared.");
  };
  $("undo").onclick = () => {
    if (busy || !undo.length) return;
    stop();
    redo.push(snapshot());
    restore(undo.pop());
    notice("Undone.");
  };
  $("redo").onclick = () => {
    if (busy || !redo.length) return;
    stop();
    undo.push(snapshot());
    restore(redo.pop());
    notice("Redone.");
  };
  $("rule").onchange = () => {
    if (busy) return;
    stop();
    capture();
    world = new HashLife($("rule").value);
    selected = null;
    syncRule();
    render();
    notice(
      "New " + world.rule + " universe. Choose a pattern from the catalogue.",
    );
  };
  document.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (busy) return;
        const mode = b.dataset.mode;
        if (mode === "WireWorld") {
          const p = catalogue.find(
            (p) => p.file === "patterns/WireWorld/gate-XOR.mcl",
          );
          if (p) await loadPattern(p);
        } else {
          const p = catalogue.find(
            (p) => p.file === "patterns/Life/Guns/period-52-glider-gun.rle",
          );
          if (p) await loadPattern(p);
          else {
            $("rule").value = mode;
            $("rule").dispatchEvent(new Event("change"));
          }
        }
      }),
  );
  $("speed").oninput = () =>
    ($("speedValue").textContent = $("speed").value + " FPS");
  $("engine").onchange = () => {
    stop();
    if ($("engine").value === "sparse") $("stride").value = "0";
    render();
    notice("Engine changed. Sparse mode advances one generation per frame.");
  };
  $("grid").onchange = () => {
    view.grid = $("grid").checked;
    render();
  };
  $("colourHistory").onchange = () => {
    view.colourHistory = $("colourHistory").checked;
    view.history.clear();
    render();
  };
  $("theme").onchange = () => {
    view.theme = $("theme").value;
    render();
  };
  $("fit").onclick = () => {
    view.fit(world);
    render();
  };
  $("zoomIn").onclick = () => {
    view.zoom(1.4);
    render();
  };
  $("zoomOut").onclick = () => {
    view.zoom(1 / 1.4);
    render();
  };
  document
    .querySelectorAll("[data-tool]")
    .forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
  function paint(p) {
    if (view.scale < 1) {
      notice("Zoom in to edit individual cells.");
      return;
    }
    const value = tool === "erase" ? 0 : state;
    try {
      if (drag?.last) {
        const n = Math.max(
          Math.abs(p.x - drag.last.x),
          Math.abs(p.y - drag.last.y),
        );
        if (n > 5000) throw Error("Paint stroke too long; zoom in.");
        for (let i = 0; i <= n; i++)
          world.set(
            Math.round(
              drag.last.x + ((p.x - drag.last.x) * i) / Math.max(1, n),
            ),
            Math.round(
              drag.last.y + ((p.y - drag.last.y) * i) / Math.max(1, n),
            ),
            value,
          );
      } else world.set(p.x, p.y, value);
      if (drag) drag.last = p;
      render();
    } catch (e) {
      notice(e.message);
    }
  }
  canvas.onpointerdown = (e) => {
    if (busy) return;
    e.preventDefault();
    stop();
    const moving = tool === "move" || e.button === 1;
    drag = { moving, cx: e.clientX, cy: e.clientY, last: null };
    canvas.setPointerCapture(e.pointerId);
    if (!moving) {
      capture();
      paint(view.cell(e.clientX, e.clientY));
    }
  };
  canvas.onpointermove = (e) => {
    const p = view.cell(e.clientX, e.clientY);
    $("coordinates").textContent =
      p.x.toLocaleString() + ", " + p.y.toLocaleString();
    if (!drag) return;
    if (drag.moving) {
      view.x -= (e.clientX - drag.cx) / view.scale;
      view.y -= (e.clientY - drag.cy) / view.scale;
      drag.cx = e.clientX;
      drag.cy = e.clientY;
      render();
    } else paint(p);
  };
  canvas.onpointerup = canvas.onpointercancel = () => {
    drag = null;
  };
  canvas.onwheel = (e) => {
    e.preventDefault();
    view.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
    render();
  };
  canvas.addEventListener("wheel", (e) => e.preventDefault(), {
    passive: false,
  });
  canvas.ondblclick = () => {
    view.fit(world);
    render();
  };
  function transform(kind) {
    if (busy) return;
    stop();
    try {
      const b = world.bounds(),
        cells = [];
      world.each((x, y, s) => {
        x -= b.x;
        y -= b.y;
        let p =
          kind === "right"
            ? [b.h - 1 - y, x]
            : kind === "left"
              ? [y, b.w - 1 - x]
              : kind === "x"
                ? [b.w - 1 - x, y]
                : [x, b.h - 1 - y];
        cells.push([p[0], p[1], s]);
      }, 300000);
      const next = new HashLife(world.rule);
      next.loadCells(cells);
      next.generation = world.generation;
      capture();
      world = next;
      view.fit(world);
      render();
      notice("Whole pattern transformed.");
    } catch (e) {
      notice(e.message);
    }
  }
  $("rotateLeft").onclick = () => transform("left");
  $("rotateRight").onclick = () => transform("right");
  $("flipX").onclick = () => transform("x");
  $("flipY").onclick = () => transform("y");
  $("fullscreen").onclick = async () => {
    try {
      await document.querySelector(".canvas-frame").requestFullscreen();
    } catch {
      notice("Fullscreen is unavailable in this browser.");
    }
  };
  $("openFile").onclick = () => $("fileInput").click();
  $("openFolder").onclick = () => $("folderInput").click();
  $("fileInput").onchange = async (e) => {
    await imports(e.target.files);
    e.target.value = "";
  };
  $("folderInput").onchange = async (e) => {
    await imports(e.target.files, true);
    e.target.value = "";
  };
  $("search").oninput = patternTree;
  $("filter").onchange = patternTree;
  $("export").onclick = () => {
    stop();
    $("exportName").value = selected?.name || "My pattern";
    $("exportDialog").showModal();
  };
  $("downloadPattern").onclick = () => {
    try {
      const name = $("exportName").value.trim() || "My pattern",
        mc = $("exportFormat").value === "mc",
        text = mc
          ? PatternFormats.writeMacro(world, name)
          : PatternFormats.writeRLE(world, name);
      download(
        name.replace(/[^a-z0-9_-]+/gi, "-") + "." + (mc ? "mc" : "rle"),
        text,
      );
      notice("Pattern file exported.");
      $("exportDialog").close();
    } catch (e) {
      notice(e.message);
    }
  };
  $("png").onclick = () => {
    view.render(world);
    canvas.toBlob((b) => {
      if (!b) return;
      const u = URL.createObjectURL(b),
        a = document.createElement("a");
      a.href = u;
      a.download = "cellular-studio-" + world.generation + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 5000);
    });
  };
  $("savePattern").onclick = () => {
    if (busy) return;
    stop();
    $("saveName").value = selected?.name || "My pattern";
    $("saveDialog").showModal();
  };
  $("confirmSave").onclick = () => {
    const name = $("saveName").value.trim();
    if (!name) {
      $("saveName").focus();
      return;
    }
    try {
      const text = PatternFormats.writeMacro(world, name),
        p = {
          name,
          rule: world.rule,
          folder: $("saveFolder").value.trim() || "My patterns",
          text,
          personal: true,
          id: uid(),
        };
      personal.push(p);
      try {
        savePersonal();
      } catch (e) {
        personal.pop();
        throw Error("Browser storage is full; use Export instead.");
      }
      selected = p;
      patternTree();
      $("saveDialog").close();
      notice("Pattern saved in this browser.");
    } catch (e) {
      notice(e.message);
    }
  };
  $("randomise").onclick = () => {
    if (busy) return;
    stop();
    capture();
    const width = Math.max(
        4,
        Math.min(150, Math.floor(+$("randomSize").value) || 50),
      ),
      density = +$("randomDensity").value / 100,
      cells = [];
    for (let y = 0; y < width; y++)
      for (let x = 0; x < width; x++)
        if (Math.random() < density) cells.push([x, y, world.wire ? 3 : 1]);
    world = new HashLife(world.rule);
    world.loadCells(cells);
    selected = null;
    view.fit(world);
    render();
    notice("Random field generated.");
  };
  document.addEventListener("keydown", (e) => {
    if (
      /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
      $("saveDialog").open ||
      $("exportDialog").open
    )
      return;
    if (e.key === "Escape") {
      cancel = true;
      stop();
      return;
    }
    if (busy) return;
    if (e.code === "Space") {
      e.preventDefault();
      running ? stop() : start();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      $("step").click();
    } else if (e.key === "+" || e.key === "=") $("zoomIn").click();
    else if (e.key === "-") $("zoomOut").click();
    else if (e.key.toLowerCase() === "f") $("fit").click();
    else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      (e.shiftKey ? $("redo") : $("undo")).click();
    }
  });
  new ResizeObserver(() => render()).observe(canvas);
  document.addEventListener("fullscreenchange", () => render());
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(raw))
      personal = raw
        .filter(
          (p) =>
            typeof p.name === "string" &&
            typeof p.text === "string" &&
            p.text.length <= 30000000,
        )
        .map((p) => ({ ...p, personal: true }));
    if (!localStorage.getItem(storageKey)) {
      const old = JSON.parse(
        localStorage.getItem("jenga-life-patterns-v1") || "[]",
      );
      if (Array.isArray(old))
        for (const p of old) {
          if (!Array.isArray(p.cells) || p.cells.length > 500000) continue;
          try {
            const h = new HashLife("B3/S23");
            h.loadCells(p.cells.map(([x, y]) => [x, y, 1]));
            personal.push({
              name: String(p.name || "Imported"),
              folder: String(p.folder || "My patterns"),
              rule: "B3/S23",
              personal: true,
              id: uid(),
              text: PatternFormats.writeMacro(h, p.name || "Imported"),
            });
          } catch {}
        }
      if (personal.length) savePersonal();
    }
  } catch {
    notice("Browser storage is unavailable; file import/export still works.");
  }
  syncRule();
  render();
  try {
    const response = await fetch("patterns/index.json");
    if (!response.ok)
      throw Error("Catalogue request failed: " + response.status);
    catalogue = await response.json();
    patternTree();
    const initial = catalogue.find(
      (p) => p.file === "patterns/WireWorld/gate-XOR.mcl",
    );
    if (initial) await loadPattern(initial);
  } catch (e) {
    notice(
      "Catalogue unavailable. Serve this folder through HTTP/HTTPS and keep the patterns directory. " +
        e.message,
    );
  }
});
