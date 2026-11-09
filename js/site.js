(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function remember(key, value) {
    try { localStorage.setItem("snail." + key, value); } catch (e) { /* storage blocked */ }
  }
  function recall(key) {
    try { return localStorage.getItem("snail." + key); } catch (e) { return null; }
  }

  function shotSrcset(name, widths) {
    return widths.map(w => `/img/shots/${name}-${w}.webp ${w}w`).join(", ");
  }

  // Everything that follows the scroll runs from one listener, once a frame
  const onScroll = [];
  let ticking = false;
  function scrolled() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; onScroll.forEach(f => f()); });
  }
  window.addEventListener("scroll", scrolled, { passive: true });
  window.addEventListener("resize", scrolled);
  const afterLoad = [];
  window.addEventListener("load", () => setTimeout(() => afterLoad.forEach(f => f()), 1200));

  // Top bar: takes the tone of the section under it, and marks the section in view
  const bar = document.querySelector("[data-bar]");
  if (bar) {
    const toned = [...document.querySelectorAll("[data-tone]")];
    onScroll.push(() => {
      const y = 32;
      const under = toned.find(el => { const r = el.getBoundingClientRect(); return r.top <= y && r.bottom > y; });
      bar.classList.toggle("on-dark", !!under && under.dataset.tone === "dark");
      bar.classList.toggle("at-top", window.scrollY < 8);
    });
    const links = [...bar.querySelectorAll(".bar-links a")];
    const sections = links.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
    if ("IntersectionObserver" in window) {
      const seen = new Map();
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => seen.set(e.target, e.isIntersecting));
        const current = sections.find(s => seen.get(s));
        links.forEach(a => a.setAttribute("aria-current", String(!!current && a.getAttribute("href") === "#" + current.id)));
      }, { rootMargin: "-45% 0px -50% 0px" });
      sections.forEach(s => io.observe(s));
    }
  }

  // Hero: the rooms, the headline that names them, and the pull-back from the 3D view to the app
  const hero = document.querySelector("[data-hero]");
  if (hero) {
    const stage = hero.querySelector(".hero-stage");
    const shot = hero.querySelector("[data-hero-shot]");
    const win = hero.querySelector("[data-hero-window]");
    const copy = hero.querySelector("[data-hero-copy]");
    const place = hero.querySelector("[data-place]");
    const pick = hero.querySelector(".rooms-pick");
    const buttons = [...hero.querySelectorAll("[data-room]")];
    const images = [...win.querySelectorAll("img")];
    const glows = [...hero.querySelectorAll("[data-glow] span")];
    const caption = hero.querySelector("[data-room-caption]");
    const ROOMS = [
      ["3d-library", "in the library.", "Walnut board, boxwood pieces."],
      ["3d-park", "in the park.", "Marble board and pieces, on navy felt."],
      ["3d-room", "on an old PC.", "The game on an old computer, under a desk lamp."],
      ["3d-mars", "on Mars.", "Folded paper pieces on an ebony board."],
      ["3d-goo", "anywhere.", "Goo pieces on etched glass."],
    ];
    const CYCLE = 5200;
    let room = 0;

    const load = i => {
      const img = images[i];
      if (img.dataset.src) {
        img.srcset = shotSrcset(img.dataset.src, [800, 1400, 2400]);
        img.sizes = "(min-width: 900px) 173vw, 94vw";
        img.src = `/img/shots/${img.dataset.src}-1400.webp`;
        delete img.dataset.src;
      }
      if (!glows[i].style.backgroundImage) glows[i].style.backgroundImage = `url(/img/shots/${ROOMS[i][0]}-800.webp)`;
    };

    // the place in the headline changes a letter at a time
    let wording = 0;
    function letters(text) {
      place.textContent = "";
      return [...text].map(ch => {
        const s = document.createElement("span");
        s.textContent = ch === " " ? " " : ch;
        s.style.display = "inline-block";
        place.appendChild(s);
        return s;
      });
    }
    function setPlace(text) {
      const id = ++wording;
      if (reduced || !place.animate) { place.textContent = text; return; }
      const old = [...place.querySelectorAll("span")];
      const outs = old.map((s, k) => s.animate(
        [{ transform: "none", opacity: 1 }, { transform: "translateY(-0.32em) rotate(-4deg)", opacity: 0 }],
        { duration: 200, delay: k * 12, easing: "cubic-bezier(.5, 0, .9, .4)", fill: "forwards" }));
      Promise.all(outs.map(a => a.finished)).catch(() => {}).then(() => {
        if (id !== wording) return;
        letters(text).forEach((s, k) => s.animate(
          [{ transform: "translateY(0.4em) rotate(5deg)", opacity: 0 }, { transform: "none", opacity: 1 }],
          { duration: 520, delay: k * 22, easing: "cubic-bezier(.2, .8, .25, 1.15)", fill: "backwards" }));
      });
    }
    letters(place.textContent);

    function choose(i, opts = {}) {
      room = i;
      buttons.forEach((b, k) => {
        b.setAttribute("aria-checked", String(k === i));
        b.tabIndex = k === i ? 0 : -1;
      });
      load(i);
      images.forEach((img, k) => img.classList.toggle("is-on", k === i));
      glows.forEach((g, k) => g.classList.toggle("is-on", k === i));
      // only announce rooms someone picked, not the ones that change on their own
      caption.setAttribute("aria-live", opts.byUser ? "polite" : "off");
      caption.textContent = ROOMS[i][2];
      setPlace(ROOMS[i][1]);
      if (opts.focus) buttons[i].focus();
      if (opts.byUser) stopCycling();
      else restartFill();
    }

    // Rooms change on their own until someone picks one. The pill's fill is the timer.
    let cycling = !reduced;
    let hovering = false, visible = true;
    hero.style.setProperty("--cycle", CYCLE + "ms");
    function restartFill() {
      if (!cycling) return;
      hero.classList.remove("is-cycling");
      void hero.offsetWidth;
      hero.classList.add("is-cycling");
    }
    function stopCycling() { cycling = false; hero.classList.remove("is-cycling"); }
    function pauseCheck() { hero.classList.toggle("is-paused", hovering || !visible || pick.contains(document.activeElement)); }
    pick.addEventListener("animationend", e => { if (cycling && e.animationName === "fill") choose((room + 1) % buttons.length); });
    pick.addEventListener("pointerenter", () => { hovering = true; pauseCheck(); });
    pick.addEventListener("pointerleave", () => { hovering = false; pauseCheck(); });
    pick.addEventListener("focusin", pauseCheck);
    pick.addEventListener("focusout", () => setTimeout(pauseCheck));
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; pauseCheck(); }, { threshold: 0.15 }).observe(stage);
    }

    buttons.forEach((b, i) => {
      b.tabIndex = i === 0 ? 0 : -1;
      b.addEventListener("click", () => choose(i, { byUser: true }));
      b.addEventListener("keydown", e => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        choose((i + step + buttons.length) % buttons.length, { focus: true, byUser: true });
      });
    });
    // fetch the other rooms once the page has settled, so switching is instant
    afterLoad.push(() => images.forEach((_, i) => load(i)));
    restartFill();

    // The 3D view inside each screenshot, as fractions of it
    const VIEW = { x0: 0.004, y0: 0.08, x1: 0.574, y1: 0.995 };
    const zoomable = window.matchMedia("(min-width: 900px) and (min-aspect-ratio: 5/4) and (prefers-reduced-motion: no-preference)");
    let geo = null;

    function layout() {
      const on = zoomable.matches;
      hero.classList.toggle("is-zoom", on);
      if (!on) {
        geo = null;
        shot.removeAttribute("style");
        win.removeAttribute("style");
        copy.classList.remove("is-gone");
        ["--copy", "--scrim", "--glow"].forEach(p => hero.style.removeProperty(p));
        return;
      }
      const vw = stage.clientWidth, vh = stage.clientHeight;
      const gutter = clamp(vw * 0.04, 16, 40);
      const top0 = 64 + 20, bottom0 = 32 + 42 + 24;
      const space = vh - top0 - bottom0;
      const w = Math.min(1240, vw - 2 * gutter, space * 1.6), h = w / 1.6;
      const left = (vw - w) / 2, top = top0 + (space - h) / 2;
      // how much bigger the window has to be for its 3D view to cover the screen
      const S = Math.max(vw / ((VIEW.x1 - VIEW.x0) * w), vh / ((VIEW.y1 - VIEW.y0) * h)) * 1.02;
      const cx = (VIEW.x0 + VIEW.x1) / 2 * w * S, cy = (VIEW.y0 + VIEW.y1) / 2 * h * S;
      geo = { S, tx: vw / 2 - left - cx, ty: vh / 2 - top - cy };
      Object.assign(shot.style, { left: left + "px", top: top + "px", width: w + "px", height: h + "px" });
      win.style.width = w * S + "px";
      win.style.setProperty("--S", S);
    }

    let faded = false;
    function update() {
      if (!geo) return;
      const r = hero.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, hero.offsetHeight - stage.clientHeight));
      const e = ease(clamp(p / 0.8));
      const s = geo.S + (1 - geo.S) * e;
      win.style.transform = `translate3d(${geo.tx * (1 - e)}px, ${geo.ty * (1 - e)}px, 0) scale(${s / geo.S})`;
      const c = clamp(1 - p / 0.28);
      hero.style.setProperty("--copy", c.toFixed(3));
      hero.style.setProperty("--scrim", clamp(1 - e * 1.5).toFixed(3));
      hero.style.setProperty("--glow", e.toFixed(3));
      faded = c < 0.98;
      copy.classList.toggle("is-gone", c === 0);
    }
    // someone tabbing to the hero buttons while they're fading gets taken back up to them
    copy.addEventListener("focusin", () => { if (geo && faded) window.scrollTo({ top: hero.offsetTop, behavior: "smooth" }); });

    layout();
    update();
    onScroll.push(update);
    let resizing = 0;
    window.addEventListener("resize", () => { cancelAnimationFrame(resizing); resizing = requestAnimationFrame(() => { layout(); update(); }); });
    zoomable.addEventListener("change", () => { layout(); update(); });
  }

  // Analysis tour: the screenshot stays put and zooms to whatever step is in the middle of the screen
  const tour = document.querySelector("[data-tour]");
  if (tour) {
    const steps = [...tour.querySelectorAll(".tour-step")];
    const imgs = [...tour.querySelectorAll(".tour-view img")];
    const stageEl = tour.querySelector(".tour-stage");
    const cap = tour.querySelector("[data-tour-cap]");
    const firstCap = cap.textContent;
    const stacked = window.matchMedia("(max-width: 999px)");
    let current = -1;

    function zoomFor(box) {
      const [x0, y0, x1, y1] = box.split(" ").map(Number);
      const s = clamp(Math.min(1 / (x1 - x0), 1 / (y1 - y0)) * 0.94, 1, 2.5);
      const tx = clamp(0.5 - (x0 + x1) / 2 * s, 1 - s, 0) * 100;
      const ty = clamp(0.5 - (y0 + y1) / 2 * s, 1 - s, 0) * 100;
      return `translate(${tx}%, ${ty}%) scale(${s})`;
    }
    function show(i) {
      if (i === current) return;
      current = i;
      const st = steps[i];
      steps.forEach((s, k) => s.classList.toggle("is-on", k === i));
      imgs.forEach(img => {
        const on = img.dataset.shot === st.dataset.shot;
        img.classList.toggle("is-on", on);
        if (on) img.style.transform = reduced ? "" : zoomFor(st.dataset.zoom);
      });
      cap.textContent = st.dataset.cap || firstCap;
    }
    onScroll.push(() => {
      // the line a step's heading has to cross: just below mid-screen, or mid-way down what's left under the pinned shot
      const vh = window.innerHeight;
      const line = stacked.matches ? (stageEl.getBoundingClientRect().bottom + vh) / 2 : vh * 0.62;
      let i = 0;
      steps.forEach((s, k) => { if (s.firstElementChild.getBoundingClientRect().top < line) i = k; });
      show(i);
    });
    show(0);
  }

  // Live board: the real piece sets and board colours from the app
  const SETS = [
    { group: "Standard", items: [["classic", "Classic"]] },
    { group: "Stylised", items: [["studio", "Studio"], ["folded", "Origami"], ["facet", "Facet"], ["vitrail", "Vitrail"], ["tribal", "Tribal"]] },
    { group: "Minimal", items: [["letters", "Letters"], ["shapes", "Shapes"], ["checker", "Checker"], ["tokens", "Tokens"], ["blindfold", "Blindfold"]] },
    { group: "Animated", items: [["blunder", "Blunder"]] },
  ];
  const PALETTES = [
    { group: "Basic", items: [["sage", "Sage", "#EEF0E3", "#A2B5A5"], ["walnut", "Walnut", "#EEE0CA", "#B28B6A"], ["slate", "Slate", "#E1E7E8", "#8C9DA6"], ["sand", "Sand", "#F1E8D7", "#C3B18B"], ["brown", "Brown", "#F0D9B5", "#B58863"], ["blue", "Blue", "#DEE3E6", "#8CA2AD"], ["green", "Green", "#EEEED2", "#769656"], ["plum", "Plum", "#EDE4F0", "#9B7FAE"]] },
    { group: "Wood, stone and glass", items: [["maple", "Maple and walnut", "#E8CA9C", "#74482A"], ["ebony", "Ebony and box", "#E9D29E", "#241B16"], ["cherry", "Cherry", "#E8B88A", "#8A3A24"], ["marble", "Marble", "#EEEDEA", "#8C939B"], ["lapis", "Lapis", "#E8E8E4", "#1C3F8E"], ["onyx", "Onyx", "#EBDDC0", "#1A1A1E"], ["light-glass", "Light glass", "#E2EEEB", "#7DB3AB"], ["dark-glass", "Dark glass", "#E6B46C", "#3A3050"]] },
    { group: "Theme", items: [["circuit", "Circuit", "#8A9BB0", "#26344A"], ["goo", "Goo", "#D6ECCB", "#5E9A55"], ["paper", "Paper", "#EFE7D6", "#9C9385"]] },
  ];
  const MOODS = { blunder: true };

  const studio = document.querySelector("[data-studio]");
  if (studio && window.SNAIL_GAME) {
    const game = window.SNAIL_GAME;
    const boardEl = studio.querySelector("[data-board]");
    const nowEl = studio.querySelector("[data-now]");
    const movesEl = studio.querySelector("[data-moves]");
    const setsEl = studio.querySelector("[data-sets]");
    const palEl = studio.querySelector("[data-palettes]");
    const playEl = studio.querySelector("[data-play]");
    const allSets = SETS.flatMap(g => g.items);
    const allPalettes = PALETTES.flatMap(g => g.items);

    let set = allSets.some(s => s[0] === recall("set")) ? recall("set") : "classic";
    let palette = allPalettes.some(p => p[0] === recall("palette")) ? recall("palette") : "sage";
    let at = 47; // just after 24. Rxd4
    const files = "abcdefgh";

    // 64 squares, a8 first. --i counts out from a1, so changes sweep across the board from there.
    const squares = {};
    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const sq = document.createElement("div");
        const name = files[f] + (r + 1);
        sq.className = "sq" + ((f + r) % 2 === 0 ? " dk" : "");
        sq.style.setProperty("--i", f + r);
        if (f === 0) sq.insertAdjacentHTML("beforeend", `<span class="co co-rank">${r + 1}</span>`);
        if (r === 0) sq.insertAdjacentHTML("beforeend", `<span class="co co-file">${files[f]}</span>`);
        squares[name] = sq;
        boardEl.appendChild(sq);
      }
    }

    function readFen(fen) {
      const out = {};
      fen.split("/").forEach((row, i) => {
        let f = 0;
        for (const ch of row) {
          if (/\d/.test(ch)) { f += Number(ch); continue; }
          const color = ch === ch.toUpperCase() ? "w" : "b";
          out[files[f] + (8 - i)] = color + ch.toUpperCase();
          f++;
        }
      });
      return out;
    }

    function pieceFile(code, square, check) {
      if (MOODS[set]) {
        if (code[1] === "K" && square === check) return `${code}-checked`;
        if (code === "wP" && square[1] === "7") return "wP-promoting";
        if (code === "bP" && square[1] === "2") return "bP-promoting";
      }
      return code;
    }

    function moveLabel(n) {
      if (n === 0) return "Starting position";
      const p = game.plies[n - 1];
      const num = Math.ceil(n / 2);
      return n % 2 === 1 ? `${num}. ${p.san}` : `${num}... ${p.san}`;
    }

    // Each draw cancels the piece flips still waiting from a set change
    let waveId = 0;

    function draw(animate, wave) {
      const id = ++waveId;
      const fen = at === 0 ? game.start : game.plies[at - 1].fen;
      const last = at === 0 ? null : game.plies[at - 1];
      const pieces = readFen(fen);
      for (const name in squares) {
        const sq = squares[name];
        sq.classList.toggle("moved", !!last && (name === last.from || name === last.to));
        sq.classList.toggle("check", !!last && name === last.check);
        const old = sq.querySelector(".pc");
        const code = pieces[name];
        if (!code) { if (old) old.remove(); continue; }
        const file = pieceFile(code, name, last && last.check);
        const src = `/pieces/${set}/${file}.svg`;
        if (old && old.getAttribute("src") === src) continue;
        if (old && wave) {
          // turn the piece over, and swap it while it's edge-on
          const delay = Number(sq.style.getPropertyValue("--i")) * 34;
          old.animate([
            { transform: "perspective(400px) rotateY(0)" },
            { transform: "perspective(400px) rotateY(90deg)", offset: 0.5 },
            { transform: "perspective(400px) rotateY(0)" },
          ], { duration: 440, delay, easing: "ease-in-out" });
          setTimeout(() => { if (id === waveId) old.src = src; }, delay + 220);
          continue;
        }
        const img = old || document.createElement("img");
        img.className = "pc";
        img.alt = "";
        img.draggable = false;
        img.src = src;
        if (!old) sq.appendChild(img);
      }
      if (animate && last && !reduced) {
        const img = squares[last.to].querySelector(".pc");
        const df = files.indexOf(last.from[0]) - files.indexOf(last.to[0]);
        const dr = Number(last.to[1]) - Number(last.from[1]);
        img.classList.remove("slide");
        img.style.transform = `translate(${df * 108.7}%, ${dr * 108.7}%)`;
        img.getBoundingClientRect();
        img.classList.add("slide");
        img.style.transform = "";
      }
      nowEl.textContent = moveLabel(at);
      boardEl.setAttribute("aria-label", `Chess board, Kasparov against Topalov, after ${moveLabel(at)}`);
      movesEl.querySelectorAll("button").forEach(b => {
        const on = Number(b.dataset.ply) === at;
        b.setAttribute("aria-current", String(on));
        if (on) {
          const top = b.offsetTop - movesEl.offsetTop;
          if (top < movesEl.scrollTop || top > movesEl.scrollTop + movesEl.clientHeight - 30) movesEl.scrollTop = top - movesEl.clientHeight / 2;
        }
      });
    }

    function go(n) {
      n = Math.max(0, Math.min(game.plies.length, n));
      if (n === at) return;
      const forward = n === at + 1;
      at = n;
      draw(forward);
    }

    // play through the game; any other move control stops it
    let playing = 0;
    function stop() {
      clearInterval(playing);
      playing = 0;
      playEl.setAttribute("aria-pressed", "false");
      playEl.setAttribute("aria-label", "Play through the game");
    }
    playEl.addEventListener("click", () => {
      if (playing) return stop();
      if (at === game.plies.length) go(0);
      playEl.setAttribute("aria-pressed", "true");
      playEl.setAttribute("aria-label", "Pause");
      playing = setInterval(() => { if (at >= game.plies.length) stop(); else go(at + 1); }, 850);
    });
    const userGo = n => { stop(); go(n); };

    // move list, like the app's moves panel
    for (let i = 0; i < game.plies.length; i += 2) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="num">${i / 2 + 1}</span>` +
        `<button type="button" data-ply="${i + 1}">${game.plies[i].san}</button>` +
        (game.plies[i + 1] ? `<button type="button" data-ply="${i + 2}">${game.plies[i + 1].san}</button>` : "<span></span>");
      movesEl.appendChild(li);
    }
    movesEl.addEventListener("click", e => {
      const b = e.target.closest("button[data-ply]");
      if (b) userGo(Number(b.dataset.ply));
    });

    studio.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => {
      const kind = b.dataset.step;
      userGo(kind === "first" ? 0 : kind === "back" ? at - 1 : kind === "next" ? at + 1 : game.plies.length);
    }));
    boardEl.tabIndex = 0;
    boardEl.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") { e.preventDefault(); userGo(at + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); userGo(at - 1); }
      if (e.key === "Home") { e.preventDefault(); userGo(0); }
      if (e.key === "End") { e.preventDefault(); userGo(game.plies.length); }
    });

    // piece sets: fetch the new set first, so every piece has something to flip to
    function wearSet(word) {
      set = word;
      remember("set", word);
      markSets();
      if (reduced) return draw(false);
      const codes = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"];
      const names = MOODS[word] ? codes.concat(["wK-checked", "bK-checked", "wP-promoting", "bP-promoting"]) : codes;
      const ready = names.map(f => { const im = new Image(); im.src = `/pieces/${word}/${f}.svg`; return im.decode ? im.decode().catch(() => {}) : null; });
      Promise.all(ready).then(() => { if (set === word) draw(false, true); });
    }
    const setLegend = setsEl.closest("fieldset").querySelector("legend");
    SETS.forEach(g => {
      const shelf = document.createElement("div");
      shelf.className = "shelf";
      shelf.innerHTML = `<span class="shelf-name">${g.group}</span><div class="shelf-items"></div>`;
      g.items.forEach(([word, label]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "set-btn";
        b.dataset.set = word;
        // blindfold pieces are invisible on purpose, so its button gets an empty outline instead
        const icon = word === "blindfold" ? `<span class="blind"></span>` : `<img src="/pieces/${word}/wN.svg" alt="" width="30" height="30" loading="lazy">`;
        b.innerHTML = `${icon}<span>${label}</span>`;
        b.addEventListener("click", () => { if (word !== set) wearSet(word); });
        shelf.lastElementChild.appendChild(b);
      });
      setsEl.appendChild(shelf);
    });
    function markSets() {
      setsEl.querySelectorAll("[data-set]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.set === set)));
      setLegend.innerHTML = `Pieces <span>${allSets.find(s => s[0] === set)[1]}</span>`;
    }

    // board colours
    const palLegend = palEl.closest("fieldset").querySelector("legend");
    PALETTES.forEach(g => {
      const shelf = document.createElement("div");
      shelf.className = "shelf";
      shelf.innerHTML = `<span class="shelf-name">${g.group}</span><div class="shelf-items"></div>`;
      g.items.forEach(([word, label, light, dark]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "swatch";
        b.dataset.palette = word;
        b.title = label;
        b.setAttribute("aria-label", label);
        b.style.setProperty("--l", light);
        b.style.setProperty("--d", dark);
        b.addEventListener("click", () => { palette = word; remember("palette", word); markPalette(); });
        shelf.lastElementChild.appendChild(b);
      });
      palEl.appendChild(shelf);
    });
    function markPalette() {
      const p = allPalettes.find(x => x[0] === palette);
      boardEl.style.setProperty("--light", p[2]);
      boardEl.style.setProperty("--dark", p[3]);
      palEl.querySelectorAll("[data-palette]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.palette === palette)));
      palLegend.innerHTML = `Board <span>${p[1]}</span>`;
    }

    markSets();
    markPalette();
    draw(false);
    // colour changes sweep across the board, but not the first paint
    requestAnimationFrame(() => requestAnimationFrame(() => boardEl.classList.add("is-ready")));
  }

  // Themes: the band wears the colours of the theme you pick, taken from the app's own screenshots
  const THEMES = [
    ["Porcelain", "analysis-porcelain", "#E9ECE6", "#1D2622", "#3D658C", false, "Porcelain, with the Sage board."],
    ["Charcoal", "backdrop-concrete", "#222326", "#E9EAEC", "#95B8DC", true, "Charcoal, with a lapis board on concrete."],
    ["After hours", "theme-after-hours", "#1C2823", "#E4ECE6", "#C4A1C7", true, "After hours, with an onyx board."],
    ["Goo", "theme-goo", "#192E25", "#E3EEE6", "#4FD69A", true, "Goo, with a glossy green board."],
    ["Paper", "theme-paper", "#E2DDD3", "#3A3128", "#9A6944", false, "Paper, with a folded paper board."],
    ["Circuit", "theme-circuit", "#0F1725", "#E2EAF6", "#3D8BFF", true, "Circuit, with a glowing circuit board."],
  ];
  const themes = document.querySelector("[data-themes]");
  if (themes) {
    const pickEl = themes.querySelector("[data-theme-pick]");
    const view = themes.querySelector("[data-theme-view]");
    const capEl = themes.querySelector("[data-theme-cap]");
    const imgs = THEMES.map(([name, shot]) => {
      const img = document.createElement("img");
      img.width = 2400;
      img.height = 1500;
      img.alt = `The ${name} theme.`;
      img.dataset.src = shot;
      view.appendChild(img);
      return img;
    });
    const load = img => {
      if (!img.dataset.src) return;
      img.srcset = shotSrcset(img.dataset.src, [800, 1400, 2400]);
      img.sizes = "(min-width: 1320px) 1240px, 94vw";
      img.src = `/img/shots/${img.dataset.src}-1400.webp`;
      delete img.dataset.src;
    };
    const buttons = THEMES.map(([name, , bg, , accent], i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.innerHTML = `<span class="dot" aria-hidden="true"></span>${name}`;
      b.querySelector(".dot").style.cssText = `--dot-bg: ${bg}; --dot-accent: ${accent}`;
      b.addEventListener("click", () => wear(i));
      b.addEventListener("keydown", e => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        wear((i + step + THEMES.length) % THEMES.length, true);
      });
      pickEl.appendChild(b);
      return b;
    });
    function wear(i, focus) {
      const [, , bg, ink, accent, dark, cap] = THEMES[i];
      themes.style.setProperty("--t-bg", bg);
      themes.style.setProperty("--t-ink", ink);
      themes.style.setProperty("--t-soft", ink + "AA");
      themes.style.setProperty("--t-accent", accent);
      themes.dataset.tone = dark ? "dark" : "light";
      buttons.forEach((b, k) => { b.setAttribute("aria-checked", String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      load(imgs[i]);
      imgs.forEach((img, k) => img.classList.toggle("is-on", k === i));
      capEl.textContent = cap;
      if (focus) buttons[i].focus();
      scrolled();
    }
    wear(3);
    afterLoad.push(() => imgs.forEach(load));
  }

  // Effects: embers off the king in check, on b4 of the board crop
  const embers = document.querySelector("[data-embers]");
  if (embers && !reduced && "IntersectionObserver" in window) {
    const canvas = embers.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const KING = { x: 1.5 / 8, y: 4.45 / 8 };
    let parts = [], raf = 0, last = 0, w = 0, h = 0, dpr = 1;
    const size = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
    };
    function frame(t) {
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      // the canvas reaches 30% above the board, so the board starts 0.3/1.3 of the way down
      const bw = w, top = h * 0.3 / 1.3, sqr = bw / 8;
      const kx = KING.x * bw, ky = top + KING.y * bw;
      const born = dt * 48;
      for (let n = 0; n < Math.floor(born) + (Math.random() < born % 1 ? 1 : 0); n++) {
        parts.push({
          x: kx + (Math.random() - 0.5) * sqr * 0.8,
          y: ky + (Math.random() - 0.3) * sqr * 0.4,
          vx: (Math.random() - 0.5) * sqr * 0.3,
          vy: -(0.6 + Math.random() * 1.1) * sqr,
          age: 0, life: 1.4 + Math.random() * 1.8,
          r: (0.8 + Math.random() * 1.6) * sqr / 52,
          wob: Math.random() * 6.28,
        });
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      parts = parts.filter(p => (p.age += dt) < p.life);
      for (const p of parts) {
        p.wob += dt * 3;
        p.x += (p.vx + Math.sin(p.wob) * sqr * 0.12) * dt;
        p.y += p.vy * dt;
        p.vy *= 1 - dt * 0.25;
        const k = p.age / p.life;
        const a = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * 0.95;
        // yellow-white when fresh, cooling to red
        const g = Math.round(210 - 150 * k), b = Math.round(120 - 110 * k);
        ctx.fillStyle = `rgba(255, ${g}, ${Math.max(0, b)}, ${a * 0.22})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.2, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(255, ${g + 30}, ${Math.max(0, b + 40)}, ${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) { size(); last = 0; raf = requestAnimationFrame(frame); }
    }).observe(embers);
    window.addEventListener("resize", () => { if (raf) size(); });
  }

  // Engine room tabs
  const bench = document.querySelector("[data-bench]");
  if (bench) {
    const tabs = [...bench.querySelectorAll("[role=tab]")];
    const panels = tabs.map(t => document.getElementById(t.getAttribute("aria-controls")));
    const load = panel => {
      const img = panel.querySelector("img[data-src]");
      if (!img) return;
      img.srcset = shotSrcset(img.dataset.src, [800, 1400, 2400]);
      img.sizes = "(min-width: 1100px) 860px, 94vw";
      img.src = `/img/shots/${img.dataset.src}-1400.webp`;
      delete img.dataset.src;
    };
    function select(i, focus) {
      tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
      panels.forEach((p, k) => { if (k === i) load(p); p.hidden = k !== i; });
      if (focus) tabs[i].focus();
    }
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", e => {
        const n = tabs.length;
        const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: n - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        select((to + n) % n, true);
      });
    });
    afterLoad.push(() => panels.forEach(load));
  }

  // Download: the spiral draws itself out from the middle as the section comes up
  const dl = document.querySelector("[data-download]");
  if (dl && !reduced) {
    onScroll.push(() => {
      const r = dl.getBoundingClientRect(), vh = window.innerHeight;
      const p = ease(clamp((vh - r.top) / (vh * 0.85)));
      dl.style.setProperty("--trail", (1 - p).toFixed(4));
    });
  }

  // Screenshot gallery. The first FIRST_SHOWN entries are what "All" shows before "Show all".
  const SHOTS = [
    ["analysis-review", "Analysis and game review", "Analysis"],
    ["3d-library", "The library", "3D"],
    ["theme-goo", "Goo theme", "Looks"],
    ["event-standings", "Tournament standings", "Tournaments"],
    ["newtab", "New tab page", "Play"],
    ["3d-room", "The room", "3D"],
    ["registry", "Engine registry", "Engines and books"],
    ["effects-immortal", "Fire on a piece", "Looks"],
    ["theme-circuit", "Circuit theme", "Looks"],
    ["event-live", "A live tournament game", "Tournaments"],
    ["3d-park", "The park", "3D"],
    ["install", "Installing an engine", "Engines and books"],
    ["analysis-porcelain", "Porcelain theme", "Analysis"],
    ["immortal-arrows", "Engine arrows", "Analysis"],
    ["analysis-picker", "Engine picker", "Analysis"],
    ["analysis-log", "Engine log", "Analysis"],
    ["analysis-evals", "Saved evaluations", "Analysis"],
    ["editor", "Board editor", "Analysis"],
    ["3d-mars", "Mars", "3D"],
    ["3d-goo", "Goo pieces on glass", "3D"],
    ["3d-metal", "Brass and pewter", "3D"],
    ["play-3d", "Playing in 3D", "3D"],
    ["theme-after-hours", "After hours theme", "Looks"],
    ["theme-paper", "Paper theme", "Looks"],
    ["backdrop-clouds", "Above the clouds", "Looks"],
    ["backdrop-linen", "Linen", "Looks"],
    ["backdrop-concrete", "Concrete", "Looks"],
    ["font-gluten", "Gluten font", "Looks"],
    ["font-pixel", "Pixelify Sans font", "Looks"],
    ["costume-halloween", "Halloween", "Looks"],
    ["costume-christmas", "Christmas", "Looks"],
    ["costume-party", "Party", "Looks"],
    ["effects", "Moss and check flames", "Looks"],
    ["quick-match", "Quick match", "Play"],
    ["play-setup", "Custom game", "Play"],
    ["play-game", "Playing the engine", "Play"],
    ["lichess", "Lichess", "Play"],
    ["tournaments", "All tournaments", "Tournaments"],
    ["event-games", "Tournament games", "Tournaments"],
    ["event-details", "Tournament details", "Tournaments"],
    ["event-moves", "Speed graph", "Tournaments"],
    ["newtour-0", "New tournament", "Tournaments"],
    ["newtour-1", "Adding engines", "Tournaments"],
    ["newtour-2", "Consensus book", "Tournaments"],
    ["engines", "Engines", "Engines and books"],
    ["books", "Opening books", "Engines and books"],
    ["book-generate", "Generating a book", "Engines and books"],
    ["book-registry", "Book registry", "Engines and books"],
    ["database", "Game database", "Engines and books"],
    ["contribute", "Contributing analysis", "Engines and books"],
    ["profile-overview", "Profile", "Profile"],
    ["profile-games", "All games", "Profile"],
    ["profile-blitz", "Blitz rating", "Profile"],
    ["profile-tournaments", "Your tournaments", "Profile"],
    ["profile-fastchess", "fastchess runs", "Profile"],
    ["settings-appearance", "Appearance", "Settings"],
    ["settings-arrows", "Arrows", "Settings"],
    ["settings-effects", "Effects", "Settings"],
    ["settings-graphics", "Graphics", "Settings"],
    ["settings-board", "2D board", "Settings"],
    ["settings-background", "Backgrounds", "Settings"],
    ["settings-board3d", "3D board", "Settings"],
    ["settings-pieces3d", "3D pieces", "Settings"],
    ["settings-scene", "3D scene", "Settings"],
    ["settings-settings", "General settings", "Settings"],
    ["settings-cloud", "Cloud", "Settings"],
    ["settings-fastchess", "FastChess", "Settings"],
    ["settings-lichess", "Lichess account", "Settings"],
  ];
  const GROUPS = ["All", "Analysis", "3D", "Looks", "Play", "Tournaments", "Engines and books", "Profile", "Settings"];
  const FIRST_SHOWN = 12;

  const galleryEl = document.querySelector("[data-gallery]");
  const filtersEl = document.querySelector("[data-filters]");
  const moreEl = document.querySelector("[data-more]");
  const lightbox = document.querySelector("[data-lightbox]");
  if (galleryEl && filtersEl && lightbox) {
    let shown = [];
    let open = -1;
    let group = "All";
    let all = false;

    SHOTS.forEach(([name, title, g], i) => {
      const li = document.createElement("li");
      li.dataset.group = g;
      li.innerHTML = `<button type="button" class="shot-btn" data-i="${i}">` +
        `<img src="/img/shots/${name}-800.webp" width="800" height="500" alt="" loading="lazy" decoding="async">` +
        `<span>${title}</span></button>`;
      galleryEl.appendChild(li);
    });

    function filter() {
      shown = [];
      galleryEl.querySelectorAll("li").forEach((li, i) => {
        const on = group === "All" ? (all || i < FIRST_SHOWN) : li.dataset.group === group;
        li.hidden = !on;
        if (on) shown.push(i);
      });
      if (moreEl) {
        moreEl.hidden = group !== "All" || all;
        moreEl.textContent = `Show all ${SHOTS.length} screenshots`;
      }
    }

    GROUPS.forEach(g => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = g;
      b.setAttribute("aria-pressed", String(g === group));
      b.addEventListener("click", () => {
        filtersEl.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        group = g;
        filter();
      });
      filtersEl.appendChild(b);
    });
    if (moreEl) moreEl.addEventListener("click", () => {
      all = true;
      filter();
      const next = galleryEl.querySelectorAll(".shot-btn")[FIRST_SHOWN];
      if (next) next.focus();
    });
    filter();

    const lbImg = lightbox.querySelector("[data-lightbox-img]");
    const lbCap = lightbox.querySelector("[data-lightbox-caption]");
    function show(i) {
      open = i;
      const [name, title] = SHOTS[i];
      lbImg.src = `/img/shots/${name}-2400.webp`;
      lbImg.alt = title;
      lbCap.textContent = title;
    }
    function step(d) {
      const k = shown.indexOf(open);
      show(shown[(k + d + shown.length) % shown.length]);
    }
    galleryEl.addEventListener("click", e => {
      const b = e.target.closest(".shot-btn");
      if (!b) return;
      show(Number(b.dataset.i));
      lightbox.showModal();
    });
    lightbox.addEventListener("click", e => {
      const act = e.target.closest("[data-lb]");
      if (act) {
        if (act.dataset.lb === "close") lightbox.close();
        else step(act.dataset.lb === "next" ? 1 : -1);
        return;
      }
      if (e.target === lightbox || e.target.tagName === "FIGURE") lightbox.close();
    });
    lightbox.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    });
    lightbox.addEventListener("close", () => {
      const b = galleryEl.querySelector(`[data-i="${open}"]`);
      if (b) b.focus();
    });
  }

  scrolled();
})();
