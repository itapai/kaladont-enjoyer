const inp = document.getElementById("p");
let opts = {};
browser.storage.local.get(["kaladontBlacklist", "kaladontAlive", "kaladontDead"]).then(r => {
  opts = {
    used: new Set(r.kaladontBlacklist || []),
    alive: new Set(r.kaladontAlive || []),
    dead: new Set(r.kaladontDead || [])
  };
});
function show() {
  const r = KaladontEngine.suggest(inp.value, opts, 3);
  const fill = (id, arr, f) => {
    const ul = document.getElementById(id);
    ul.textContent = "";
    if (!arr.length) { ul.innerHTML = "<li><i>nema</i></li>"; return; }
    for (const s of arr) {
      const li = document.createElement("li");
      li.innerHTML = `<b></b> <small></small>`;
      li.querySelector("b").textContent = s.word;
      li.querySelector("small").textContent = f
        ? (s.kaladont ? "izbacuje prethodnog" : `→ ${s.end.toUpperCase()} ${s.sure ? "✔" : "?"}`)
        : `→ ${s.end.toUpperCase()} (${s.rare ? "rijetko" : s.count})`;
      ul.appendChild(li);
    }
  };
  fill("fin", r.finishers, true);
  fill("cont", r.continuers, false);
}
inp.addEventListener("input", () => { if (KaladontEngine.letters(KaladontEngine.norm(inp.value)).length >= 2) show(); });
