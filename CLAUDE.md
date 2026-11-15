# Mistrz Tabliczki — instrukcja dla Claude Code

Prywatna aplikacja (PWA) do nauki tabliczki mnożenia i dzielenia dla rodziny i znajomych MarGiba.
Odpowiadaj i pisz teksty w aplikacji **po polsku**, prostymi słowami (użytkownicy to dzieci i rodzice).

## Stos i uruchamianie

- Vite 8 + React 19 + TypeScript + Tailwind 4, `base: './'`.
- Firebase 12: Auth + Firestore, projekt `mistrz-tabliczki`, plan **Spark (darmowy)**, baza w `europe-central2` (Warszawa).
- Hosting: GitHub Pages przez GitHub Actions (`.github/workflows/deploy-pages.yml`), push do `main` = publikacja (~45 s).
- `npm run dev` · `npm run check` (tsc + testy `tsx --test src/**/*.test.ts`) · `npm run build` · `npx vite preview --port 4173`.
- Test przeglądarkowy: `python3 tools/smoke.py` (Playwright, wymaga `vite preview` na porcie 4173).
  Uwaga: `vite preview` cache'uje listę plików — po każdym `npm run build` uruchom podgląd od nowa.

## Zasady pracy

- Commit po każdym kroku (łatwy rollback), opisowe wiadomości po polsku: `feat:`, `fix:`, `chore:`.
- Przed pushem zawsze `npm run check` i `npm run build`; przy większych zmianach `tools/smoke.py`.
- Zmiana widoczna dla graczy → wpis na górze `src/data/changelog.ts` (id sortowalne, np. `2026-11-16`). Szczegóły: `RELEASING.md`.
- **Reguły bazy** (`firestore.rules`) publikuje się RĘCZNIE w konsoli Firebase, **zanim** wejdzie kod, który ich potrzebuje.
- Żadnych danych osobowych dzieci (bez e-maili, imion, wieku). Konta = login + hasło. Nie wpisuj prawdziwych loginów, kodów grup ani nazw grup do pomocy, zrzutów czy testów (używaj fikcyjnych: „Rodzina Nowaków”, `G-PRZYK`).
- Żadnych sekretów w repo (repo jest **publiczne**). Klucze/sekrety wpisuje właściciel.
- Konta testowe do prób: `testgraczA`, `testgraczB` (zostają).

## Mapa kodu

| Obszar | Pliki |
|---|---|
| Stan, synchronizacja, konta | `src/store/useAppStore.ts`, `src/engine/accountCloud.ts`, `cloudMerge.ts` |
| Ścieżka z kropkami | `src/data/path.ts`, `src/engine/path.ts`, `src/engine/nextStep.ts`, `components/StagePath.tsx`, `NextDotSplash.tsx` |
| Moduły, turnieje, odznaki | `src/data/curriculum.ts` |
| Gra i gry | `components/ExerciseArena.tsx`, `TrueFalseGame.tsx`, `PairsGame.tsx`, `engine/seriesRules.ts` |
| Silnik nauki | `engine/spacedRepetition.ts` (SM-2), `engine/problemGenerator.ts` |
| Historia i raport | `engine/history.ts` (archiwum + `accounts/{uid}/history/{RRRR-MM}`), `engine/weeklyReport.ts`, `components/WeeklyReportCard.tsx` |
| Uczciwa gra | `engine/integrity.ts`, `components/FairPlayNotice.tsx`, `components/AdminFairPlay.tsx`, kolekcja `reviews/{uid}` |
| Panel admina | `components/AdminPanel.tsx` (`#admin`), `engine/adminCloud.ts`, `engine/adminStats.ts`, `components/AdminBackup.tsx` |
| Wydania i offline | `src/autoUpdate.ts` (cichy release), `public/sw.js`, `src/data/changelog.ts` |
| Pomoc | `src/help/*` (treść, wyszukiwarka `helpSearch.ts`, zrzuty z `?__shots` → `public/help/*.webp`) |
| Prywatność | `public/prywatnosc.html`, `components/DeleteAccountCard.tsx` |
| App Check | `src/engine/appCheck.ts` (włączany kluczem reCAPTCHA v3 — czeka na właściciela) |
| Kopia zapasowa | panel → Baza; `.github/workflows/backup.yml` + `tools/backup.mjs` (czeka na sekrety) |

## Kolekcje Firestore

`logins` · `accounts/{uid}` (+ `history/{RRRR-MM}`) · `circles/{id}` (+ `members`, `players`) · `circleCodes` · `reviews` ·
`loginEvents` · `devices` · `appErrors` · `helpRequests` · `config/status` · `admins/{uid}` (`role`: `owner` = właściciel, jedno konto; `admin` = zaproszony) · `adminInvites/{email}` · `ownerAccounts/{uid}` (konto gracza ze skrótem do panelu).

## Ważne zachowania (nie psuć)

- Aplikacja działa w 100% offline; zapis najpierw na urządzeniu, do bazy w tle i oszczędnie (darmowy limit: 20 tys. zapisów/dobę).
- Cichy release: nowa wersja nie przeładowuje się w trakcie gry (`setGameActive`).
- Service worker: `ignoreVary` przy dopasowaniu plików; trzyma jedną poprzednią wersję plików.
- Szablon kolorów jest zapamiętany na urządzeniu (`mt_device_themes`), nie w chmurze.

## Otwarte sprawy

- Nowy układ telefonu — projekt do decyzji: https://claude.ai/artifact/KVq9bLRtx9175GLb9KhZkh
- App Check i automatyczna kopia — kroki dla właściciela w `RELEASING.md`.
- Wiedza o projekcie (decyzje, plan, dziennik) jest też w Obsidianie MarGiba: `10 Projekty/Mistrz Tabliczki/`.
