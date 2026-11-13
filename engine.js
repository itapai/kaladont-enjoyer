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
  const norm = s => (s || "").normalize("NFC").toLowerCase().trim();
  const startKey = w => letters(w).slice(0, 2).join("");
  const endKey = w => letters(w).slice(-2).join("");

  // početna slova svih riječi iz rječnika (i pridjeva, glagola...) - igra prihvaća sve vrste
  const dictStarts = new Set(KALADONT_STARTS);

  const byStart = new Map();
  const known = new Set();
  // dodaje riječi u rječnik; vraća broj stvarno novih
  function addWords(list) {
    let n = 0;
    for (const raw of list) {
      const w = norm(raw);
      if (known.has(w) || !/^[a-zčćđšž]+$/.test(w) || letters(w).length < 3) continue;
      known.add(w);
      const k = startKey(w);
      if (!byStart.has(k)) byStart.set(k, []);
      byStart.get(k).push(w);
      dictStarts.add(k);
      n++;
    }
    return n;
  }
  addWords(KALADONT_WORDS);
  const hasWord = w => known.has(norm(w));

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // biraj riječi s različitim završecima
  function diverse(list, n) {
    const out = [], seen = new Set();
    for (const s of list) if (out.length < n && !seen.has(s.end)) { seen.add(s.end); out.push(s); }
    for (const s of list) if (out.length < n && !out.includes(s)) out.push(s);
    return out;
  }

  /**
   * prefix: tražena slova (npr. "za", "nje")
   * opts.used:  Set riječi koje ne treba predlagati (iskorištene / odbijene)
   * opts.alive: Set završetaka za koje se u igri vidjelo da imaju nastavak
   * opts.dead:  Set završetaka za koje je igra potvrdila "Nema nastavka"
   */
  function suggest(prefix, opts = {}, n = 3) {
    const used = opts.used || new Set();
    const alive = opts.alive || new Set();
    const dead = opts.dead || new Set();
    const key = letters(norm(prefix)).slice(0, 2).join("");
    const cands = (byStart.get(key) || []).filter(w => !used.has(w));

    const finishers = [], cont = [];
    for (const w of cands) {
      const end = endKey(w);
      if (end === "ka") continue; // protivnik odgovara "kaladont" i ti ispadaš
      if (dead.has(end)) { finishers.push({ word: w, end, sure: true }); continue; }
      const own = (byStart.get(end) || []).filter(x => x !== w && !used.has(x)).length;
      if (!dictStarts.has(end) && !alive.has(end)) finishers.push({ word: w, end, sure: false });
      else cont.push({ word: w, end, count: own, rare: own === 0 });
    }

    // kaladont: ako se traži "ka", "kaladont" izbacuje prethodnog igrača
    if (key === "ka" && !used.has("kaladont")) finishers.unshift({ word: "kaladont", end: "nt", sure: true, kaladont: true });

    // potvrđeni završeci prvi
    shuffle(finishers);
    finishers.sort((a, b) => (b.kaladont || 0) - (a.kaladont || 0) || b.sure - a.sure);

    // nastavak: što manje mogućih odgovora za protivnika
    shuffle(cont).sort((a, b) => a.count - b.count);
    const pool = cont.slice(0, Math.max(n * 4, 12));
    return {
      finishers: diverse(finishers, n),
      continuers: diverse(shuffle(pool), n).sort((a, b) => a.count - b.count),
      total: cands.length,
      key
    };
  }

  return { suggest, letters, startKey, endKey, norm, addWords, hasWord };
})();
