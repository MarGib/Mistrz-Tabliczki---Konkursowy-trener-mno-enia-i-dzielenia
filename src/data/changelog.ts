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
