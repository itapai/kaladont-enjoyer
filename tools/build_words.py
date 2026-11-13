import re, json, sys
dic = sys.argv[1]; out = sys.argv[2]
ADJ = {353,340,347,355,348,341,349,354,346,359,357,358,345,344,352,330,329,322,3,11}
words = set()
for line in open(dic, encoding='utf-8'):
    line = line.strip()
    m = re.fullmatch(r'([a-zčćđšž]+)/(\d+)', line)
    if not m: continue
    w, f = m.group(1), int(m.group(2))
    if f in ADJ or re.search(r'(ti|ći)$', w) or len(w) < 3: continue
    words.add(w)
words = sorted(words)
open(out, 'w', encoding='utf-8').write('const KALADONT_WORDS = ' + json.dumps(words, ensure_ascii=False, separators=(',',':')) + ';\n')
print(len(words))
