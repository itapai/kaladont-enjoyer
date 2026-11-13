(() => {
  const E = KaladontEngine;
  const KEYS = { black: "kaladontBlacklist", alive: "kaladontAlive", dead: "kaladontDead", pilot: "kaladontAutopilot" };
  let autopilot = false;
  const used = new Set();      // riječi iskorištene u ovoj partiji
  let blacklist = new Set();   // riječi koje igra ne priznaje
  let alive = new Set();       // završeci za koje znamo da imaju nastavak
  let dead = new Set();        // završeci za koje je igra potvrdila "Nema nastavka"
  let lastPrefix = null;

  browser.storage.local.get(Object.values(KEYS)).then(r => {
    blacklist = new Set(r[KEYS.black] || []);
    alive = new Set(r[KEYS.alive] || []);
    dead = new Set(r[KEYS.dead] || []);
    autopilot = r[KEYS.pilot] === true;
    $(".kh-pilot-cb").checked = autopilot;
    render(lastPrefix, true);
  });
  const save = () => browser.storage.local.set({
    [KEYS.black]: [...blacklist], [KEYS.alive]: [...alive], [KEYS.dead]: [...dead]
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
      <div class="kh-status"></div>
      <div class="kh-info"></div>
      <div class="kh-title">🏁 Završavaju igru</div>
      <ul class="kh-fin"></ul>
      <div class="kh-title">➡️ Nastavljaju igru</div>
      <ul class="kh-cont"></ul>
      <div class="kh-foot">klik = upiši (i pošalji) · ✔ = igra potvrdila da nema nastavka ·
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
  const status = t => { $(".kh-status").textContent = t; };
  $(".kh-min").onclick = () => panel.classList.toggle("kh-collapsed");

  function btn(cls, text, title, onclick) {
    const b = document.createElement("button");
    b.className = cls; b.textContent = text; b.title = title; b.onclick = onclick;
    return b;
  }

  function item(s, isFinisher) {
    const li = document.createElement("li");
    const word = btn("kh-word", s.word, "Upiši u igru", () => fillGame(s.word));
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

  function render(prefix, force) {
    if (!prefix) return;
    prefix = E.norm(prefix);
    if (!force && prefix === lastPrefix) return;
    lastPrefix = prefix;
    inp.value = prefix;
    const r = E.suggest(prefix, { used: new Set([...used, ...blacklist]), alive, dead }, 3);
    $(".kh-info").textContent = `Na "${prefix.toUpperCase()}": ${r.total} riječi u rječniku`;
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
  function fillGame(word) {
    const el = gameInput();
    if (!el) return;
    const prefix = E.norm(readPrefix() || lastPrefix || "");
    const rest = prefix && word.startsWith(prefix) ? word.slice(prefix.length) : word;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, rest);
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    el.focus();
    setTimeout(() => submitGame(el), 50);
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
  let pilotTurn = null;      // { prefix, tried: Set }

  function pilotStep() {
    if (!autopilot || pilotBusy || !myTurn()) return;
    const prefix = E.norm(readPrefix() || "");
    if (!prefix) return;
    if (!pilotTurn || pilotTurn.prefix !== prefix) pilotTurn = { prefix, tried: new Set() };
    if (pilotTurn.tried.size >= 8) { status(`Odustajem nakon ${pilotTurn.tried.size} pokušaja – tvoj potez!`); return; }

    const excluded = new Set([...used, ...blacklist, ...pilotTurn.tried]);
    const r = E.suggest(prefix, { used: excluded, alive, dead }, 3);
    // prvo završna riječ (✔ prije ?), inače nastavak s najmanje odgovora za protivnika
    const pick = r.finishers[0] || r.continuers[0];
    if (!pick) { status(`Ne znam riječ na ${prefix.toUpperCase()} – tvoj potez!`); return; }

    pilotBusy = true;
    const delay = 700 + Math.random() * 1300; // malo "razmišljanja"
    status(`Igram: ${pick.word}…`);
    setTimeout(() => {
      if (!autopilot || !myTurn() || E.norm(readPrefix() || "") !== prefix) { pilotBusy = false; return; }
      pilotTurn.tried.add(pick.word);
      fillGame(pick.word);
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
      if (/već (je )?iskorišten/i.test(txt)) used.add(word);
      else { blacklist.add(word); save(); }
      status(`${word} nije prošla, probam drugu…`);
      render(lastPrefix, true);
    }
    pilotStep();
  }

  function tick() {
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
