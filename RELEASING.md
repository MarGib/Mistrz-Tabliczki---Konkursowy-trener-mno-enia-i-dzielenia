# Jak wydawać nowe wersje Mistrza Tabliczki

Cel: gracze **niczego nie zauważają w trakcie gry**, a po powrocie do aplikacji widzą nową wersję i okienko **„Co nowego”**.

## Zwykłe wydanie (99% przypadków)

1. **Dopisz zmiany dla graczy** na górze `src/data/changelog.ts`:
   - nowy `id` (data, np. `2026-11-20`; drugie wydanie tego dnia: `2026-11-20b`),
   - 1–5 punktów pisanych prosto, dla dzieci i rodziców (co mogą teraz zrobić).
   - Drobna poprawka bez widocznych zmian → **bez wpisu** (nikt nie dostanie okienka).
2. Sprawdź lokalnie: `npm run lint && npm run build`.
3. `git push` do `main` → GitHub Actions publikuje na GitHub Pages (ok. 1 min).
4. Po publikacji: Panel administratora → **Przegląd** (wersje aplikacji na urządzeniach) i **Błędy**.

### Co dzieje się na urządzeniach

| Sytuacja | Zachowanie |
|---|---|
| Aplikacja otwarta, dziecko gra | nic — nowa wersja tylko pobiera się w tle |
| Dziecko wychodzi z aplikacji / blokuje ekran | po 1,5 s aplikacja niewidocznie przełącza się na nową wersję |
| Powrót do aplikacji | od razu nowa wersja + okienko „Co nowego” (raz) |
| Trwa seria zadań albo ktoś coś wpisuje | nigdy nie przeładowujemy — czekamy |
| Brak internetu | gra dalej na starej wersji, zaktualizuje się później |
| Nowy gracz (mniej niż 3 serie) | bez okienka „Co nowego” — dostaje przewodnik po aplikacji |

Postęp zapisuje się na bieżąco na urządzeniu, a niewysłane wyniki czekają w kolejce bazy — przełączenie wersji niczego nie gubi.
Service worker przy aktualizacji przenosi niezmienione pliki ze starej wersji, więc pobiera tylko to, co nowe.

## Duże wydanie (zmiana struktury danych w bazie)

1. Panel administratora → **Wydania** → „Przerwa techniczna”, wpisz komunikat i godzinę końca → Zapisz.
   Gracze zobaczą planszę przy najbliższym uruchomieniu/powrocie (najpóźniej w ok. 15 min). Mogą grać dalej — wyniki wyślą się po przerwie.
2. Opublikuj reguły bazy (jeśli się zmieniły) **przed** kodem, potem wypchnij kod.
3. Sprawdź działanie na swoim urządzeniu.
4. Wydania → „Wyłączony” → Zapisz. (Komunikat i tak zniknie sam po ustawionej godzinie.)

## Komunikat bez przerwy

Wydania → „Pasek z informacją” — np. zapowiedź przerwy albo nowego turnieju. Gracz może go zamknąć.

## Wycofanie wersji

`git revert <commit>` i `git push` — urządzenia przełączą się na poprzednią wersję tak samo po cichu.
