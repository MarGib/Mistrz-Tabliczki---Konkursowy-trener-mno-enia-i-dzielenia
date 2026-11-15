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

## Administratorzy panelu

- **Właściciel** (jedno konto, `admins/{uid}` z `role: "owner"`, nadane ręcznie w konsoli): wszystko, w tym zakładki Baza i Wydania, blokady kont, usuwanie danych i odbieranie uprawnień.
- **Administrator** (`role: "admin"`): przegląda panel, ustawia nowe hasła, oznacza prośby jako załatwione i zaprasza kolejne osoby. Nie może odebrać uprawnień nikomu.
- Nowy administrator: Panel → **Administratorzy** → wpisz adres Google → Zaproś. Osoba otwiera adres aplikacji z `#admin` i loguje się tym kontem — uprawnienia nadają się same.
- Żeby mógł zmieniać hasła (robi to właściciel, raz na osobę): Google Cloud → projekt → **IAM** → „Przyznaj dostęp” → jego adres Google, role **Firebase Authentication Admin** i **Service Usage Consumer**. Gdy ekran zgody OAuth jest w trybie „Testing”, dopisz go też jako testera.
- Skrót do panelu w Koncie gracza: Panel → Konta → „⭐ Moje konto” przy koncie gracza.

## Uczciwa gra i ochrona bazy

**Co działa samo:**
- Czujnik w grze (`src/engine/integrity.ts`) ocenia każdą serię. Mocny sygnał (automat, odpowiedzi < 0,45 s, dwa słabe naraz) zapisuje `reviews/{uid}` ze stanem `pending`. Wtedy karta gracza znika z rankingów grup, a reguły bazy nie przyjmują nowej karty do decyzji opiekuna. Słaby sygnał zapisuje `watch`.
- Panel → **Uczciwa gra**: zgłoszenia i decyzje (W porządku / Zaufaj / Zablokuj) oraz skan danych na serwerze (serie „w 0 s”, urządzenia z ≥ 5 kontami, zgadywanie haseł).
- Blokada (`suspended`): baza nie przyjmuje zapisów konta, a gracz widzi ekran „Konto jest wstrzymane” z prośbą o kontakt. Całkowite wyłączenie logowania: Firebase → Authentication → konto → Disable.
- Limity na urządzeniu: 3 nowe konta dziennie; po 5 błędnych hasłach 5 minut przerwy. Firebase Auth dodatkowo sam spowalnia zgadywanie haseł.
- Na lokalnym serwerze (`localhost`, testy) nic nie jest zgłaszane do bazy.

**Do włączenia ręcznie (zalecane) — App Check:**
1. https://www.google.com/recaptcha/admin → nowy klucz **reCAPTCHA v3**, domena `margib.github.io`.
2. Klucz **witryny** wpisz w `src/engine/appCheck.ts` (`RECAPTCHA_SITE_KEY`) i wydaj wersję.
3. Firebase → App Check → aplikacja web → reCAPTCHA v3 → wklej klucz **tajny** (robi to właściciel, nie trafia do kodu).
4. Przez kilka dni obserwuj w App Check odsetek „zweryfikowanych” zapytań. Gdy jest blisko 100%: Firestore i Authentication → **Wymuszaj**.

**Ataki na dostępność (DDoS):** stronę serwuje GitHub Pages przez CDN (ochrona po stronie GitHuba). Baza jest na planie Spark, więc nie ma rachunku. W najgorszym razie dzienny limit się wyczerpie, a aplikacja przechodzi wtedy w tryb „wyniki wyślą się później” i gra działa dalej. App Check odcina skrypty spoza aplikacji.

## Kopia zapasowa bazy

**Ręcznie (działa od razu):** panel → **Baza** → „Pobierz kopię (JSON)”. Gdy minie tydzień od ostatniej kopii, na „Przeglądzie” pojawia się przypomnienie. Plik trzymaj w prywatnym miejscu.

**Automatycznie co tydzień (GitHub Actions, `.github/workflows/backup.yml`):** kopia jest szyfrowana, bo repozytorium jest publiczne, i trzymana 90 dni jako artefakt przebiegu. Włączenie (raz, ok. 5 min, robi to właściciel, bo to klucze):
1. Firebase → ⚙️ Ustawienia projektu → **Konta usługi** → „Wygeneruj nowy klucz prywatny” (plik JSON).
2. GitHub → repozytorium → Settings → Secrets and variables → Actions → **New repository secret**:
   - `FIREBASE_SERVICE_ACCOUNT`: cała zawartość pliku JSON z kroku 1,
   - `BACKUP_PASSPHRASE`: długie hasło do szyfrowania kopii (zapisz je w menedżerze haseł).
3. Usuń plik JSON z dysku. Sprawdzenie: Actions → „Kopia zapasowa bazy” → Run workflow.

Bez sekretów workflow kończy się z informacją „kopia pominięta”, bez błędu.

**Odszyfrowanie:** pobierz artefakt „kopia-bazy”, rozpakuj zip, potem:
`openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in kopia-RRRR-MM-DD.json.gz.enc -out kopia.json.gz && gunzip kopia.json.gz`

**Odtworzenie:** dokumenty są w `data[kolekcja][ścieżka]`, a daty jako `{"__time": ms}`. Odtwarzamy skryptem (`firebase-admin`, `set` każdego dokumentu). Konta logowania (`authUsers`) zakłada się na nowo, a gracze logują się swoim loginem i hasłem.
