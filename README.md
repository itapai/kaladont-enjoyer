# Kaladont enjoyer

Firefox ekstenzija za igru [kaladont.hr](https://kaladont.hr). Za zadana dva slova predlaže:

- 🏁 **3 riječi koje završavaju igru**: na njihova zadnja dva slova ne počinje nijedna riječ iz rječnika (npr. `-nt`, `-rd`, `-elj`, `-ač`)
- ➡️ **3 riječi koje nastavljaju igru**: biraju se one koje protivniku ostavljaju najmanje mogućih odgovora

`lj`, `nj` i `dž` računaju se kao jedno slovo.

## Korištenje

- Na kaladont.hr se dolje desno pojavi prozor koji sam čita „Traži se riječ na: XX”.
- Klik na riječ upiše je u polje u igri.
- ✕ označi riječ koju igra ne prihvaća. Ekstenzija je pamti i više je ne predlaže.
- ↻ daje nove prijedloge.
- Ikona ekstenzije u alatnoj traci otvara isti alat i izvan igre.

## Instalacija

1. U Firefoxu otvori `about:debugging#/runtime/this-firefox`.
2. Klikni **Load Temporary Add-on…** i odaberi `manifest.json`.

Paket za instalaciju:

```bash
zip -r kaladont-enjoyer.xpi manifest.json *.js *.css *.html
```

Običan Firefox instalira samo potpisane ekstenzije. Potpis se dobije besplatno na addons.mozilla.org.

## Rječnik

`words.js` sadrži oko 22 000 hrvatskih imenica iz hunspell rječnika `hr_HR` (LibreOffice dictionaries). Generira se ovako:

```bash
curl -LO https://raw.githubusercontent.com/LibreOffice/dictionaries/master/hr_HR/hr_HR.dic
python3 tools/build_words.py hr_HR.dic words.js
```
