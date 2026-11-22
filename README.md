# Mistrz Tabliczki ✖️➗

**Darmowy trener mnożenia i dzielenia dla dzieci ze szkoły podstawowej.** Bez reklam, bez śledzenia, bez opłat.
Działa w przeglądarce i jako aplikacja na telefonie (PWA), także offline.

👉 **Zagraj:** https://margib.github.io/Mistrz-Tabliczki---Konkursowy-trener-mno-enia-i-dzielenia/

*[English version below](#english)*

---

## Dla kogo

Dla uczniów klas 2–5, którzy uczą się tabliczki mnożenia albo przygotowują do konkursów matematycznych, a także dla rodziców i nauczycieli, którzy chcą im w tym pomóc.

Aplikację stworzyliśmy razem, tata z córką z 4 klasy, z myślą o rodzinie i znajomych. Potem trafiła do całej szkoły.

## Używana w szkołach

- **Szkoła Podstawowa nr 6 w Zgierzu** udostępniła aplikację całej społeczności szkolnej (listopad 2026).

Uczysz w szkole i korzystasz z aplikacji z uczniami? [Daj znać w zgłoszeniu](../../issues/new), a dopiszemy Twoją szkołę.

## Co potrafi

- **Ścieżka nauki krok po kroku**: od tabliczki × 2 i × 10 aż po cały zakres do 100, z odznakami i nagrodami.
- **Mądre powtórki**: algorytm SM-2 (jak w SuperMemo) wraca częściej do działań, które sprawiają trudność.
- **Turnieje i gry**: trening na czas, „prawda czy fałsz”, gra w pary, certyfikaty.
- **Grupy**: rodzina, znajomi lub klasa zakładają własną grupę, porównują postępy i rywalizują.
- **Uczciwa gra**: wykrywanie podejrzanych wyników, żeby rankingi były fair.
- **Działa offline**: postęp zapisuje się na urządzeniu, a do chmury synchronizuje oszczędnie w tle.

## Prywatność

Aplikacja **nie zbiera danych osobowych dzieci**: nie ma e-maili, imion ani wieku. Konto to tylko login i hasło.
Szczegóły: [polityka prywatności](public/prywatnosc.html). Konto można w każdej chwili usunąć w ustawieniach.

## Postaw własną kopię

Chcesz uruchomić aplikację dla swojej szkoły, na własnych zasadach? Całość działa na darmowych usługach.

1. Zrób **fork** tego repozytorium.
2. Utwórz darmowy projekt w [Firebase](https://console.firebase.google.com) (plan Spark), włącz **Authentication** i **Firestore**.
3. Wpisz konfigurację swojego projektu w `firebase-accounts-config.json` i opublikuj reguły z `firestore.rules` w konsoli Firebase. W Authentication → Settings → Authorized domains dodaj domenę swojej strony (np. `twojlogin.github.io`).
4. W ustawieniach repozytorium włącz **GitHub Pages** (źródło: GitHub Actions). Każdy push do `main` publikuje nową wersję.

### Praca lokalna

```bash
npm install
npm run dev      # podgląd na http://localhost:3000
npm run check    # typy + testy
npm run build    # wersja produkcyjna
```

Stos: React 19, TypeScript, Vite, Tailwind, Firebase (Auth + Firestore).

## Plan rozwoju

Na prośbę społeczności szkolnej powstaje **siostrzana aplikacja do języka polskiego**: części mowy, części zdania i ortografia. Postęp i pomysły śledzimy w [zgłoszeniach](../../issues).

## Współpraca

Pomysły, błędy i propozycje zgłaszaj w [Issues](../../issues). Pull requesty są mile widziane.

## Licencja

[MIT](LICENSE) © 2025–2026 Mariusz Gibki ([MarGib](https://margib.blogspot.com))

---

<a id="english"></a>
## English

**Mistrz Tabliczki** ("Times Table Master") is a free, open-source multiplication and division trainer for primary-school children. No ads, no tracking, no cost. It runs in the browser and as an installable, offline-capable PWA.

- **Used in schools:** shared by Primary School No. 6 in Zgierz, Poland with its whole school community (November 2026).
- **Features:** step-by-step learning path, SM-2 spaced repetition, tournaments and mini-games, self-organised groups (families, friends, classes) with progress comparison, fair-play detection, offline-first sync.
- **Privacy:** no personal data of children is collected. Accounts are just a login and password.
- **Self-host:** fork the repo, create a free Firebase project (Auth + Firestore), add your config, enable GitHub Pages. Everything runs on free tiers.
- **Roadmap:** a sister app for Polish grammar (parts of speech, sentence structure, spelling), requested by the school community.

Licensed under the [MIT License](LICENSE).
