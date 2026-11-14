/** Treść instrukcji. Obrazki leżą w public/help/ (generowane z prawdziwych komponentów aplikacji). */
export type HelpSectionId =
  | 'start'
  | 'login'
  | 'install'
  | 'tour'
  | 'training'
  | 'hints'
  | 'path'
  | 'master'
  | 'tournaments'
  | 'certificates'
  | 'groups'
  | 'group-create'
  | 'group-join'
  | 'visibility'
  | 'stats'
  | 'rivalry'
  | 'notifications'
  | 'sync'
  | 'offline'
  | 'forgot'
  | 'logout'
  | 'parent';

export type HelpChapterId = 'first' | 'play' | 'groups' | 'account' | 'parent';

export const HELP_CHAPTERS: { id: HelpChapterId; title: string; emoji: string }[] = [
  { id: 'first', title: 'Pierwsze kroki', emoji: '👋' },
  { id: 'play', title: 'Trening i wyzwania', emoji: '🎯' },
  { id: 'groups', title: 'Grupy i statystyki', emoji: '👨‍👩‍👧' },
  { id: 'account', title: 'Konto i urządzenia', emoji: '☁️' },
  { id: 'parent', title: 'Dla rodzica', emoji: '🛡️' },
];

export interface HelpSection {
  id: HelpSectionId;
  chapter: HelpChapterId;
  title: string;
  lead: string;
  steps: string[];
  image?: string;
  imageAlt?: string;
  tip?: string;
}

export const HELP_SECTIONS: HelpSection[] = [
  /* ------------------------------ Pierwsze kroki ------------------------------ */
  {
    id: 'start',
    chapter: 'first',
    title: 'Jak zacząć — załóż konto',
    lead: 'Konto to Twój login i hasło. Dzięki nim wyniki zapisują się w chmurze i są na każdym urządzeniu.',
    steps: [
      'Na ekranie startowym wybierz „Utwórz nowe konto”.',
      'Wpisz login (np. imię lub ksywkę) — to nim będziesz się logować.',
      'Wymyśl hasło lub PIN (min. 4 znaki). Ikonka oka pokaże, co wpisujesz.',
      'Wybierz awatar i naciśnij „Utwórz konto i zacznij trening”.',
      'Po wejściu pokaże się krótki przewodnik po aplikacji — warto go przejść.',
    ],
    image: 'help/zaloz-konto.png',
    imageAlt: 'Formularz zakładania konta: login, hasło, awatar',
    tip: 'Zapisz login i hasło dziecka w bezpiecznym miejscu — przydadzą się na telefonie lub tablecie.',
  },
  {
    id: 'login',
    chapter: 'first',
    title: 'Logowanie na innym urządzeniu',
    lead: 'Masz już konto? Na nowym telefonie, tablecie lub komputerze wystarczy login i hasło.',
    steps: [
      'Otwórz aplikację i wybierz „Mam już konto”.',
      'Wpisz ten sam login i hasło co na pierwszym urządzeniu.',
      'Naciśnij „Zaloguj się” — wyniki, awatar, grupy i certyfikaty pobiorą się same.',
    ],
    image: 'help/mam-konto.png',
    imageAlt: 'Formularz logowania loginem i hasłem',
    tip: 'Login się nie zgadza? Sprawdź literówki — „ola” i „ola1” to dwa różne konta.',
  },
  {
    id: 'install',
    chapter: 'first',
    title: 'Zainstaluj jako aplikację (polecane)',
    lead: 'Zainstalowana gra otwiera się z ikonki na pełnym ekranie, bez pasków przeglądarki — jest więcej miejsca na zadania.',
    steps: [
      'Nad dolnym menu (na iPadzie i komputerze — w prawym dolnym rogu) pojawia się propozycja „Zainstaluj Mistrza Tabliczki”.',
      'Android i komputer: naciśnij „Zainstaluj” i potwierdź.',
      'iPhone i iPad: naciśnij „Jak?” — zobaczysz 3 kroki: Udostępnij → „Do ekranu początkowego” → „Dodaj”.',
      'Strona otwarta w Messengerze lub na Facebooku? Najpierw wybierz „Otwórz w przeglądarce”.',
      'Krzyżyk chowa propozycję — wróci za kilka dni. Instalować można też zawsze z zakładki Konto.',
    ],
    image: 'help/instalacja.png',
    imageAlt: 'Propozycja instalacji nad dolnym menu z instrukcją dla iPhone’a',
  },
  {
    id: 'tour',
    chapter: 'first',
    title: 'Przewodnik po aplikacji',
    lead: 'Krótka wycieczka, która podświetla po kolei najważniejsze miejsca: trening, ścieżkę, turnieje, statystyki, konto i pomoc.',
    steps: [
      'Pojawia się sam przy pierwszym wejściu na nowe konto.',
      '„Dalej” przechodzi do następnego miejsca, „Pomiń” zamyka przewodnik.',
      'Chcesz obejrzeć jeszcze raz? Użyj przycisku „Uruchom przewodnik” poniżej albo w zakładce Konto.',
    ],
  },

  /* ---------------------------- Trening i wyzwania ---------------------------- */
  {
    id: 'training',
    chapter: 'play',
    title: 'Trening i klawiatura',
    lead: 'Szybki trening to seria zadań z mnożenia i dzielenia. Odpowiedź wpisujesz na dużej klawiaturze.',
    steps: [
      'Naciśnij „Szybki Trening” (na komputerze u góry) albo „Rozpocznij serię” w zakładce Trening.',
      'Wpisz wynik cyframi i naciśnij „Sprawdź”. Zero jest szerokie — trudno w nie nie trafić.',
      'Pomarańczowy przycisk ⌫ kasuje ostatnią cyfrę. Przytrzymaj go, aby wyczyścić całą odpowiedź.',
      'Na końcu serii zobaczysz celność, tempo i działania, które warto powtórzyć.',
    ],
    image: 'help/klawiatura.png',
    imageAlt: 'Klawiatura: cyfry, szerokie zero, pomarańczowe cofanie i przycisk Sprawdź',
    tip: 'Aplikacja sama przypomina o powtórkach trudnych działań — przycisk „Powtórz teraz” na górze.',
  },
  {
    id: 'hints',
    chapter: 'play',
    title: 'Podpowiedzi w zadaniach',
    lead: 'Gdy długo się zastanawiasz, pod działaniem pojawia się podpowiedź — klawiatura zostaje na miejscu.',
    steps: [
      'Kolorowe klocki pokazują, jak rozbić działanie, np. 7 × 6 = 5 × 6 + 2 × 6.',
      'Przy dzieleniu widzisz „8 × ? = 56” i kolejne wielokrotności.',
      'Krzyżyk chowa podpowiedź, a „Pokaż podpowiedź” ją przywraca. Z podpowiedzią dostajesz trochę mniej punktów.',
    ],
    image: 'help/podpowiedz.png',
    imageAlt: 'Zadanie 7 × 6 z podpowiedzią w kolorowych klockach',
  },
  {
    id: 'path',
    chapter: 'play',
    title: 'Ścieżka Mistrza: Podstawy i Liga Mistrzów',
    lead: 'Ścieżka to 13 etapów — od rozgrzewki do zadań do 1000. Każdy kolejny odblokowuje się po zaliczeniu poprzedniego.',
    steps: [
      'Pasek u góry pokazuje, ile etapów masz już za sobą (np. „6 / 13 etapów”).',
      'Zakładki: „Podstawy” (zadania do 100, etapy 1–6) i „👑 Liga Mistrzów” (ponad 100: do 144, 200, 500 i 1000).',
      'Duża karta „Następny etap” to ten, który teraz gramy — naciśnij „Graj”.',
      'Poniżej krótka lista: ✓ zaliczone (można powtarzać), 🔒 jeszcze zablokowane.',
      'Etap zaliczasz, gdy zdobędziesz wymagany próg celności (np. 85%). Nagroda: XP, odznaka i certyfikat.',
    ],
    image: 'help/sciezka.png',
    imageAlt: 'Ścieżka Mistrza: postęp, zakładki lig, następny etap i lista etapów',
  },
  {
    id: 'master',
    chapter: 'play',
    title: 'Wyzwanie Mistrza — bez końca',
    lead: 'Fioletowa karta z poziomami, które nigdy się nie kończą. Poprzeczka rośnie razem z Tobą.',
    steps: [
      'Każdy poziom ma: zakres liczb, liczbę zadań, próg celności i limit tempa (sekundy na zadanie).',
      'Limit tempa liczony jest z Twoich ostatnich wyników — szybki gracz dostaje trudniejsze wyzwanie.',
      'Zaliczasz poziom, gdy masz wymaganą celność i mieścisz się w limicie tempa. Wtedy awansujesz na następny.',
      'Kolejne poziomy: większe liczby (aż do 1000), więcej zadań i szybsze tempo.',
      'Gdy przejdziesz całą Ścieżkę, Wyzwanie Mistrza wskakuje na górę zakładki Trening.',
    ],
    image: 'help/wyzwanie-mistrza.png',
    imageAlt: 'Karta Wyzwanie Mistrza z poziomem, liczbą zadań, celnością i limitem tempa',
  },
  {
    id: 'tournaments',
    chapter: 'play',
    title: 'Turnieje i medale',
    lead: 'Turnieje to próby na czas. Im szybciej i celniej, tym lepszy medal.',
    steps: [
      'Zakładka Turnieje: 8 turniejów — od klasycznych do 100 po Puchar Dwucyfrowy 200, Maraton 30 i Ligę Tytanów 1000.',
      'Medal zależy od czasu całej serii: brąz, srebro, złoto, a najlepsi zdobywają Puchar.',
      'Wynik musi też spełnić próg celności turnieju.',
      'Najlepszy wynik każdego turnieju zapisuje się na Twoim koncie — możesz go poprawiać.',
    ],
  },
  {
    id: 'certificates',
    chapter: 'play',
    title: 'Certyfikaty do druku',
    lead: 'Za medal w turnieju, zaliczony etap ścieżki albo poziom Wyzwania Mistrza dostajesz certyfikat z imieniem i wynikiem.',
    steps: [
      'Po udanej serii pojawia się żółta ramka „Zdobyto certyfikat!” → „Zobacz certyfikat”.',
      '„Drukuj” — kartka A4 poziomo (na telefonie można wybrać „Zapisz jako PDF”).',
      '„Pobierz” zapisuje obrazek, „Udostępnij” wysyła go np. rodzinie.',
      'Wszystkie zdobyte certyfikaty znajdziesz w zakładce Turnieje → „Moje certyfikaty”.',
    ],
    image: 'help/certyfikat.png',
    imageAlt: 'Przykładowy certyfikat ze złotym medalem',
  },

  /* ---------------------------- Grupy i statystyki ---------------------------- */
  {
    id: 'groups',
    chapter: 'groups',
    title: 'Co to są grupy i jak je przełączać?',
    lead: 'Grupa to Twoje grono do wspólnego treningu: rodzina, paczka znajomych, drużyna.',
    steps: [
      'Możesz należeć do kilku grup naraz. Każda ma własny ranking — wyniki się nie mieszają.',
      'Na górze zakładki Statystyki widzisz przyciski: „Moje konta” (konta z tego urządzenia) i Twoje grupy.',
      'Gdy grup jest dużo, część chowa się pod „+2 więcej” — wybrana grupa jest zawsze widoczna.',
      '„Zarządzaj” (po prawej) otwiera listę grup: zakładanie, dołączanie kodem, widoczność i opuszczanie.',
      'Pod przyciskami: liczba osób widocznych w rankingu, kod grupy i „Zaproś”.',
    ],
    image: 'help/grupy.png',
    imageAlt: 'Wybór grupy: Moje konta, grupy, przycisk Zarządzaj, kod i Zaproś',
  },
  {
    id: 'group-create',
    chapter: 'groups',
    title: 'Jak założyć grupę i zaprosić innych',
    lead: 'Grupę zakłada jedna osoba, a potem wysyła zaproszenie.',
    steps: [
      'Statystyki → „Dodaj grupę” (albo „Zarządzaj”, jeśli masz już jakąś grupę).',
      'Wpisz nazwę, np. „Rodzinka G”, i naciśnij „Załóż”.',
      'Pojawi się karta z kodem grupy. „Wyślij zaproszenie” — link SMS-em, WhatsAppem lub Messengerem.',
      'Kolejne osoby zaprosisz przyciskiem „Zaproś” obok kodu grupy.',
    ],
    image: 'help/grupa-zalozona.png',
    imageAlt: 'Karta „Grupa gotowa” z kodem i przyciskiem Wyślij zaproszenie',
    tip: 'Wystarczy przekazać link z zaproszenia. Bez linku podaj kod grupy, np. G-9GSVX.',
  },
  {
    id: 'group-join',
    chapter: 'groups',
    title: 'Jak dołączyć do grupy',
    lead: 'Dostałeś zaproszenie? Dołączenie zajmuje kilka sekund.',
    steps: [
      'Kliknij link z zaproszenia, zaloguj się lub załóż konto.',
      'Na górze pojawi się pasek „Masz zaproszenie do grupy” — naciśnij „Dołącz”.',
      'Masz tylko kod? Statystyki → „Zarządzaj” / „Dodaj grupę” → wpisz kod w „Dołącz kodem” → „Dołącz”.',
    ],
    image: 'help/zaproszenie.png',
    imageAlt: 'Pasek zaproszenia z przyciskiem Dołącz',
  },
  {
    id: 'visibility',
    chapter: 'groups',
    title: 'Kto widzi moje wyniki?',
    lead: 'Twoje wyniki widzą tylko członkowie grup, w których je pokazujesz. Nikt inny.',
    steps: [
      'Statystyki → „Zarządzaj”: przy każdej grupie jest przełącznik „Moje wyniki widoczne / ukryte”.',
      'Grupa z ukrytymi wynikami ma przy nazwie przekreślone oko.',
      'Ukryte wyniki znikają z rankingu tej grupy, ale dalej widzisz innych.',
      '„Opuść” usuwa Cię z grupy razem z Twoimi wynikami w niej.',
    ],
    image: 'help/widocznosc.png',
    imageAlt: 'Lista grup z przełącznikiem widoczności wyników i przyciskiem Opuść',
  },
  {
    id: 'stats',
    chapter: 'groups',
    title: 'Co pokazują statystyki?',
    lead: 'Zakładka Statystyki pokazuje wyniki wybranej grupy (albo kont z tego urządzenia).',
    steps: [
      'Tabela wyników: ranking osób w grupie — XP, celność, tempo. Aktualizuje się na żywo, gdy ktoś skończy serię.',
      'Kafelki grupy: łączne punkty i lider, zadania rozwiązane razem, średnia celność i średnie tempo grupy.',
      'Tendencja szybkości i skuteczności: wykres ostatnich serii każdej osoby. Niższa linia tempa = szybsze odpowiedzi.',
      'Przełącznik nad wykresem zmienia go między „Szybkość” a „Skuteczność (%)”. Imiona pod spodem włączają i wyłączają linie.',
      '„Przećwicz najtrudniejsze” uruchamia serię z działań, które sprawiają Ci najwięcej kłopotu.',
    ],
    tip: 'Wykres pokazuje 12 ostatnich serii. Nowa osoba w grupie pojawi się na nim po pierwszej serii.',
  },
  {
    id: 'rivalry',
    chapter: 'groups',
    title: 'Wyzwania w grupie — kogo mogę dogonić?',
    lead: 'Pod tabelą wyników jest sekcja „Wyzwania w grupie”: porównanie w 8 kategoriach, żeby było kogo gonić.',
    steps: [
      'Kolorowa karta „Twój najbliższy cel” mówi, kogo najłatwiej teraz wyprzedzić i ile brakuje (np. „brakuje 120 XP — to ok. 2 serie”).',
      'Kategorie: punkty XP, serie w tym tygodniu, dni z rzędu, celność, tempo, rozwiązane zadania, postęp w tempie i medale z turniejów.',
      'W każdej kategorii: podium 🥇🥈🥉 z paskami, Twoje miejsce (np. „3. / 5”) i wskazówka, co zrobić, by wyprzedzić osobę przed Tobą.',
      'Najpierw widać 4 kategorie, w których najłatwiej awansować. „Pokaż wszystkie kategorie” rozwija resztę.',
      'Prowadzisz? Zobaczysz 👑 i listę kategorii, w których jesteś najlepszy.',
    ],
    image: 'help/wyzwania-w-grupie.png',
    imageAlt: 'Wyzwania w grupie: najbliższy cel i kategorie z podium',
  },
  {
    id: 'notifications',
    chapter: 'groups',
    title: 'Powiadomienia',
    lead: 'Dzwoneczek na górze pokazuje, gdy ktoś z Twojej grupy Cię wyprzedzi albo pobije rekord.',
    steps: [
      'Liczba na dzwonku oznacza nowe powiadomienia.',
      'Kliknij dzwonek, aby je przeczytać — „Zobacz” prowadzi do rankingu.',
    ],
    image: 'help/powiadomienia.png',
    imageAlt: 'Powiadomienie: ktoś wyprzedza Cię w grupie',
  },

  /* ---------------------------- Konto i urządzenia ---------------------------- */
  {
    id: 'sync',
    chapter: 'account',
    title: 'Synchronizacja — co znaczą komunikaty?',
    lead: 'Konto z hasłem synchronizuje się samo. Wyniki najpierw zapisują się na urządzeniu, a potem wysyłają do chmury — nic nie ginie.',
    steps: [
      'Zakładka Konto → „☁ Zsynchronizowano”: wszystko w porządku.',
      'Niebieski pasek „Czekam na połączenie / Wyniki czekają na wysłanie”: chwilowy brak internetu albo wolna baza. Nic nie trzeba robić — aplikacja ponawia sama (licznik pokazuje, kiedy). Można grać dalej, a „Spróbuj teraz” ponawia od razu.',
      'Żółty pasek „Wpisz hasło konta…”: hasło zmieniono na innym urządzeniu albo konto powstało przed chmurą. Wpisz hasło i naciśnij „Włącz”.',
      'Wyniki wysyłają się także po zamknięciu i ponownym otwarciu aplikacji.',
    ],
    image: 'help/synchronizacja-czeka.png',
    imageAlt: 'Niebieski pasek: wyniki czekają na wysłanie, licznik i przycisk Spróbuj teraz',
  },
  {
    id: 'offline',
    chapter: 'account',
    title: 'Gdy nie ma internetu albo bazy',
    lead: 'Aplikacja działa w pełni także bez internetu i bez bazy. Synchronizacja dzieje się zawsze, gdy tylko jest to możliwe.',
    steps: [
      'Trening, Ścieżka Mistrza, Wyzwanie Mistrza, turnieje, certyfikaty (druk i pobieranie) i Twoje statystyki działają zawsze, również bez internetu.',
      'Gdy baza jest niedostępna, wyniki czekają na urządzeniu i wysyłają się same później — nawet po zamknięciu aplikacji.',
      'Gdy baza ma chwilowe problemy (np. wyczerpany dzienny limit darmowej bazy), na górze pojawia się niebieski komunikat — można dalej grać bez przeszkód.',
      'Bez połączenia z bazą nie odświeżają się tylko: rankingi grup i logowanie na nowym urządzeniu. Wszystko inne działa normalnie.',
    ],
  },
  {
    id: 'forgot',
    chapter: 'account',
    title: 'Nie pamiętam hasła',
    lead: 'Hasło może ustawić od nowa rodzic (administrator aplikacji).',
    steps: [
      'Poproś rodzica o nowe hasło — ustawi je w panelu administratora.',
      'Zaloguj się nowym hasłem: „Mam już konto” → login → nowe hasło.',
      'Na urządzeniach, na których konto było otwarte, pojawi się żółty pasek — wpisz tam nowe hasło.',
    ],
  },
  {
    id: 'logout',
    chapter: 'account',
    title: 'Wylogowanie i zmiana osoby',
    lead: 'Na wspólnym tablecie każdy może mieć swoje konto.',
    steps: [
      '„Zmień osobę” na ekranie Treningu przełącza między kontami na tym urządzeniu.',
      '„Wyloguj” w zakładce Konto usuwa konto z tego urządzenia. Wyniki zostają w chmurze — wrócisz przez „Mam już konto”.',
    ],
  },

  /* ------------------------------- Dla rodzica ------------------------------- */
  {
    id: 'parent',
    chapter: 'parent',
    title: 'Panel administratora (rodzic)',
    lead: 'Rodzic ma osobny panel: lista kont, dziennik logowań i ustawianie nowych haseł.',
    steps: [
      'Otwórz adres aplikacji z dopiskiem #admin na końcu albo, na swoim urządzeniu, Konto → „Panel administratora”.',
      'Zaloguj się kontem Google właściciela aplikacji.',
      '„Konta”: login, imię, XP, liczba serii, ostatnia aktywność i grupy każdego dziecka.',
      '„Nowe hasło” przy koncie: wpisz nowy PIN lub hasło (min. 4 znaki) i przekaż go dziecku.',
      '„Logowania”: kto i kiedy próbował się zalogować, z jakiego urządzenia i czy się udało (hasła nie są zapisywane).',
    ],
    tip: 'Uprawnienie Google do zmiany haseł jest ważne ok. godziny — potem panel poprosi o ponowne zalogowanie.',
  },
];
