// Hrvatska slova: lj, nj, dž se broje kao jedno slovo (npr. "prijatelj" završava na "elj").
const KaladontEngine = (() => {
  const DIGRAPHS = ["dž", "lj", "nj"];

  function letters(w) {
    const out = [];
    for (let i = 0; i < w.length; ) {
      const two = w.slice(i, i + 2);
      if (DIGRAPHS.includes(two)) { out.push(two); i += 2; }
      else { out.push(w[i]); i += 1; }
    }
    return out;
  }
  const norm = s => (s || "").toLowerCase().trim().replace(/dz/g, "dž");
  const startKey = w => letters(w).slice(0, 2).join("");
  const endKey = w => letters(w).slice(-2).join("");

  // indeks: početna 2 slova -> riječi
  const byStart = new Map();
  for (const w of KALADONT_WORDS) {
    if (letters(w).length < 3) continue;
    const k = startKey(w);
    if (!byStart.has(k)) byStart.set(k, []);
    byStart.get(k).push(w);
  }

  function continuations(key, used, self) {
    const list = byStart.get(key) || [];
    let n = 0;
    for (const w of list) if (w !== self && !used.has(w)) n++;
    return n;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // biraj riječi s različitim završecima (ne tri puta "-ač")
  function diverse(list, n) {
    const out = [], seen = new Set();
    for (const s of list) if (out.length < n && !seen.has(s.end)) { seen.add(s.end); out.push(s); }
    for (const s of list) if (out.length < n && !out.includes(s)) out.push(s);
    return out;
  }

  /**
   * prefix: 2 slova (npr. "za", "lje")
   * used: Set već iskorištenih / odbijenih riječi
   * Vraća { finishers: [{word,end}], continuers: [{word,end,count}], total }
   */
  function suggest(prefix, used = new Set(), n = 3) {
    const key = letters(norm(prefix)).slice(0, 2).join("");
    const cands = (byStart.get(key) || []).filter(w => !used.has(w));
    const finishers = [], cont = [];
    for (const w of cands) {
      const end = endKey(w);
      const c = continuations(end, used, w);
      if (c === 0) finishers.push({ word: w, end });
      else cont.push({ word: w, end, count: c });
    }
    // Nastavak: preferiraj riječi koje protivniku ostavljaju što manje opcija.
    shuffle(cont).sort((a, b) => a.count - b.count);
    const pool = cont.slice(0, Math.max(n * 4, 12));
    return {
      finishers: diverse(shuffle(finishers), n),
      continuers: diverse(shuffle(pool), n).sort((a, b) => a.count - b.count),
      total: cands.length,
      key
    };
  }

  return { suggest, letters, endKey, norm };
})();
