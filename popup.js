const inp = document.getElementById("p");
function show() {
  const r = KaladontEngine.suggest(inp.value, new Set(), 3);
  const fill = (id, arr, f) => {
    const ul = document.getElementById(id);
    ul.textContent = "";
    if (!arr.length) { ul.innerHTML = "<li><i>nema</i></li>"; return; }
    for (const s of arr) {
      const li = document.createElement("li");
      li.innerHTML = `<b></b> <small></small>`;
      li.querySelector("b").textContent = s.word;
      li.querySelector("small").textContent = `→ ${s.end.toUpperCase()} (${f ? 0 : s.count})`;
      ul.appendChild(li);
    }
  };
  fill("fin", r.finishers, true);
  fill("cont", r.continuers, false);
}
inp.addEventListener("input", () => { if (KaladontEngine.letters(KaladontEngine.norm(inp.value)).length >= 2) show(); });
