(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function remember(key, value) {
    try { localStorage.setItem("snail." + key, value); } catch (e) { /* storage blocked */ }
  }
  function recall(key) {
    try { return localStorage.getItem("snail." + key); } catch (e) { return null; }
  }

  function shotSrcset(name, widths) {
    return widths.map(w => `/img/shots/${name}-${w}.webp ${w}w`).join(", ");
  }

  // Top bar gets a rule once the page scrolls, and marks the section in view
  const bar = document.querySelector(".bar");
  if (bar) {
    const onScroll = () => bar.classList.toggle("is-scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
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

  // Hero: pick a room
  const rooms = document.querySelector("[data-rooms]");
  if (rooms) {
    const buttons = [...rooms.querySelectorAll("[data-room]")];
    const images = [...rooms.querySelectorAll(".rooms-stage img")];
    const caption = rooms.querySelector("[data-room-caption]");
    const captions = [
      "Walnut board, boxwood pieces.",
      "Marble board and pieces, on navy felt.",
      "The game on an old computer, under a desk lamp.",
      "Folded paper pieces on an ebony board.",
      "Goo pieces on etched glass.",
    ];
    const load = img => {
      if (!img.dataset.src) return;
      img.srcset = shotSrcset(img.dataset.src, [800, 1400, 2400]);
      img.sizes = "(min-width: 1320px) 1240px, 94vw";
      img.src = `/img/shots/${img.dataset.src}-1400.webp`;
      delete img.dataset.src;
    };
    const choose = (i, focus) => {
      buttons.forEach((b, k) => {
        b.setAttribute("aria-checked", String(k === i));
        b.tabIndex = k === i ? 0 : -1;
      });
      load(images[i]);
      images.forEach((img, k) => img.classList.toggle("is-on", k === i));
      caption.textContent = captions[i];
      if (focus) buttons[i].focus();
    };
    buttons.forEach((b, i) => {
      b.tabIndex = i === 0 ? 0 : -1;
      b.addEventListener("click", () => choose(i, false));
      b.addEventListener("keydown", e => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        choose((i + step + buttons.length) % buttons.length, true);
      });
    });
    // fetch the other rooms once the page has settled, so switching is instant
    window.addEventListener("load", () => setTimeout(() => images.forEach(load), 1200));
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
    const allSets = SETS.flatMap(g => g.items);
    const allPalettes = PALETTES.flatMap(g => g.items);

    let set = allSets.some(s => s[0] === recall("set")) ? recall("set") : "classic";
    let palette = allPalettes.some(p => p[0] === recall("palette")) ? recall("palette") : "sage";
    let at = 47; // just after 24. Rxd4
    const files = "abcdefgh";

    // 64 squares, a8 first
    const squares = {};
    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const sq = document.createElement("div");
        const name = files[f] + (r + 1);
        sq.className = "sq" + ((f + r) % 2 === 0 ? " dk" : "");
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

    function draw(animate) {
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
      if (b) go(Number(b.dataset.ply));
    });

    studio.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => {
      const kind = b.dataset.step;
      go(kind === "first" ? 0 : kind === "back" ? at - 1 : kind === "next" ? at + 1 : game.plies.length);
    }));
    boardEl.tabIndex = 0;
    boardEl.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(at + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(at - 1); }
      if (e.key === "Home") { e.preventDefault(); go(0); }
      if (e.key === "End") { e.preventDefault(); go(game.plies.length); }
    });

    // piece sets
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
        b.addEventListener("click", () => { set = word; remember("set", word); markSets(); draw(false); });
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
})();
