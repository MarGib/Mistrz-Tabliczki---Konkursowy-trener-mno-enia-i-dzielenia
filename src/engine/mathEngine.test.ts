import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTaskPoints,
  checkStagePass,
  computeResponseQuality,
  computeTournamentMedal,
  computeUserLevel,
  getDifficultFacts,
  updateFactMemory,
} from './spacedRepetition';
import {
  buildFactCatalog,
  createProblem,
  generateVisualHint,
  selectAdaptiveSeries,
} from './problemGenerator';
import { classifyDevice } from './deviceDetector';
import { buildUserSpeedTrendData } from './chartData';
import type { FactMemory, TournamentDef, UserProfile } from '../types/math';
import { DEFAULT_SETTINGS } from '../data/curriculum';

test('SM-2 quality and memory update prioritizes wrong and slow answers', () => {
  const prob = createProblem('mul', 7, 8);
  const now = 1_700_000_000_000;

  assert.equal(computeResponseQuality(true, 1800, false), 5);
  assert.equal(computeResponseQuality(true, 4200, false), 4);
  assert.equal(computeResponseQuality(true, 8000, false), 3);
  assert.equal(computeResponseQuality(true, 2000, true), 3);
  assert.equal(computeResponseQuality(false, 2000, false), 1);

  const firstWrong = updateFactMemory(undefined, prob, false, 4500, false, now);
  assert.equal(firstWrong.updated.mastery, 'trudne');
  assert.equal(firstWrong.updated.repetitions, 0);
  assert.ok(firstWrong.updated.easiness < 2.5);

  let mem: FactMemory | undefined = undefined;
  for (let i = 0; i < 3; i++) {
    mem = updateFactMemory(mem, prob, true, 1900, false, now + i * 86_400_000).updated;
  }
  assert.equal(mem?.mastery, 'mistrzowskie');
  assert.equal(mem?.repetitions, 3);
});

test('Difficult facts ranking places error-prone slow facts first', () => {
  const easy = createProblem('mul', 2, 5);
  const hard = createProblem('mul', 7, 8);
  const easyMem = updateFactMemory(undefined, easy, true, 1500, false).updated;
  const hardMem = updateFactMemory(undefined, hard, false, 8900, true).updated;

  const ranked = getDifficultFacts({
    [easy.id]: easyMem,
    [hard.id]: hardMem,
  });
  assert.equal(ranked[0].id, hard.id);
});

test('Problem catalog respects maxRange 100 and expands when range > 100', () => {
  const stdCatalog = buildFactCatalog('mixed', 100);
  assert.ok(stdCatalog.every((p) => (p.op === 'mul' ? p.answer <= 100 : p.a <= 100)));
  assert.ok(stdCatalog.some((p) => p.id === 'mul:7x8'));
  assert.ok(stdCatalog.some((p) => p.id === 'div:56/7'));

  const bigCatalog = buildFactCatalog('mul', 200);
  assert.ok(bigCatalog.some((p) => p.answer > 100 && p.answer <= 200));
});

test('Adaptive series prioritizes focusFactIds and returns exact count', () => {
  const hard = createProblem('mul', 7, 8);
  const hardMem = updateFactMemory(undefined, hard, false, 9000, false).updated;

  const series = selectAdaptiveSeries({
    mode: 'mixed',
    maxRange: 100,
    count: 10,
    memories: { [hard.id]: hardMem },
    focusFactIds: [hard.id],
    rng: () => 0.42,
  });

  assert.equal(series.length, 10);
  assert.ok(series.some((p) => p.id === hard.id));
});

test('Visual hint generator produces array split for multiplication and groups for division', () => {
  const mulHint = generateVisualHint(createProblem('mul', 7, 8));
  assert.equal(mulHint.visualType, 'array_split');
  assert.equal(mulHint.splitRow, 5);
  assert.ok(mulHint.mnemonic.includes('56'));

  const divHint = generateVisualHint(createProblem('div', 56, 7));
  assert.equal(divHint.visualType, 'division_groups');
  assert.equal(divHint.groupCount, 7);
  assert.equal(divHint.groupSize, 8);
});

test('Stage passing, points calculation, medals, and device classification work accurately', () => {
  assert.deepEqual(checkStagePass(8, 10, 80), { accuracyPct: 80, passed: true });
  assert.deepEqual(checkStagePass(7, 10, 80), { accuracyPct: 70, passed: false });

  assert.ok(calculateTaskPoints(true, 1800, false, 4) > calculateTaskPoints(true, 7000, true, 0));
  assert.equal(calculateTaskPoints(false, 1800, false, 4), 0);

  const tourney: TournamentDef = {
    id: 't1',
    title: 'Test',
    description: 'Test',
    mode: 'mixed',
    maxRange: 100,
    taskCount: 10,
    passAccuracyPct: 80,
    bronzeTimeSec: 80,
    silverTimeSec: 50,
    goldTimeSec: 30,
    rewardXp: 100,
    simulatedPeers: [],
  };

  assert.equal(computeTournamentMedal(tourney, 70, 20), 'brak');
  assert.equal(computeTournamentMedal(tourney, 100, 28), 'puchar');
  assert.equal(computeTournamentMedal(tourney, 90, 28), 'zloto');
  assert.equal(computeTournamentMedal(tourney, 90, 45), 'srebro');

  assert.equal(computeUserLevel(0).level, 1);
  assert.equal(computeUserLevel(500).level, 3);

  assert.equal(classifyDevice(390, 844, true).category, 'telefon');
  assert.equal(classifyDevice(768, 1024, true).category, 'tablet');
  assert.equal(classifyDevice(1440, 900, false).category, 'komputer');
});

test('buildUserSpeedTrendData computes per-user speed series and improvement delta', () => {
  const makeProfile = (id: string, name: string, avgMsList: number[]): UserProfile => ({
    id,
    name,
    avatarId: 'owl',
    xp: 100,
    streakDays: 1,
    lastActiveDate: '2026-11-14',
    unlockedStageIds: ['stage-1'],
    completedStageIds: [],
    earnedBadges: [],
    memories: {},
    tournamentBests: {},
    settings: { ...DEFAULT_SETTINGS },
    sessions: avgMsList.map((ms, idx) => ({
      id: `${id}-s${idx}`,
      timestamp: 1_700_000_000_000 + idx * 86_400_000,
      mode: 'mixed',
      seriesTitle: `Seria testowa ${idx + 1}`,
      totalTasks: 10,
      correctTasks: 8 + (idx % 2),
      accuracyPct: 80 + (idx % 2) * 10,
      totalTimeMs: ms * 10,
      avgTimeMs: ms,
      pointsEarned: 100,
      passedThreshold: true,
      attempts: [],
    })),
  });

  const p1 = makeProfile('u1', 'Maja', [6200, 4800, 3400]);
  const p2 = makeProfile('u2', 'Kacper', [5500, 4100]);

  const { data, summaries } = buildUserSpeedTrendData([p1, p2], ['u1', 'u2']);
  assert.equal(data.length, 3);
  assert.equal(data[0].label, 'Seria 1');
  assert.equal(data[0]['time_u1'], 6.2);
  assert.equal(data[2]['time_u1'], 3.4);
  assert.equal(data[1]['time_u2'], 4.1);
  assert.equal(data[2]['time_u2'], undefined);

  assert.equal(summaries[0].deltaSec, -2.8);
  assert.equal(summaries[1].deltaSec, -1.4);
});

import {
  buildThemeTokens,
  getContrastRatio,
  getReadableForeground,
  themeToCssVariables,
} from './themeEngine';
import { PRESET_THEMES, resolveThemeById } from '../data/themes';

test('PRESET_THEMES has at least 10 themes including Royal Purple, Chicago Bulls, and blue theme with WCAG contrast', () => {
  assert.ok(PRESET_THEMES.length >= 10);
  const purple = PRESET_THEMES.find((t) => t.id === 'royal-purple');
  const bulls = PRESET_THEMES.find((t) => t.id === 'chicago-bulls');
  const ocean = PRESET_THEMES.find((t) => t.id === 'blekit-oceanu');
  assert.ok(purple && bulls && ocean);
  assert.equal(bulls.name, 'Chicago Bulls');

  for (const theme of PRESET_THEMES) {
    const textRatio = getContrastRatio(theme.tokens.surface, theme.tokens.text);
    const btnRatio = getContrastRatio(theme.tokens.primary, theme.tokens.primaryFg);
    assert.ok(textRatio >= 4.5, `Text contrast failed for ${theme.name}: ${textRatio}`);
    assert.ok(btnRatio >= 3.0, `Primary button contrast failed for ${theme.name}: ${btnRatio}`);
  }

  // Sharp yellow accent must pick dark text for readability
  assert.equal(getReadableForeground('#FACC15'), '#0F172A');
  const customTokens = buildThemeTokens({
    canvas: '#F5F3FF',
    surface: '#FFFFFF',
    primary: '#7C3AED',
    accent: '#FACC15',
    isDark: false,
  });
  assert.equal(customTokens.accentFg, '#0F172A');

  const vars = themeToCssVariables(purple);
  assert.equal(vars['--th-primary'], '#7C3AED');
  assert.equal(resolveThemeById('nonexistent').id, PRESET_THEMES[0].id);
});

import { PRESET_AVATARS } from '../data/avatars';
import { parseAvatarPrompt } from './avatarComposer';
import { createFamilySeedProfiles } from '../data/curriculum';
import { computeFamilySummary } from './familyStats';
import { buildVictoryShareText } from './victoryCardCanvas';

test('PRESET_AVATARS provides 50+ unique avatars and parseAvatarPrompt maps Polish descriptions', () => {
  assert.ok(PRESET_AVATARS.length >= 50);
  const uniqueIds = new Set(PRESET_AVATARS.map((a) => a.id));
  assert.equal(uniqueIds.size, PRESET_AVATARS.length);

  const dragon = parseAvatarPrompt('fioletowy smok w okularach z pucharem');
  assert.equal(dragon.character, 'dragon');
  assert.equal(dragon.bodyColor, '#7C3AED');
  assert.equal(dragon.accessory, 'glasses');
  assert.equal(dragon.prop, 'trophy');

  const robot = parseAvatarPrompt('niebieski robot z kalkulatorem');
  assert.equal(robot.character, 'robot');
  assert.equal(robot.bodyColor, '#2563EB');
  assert.equal(robot.prop, 'calculator');

  const fallback = parseAvatarPrompt('');
  assert.ok(fallback.character);
  assert.ok(fallback.bodyColor.startsWith('#'));
});

test('Family seed profiles and computeFamilySummary aggregate Ola, Mama, Tata, Natalka accurately', () => {
  const family = createFamilySeedProfiles();
  assert.deepEqual(
    family.map((p) => p.name),
    ['Ola', 'Mama', 'Tata', 'Natalka']
  );

  const summary = computeFamilySummary(family);
  assert.equal(summary.members.length, 4);
  assert.equal(summary.totalXp, family.reduce((s, p) => s + p.xp, 0));
  assert.ok(summary.totalSolvedTasks > 100);
  assert.ok(summary.fastestMember !== null);
  assert.equal(summary.xpLeader?.name, 'Ola');
});

test('buildVictoryShareText formats Polish numeric summary for WhatsApp sharing', () => {
  const text = buildVictoryShareText({
    playerName: 'Ola',
    seriesTitle: 'Brązowa Tabliczka',
    accuracyPct: 90,
    correctCount: 9,
    totalTasks: 10,
    totalTimeSec: 28.5,
    avgTimeSec: 2.85,
    pointsEarned: 150,
    streakBest: 6,
    passed: true,
    isStageOrTournament: true,
    badgeOrMedalTitle: 'Brązowy Rachmistrz',
    primaryColor: '#7C3AED',
    accentColor: '#FACC15',
  });
  assert.ok(text.includes('Ola'));
  assert.ok(text.includes('90%'));
  assert.ok(text.includes('9/10'));
  assert.ok(text.includes('+150 XP'));
  assert.ok(text.includes('Brązowy Rachmistrz'));
});

