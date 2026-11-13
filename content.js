(() => {
  const E = KaladontEngine;
  // vremena u milisekundama [min, max]
  const TIMING = {
    think: [2000, 4000],        // autopilot: "razmišljanje" prije tipkanja
    beforeTyping: [300, 700],   // pauza prije prvog slova
    perLetter: [90, 220],       // razmak između slova
    beforeSend: [250, 600]      // pauza prije Entera
  };
  const KEYS = { black: "kaladontBlacklist", alive: "kaladontAlive", dead: "kaladontDead", pilot: "kaladontAutopilot", learned: "kaladontLearnedWords", replay: "kaladontAutoReplay" };
  let autopilot = false;
  let autoReplay = false;
  const used = new Set();      // riječi iskorištene u ovoj partiji
  let blacklist = new Set();   // riječi koje igra ne priznaje
  let alive = new Set();       // završeci za koje znamo da imaju nastavak
  let dead = new Set();        // završeci za koje je igra potvrdila "Nema nastavka"
  let learned = new Set();     // riječi naučene iz igre (nema ih u ugrađenom rječniku)
  let lastPrefix = null;

  let loaded = false;   // dok se ne učita spremljeno stanje, ništa ne spremaj
  browser.storage.local.get(Object.values(KEYS)).then(r => {
    blacklist = new Set(r[KEYS.black] || []);
    alive = new Set(r[KEYS.alive] || []);
    dead = new Set(r[KEYS.dead] || []);
    learned = new Set(r[KEYS.learned] || []);
    E.addWords(learned);
    autopilot = r[KEYS.pilot] === true;
    $(".kh-pilot-cb").checked = autopilot;
    autoReplay = r[KEYS.replay] === true;
    $(".kh-replay-cb").checked = autoReplay;
    loaded = true;
    tick();
    render(lastPrefix, true);
  });
  const save = () => browser.storage.local.set({
    [KEYS.black]: [...blacklist], [KEYS.alive]: [...alive], [KEYS.dead]: [...dead],
    [KEYS.learned]: [...learned]
  });

  // ---------- UI ----------
  const panel = document.createElement("div");
  panel.id = "kh-panel";
  panel.innerHTML = `
    <div class="kh-head">
      <span>Kaladont pomoćnik</span>
      <button class="kh-min" title="Smanji">–</button>
    </div>
    <div class="kh-body">
      <div class="kh-row">
        <input class="kh-in" maxlength="4" placeholder="slova (npr. za)">
        <button class="kh-go">Traži</button>
        <button class="kh-re" title="Nove preporuke">↻</button>
      </div>
      <label class="kh-auto kh-pilot"><input type="checkbox" class="kh-pilot-cb"> 🤖 autopilot (igra umjesto mene)</label>
      <label class="kh-auto"><input type="checkbox" class="kh-replay-cb"> 🔁 automatski nova igra</label>
      <div class="kh-status"></div>
      <div class="kh-info"></div>
      <div class="kh-title">🏁 Završavaju igru</div>
      <ul class="kh-fin"></ul>
      <div class="kh-title">➡️ Nastavljaju igru</div>
      <ul class="kh-cont"></ul>
      <div class="kh-foot">klik = utipkaj i pošalji · dvoklik = odmah · ✔ = igra potvrdila da nema nastavka ·
        ↩ = ipak ima nastavak · ✕ = igra ne priznaje riječ</div>
    </div>`;
  document.documentElement.appendChild(panel);

  const $ = s => panel.querySelector(s);
  const inp = $(".kh-in");
  $(".kh-go").onclick = () => render(inp.value, true);
  $(".kh-re").onclick = () => render(inp.value, true);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") render(inp.value, true); e.stopPropagation(); });
  $(".kh-pilot-cb").onchange = e => {
    autopilot = e.target.checked;
    browser.storage.local.set({ [KEYS.pilot]: autopilot });
    status(autopilot ? "Autopilot uključen – čekam svoj red." : "");
    tick();
  };
  $(".kh-replay-cb").onchange = e => {
    autoReplay = e.target.checked;
    browser.storage.local.set({ [KEYS.replay]: autoReplay });
    tick();
  };
  const status = t => { $(".kh-status").textContent = t; };
  $(".kh-min").onclick = () => panel.classList.toggle("kh-collapsed");

  function btn(cls, text, title, onclick) {
    const b = document.createElement("button");
    b.className = cls; b.textContent = text; b.title = title; b.onclick = onclick;
    return b;
  }

  function item(s, isFinisher) {
    const li = document.createElement("li");
    const word = btn("kh-word", s.word, "Klik: utipkaj i pošalji · dvoklik: odmah pošalji", () => fillGame(s.word));
    word.ondblclick = () => fillGame(s.word, true);
    const meta = document.createElement("span");
    meta.className = "kh-meta";
    if (isFinisher) {
      meta.textContent = s.kaladont ? "izbacuje prethodnog" : `→ ${s.end.toUpperCase()} ${s.sure ? "✔" : "?"}`;
      meta.title = s.sure ? "Igra je potvrdila da na ova slova nema riječi"
                          : "U rječniku nema riječi na ova slova (igra možda ima)";
    } else {
      meta.textContent = `→ ${s.end.toUpperCase()} (${s.rare ? "rijetko" : s.count})`;
      meta.title = "Broj mogućih odgovora protivnika";
    }
    li.append(word, meta);
    if (isFinisher && !s.kaladont) {
      li.append(btn("kh-x", "↩", `Na ${s.end.toUpperCase()} ipak ima nastavka – ne nudi više kao završnu`, () => {
        alive.add(s.end); dead.delete(s.end); save(); render(lastPrefix, true);
      }));
    }
    li.append(btn("kh-x", "✕", "Igra ne priznaje ovu riječ – ne predlaži je više", () => {
      blacklist.add(s.word); save(); render(lastPrefix, true);
    }));
    return li;
  }

  let pilotTurn = null;      // autopilot: { prefix, tried: Set } za trenutni potez
  let shown = { prefix: null, words: [] };   // riječi trenutno prikazane u prozoru (redom)

  // označi riječ u prozoru: "playing" (autopilot je igra) ili "bad" (odbijena)
  function mark(word, cls) {
    for (const b of panel.querySelectorAll(".kh-word"))
      if (b.textContent === word) b.classList.add(cls);
  }

  function render(prefix, force) {
    if (!prefix) return;
    prefix = E.norm(prefix);
    if (!force && prefix === lastPrefix) return;
    lastPrefix = prefix;
    inp.value = prefix;
    const tried = pilotTurn && pilotTurn.prefix === prefix ? pilotTurn.tried : [];
    const r = E.suggest(prefix, { used: new Set([...used, ...blacklist, ...tried]), alive, dead }, 3);
    shown = { prefix, words: [...r.finishers, ...r.continuers].map(x => x.word) };
    $(".kh-info").textContent = `Na "${prefix.toUpperCase()}": ${r.total} riječi u rječniku` +
      (learned.size ? ` · naučeno iz igre: ${learned.size}` : "");
    const fin = $(".kh-fin"), cont = $(".kh-cont");
    fin.textContent = ""; cont.textContent = "";
    if (!r.finishers.length) fin.innerHTML = `<li class="kh-none">nema</li>`;
    if (!r.continuers.length) cont.innerHTML = `<li class="kh-none">nema</li>`;
    r.finishers.forEach(s => fin.appendChild(item(s, true)));
    r.continuers.forEach(s => cont.appendChild(item(s, false)));
  }

  // ---------- upis u igru ----------
  function gameInput() {
    const el = document.querySelector("form.zona-poteza input[type='text']");
    if (el) return el;
    const all = [...document.querySelectorAll('input[type="text"], input:not([type]), textarea')]
      .filter(e => !panel.contains(e) && e.offsetParent !== null);
    return all[all.length - 1] || null;
  }

  // Igra sama dodaje tražena slova ispred polja (span.prefiks-unosa) i šalje
  // "traženaSlova + unos", pa u polje upisujemo riječ BEZ početnih slova.
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  let typingId = 0; // svako novo upisivanje prekida prethodno

  // Tipka slovo po slovo kao čovjek, pa pošalje. instant = odmah upiši i pošalji.
  // Vraća true ako je poslano.
  async function fillGame(word, instant = false) {
    const el = gameInput();
    if (!el) return false;
    const id = ++typingId;
    const alive = () => id === typingId && el.isConnected;
    const prefix = E.norm(readPrefix() || lastPrefix || "");
    const rest = prefix && word.startsWith(prefix) ? word.slice(prefix.length) : word;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setVal = v => {
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    };
    el.focus();
    if (instant) {
      setVal(rest);
      submitGame(el);
      return true;
    }
    setVal("");
    await sleep(rand(TIMING.beforeTyping[0], TIMING.beforeTyping[1]));
    for (let i = 1; i <= rest.length; i++) {
      if (!alive()) return false;           // prekinuto ili je potez prošao
      setVal(rest.slice(0, i));
      await sleep(rand(TIMING.perLetter[0], TIMING.perLetter[1]));
    }
    await sleep(rand(TIMING.beforeSend[0], TIMING.beforeSend[1]));
    if (!alive()) return false;
    submitGame(el);
    return true;
  }

  // isto kao Enter / klik na "Pošalji"
  function submitGame(el) {
    const form = el.form || el.closest("form");
    if (form && form.requestSubmit) { form.requestSubmit(); return; }
    for (const type of ["keydown", "keypress", "keyup"])
      el.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
  }

  // ---------- čitanje stanja igre ----------
  function readPrefix() {
    const strong = document.querySelector(".trazena-slova strong");
    if (strong && strong.textContent.trim()) return strong.textContent.trim();
    // rezerva: tekst "Traži se riječ na: XX" bilo gdje na stranici
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (panel.contains(node) || !/Traži se riječ na/i.test(node.nodeValue)) continue;
      let scope = node.parentElement;
      for (let i = 0; i < 3 && scope; i++, scope = scope.parentElement) {
        const m = scope.textContent.replace(/\s+/g, " ").match(/Traži se riječ na:\s*([a-zčćđšž]{1,4})/i);
        if (m) return m[1];
      }
    }
    return null;
  }

  // Uči iz igre:
  //  - svaka odigrana riječ (oblačić iznad igrača, trenutna riječ) je iskorištena,
  //    a njezina početna slova očito imaju nastavak
  //  - "Nema nastavka na XX" potvrđuje mrtva slova
  function learn() {
    let changed = false;
    const words = document.querySelectorAll(".rijec-oblak, .trenutna-rijec, .mobilna-trenutna-rijec");
    for (const el of words) {
      const w = E.norm(el.textContent).replace(/\s+/g, "");
      if (!/^[a-zčćđšž]{3,}$/.test(w)) continue;
      used.add(w);
      // igra je prihvatila riječ -> ako je nemamo, naučimo je
      if (!E.hasWord(w) && !blacklist.has(w)) { learned.add(w); E.addWords([w]); changed = true; }
      const k = E.startKey(w);
      if (!alive.has(k)) { alive.add(k); dead.delete(k); changed = true; }
    }
    const m = document.body.innerText.match(/Nema nastavka na ([A-ZČĆĐŠŽ]{1,4})/g) || [];
    for (const s of m) {
      const k = E.norm(s.replace("Nema nastavka na ", ""));
      if (!dead.has(k) && !alive.has(k)) { dead.add(k); changed = true; }
    }
    if (changed) save();
    return changed;
  }

  // ---------- autopilot ----------
  // Polje za unos (form.zona-poteza) igra prikazuje samo kad je moj red.
  function myTurn() {
    const el = document.querySelector("form.zona-poteza input[type='text']");
    return !!el && !el.disabled;
  }

  let pilotBusy = false;     // čeka se odgovor igre ili "razmišljanje"

  function pilotStep() {
    if (!autopilot || pilotBusy || !myTurn()) return;
    const prefix = E.norm(readPrefix() || "");
    if (!prefix) return;
    if (!pilotTurn || pilotTurn.prefix !== prefix) pilotTurn = { prefix, tried: new Set() };
    if (pilotTurn.tried.size >= 8) { status(`Odustajem nakon ${pilotTurn.tried.size} pokušaja – tvoj potez!`); return; }

    // autopilot igra SAMO riječi koje su ponuđene u prozoru, redom:
    // prvo završne, pa nastavci. Kad sve ponuđene ne prođu -> osvježi (↻) i probaj nove.
    if (shown.prefix !== prefix) render(prefix, true);
    let pickWord = shown.words.find(w => !pilotTurn.tried.has(w));
    if (!pickWord) {
      render(prefix, true);
      pickWord = shown.words.find(w => !pilotTurn.tried.has(w));
    }
    if (!pickWord) { status(`Ne znam riječ na ${prefix.toUpperCase()} – tvoj potez!`); return; }
    const pick = { word: pickWord };
    mark(pick.word, "kh-playing");

    pilotBusy = true;
    const delay = rand(TIMING.think[0], TIMING.think[1]);
    status(`Igram: ${pick.word}…`);
    setTimeout(async () => {
      if (!autopilot || !myTurn() || E.norm(readPrefix() || "") !== prefix) { pilotBusy = false; return; }
      pilotTurn.tried.add(pick.word);
      const sent = await fillGame(pick.word);
      if (!sent) { pilotBusy = false; return; }
      // provjeri je li igra prihvatila riječ
      setTimeout(() => checkResult(pick.word, prefix), 2000);
    }, delay);
  }

  function checkResult(word, prefix) {
    const btn = document.querySelector("form.zona-poteza button[type='submit']");
    if (btn && /Provjera/i.test(btn.textContent)) { setTimeout(() => checkResult(word, prefix), 500); return; }
    pilotBusy = false;
    const stillMine = myTurn() && E.norm(readPrefix() || "") === prefix;
    if (!stillMine) {
      used.add(word);
      status(`Odigrao: ${word}`);
    } else {
      // odbijeno: ne postoji / vlastito ime / već iskorišteno
      const txt = document.body.innerText;
      if (/već (je )?iskorišten/i.test(txt)) {
        // riječ postoji, samo je već odigrana u ovoj partiji -> makni je samo za ovu partiju
        used.add(word);
        render(prefix, true);
      } else {
        // igra je ne priznaje -> klikni ✕ (trajno makni i ponudi drugu)
        const x = [...panel.querySelectorAll("li")]
          .find(li => li.querySelector(".kh-word")?.textContent === word)
          ?.querySelector(".kh-x:last-of-type");
        if (x) x.click();
        else { blacklist.add(word); save(); render(prefix, true); }
      }
      status(`${word} nije prošla, maknuo sam je, probam drugu…`);
    }
    pilotStep();
  }

  // ---------- automatski nova igra ----------
  // Na kraju igre se pojavi "Igraj opet" (a.igraj-opet-gumb) koji vodi u red čekanja.
  let replayTimer = null, lastReplay = 0;
  function replayStep() {
    if (!autoReplay || replayTimer || Date.now() - lastReplay < 10000) return;
    const b = document.querySelector("a.igraj-opet-gumb");
    if (!b || b.offsetParent === null) return;
    status("Igra gotova – nova igra za 3 s…");
    replayTimer = setTimeout(() => {
      replayTimer = null;
      const b2 = document.querySelector("a.igraj-opet-gumb");
      if (!autoReplay || !b2) return;
      lastReplay = Date.now();
      used.clear();          // nova partija, nove riječi
      pilotTurn = null;
      status("Tražim novu igru…");
      b2.click();
    }, 3000);
  }

  function tick() {
    if (!loaded) return;
    replayStep();
    const changed = learn();
    const p = readPrefix();
    if (p) render(p, changed);
    pilotStep();
  }

  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; tick(); }, 150);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  tick();
})();
