(() => {
  const STORE_KEY = "kaladontBlacklist";
  const used = new Set();      // riječi iskorištene u ovoj partiji (ova stranica)
  let blacklist = new Set();   // riječi koje igra ne priznaje (trajno)
  let lastPrefix = null;

  browser.storage.local.get(STORE_KEY).then(r => {
    blacklist = new Set(r[STORE_KEY] || []);
    render(lastPrefix, true);
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
      <div class="kh-info"></div>
      <div class="kh-title kh-fin-t">🏁 Završavaju igru</div>
      <ul class="kh-fin"></ul>
      <div class="kh-title">➡️ Nastavljaju igru</div>
      <ul class="kh-cont"></ul>
      <div class="kh-foot">klik = upiši u igru · ✕ = igra ne priznaje riječ</div>
    </div>`;
  document.documentElement.appendChild(panel);

  const $ = s => panel.querySelector(s);
  const inp = $(".kh-in");
  $(".kh-go").onclick = () => render(inp.value, true);
  $(".kh-re").onclick = () => render(inp.value, true);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") render(inp.value, true); e.stopPropagation(); });
  $(".kh-min").onclick = () => panel.classList.toggle("kh-collapsed");

  function item(s, isFinisher) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "kh-word";
    btn.textContent = s.word;
    btn.title = "Upiši u igru";
    btn.onclick = () => fillGame(s.word);
    const meta = document.createElement("span");
    meta.className = "kh-meta";
    meta.textContent = isFinisher ? `→ ${s.end.toUpperCase()} (0)` : `→ ${s.end.toUpperCase()} (${s.count})`;
    meta.title = isFinisher ? "Nema riječi na ova slova" : "Broj mogućih odgovora protivnika";
    const x = document.createElement("button");
    x.className = "kh-x";
    x.textContent = "✕";
    x.title = "Igra ne priznaje ovu riječ – ne predlaži je više";
    x.onclick = () => {
      blacklist.add(s.word);
      browser.storage.local.set({ [STORE_KEY]: [...blacklist] });
      render(lastPrefix, true);
    };
    li.append(btn, meta, x);
    return li;
  }

  function render(prefix, force) {
    if (!prefix) return;
    prefix = KaladontEngine.norm(prefix);
    if (!force && prefix === lastPrefix) return;
    lastPrefix = prefix;
    inp.value = prefix;
    const excluded = new Set([...used, ...blacklist]);
    const r = KaladontEngine.suggest(prefix, excluded, 3);
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
    const prefix = KaladontEngine.norm(readPrefix() || lastPrefix || "");
    const rest = prefix && word.startsWith(prefix) ? word.slice(prefix.length) : word;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, rest);
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    el.focus();
  }

  // ---------- čitanje stanja igre ----------
  // Traži tekst "Traži se riječ na:" i slova odmah iza njega.
  function readPrefix() {
    const strong = document.querySelector(".trazena-slova strong");
    if (strong && strong.textContent.trim()) return strong.textContent.trim();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (panel.contains(node)) continue;
      if (!/Traži se riječ na/i.test(node.nodeValue)) continue;
      const parent = node.parentElement;
      // slučaj 1: slova su u istom tekstu
      const m = node.nodeValue.match(/na:\s*([a-zčćđšž]{1,4})/i);
      if (m) return m[1];
      // slučaj 2: slova su u susjednom elementu (badge)
      let scope = parent;
      for (let i = 0; i < 3 && scope; i++, scope = scope.parentElement) {
        const t = scope.textContent.replace(/\s+/g, " ");
        const mm = t.match(/Traži se riječ na:\s*([a-zčćđšž]{1,4})/i);
        if (mm) return mm[1];
      }
    }
    return null;
  }

  // Bilježi iskorištene riječi: prepoznaje riječi iz rječnika koje se pojave u oblačićima/povijesti.
  const wordSet = new Set(KALADONT_WORDS);
  function scanUsed() {
    // riječ može biti razlomljena u više elemenata (npr. "acido" + "za"), pa gledamo textContent elemenata
    for (const el of document.body.querySelectorAll("*")) {
      if (panel.contains(el) || el.childElementCount > 4) continue;
      const t = el.textContent.trim().toLowerCase();
      if (t.length >= 3 && t.length <= 30 && wordSet.has(t)) used.add(t);
    }
  }

  function tick() {
    scanUsed();
    const p = readPrefix();
    if (p) render(p, false);
  }

  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; tick(); }, 150);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  tick();
})();
