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

import { ILLUSTRATED_MASCOTS, PRESET_AVATARS } from '../data/avatars';
import { parseAvatarPrompt } from './avatarComposer';
import { createFamilySeedProfiles, createFreshProfile } from '../data/curriculum';
import { computeFamilySummary } from './familyStats';
import { buildVictoryShareText } from './victoryCardCanvas';

test('PRESET_AVATARS and ILLUSTRATED_MASCOTS provide rich avatar pool and parseAvatarPrompt maps Polish descriptions', () => {
  assert.ok(ILLUSTRATED_MASCOTS.length >= 9);
  assert.equal(new Set(ILLUSTRATED_MASCOTS.map((a) => a.id)).size, ILLUSTRATED_MASCOTS.length);
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

test('Family seed profiles start cleanly at 0 XP / Level 1 / 0 streak and computeFamilySummary aggregates active players', () => {
  const family = createFamilySeedProfiles();
  assert.deepEqual(
    family.map((p) => p.name),
    ['Ola', 'Mama', 'Tata', 'Natalka']
  );
  assert.ok(family.every((p) => p.xp === 0 && p.streakDays === 0 && p.sessions.length === 0));

  const withSessions = family.map((p, idx) =>
    idx === 0
      ? {
          ...p,
          xp: 120,
          streakDays: 1,
          sessions: [
            {
              id: 's1',
              timestamp: 1_700_000_000_000,
              mode: 'mixed' as const,
              seriesTitle: 'Start',
              totalTasks: 10,
              correctTasks: 9,
              accuracyPct: 90,
              totalTimeMs: 25_000,
              avgTimeMs: 2500,
              pointsEarned: 120,
              passedThreshold: true,
              attempts: [],
            },
          ],
        }
      : p
  );

  const summary = computeFamilySummary(withSessions);
  assert.equal(summary.members.length, 4);
  assert.equal(summary.totalXp, 120);
  assert.equal(summary.totalSolvedTasks, 10);
  assert.equal(summary.fastestMember?.name, 'Ola');
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

import { parseInitialStoreState } from '../store/useAppStore';

test('parseInitialStoreState starts cleanly empty with no leaked profiles and restores saved owned accounts afterwards', () => {
  const fresh = parseInitialStoreState(null);
  assert.equal(fresh.hasSelectedProfile, false);
  assert.equal(fresh.profiles.length, 0);
  assert.equal(fresh.ownedProfileIds.length, 0);

  const kuba = createFreshProfile('Kuba', 'mascot-fox', 1700000000000, undefined, 'SP nr 5', '4a');
  const savedKuba = { ...kuba, activeThemeId: 'royal-purple', xp: 340 };
  const other = createFreshProfile('Zosia', 'mascot-unicorn', 1700000000001, undefined, 'SP nr 5', '4b');

  const restored = parseInitialStoreState(
    JSON.stringify({
      activeProfileId: savedKuba.id,
      profiles: [savedKuba, other],
      ownedProfileIds: [savedKuba.id],
      hasSelectedProfile: true,
    })
  );
  assert.equal(restored.hasSelectedProfile, true);
  assert.equal(restored.activeProfileId, savedKuba.id);
  assert.deepEqual(restored.ownedProfileIds, [savedKuba.id]);
  const restoredKuba = restored.profiles.find((p) => p.id === savedKuba.id)!;
  assert.equal(restoredKuba.activeThemeId, 'royal-purple');
  assert.equal(restoredKuba.xp, 340);
  assert.equal(restoredKuba.schoolName, 'SP nr 5');
  assert.equal(restoredKuba.className, '4a');
});

import {
  hashAccountPassword,
  normalizeLogin,
  verifyAccountCredentials,
} from './accountSecurity';
import {
  generateSessionNotifications,
  getUnreadNotificationsForProfile,
} from './familyNotifications';

test('accountSecurity normalizes Polish logins, hashes deterministically, and verifies credentials', () => {
  assert.equal(normalizeLogin('  Łukasz Śliwa '), 'lukaszsliwa');
  assert.equal(normalizeLogin('Natalka'), 'natalka');

  const hash = hashAccountPassword('sekret123', 'user-natalka');
  assert.ok(hash.length >= 16);
  assert.equal(hash, hashAccountPassword('sekret123', 'user-natalka'));
  assert.notEqual(hash, hashAccountPassword('sekret123', 'user-ola'));

  const protectedProfile = {
    id: 'user-natalka',
    name: 'Natalka',
    login: 'natalka',
    passwordHash: hash,
  };
  assert.equal(verifyAccountCredentials(protectedProfile, 'sekret123', 'Natalka'), true);
  assert.equal(verifyAccountCredentials(protectedProfile, 'zlehaslo', 'natalka'), false);
  assert.equal(verifyAccountCredentials(protectedProfile, 'sekret123', 'ola'), false);
});

test('familyNotifications detects XP overtake and family speed record beaten', () => {
  const baseFamily = createFamilySeedProfiles();
  const ola: UserProfile = {
    ...baseFamily.find((p) => p.name === 'Ola')!,
    xp: 150,
    sessions: [
      {
        id: 'ola-s1',
        timestamp: 1_700_000_000_000,
        mode: 'mixed',
        seriesTitle: 'Rozgrzewka',
        totalTasks: 10,
        correctTasks: 9,
        accuracyPct: 90,
        totalTimeMs: 30_000,
        avgTimeMs: 3000,
        pointsEarned: 150,
        passedThreshold: true,
        attempts: [],
      },
    ],
  };
  const natalkaBefore = baseFamily.find((p) => p.name === 'Natalka')!;
  const natalkaAfter: UserProfile = {
    ...natalkaBefore,
    xp: ola.xp + 25,
  };

  const notifications = generateSessionNotifications({
    actorBefore: natalkaBefore,
    actorAfter: natalkaAfter,
    otherProfiles: [ola, ...baseFamily.filter((p) => p.id !== natalkaBefore.id && p.id !== ola.id)],
    session: {
      id: 's-fast',
      timestamp: 1_700_100_000_000,
      mode: 'mixed',
      seriesTitle: 'Błyskawica',
      totalTasks: 10,
      correctTasks: 10,
      accuracyPct: 100,
      totalTimeMs: 12_000,
      avgTimeMs: 1200,
      pointsEarned: 175,
      passedThreshold: true,
      attempts: [],
    },
    newBadges: ['Nowa Odznaka'],
    now: 1_700_100_000_000,
  });

  assert.ok(notifications.some((n) => n.type === 'xp_overtake' && n.targetProfileId === ola.id));
  assert.ok(notifications.some((n) => n.type === 'speed_record'));
  assert.ok(notifications.some((n) => n.type === 'badge_earned'));

  // Actor doesn't see own alerts as unread; Ola sees them as unread
  assert.equal(getUnreadNotificationsForProfile(notifications, natalkaAfter.id).length, 0);
  assert.ok(getUnreadNotificationsForProfile(notifications, ola.id).length >= 2);
});

import {
  mergeNotifications,
  mergeProfiles,
  sanitizeProfileForFirestore,
  stripUndefinedDeep,
} from './cloudMerge';

test('cloudMerge sanitizes Firestore payloads, merges untouched device with cloud progress, and aggregates class/school standings', () => {
  const cleaned = stripUndefinedDeep({ a: 0, b: undefined, c: { d: undefined, e: 'ok' } });
  assert.deepEqual(cleaned, { a: 0, c: { e: 'ok' } });

  const localBlank = createFreshProfile('Kuba', 'owl', 1700000000000, undefined, 'SP nr 5', '4a');
  const cloudProgressed: UserProfile = {
    ...localBlank,
    ownerUid: 'uid-kuba',
    xp: 480,
    streakDays: 3,
    activeThemeId: 'chicago-bulls',
    sessions: [
      {
        id: 'sess-1',
        timestamp: 1_700_050_000_000,
        mode: 'mixed',
        seriesTitle: 'Sprint',
        totalTasks: 10,
        correctTasks: 9,
        accuracyPct: 90,
        totalTimeMs: 28_000,
        avgTimeMs: 2800,
        pointsEarned: 150,
        passedThreshold: true,
        attempts: [],
      },
    ],
  };

  const firestoreDoc = sanitizeProfileForFirestore(cloudProgressed, 'grp-1', 'uid-kuba');
  assert.equal(firestoreDoc.groupId, 'grp-1');
  assert.equal(firestoreDoc.schoolName, 'SP nr 5');
  assert.equal(firestoreDoc.className, '4a');
  assert.equal(firestoreDoc.passwordHash, undefined);

  const merged = mergeProfiles([localBlank], [cloudProgressed]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].xp, 480);
  assert.equal(merged[0].activeThemeId, 'chicago-bulls');
  assert.equal(merged[0].sessions.length, 1);

  const classmate: UserProfile = {
    ...createFreshProfile('Zosia', 'mascot-unicorn', 1700000000111, undefined, 'SP nr 5', '4b'),
    xp: 220,
  };
  const summary = computeFamilySummary([cloudProgressed, classmate]);
  assert.equal(summary.classStandings.length, 2);
  assert.equal(summary.schoolStandings.length, 1);
  assert.equal(summary.schoolStandings[0].totalXp, 700);

  const mergedAlerts = mergeNotifications(
    [
      {
        id: 'n1',
        createdAt: 100,
        type: 'xp_overtake',
        actorProfileId: 'a',
        actorName: 'A',
        title: 'T',
        message: 'M',
        readByProfileIds: ['a'],
      },
    ],
    [
      {
        id: 'n1',
        createdAt: 100,
        type: 'xp_overtake',
        actorProfileId: 'a',
        actorName: 'A',
        title: 'T',
        message: 'M',
        readByProfileIds: ['b'],
      },
    ]
  );
  assert.equal(mergedAlerts.length, 1);
  assert.deepEqual(mergedAlerts[0].readByProfileIds.sort(), ['a', 'b']);
});

import {
  checkDuplicateClassAttempt,
  mergeSchoolDirectories,
  normalizeClassKey,
  normalizeSchoolKey,
  resolveCanonicalSchoolAndClass,
} from './schoolDirectory';
import {
  buildPlayerDiagnostics,
  buildReviewCalendar,
  getReviewReminderBanner,
} from './reviewCalendar';

test('schoolDirectory prevents duplicate classes and merges canonical schools across inputs', () => {
  assert.equal(normalizeSchoolKey('  SP nr. 5 w Łodzi '), 'sp nr 5 w lodzi');
  assert.equal(normalizeClassKey('Klasa 4 A'), '4a');
  assert.equal(normalizeClassKey('4a'), '4a');

  const dir = mergeSchoolDirectories(
    [[{ id: 'sp-nr-5', name: 'SP nr 5', classes: ['4a', '4b'] }]],
    [
      { schoolName: 'sp nr. 5', className: '4 A' },
      { schoolName: 'SP nr 5', className: '5c' },
    ]
  );
  assert.equal(dir.length, 1);
  assert.deepEqual(dir[0].classes, ['4a', '4b', '5c']);

  const dup = checkDuplicateClassAttempt(dir, 'sp nr 5', 'Kl. 4 A');
  assert.equal(dup.isDuplicate, true);
  assert.equal(dup.existingClass, '4a');

  const notDup = checkDuplicateClassAttempt(dir, 'SP nr 5', '6b');
  assert.equal(notDup.isDuplicate, false);

  const resolved = resolveCanonicalSchoolAndClass(dir, 'sp nr. 5', '4A');
  assert.equal(resolved.schoolName, 'SP nr 5');
  assert.equal(resolved.className, '4a');
  assert.equal(resolved.matchedExistingClass, true);
});

test('reviewCalendar and diagnostics highlight weak/slow/strong facts and 7-day schedule', () => {
  const now = new Date('2026-11-14T10:00:00Z').getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  const memories: Record<string, FactMemory> = {
    'mul:7x8': {
      id: 'mul:7x8',
      op: 'mul',
      a: 7,
      b: 8,
      answer: 56,
      easiness: 1.5,
      intervalDays: 0.0015,
      repetitions: 0,
      nextReviewAt: now - 60_000,
      attempts: 4,
      correctCount: 2,
      wrongCount: 2,
      totalTimeMs: 24_000,
      avgTimeMs: 6000,
      lastTimeMs: 7000,
      lastSeenAt: now - 10_000,
      mastery: 'trudne',
    },
    'mul:3x4': {
      id: 'mul:3x4',
      op: 'mul',
      a: 3,
      b: 4,
      answer: 12,
      easiness: 2.6,
      intervalDays: 1,
      repetitions: 3,
      nextReviewAt: now + oneDay,
      attempts: 5,
      correctCount: 5,
      wrongCount: 0,
      totalTimeMs: 7500,
      avgTimeMs: 1500,
      lastTimeMs: 1400,
      lastSeenAt: now - 20_000,
      mastery: 'mistrzowskie',
    },
  };

  const diag = buildPlayerDiagnostics(memories);
  assert.equal(diag.totalMeasured, 2);
  assert.equal(diag.strongestFacts[0].id, 'mul:3x4');
  assert.equal(diag.weakestFacts[0].id, 'mul:7x8');
  assert.equal(diag.slowestFacts[0].id, 'mul:7x8');

  const cal = buildReviewCalendar(memories, now);
  assert.equal(cal.dueNow.length, 1);
  assert.equal(cal.dueNow[0].id, 'mul:7x8');
  assert.equal(cal.days.length, 7);
  assert.equal(cal.days[0].count, 1);
  assert.equal(cal.days[1].count, 1);

  const reminder = getReviewReminderBanner(memories, now);
  assert.ok(reminder !== null);
  assert.equal(reminder!.hasDue, true);
  assert.equal(reminder!.urgentCount, 1);
});


