# Kaladont enjoyer

Firefox ekstenzija za igru [kaladont.hr](https://kaladont.hr). Za zadana dva slova predlaže:

- 🏁 **3 riječi koje završavaju igru**: na njihova zadnja dva slova ne počinje nijedna riječ iz rječnika (npr. `-nt`, `-rd`, `-elj`, `-ač`)
- ➡️ **3 riječi koje nastavljaju igru**: biraju se one koje protivniku ostavljaju najmanje mogućih odgovora

`lj`, `nj` i `dž` računaju se kao jedno slovo.

## Korištenje

- Na kaladont.hr se dolje desno pojavi prozor koji sam čita „Traži se riječ na: XX”.
- Klik na riječ upiše je u polje u igri i pošalje (kao Enter). Slanje se gasi kvačicom „automatski pošalji”.
- ✕ označi riječ koju igra ne prihvaća. Ekstenzija je pamti i više je ne predlaže.
- ↩ označi da na ta slova ipak ima nastavka. Ta se slova više ne nude kao završna.
- ✔ uz završnu riječ znači da je igra potvrdila mrtva slova („Nema nastavka na XX”). ? znači samo da ih nema u rječniku.
- Ekstenzija uči iz igre: slova kojima počinje svaka odigrana riječ više se ne smatraju mrtvima, a „Nema nastavka na XX” ih potvrđuje.
- Kad se traži „KA”, prvi prijedlog je „kaladont” (izbacuje prethodnog igrača). Riječi koje završavaju na „ka” se ne predlažu.
- ↻ daje nove prijedloge.
- 🤖 **Autopilot** (kvačica u prozoru): kad je tvoj red, sam odigra riječ nakon 1–2 sekunde. Prvo bira završnu riječ, a ako je nema, onda nastavak koji protivniku ostavlja najmanje odgovora. Ako igra odbije riječ, zapamti to i proba drugu (najviše 8 pokušaja po potezu). Kad ne zna riječ, prepušta potez tebi.
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

`words.js` sadrži oko 32 000 hrvatskih imenica i glagola (osnovni oblik) te popis početnih slova svih riječi iz hunspell rječnika `hr_HR` (LibreOffice dictionaries). Generira se ovako:

```bash
curl -LO https://raw.githubusercontent.com/LibreOffice/dictionaries/master/hr_HR/hr_HR.dic
python3 tools/build_words.py hr_HR.dic words.js
```
