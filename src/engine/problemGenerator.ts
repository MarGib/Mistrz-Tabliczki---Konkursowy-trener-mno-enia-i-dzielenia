import type {
  FactMemory,
  MathProblem,
  OperationMode,
  OperationType,
  VisualHintData,
} from '../types/math';
import { getDifficultyScore } from './spacedRepetition';

export function makeProblemId(op: OperationType, a: number, b: number): string {
  return op === 'mul' ? `mul:${a}x${b}` : `div:${a}/${b}`;
}

export function createProblem(op: OperationType, a: number, b: number): MathProblem {
  if (op === 'mul') {
    return {
      id: makeProblemId('mul', a, b),
      op: 'mul',
      a,
      b,
      answer: a * b,
      display: `${a} × ${b}`,
    };
  }
  return {
    id: makeProblemId('div', a, b),
    op: 'div',
    a,
    b,
    answer: Math.round(a / b),
    display: `${a} ÷ ${b}`,
  };
}

/**
 * Generates the catalog of multiplication and division facts up to maxRange.
 * For maxRange <= 100, keeps factors intuitive (2..10, plus 11/12 when product <= maxRange).
 * When maxRange is expanded (144, 200, 500, 1000), expands factors cleanly so learners progress into harder multi-digit products!
 */
export function buildFactCatalog(mode: OperationMode, maxRange: number): MathProblem[] {
  const problems: MathProblem[] = [];
  const maxFactor = maxRange <= 100 ? 10 : maxRange <= 144 ? 12 : Math.min(25, Math.floor(Math.sqrt(maxRange)) + 4);

  const includeMul = mode === 'mul' || mode === 'mixed';
  const includeDiv = mode === 'div' || mode === 'mixed';

  for (let a = 2; a <= maxFactor; a++) {
    for (let b = 2; b <= maxFactor; b++) {
      const product = a * b;
      if (product <= maxRange && product >= 4) {
        if (includeMul) {
          problems.push(createProblem('mul', a, b));
        }
        if (includeDiv) {
          problems.push(createProblem('div', product, a));
        }
      }
    }
  }

  // If maxRange > 144, add extra rich two-digit × one-digit facts up to maxRange (e.g., 14 × 7 = 98 or 18 × 6 = 108)
  if (maxRange > 100) {
    const upperFirst = Math.min(99, Math.floor(maxRange / 2));
    for (let a = 11; a <= upperFirst; a++) {
      for (let b = 2; b <= 9; b++) {
        const product = a * b;
        if (product > 100 && product <= maxRange) {
          if (includeMul && !problems.some((p) => p.id === makeProblemId('mul', a, b))) {
            problems.push(createProblem('mul', a, b));
          }
          if (includeDiv && !problems.some((p) => p.id === makeProblemId('div', product, b))) {
            problems.push(createProblem('div', product, b));
          }
        }
      }
    }
  }

  return problems;
}

/**
 * Selects an adaptive series of `count` problems using SM-2 due items, difficult/slow items, and variety.
 */
export function selectAdaptiveSeries(options: {
  mode: OperationMode;
  maxRange: number;
  count: number;
  memories: Record<string, FactMemory>;
  focusFactIds?: string[];
  now?: number;
  rng?: () => number;
}): MathProblem[] {
  const {
    mode,
    maxRange,
    count,
    memories,
    focusFactIds,
    now = Date.now(),
    rng = Math.random,
  } = options;

  const catalog = buildFactCatalog(mode, maxRange);
  if (catalog.length === 0) return [];

  const catalogMap = new Map(catalog.map((p) => [p.id, p]));
  const selected: MathProblem[] = [];
  const usedIds = new Set<string>();

  const pushUnique = (problem: MathProblem) => {
    if (selected.length >= count) return;
    if (!usedIds.has(problem.id)) {
      selected.push(problem);
      usedIds.add(problem.id);
    }
  };

  // 1. Explicit focus facts (e.g., user clicked "Powtórz najtrudniejsze")
  if (focusFactIds && focusFactIds.length > 0) {
    for (const id of focusFactIds) {
      const fromCatalog = catalogMap.get(id);
      if (fromCatalog) {
        pushUnique(fromCatalog);
      } else {
        const mem = memories[id];
        if (mem) {
          pushUnique(createProblem(mem.op, mem.a, mem.b));
        }
      }
    }
  }

  // 2. Overdue SM-2 items or "trudne" items weighted by difficulty score
  const dueOrHard = catalog
    .filter((p) => {
      const m = memories[p.id];
      return m && m.attempts > 0 && (m.nextReviewAt <= now || m.mastery === 'trudne');
    })
    .sort((a, b) => {
      const scoreA = getDifficultyScore(memories[a.id]);
      const scoreB = getDifficultyScore(memories[b.id]);
      return scoreB - scoreA;
    });

  // Take up to ~50% of the series from due/hard items so training feels targeted yet fresh
  const hardQuota = Math.ceil(count * 0.5);
  for (const p of dueOrHard) {
    if (selected.length >= hardQuota) break;
    pushUnique(p);
  }

  // 3. Unseen ("nowe") items mixed in for steady curriculum growth
  const unseen = catalog.filter((p) => !memories[p.id] || memories[p.id].attempts === 0);
  const shuffledUnseen = [...unseen].sort(() => rng() - 0.5);
  for (const p of shuffledUnseen) {
    if (selected.length >= Math.ceil(count * 0.85)) break;
    pushUnique(p);
  }

  // 4. Fill remaining slots with shuffled catalog (avoiding trivial ×1 or exact duplicates)
  const shuffledCatalog = [...catalog].sort(() => rng() - 0.5);
  for (const p of shuffledCatalog) {
    if (selected.length >= count) break;
    pushUnique(p);
  }

  // If catalog was smaller than count (edge case), repeat cleanly without adjacent identical problems
  let safety = 0;
  while (selected.length < count && safety < 50) {
    const candidate = catalog[Math.floor(rng() * catalog.length)];
    if (selected[selected.length - 1]?.id !== candidate.id || catalog.length === 1) {
      selected.push(candidate);
    }
    safety++;
  }

  // Final gentle shuffle that keeps focus items distributed instead of clumped
  return [...selected].sort(() => rng() - 0.5);
}

const MEMORY_RHYMES: Record<string, string> = {
  '6x6': 'Sześć razy sześć — trzydzieści sześć, jak w zegarze sześć po sześć!',
  '6x7': 'Sześć razy siedem — czterdzieści dwa, to już połowa sukcesu ma!',
  '6x8': 'Sześć razy osiem — czterdzieści osiem, końcówka „osiem” zostaje w nosie!',
  '7x7': 'Siedem razy siedem — czterdzieści dziewięć, prawie pięćdziesiąt bez jednego!',
  '7x8': '5, 6, 7, 8! Pięćdziesiąt sześć (56) równa się 7 × 8 — kolejne cyfry obok siebie!',
  '8x7': '5, 6, 7, 8! Pięćdziesiąt sześć (56) równa się 8 × 7 — kolejność liczb jak na schodkach!',
  '8x8': 'Ośmiornica na ósemce ma sześćdziesiąt cztery macki (8 × 8 = 64)!',
  '8x9': 'Dziewiątka lubi sumę cyfr równą 9: 8 × 9 = 72 (bo 7 + 2 = 9)!',
  '9x8': 'Pomyśl: 10 × 8 to 80, odejmij jedną ósemkę i masz 72!',
  '7x9': '10 × 7 to 70, zabierz jedną siódemkę i zostanie 63!',
  '9x7': 'Cyfry wyniku dają w sumie 9: jedno mniej od 7 to 6, a 6 + 3 = 9 → 63!',
  '9x9': '10 × 9 to 90, odejmij 9 i zostaje 81 (8 + 1 = 9)!',
};

/**
 * Generates an intuitive, kid-friendly visual decomposition + mnemonic hint for any multiplication or division problem.
 */
function buildDivisionLadder(dividend: number, divisor: number, quotient: number) {
  const MAX_STEPS = 6;
  let anchorK = quotient >= 10 ? 10 : quotient > 5 ? 5 : 0;
  if (quotient - anchorK > MAX_STEPS) anchorK = quotient - MAX_STEPS;
  const multiples: number[] = [];
  for (let k = anchorK + 1; k <= quotient; k += 1) multiples.push(k * divisor);
  return { divisor, dividend, anchorK, anchorValue: anchorK * divisor, multiples };
}

export function generateVisualHint(problem: MathProblem): VisualHintData {
  if (problem.op === 'mul') {
    const { a, b } = problem;
    const key = `${Math.min(a, b)}x${Math.max(a, b)}`;
    const specialRhyme = MEMORY_RHYMES[`${a}x${b}`] || MEMORY_RHYMES[key];

    // Special smart strategies for 9, 5, 4, or >= 6
    if (a === 9 || b === 9) {
      const other = a === 9 ? b : a;
      const tenTimes = other * 10;
      return {
        strategyTitle: 'Sztuczka z dziesiątką (× 9)',
        mnemonic:
          specialRhyme ??
          `Łatwiej pomnożyć przez 10, a potem odjąć jedną ${other}: ${tenTimes} − ${other}!`,
        decompositionText: `${a} × ${b} = (10 × ${other}) − ${other} = ${tenTimes} − ${other}`,
        visualType: 'array_split',
        rows: Math.min(a, 10),
        cols: Math.min(b, 12),
        splitRow: Math.min(a, 10) > 5 ? 5 : Math.floor(Math.min(a, 10) / 2),
        highlightNote: `Zauważ: przy mnożeniu przez 9 suma cyfr wyniku do 90 zawsze wynosi 9!`,
        parts: [
          { label: `10 × ${other}`, value: tenTimes, tone: 'blue' },
          { label: `1 × ${other}`, value: other, tone: 'amber' },
        ],
        joiner: '−',
        shortTip: `10 razy ${other}, potem zabierz jedno ${other}`,
      };
    }

    if (a === 5 || b === 5) {
      const other = a === 5 ? b : a;
      const tenTimes = other * 10;
      return {
        strategyTitle: 'Połowa dziesiątki (× 5)',
        mnemonic: `Mnożenie przez 5 to zawsze połowa mnożenia przez 10! Połowa z ${tenTimes} to...`,
        decompositionText: `${a} × ${b} = (${other} × 10) ÷ 2 = ${tenTimes} ÷ 2`,
        visualType: 'array_split',
        rows: Math.min(a, 10),
        cols: Math.min(b, 12),
        splitRow: Math.min(a, 10) > 5 ? 5 : undefined,
        highlightNote: `Każdy wynik mnożenia przez 5 kończy się cyfrą 0 lub 5.`,
        parts: [{ label: `10 × ${other}`, value: tenTimes, tone: 'blue' }],
        joiner: 'half',
        shortTip: `× 5 to połowa z × 10`,
      };
    }

    if (a > 5 && b <= 12) {
      const part1 = 5 * b;
      const rem = a - 5;
      const part2 = rem * b;
      return {
        strategyTitle: 'Rozbijanie na złotą piątkę',
        mnemonic:
          specialRhyme ??
          `Rozbij ${a} na 5 i ${rem}! Najpierw policz łatwe 5 × ${b} = ${part1}, a potem dodaj ${rem} × ${b} = ${part2}.`,
        decompositionText: `${a} × ${b} = (5 × ${b}) + (${rem} × ${b}) = ${part1} + ${part2}`,
        visualType: 'array_split',
        rows: Math.min(a, 12),
        cols: Math.min(b, 12),
        splitRow: 5,
        highlightNote: `Niebieskie klocki to 5 rzędów (${part1}), a bursztynowe to pozostałe ${rem} rzędy (${part2}).`,
        parts: [
          { label: `5 × ${b}`, value: part1, tone: 'blue' },
          { label: `${rem} × ${b}`, value: part2, tone: 'amber' },
        ],
        joiner: '+',
        shortTip: `Rozbij ${a} na 5 i ${rem}`,
      };
    }

    if (a > 10) {
      const tens = Math.floor(a / 10) * 10;
      const ones = a % 10;
      return {
        strategyTitle: 'Rozbij na dziesiątki i jedności',
        mnemonic: `Podziel ${a} na ${tens} i ${ones}, pomnóż każdą część przez ${b} i dodaj!`,
        decompositionText: `${a} × ${b} = (${tens} × ${b}) + (${ones} × ${b}) = ${tens * b} + ${ones * b}`,
        visualType: 'array_split',
        rows: Math.min(b, 10),
        cols: Math.min(a, 14),
        splitRow: Math.floor(Math.min(b, 10) / 2),
        highlightNote: `Dziesiątki liczy się błyskawicznie: ${tens} × ${b} = ${tens * b}.`,
        parts:
          ones > 0
            ? [
                { label: `${tens} × ${b}`, value: tens * b, tone: 'blue' },
                { label: `${ones} × ${b}`, value: ones * b, tone: 'amber' },
              ]
            : [{ label: `${tens} × ${b}`, value: tens * b, tone: 'blue' }],
        joiner: '+',
        shortTip: ones > 0 ? `Rozbij ${a} na ${tens} i ${ones}` : `Policz ${tens / 10} × ${b} i dopisz 0`,
      };
    }

    const halfRows = Math.max(1, Math.floor(a / 2));
    const remRows = a - halfRows;
    return {
      strategyTitle: 'Podział na mniejsze grupy',
      mnemonic:
        specialRhyme ??
        `Wyobraź sobie ${a} rzędów po ${b} klocków. Policz najpierw ${halfRows} × ${b} = ${halfRows * b}, a potem resztę!`,
      decompositionText: `${a} × ${b} = (${halfRows} × ${b}) + (${remRows} × ${b}) = ${halfRows * b} + ${remRows * b}`,
      visualType: 'array_split',
      rows: Math.min(a, 10),
      cols: Math.min(b, 12),
      splitRow: halfRows,
      highlightNote: `Policz kropki w pierwszym bloku i dodaj drugi blok.`,
      parts: [
        { label: `${halfRows} × ${b}`, value: halfRows * b, tone: 'blue' },
        { label: `${remRows} × ${b}`, value: remRows * b, tone: 'amber' },
      ],
      joiner: '+',
      shortTip: `Rozbij ${a} na ${halfRows} i ${remRows}`,
    };
  }

  // Division visual hint
  const { a: dividend, b: divisor } = problem;
  const quotient = Math.round(dividend / divisor);
  const easyPart = divisor * (quotient > 5 ? 5 : Math.max(1, Math.floor(quotient / 2)));
  const restPart = dividend - easyPart;

  return {
    strategyTitle: 'Odwrotne mnożenie i dzielenie na koszyki',
    mnemonic: `Pomyśl odwrotnie: ile razy ${divisor} daje razem ${dividend}? Możesz podzielić ${dividend} na ${easyPart} + ${restPart}!`,
    decompositionText: `${divisor} × ? = ${dividend}  (${easyPart} ÷ ${divisor} = ${easyPart / divisor} oraz ${restPart} ÷ ${divisor} = ${restPart / divisor})`,
    visualType: 'division_groups',
    rows: Math.min(divisor, 10),
    cols: Math.min(quotient, 12),
    groupCount: divisor,
    groupSize: quotient,
    highlightNote: `Rozdajemy ${dividend} elementów po równo do ${divisor} koszyków.`,
    division: buildDivisionLadder(dividend, divisor, quotient),
    shortTip: `Licz co ${divisor}, aż dojdziesz do ${dividend}`,
  };
}
