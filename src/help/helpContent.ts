/** Treść instrukcji. Obrazki leżą w public/help/ (generowane z prawdziwych komponentów aplikacji). */
export type HelpSectionId =
  | 'start'
  | 'login'
  | 'sync'
  | 'groups'
  | 'group-create'
  | 'group-join'
  | 'visibility'
  | 'notifications'
  | 'hints'
  | 'logout'
  | 'install';

export interface HelpSection {
  id: HelpSectionId;
  title: string;
  lead: string;
  steps: string[];
  image?: string;
  imageAlt?: string;
  tip?: string;
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'start',
    title: 'Jak zacząć — załóż konto',
    lead: 'Konto to Twój login i hasło. Dzięki nim wyniki zapisują się w chmurze i są na każdym urządzeniu.',
    steps: [
      'Na ekranie startowym wybierz „Utwórz nowe konto”.',
      'Wpisz login (np. imię lub ksywkę) — to nim będziesz się logować.',
      'Wymyśl hasło lub PIN (min. 4 znaki). Ikonka oka pokaże, co wpisujesz.',
      'Wybierz awatar i naciśnij „Utwórz konto i zacznij trening”.',
    ],
    image: 'help/zaloz-konto.png',
    imageAlt: 'Formularz zakładania konta: login, hasło, awatar',
    tip: 'Zapisz login i hasło dziecka w bezpiecznym miejscu — przydadzą się na telefonie lub tablecie.',
  },
  {
    id: 'login',
    title: 'Logowanie na innym urządzeniu',
    lead: 'Masz już konto? Na nowym telefonie, tablecie lub komputerze wystarczy login i hasło.',
    steps: [
      'Otwórz aplikację i wybierz „Mam już konto”.',
      'Wpisz ten sam login i hasło co na pierwszym urządzeniu.',
      'Naciśnij „Zaloguj się” — wyniki, awatar i grupy pobiorą się automatycznie.',
    ],
    image: 'help/mam-konto.png',
    imageAlt: 'Formularz logowania loginem i hasłem',
    tip: 'Konto Google jest tylko dodatkową opcją — nie jest potrzebne.',
  },
  {
    id: 'sync',
    title: 'Synchronizacja wyników',
    lead: 'Konto z hasłem synchronizuje się samo — po każdej serii wyniki trafiają do chmury.',
    steps: [
      'W zakładce Konto, przy „Login i hasło”, zobaczysz „☁ Zsynchronizowano”.',
      'Jeśli na górze pojawi się żółty pasek „Wpisz hasło…”, wpisz hasło i naciśnij „Włącz”. Tak jest przy kontach założonych przed wprowadzeniem chmury.',
      'Bez internetu nic nie ginie — wyniki wyślą się, gdy połączenie wróci.',
    ],
    image: 'help/synchronizacja.png',
    imageAlt: 'Żółty pasek z prośbą o wpisanie hasła, aby włączyć synchronizację',
  },
  {
    id: 'groups',
    title: 'Co to są grupy?',
    lead: 'Grupa to Twoje grono do wspólnego treningu: rodzina, paczka znajomych, drużyna.',
    steps: [
      'Możesz należeć do kilku grup naraz, np. „Rodzina” i „Nasza paczka”.',
      'Każda grupa ma własny ranking i statystyki — wyniki z różnych grup się nie mieszają.',
      'Grupę wybierasz przyciskami na górze zakładek Statystyki i Turnieje. „Moje konta” to konta z tego urządzenia.',
    ],
    image: 'help/grupy.png',
    imageAlt: 'Przełącznik grup: Moje konta, Rodzina, Nasza paczka',
  },
  {
    id: 'group-create',
    title: 'Jak założyć grupę i zaprosić innych',
    lead: 'Grupę zakłada jedna osoba, a potem wysyła zaproszenie.',
    steps: [
      'Wejdź w Statystyki → „Dodaj grupę”.',
      'Wpisz nazwę, np. „Rodzinka G”, i naciśnij „Załóż”.',
      'Pojawi się karta z kodem grupy. Naciśnij „Wyślij zaproszenie” — możesz wysłać link SMS-em, WhatsAppem lub Messengerem.',
      'Później zaprosisz kolejne osoby przyciskiem „Zaproś” obok kodu grupy.',
    ],
    image: 'help/grupa-zalozona.png',
    imageAlt: 'Karta „Grupa gotowa” z kodem i przyciskiem Wyślij zaproszenie',
    tip: 'Co komu przekazać? Wystarczy link z zaproszenia. Bez linku podaj kod grupy, np. G-9GSVX.',
  },
  {
    id: 'group-join',
    title: 'Jak dołączyć do grupy',
    lead: 'Dostałeś zaproszenie? Dołączenie zajmuje kilka sekund.',
    steps: [
      'Kliknij link z zaproszenia, zaloguj się lub załóż konto.',
      'Na górze pojawi się pasek „Masz zaproszenie do grupy” — naciśnij „Dołącz”.',
      'Masz tylko kod? Wejdź w Statystyki → „Dodaj grupę” → wpisz kod w „Dołącz kodem” → „Dołącz”.',
    ],
    image: 'help/zaproszenie.png',
    imageAlt: 'Pasek zaproszenia z przyciskiem Dołącz',
  },
  {
    id: 'visibility',
    title: 'Kto widzi moje wyniki?',
    lead: 'Twoje wyniki widzą tylko członkowie grup, w których je pokazujesz. Nikt inny.',
    steps: [
      'W Statystyki → „Grupy” przy każdej grupie jest przełącznik „Moje wyniki widoczne / ukryte”.',
      'Ukryte wyniki znikają z rankingu tej grupy, ale dalej widzisz innych.',
      '„Opuść” usuwa Cię z grupy razem z Twoimi wynikami w niej.',
    ],
    image: 'help/widocznosc.png',
    imageAlt: 'Lista grup z przełącznikiem widoczności wyników i przyciskiem Opuść',
  },
  {
    id: 'notifications',
    title: 'Powiadomienia',
    lead: 'Dzwoneczek na górze pokazuje, gdy ktoś z Twojej grupy Cię wyprzedzi albo pobije rekord.',
    steps: [
      'Czerwona liczba na dzwonku oznacza nowe powiadomienia.',
      'Kliknij dzwonek, aby je przeczytać — „Zobacz” prowadzi do rankingu.',
    ],
    image: 'help/powiadomienia.png',
    imageAlt: 'Powiadomienie: ktoś wyprzedza Cię w grupie',
  },
  {
    id: 'hints',
    title: 'Podpowiedzi w zadaniach',
    lead: 'Gdy długo się zastanawiasz, pod działaniem pojawia się podpowiedź — klawiatura zostaje na miejscu.',
    steps: [
      'Kolorowe klocki pokazują, jak rozbić działanie, np. 7 × 6 = 5 × 6 + 2 × 6.',
      'Przy dzieleniu widzisz „8 × ? = 56” i kolejne wielokrotności.',
      'Krzyżyk chowa podpowiedź, a przycisk „Pokaż podpowiedź” ją przywraca. Z podpowiedzią dostajesz trochę mniej punktów.',
    ],
    image: 'help/podpowiedz.png',
    imageAlt: 'Zadanie 7 × 6 z podpowiedzią w kolorowych klockach',
  },
  {
    id: 'logout',
    title: 'Wylogowanie i zmiana osoby',
    lead: 'Na wspólnym tablecie każdy może mieć swoje konto.',
    steps: [
      '„Zmień osobę” na ekranie Treningu przełącza między kontami na tym urządzeniu.',
      '„Wyloguj” w zakładce Konto usuwa konto z tego urządzenia. Wyniki zostają w chmurze — wrócisz przez „Mam już konto”.',
    ],
  },
  {
    id: 'install',
    title: 'Aplikacja na telefonie',
    lead: 'Mistrza Tabliczki można dodać do ekranu głównego — otwiera się wtedy jak zwykła aplikacja.',
    steps: [
      'Najprościej: zakładka Konto → „Zainstaluj aplikację na tym urządzeniu”.',
      'Android (Chrome): jeśli przycisku nie ma, menu ⋮ → „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.',
      'iPhone/iPad: otwórz stronę w Safari → przycisk Udostępnij → „Do ekranu początkowego”. (W Chrome na iPhonie instalacja działa tylko przez Safari.)',
      'Otwieranie w Messengerze, Facebooku lub innej aplikacji nie pozwala instalować — wybierz „Otwórz w przeglądarce”.',
    ],
  },
];
