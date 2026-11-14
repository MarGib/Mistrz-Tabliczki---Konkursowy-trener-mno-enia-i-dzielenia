/**
 * Lista zmian pokazywana graczom w okienku „Co nowego” po aktualizacji.
 *
 * JAK WYDAĆ NOWĄ WERSJĘ (szczegóły: RELEASING.md):
 *  1. Dopisz NA GÓRZE nowy wpis z nowym `id` (data, a gdy kilka wydań jednego dnia: 2026-11-20b).
 *  2. Pisz prosto, dla dzieci i rodziców: co mogą teraz zrobić, a nie jak to działa w kodzie.
 *  3. Drobne poprawki bez widocznych zmian — nie dopisuj wpisu (nikt nie dostanie okienka).
 *  4. Commit + push do main → GitHub Actions publikuje, a aplikacje podmieniają się po cichu.
 */
export interface ReleaseNote {
  /** Unikalny i rosnący identyfikator, np. '2026-11-14'. */
  id: string;
  /** Data czytelna dla ludzi. */
  date: string;
  title: string;
  items: { emoji: string; text: string }[];
}

export const RELEASES: ReleaseNote[] = [
  {
    id: '2026-11-15c',
    date: '15 listopada 2026',
    title: 'Płynniej po ścieżce',
    items: [
      { emoji: '➡️', text: '„Dalej po ścieżce” od razu prowadzi do następnej kropki — z krótkim ekranem, co teraz robimy.' },
      { emoji: '📍', text: 'Po wyjściu z kropki wracasz dokładnie do swojego miejsca na ścieżce.' },
      { emoji: '✅', text: '„Prawda czy fałsz” i „Pary” nie zmieniają już pytań, zanim odpowiesz.' },
    ],
  },
  {
    id: '2026-11-15b',
    date: '15 listopada 2026',
    title: 'Uczciwa gra',
    items: [
      { emoji: '🛡️', text: 'Rankingi są uczciwe: aplikacja zauważa serie grane przez automat albo z podpowiedziami i przekazuje je opiekunowi do sprawdzenia.' },
      { emoji: '🙂', text: 'Szybkie liczenie z pamięci jest super — nikt nie jest za nie karany, a w czasie sprawdzania można dalej grać.' },
    ],
  },
  {
    id: '2026-11-15',
    date: '15 listopada 2026',
    title: 'Ścieżka z kropkami, gry i wolny trening',
    items: [
      { emoji: '🗺️', text: 'Każdy moduł to kilka krótkich kropek (2–3 minuty): poznaj sposób liczenia, ćwicz, zagraj, a na końcu test modułu.' },
      { emoji: '🧩', text: 'Nowe gry: Pary, Prawda czy fałsz, Wyścig z czasem, zadania z luką i historyjki.' },
      { emoji: '🌉', text: 'Nowy moduł „Most do Ligi” i łagodniejsze progi w Lidze Mistrzów.' },
      { emoji: '🎲', text: 'Wolny trening: sam wybierasz, co, ile minut i które tabliczki — albo „Tylko moje trudne”.' },
      { emoji: '🔒', text: 'Nie podajesz żadnych danych — login możesz wylosować przyciskiem 🎲.' },
    ],
  },
  {
    id: '2026-11-14d',
    date: '14 listopada 2026',
    title: 'Wygodniej na tablecie',
    items: [
      { emoji: '📱', text: 'Na iPadzie i tablecie gra wypełnia cały ekran: duże działanie i duże klawisze — poziomo i pionowo.' },
    ],
  },
  {
    id: '2026-11-14c',
    date: '14 listopada 2026',
    title: 'Cel na dziś i rekordy',
    items: [
      { emoji: '🎯', text: 'Pasek „Cel na dziś” pokazuje, ile serii zostało. Rodzic ustawia cel w zakładce Konto (domyślnie 3).' },
      { emoji: '🏆', text: 'Po serii zobaczysz, gdy pobijesz swój rekord tempa albo pierwszy raz zagrasz bez błędu.' },
      { emoji: '👨‍👩‍👧', text: 'Powtórki ćwiczą całe rodziny działań: pomyłka przy 7 × 8 dokłada też 8 × 7, 56 : 7 i 56 : 8.' },
      { emoji: '🧠', text: 'Po serii widać, ile działań znasz z pamięci (poniżej 3 sekund).' },
      { emoji: '🔠', text: 'W Koncie można włączyć duży tekst.' },
    ],
  },
  {
    id: '2026-11-14b',
    date: '14 listopada 2026',
    title: 'Graj dalej jednym dotknięciem',
    items: [
      { emoji: '▶️', text: 'Nowy duży przycisk „Graj dalej” na górze ekranu sam wybiera, co dziś najlepiej ćwiczyć: powtórki, następny etap albo Wyzwanie Mistrza.' },
      { emoji: '💡', text: 'Po każdej serii zobaczysz jedną wskazówkę, np. które działanie warto zapamiętać.' },
      { emoji: '⚡', text: 'Aplikacja uruchamia się szybciej.' },
    ],
  },
  {
    id: '2026-11-14',
    date: '14 listopada 2026',
    title: 'Pomoc jednym kliknięciem i spokojne aktualizacje',
    items: [
      { emoji: '🛟', text: 'Nie pamiętasz hasła? Na ekranie logowania kliknij „Nie pamiętam hasła” i wyślij prośbę — rodzic ustawi nowe.' },
      { emoji: '🔄', text: 'Aplikacja aktualizuje się sama, po cichu, gdy z niej wychodzisz. Nigdy w trakcie zadań.' },
      { emoji: '✨', text: 'Po każdej większej zmianie zobaczysz takie okienko i dowiesz się, co nowego.' },
    ],
  },
  {
    id: '2026-11-13',
    date: '13 listopada 2026',
    title: 'Liga Mistrzów, certyfikaty i gra bez internetu',
    items: [
      { emoji: '🏆', text: 'Liga Mistrzów: 7 nowych etapów aż do 1000 i 4 nowe turnieje.' },
      { emoji: '♾️', text: 'Wyzwanie Mistrza — coraz trudniejsze zadania bez końca, dopasowane do Twojego tempa.' },
      { emoji: '📜', text: 'Certyfikaty do wydrukowania za ukończone etapy i turnieje (zakładka Turnieje).' },
      { emoji: '⚔️', text: 'Wyzwania w grupie: zobacz, kogo możesz dogonić w 8 kategoriach.' },
      { emoji: '📶', text: 'Zainstalowana aplikacja działa bez internetu — wyniki wyślą się, gdy sieć wróci.' },
    ],
  },
];

export const LATEST_RELEASE_ID = RELEASES[0]?.id ?? '';
