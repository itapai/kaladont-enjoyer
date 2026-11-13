"""Generira words.js iz hunspell rječnika hr_HR.

WORDS  - riječi koje ekstenzija predlaže (imenice + infinitivi, osnovni oblik)
STARTS - početna 2 slova svih riječi iz rječnika (sve vrste riječi);
         služi za procjenu ima li nastavka na neka slova.
"""
import re, json, sys

dic, out = sys.argv[1], sys.argv[2]
ADJ = {353,340,347,355,348,341,349,354,346,359,357,358,345,344,352,330,329,322,3,11}
DIGRAPHS = ("dž", "lj", "nj")

def letters(w):
    o, i = [], 0
    while i < len(w):
        if w[i:i+2] in DIGRAPHS: o.append(w[i:i+2]); i += 2
        else: o.append(w[i]); i += 1
    return o

words, starts = set(), set()
for line in open(dic, encoding='utf-8'):
    m = re.fullmatch(r'([a-zčćđšž]+)(?:/(\d+))?', line.strip())
    if not m or len(letters(m.group(1))) < 3: continue
    w = m.group(1)
    starts.add(''.join(letters(w)[:2]))
    if m.group(2) is None or int(m.group(2)) in ADJ: continue
    words.add(w)

j = lambda x: json.dumps(sorted(x), ensure_ascii=False, separators=(',', ':'))
with open(out, 'w', encoding='utf-8') as f:
    f.write('const KALADONT_WORDS = ' + j(words) + ';\n')
    f.write('const KALADONT_STARTS = ' + j(starts) + ';\n')
print(len(words), 'riječi,', len(starts), 'početaka')
