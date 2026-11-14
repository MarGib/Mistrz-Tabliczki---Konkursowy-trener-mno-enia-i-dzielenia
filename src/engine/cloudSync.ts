import {
  type Unsubscribe,
  type User,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_SETTINGS } from '../data/curriculum';
import { DEFAULT_THEME_ID } from '../data/themes';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isFirebaseConfigured,
} from '../firebase';
import type { FamilyNotification, UserProfile } from '../types/math';
import {
  type ArenaPlayerCard,
  doesProfileNeedCloudPush,
  generateJoinCode,
  mergeSingleProfile,
  profileToArenaPlayerCard,
  sanitizeFirestoreId,
  sanitizeProfileForFirestore,
  stripUndefinedDeep,
} from './cloudMerge';
import {
  type SchoolDirectoryEntry,
  mergeSchoolDirectories,
  slugifySchoolId,
} from './schoolDirectory';

export interface CloudSessionMeta {
  uid: string;
  displayName: string;
  email: string;
  groupId: string;
  joinCode: string;
}

export async function signInWithGoogleCloud(): Promise<User> {
  if (!isFirebaseConfigured()) {
    throw new Error('Brak konfiguracji Firebase (firebase-applet-config.json).');
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutCloud(): Promise<void> {
  await signOut(auth);
}

function docToUserProfile(data: Record<string, unknown>): UserProfile {
  return {
    id: String(data.id ?? ''),
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : undefined,
    name: String(data.name ?? 'Mistrz'),
    schoolName: typeof data.schoolName === 'string' ? data.schoolName : undefined,
    className: typeof data.className === 'string' ? data.className : undefined,
    login: typeof data.login === 'string' ? data.login : undefined,
    passwordHash: typeof data.passwordHash === 'string' ? data.passwordHash : undefined,
    avatarId: String(data.avatarId ?? 'owl'),
    customAvatarSpec: data.customAvatarSpec as UserProfile['customAvatarSpec'],
    xp: Number(data.xp ?? 0),
    streakDays: Number(data.streakDays ?? 0),
    lastActiveDate: String(data.lastActiveDate ?? ''),
    unlockedStageIds: Array.isArray(data.unlockedStageIds)
      ? (data.unlockedStageIds as string[])
      : ['stage-1'],
    completedStageIds: Array.isArray(data.completedStageIds)
      ? (data.completedStageIds as string[])
      : [],
    earnedBadges: Array.isArray(data.earnedBadges) ? (data.earnedBadges as string[]) : [],
    memories: (data.memories as UserProfile['memories']) ?? {},
    sessions: Array.isArray(data.sessions) ? (data.sessions as UserProfile['sessions']) : [],
    tournamentBests: (data.tournamentBests as UserProfile['tournamentBests']) ?? {},
    settings: {
      ...DEFAULT_SETTINGS,
      ...((data.settings as Partial<UserProfile['settings']>) ?? {}),
    },
    activeThemeId:
      typeof data.activeThemeId === 'string' && data.activeThemeId.length > 0
        ? data.activeThemeId
        : DEFAULT_THEME_ID,
    customThemes: Array.isArray(data.customThemes)
      ? (data.customThemes as UserProfile['customThemes'])
      : [],
  };
}

function parseArenaPlayers(rawPlayers: unknown): ArenaPlayerCard[] {
  if (!Array.isArray(rawPlayers)) return [];
  return rawPlayers
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as { profileId?: unknown }).profileId === 'string' &&
        typeof (item as { name?: unknown }).name === 'string'
    )
    .map((item) => ({
      profileId: sanitizeFirestoreId(String(item.profileId)),
      name: String(item.name).slice(0, 32),
      schoolName: typeof item.schoolName === 'string' ? item.schoolName : undefined,
      className: typeof item.className === 'string' ? item.className : undefined,
      avatarId: typeof item.avatarId === 'string' ? item.avatarId : 'owl',
      customAvatarSpec: item.customAvatarSpec as ArenaPlayerCard['customAvatarSpec'],
      xp: Number(item.xp ?? 0),
      streakDays: Number(item.streakDays ?? 0),
      solvedTasks: Number(item.solvedTasks ?? 0),
      accuracyPct: Number(item.accuracyPct ?? 0),
      avgTimeSec: typeof item.avgTimeSec === 'number' ? item.avgTimeSec : undefined,
      sessionsCount: Number(item.sessionsCount ?? 0),
      tournamentBests:
        (item.tournamentBests as ArenaPlayerCard['tournamentBests']) ?? {},
      updatedAtMs: Number(item.updatedAtMs ?? 0),
    }));
}

async function reconcileLocalProfilesIntoGroup(
  groupId: string,
  uid: string,
  remoteIds: string[],
  localProfiles: UserProfile[]
): Promise<void> {
  if (localProfiles.length === 0) return;

  const localById = new Map(
    localProfiles.slice(0, 50).map((p) => [sanitizeFirestoreId(p.id), p])
  );
  const remoteIdSet = new Set(remoteIds);
  const toPush: UserProfile[] = [];

  // Fetch existing cloud copies for overlapping IDs so we merge instead of overwriting newer cloud stats
  const overlappingIds = Array.from(localById.keys()).filter((id) =>
    remoteIdSet.has(id)
  );
  const cloudById = new Map<string, UserProfile>();
  if (overlappingIds.length > 0) {
    const snaps = await Promise.all(
      overlappingIds.map((pid) =>
        getDoc(doc(db, 'groups', groupId, 'profiles', pid)).catch(() => null)
      )
    );
    snaps.forEach((snap, idx) => {
      if (snap && snap.exists()) {
        cloudById.set(overlappingIds[idx], docToUserProfile(snap.data()));
      }
    });
  }

  for (const [pid, localProf] of localById.entries()) {
    const taggedLocal: UserProfile = {
      ...localProf,
      id: pid,
      ownerUid: localProf.ownerUid || uid,
    };
    const cloudProf = cloudById.get(pid);
    if (!cloudProf) {
      toPush.push(taggedLocal);
    } else {
      const merged = mergeSingleProfile(taggedLocal, cloudProf);
      if (doesProfileNeedCloudPush(merged, cloudProf)) {
        toPush.push(merged);
      }
    }
  }

  if (toPush.length > 0) {
    const batch = writeBatch(db);
    for (const prof of toPush) {
      batch.set(doc(db, 'groups', groupId, 'profiles', prof.id), {
        ...sanitizeProfileForFirestore(prof, groupId, uid),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  const missingRemoteIds = Array.from(localById.keys()).filter(
    (id) => !remoteIdSet.has(id)
  );
  if (missingRemoteIds.length > 0) {
    const nextIds = Array.from(new Set([...remoteIds, ...missingRemoteIds])).slice(
      0,
      50
    );
    await updateDoc(doc(db, 'groups', groupId), {
      profileIds: nextIds,
      updatedAt: serverTimestamp(),
    });
  }
}

export async function ensureCloudGroupForUser(
  user: User,
  localProfiles: UserProfile[],
  activeProfileId: string
): Promise<CloudSessionMeta> {
  const uid = user.uid;
  const displayName = (user.displayName || user.email || 'Gracz').slice(0, 80);
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let existingUserSnap;
  try {
    existingUserSnap = await getDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  if (existingUserSnap.exists()) {
    const userData = existingUserSnap.data();
    const groupId = String(userData.groupId);
    const groupPath = `groups/${groupId}`;
    try {
      const grpSnap = await getDoc(doc(db, 'groups', groupId));
      const remoteIds =
        grpSnap.exists() && Array.isArray(grpSnap.data().profileIds)
          ? (grpSnap.data().profileIds as string[]).filter((id) => typeof id === 'string')
          : [];
      const joinCode = grpSnap.exists()
        ? String(grpSnap.data().joinCode ?? generateJoinCode(uid))
        : generateJoinCode(uid);

      // Silently reconcile any existing local progress / accounts / passwords into Firestore
      await reconcileLocalProfilesIntoGroup(groupId, uid, remoteIds, localProfiles);

      return {
        uid,
        displayName,
        email: user.email ?? '',
        groupId,
        joinCode,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, groupPath);
    }
  }

  // First time signing in with Google: create competition group workspace + member + joinCode + user pointer
  const groupId = `grp-${uid}`;
  const joinCode = generateJoinCode(uid);
  const profileIds = localProfiles
    .slice(0, 50)
    .map((p) => sanitizeFirestoreId(p.id));
  const safeActiveId =
    activeProfileId && profileIds.includes(sanitizeFirestoreId(activeProfileId))
      ? sanitizeFirestoreId(activeProfileId)
      : profileIds[0] ?? '';

  try {
    const batch1 = writeBatch(db);
    batch1.set(doc(db, 'groups', groupId), {
      ownerUid: uid,
      joinCode,
      profileIds,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch1.set(doc(db, 'groups', groupId, 'members', uid), {
      uid,
      groupId,
      role: 'owner',
      joinedAt: serverTimestamp(),
    });
    batch1.set(doc(db, 'joinCodes', joinCode), {
      code: joinCode,
      groupId,
      ownerUid: uid,
      createdAt: serverTimestamp(),
    });
    batch1.set(userRef, {
      uid,
      displayName,
      groupId,
      activeProfileId: safeActiveId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch1.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}`);
  }

  // Commit user profiles (preserving local XP, sessions, memories, and local passwordHash) + feed after member doc exists
  try {
    const batch2 = writeBatch(db);
    for (const prof of localProfiles.slice(0, 50)) {
      const safeId = sanitizeFirestoreId(prof.id);
      const taggedProf: UserProfile = {
        ...prof,
        id: safeId,
        ownerUid: prof.ownerUid || uid,
      };
      batch2.set(doc(db, 'groups', groupId, 'profiles', safeId), {
        ...sanitizeProfileForFirestore(taggedProf, groupId, uid),
        updatedAt: serverTimestamp(),
      });
    }
    batch2.set(doc(db, 'groups', groupId, 'feed', 'latest'), {
      groupId,
      items: [],
      updatedByUid: uid,
      updatedAt: serverTimestamp(),
    });
    await batch2.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}/profiles`);
  }

  return {
    uid,
    displayName,
    email: user.email ?? '',
    groupId,
    joinCode,
  };
}

export interface CloudJoinResult {
  meta: CloudSessionMeta;
  existingProfileIds: string[];
}

export async function joinCloudGroupByCode(
  user: User,
  rawCode: string,
  activeProfileId: string
): Promise<CloudJoinResult> {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (code.length < 4 || code.length > 16) {
    throw new Error('Wpisz poprawny Kod Grupy / Klasy (np. MT-ABCD).');
  }

  const codePath = `joinCodes/${code}`;
  let codeSnap;
  try {
    codeSnap = await getDoc(doc(db, 'joinCodes', code));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, codePath);
  }

  if (!codeSnap.exists()) {
    throw new Error(
      'Nie znaleziono grupy o tym kodzie. Sprawdź kod u organizatora lub znajomego.'
    );
  }

  const targetGroupId = String(codeSnap.data().groupId);
  const uid = user.uid;
  const displayName = (user.displayName || user.email || 'Gracz').slice(0, 80);
  const safeActiveId = activeProfileId ? sanitizeFirestoreId(activeProfileId, '') : '';
  let existingProfileIds: string[] = [];

  try {
    const memberRef = doc(db, 'groups', targetGroupId, 'members', uid);
    const existingMember = await getDoc(memberRef);
    if (!existingMember.exists()) {
      await setDoc(memberRef, {
        uid,
        groupId: targetGroupId,
        role: 'member',
        joinedAt: serverTimestamp(),
      });
    }
    const grpSnap = await getDoc(doc(db, 'groups', targetGroupId));
    if (grpSnap.exists() && Array.isArray(grpSnap.data().profileIds)) {
      existingProfileIds = (grpSnap.data().profileIds as string[]).filter(
        (id) => typeof id === 'string'
      );
    }

    const userRef = doc(db, 'users', uid);
    const existingUser = await getDoc(userRef);
    if (existingUser.exists()) {
      await updateDoc(userRef, {
        displayName,
        groupId: targetGroupId,
        activeProfileId: safeActiveId,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, {
        uid,
        displayName,
        groupId: targetGroupId,
        activeProfileId: safeActiveId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `groups/${targetGroupId}/members/${uid}`);
  }

  return {
    meta: {
      uid,
      displayName,
      email: user.email ?? '',
      groupId: targetGroupId,
      joinCode: code,
    },
    existingProfileIds,
  };
}

export async function pushProfileToCloud(
  groupId: string,
  uid: string,
  profile: UserProfile
): Promise<void> {
  const safeId = sanitizeFirestoreId(profile.id);
  const path = `groups/${groupId}/profiles/${safeId}`;
  try {
    await setDoc(doc(db, 'groups', groupId, 'profiles', safeId), {
      ...sanitizeProfileForFirestore(profile, groupId, uid),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function pushGroupProfileIds(
  groupId: string,
  profileIds: string[]
): Promise<void> {
  const path = `groups/${groupId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId), {
      profileIds: profileIds.map((id) => sanitizeFirestoreId(id)).slice(0, 50),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteProfileFromCloud(
  groupId: string,
  profileId: string,
  remainingIds: string[]
): Promise<void> {
  const safeId = sanitizeFirestoreId(profileId);
  const path = `groups/${groupId}/profiles/${safeId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId), {
      profileIds: remainingIds.map((id) => sanitizeFirestoreId(id)).slice(0, 50),
      updatedAt: serverTimestamp(),
    });
    await deleteDoc(doc(db, 'groups', groupId, 'profiles', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function pushNotificationsFeedToCloud(
  groupId: string,
  uid: string,
  items: FamilyNotification[]
): Promise<void> {
  const path = `groups/${groupId}/feed/latest`;
  try {
    await setDoc(doc(db, 'groups', groupId, 'feed', 'latest'), {
      groupId,
      items: stripUndefinedDeep(items.slice(0, 40)),
      updatedByUid: uid,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function pushActiveProfileSelectionToCloud(
  uid: string,
  activeProfileId: string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      activeProfileId: activeProfileId ? sanitizeFirestoreId(activeProfileId) : '',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeToGroupCloud(params: {
  groupId: string;
  onProfilesSnapshot: (profiles: UserProfile[]) => void;
  onFeedSnapshot: (notifications: FamilyNotification[]) => void;
  onError?: (err: unknown) => void;
}): Unsubscribe {
  const { groupId, onProfilesSnapshot, onFeedSnapshot, onError } = params;
  const profileUnsubs = new Map<string, Unsubscribe>();
  const latestProfiles = new Map<string, UserProfile>();
  let orderedIds: string[] = [];

  const emitOrdered = () => {
    const list: UserProfile[] = [];
    for (const id of orderedIds) {
      const found = latestProfiles.get(id);
      if (found) list.push(found);
    }
    if (list.length > 0) {
      onProfilesSnapshot(list);
    }
  };

  const unsubGroup = onSnapshot(
    doc(db, 'groups', groupId),
    (grpSnap) => {
      if (!grpSnap.exists()) return;
      const ids = Array.isArray(grpSnap.data().profileIds)
        ? (grpSnap.data().profileIds as string[])
        : [];
      orderedIds = ids;

      for (const [existingId, unsub] of profileUnsubs.entries()) {
        if (!ids.includes(existingId)) {
          unsub();
          profileUnsubs.delete(existingId);
          latestProfiles.delete(existingId);
        }
      }

      for (const pid of ids) {
        if (profileUnsubs.has(pid)) continue;
        const pPath = `groups/${groupId}/profiles/${pid}`;
        const unsubProf = onSnapshot(
          doc(db, 'groups', groupId, 'profiles', pid),
          (pSnap) => {
            if (!pSnap.exists()) return;
            latestProfiles.set(pid, docToUserProfile(pSnap.data()));
            emitOrdered();
          },
          (err) => {
            if (onError) onError(err);
            handleFirestoreError(err, OperationType.GET, pPath);
          }
        );
        profileUnsubs.set(pid, unsubProf);
      }

      emitOrdered();
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, `groups/${groupId}`);
    }
  );

  const unsubFeed = onSnapshot(
    doc(db, 'groups', groupId, 'feed', 'latest'),
    (feedSnap) => {
      if (!feedSnap.exists()) return;
      const items = Array.isArray(feedSnap.data().items)
        ? (feedSnap.data().items as FamilyNotification[])
        : [];
      onFeedSnapshot(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, `groups/${groupId}/feed/latest`);
    }
  );

  return () => {
    unsubGroup();
    unsubFeed();
    for (const unsub of profileUnsubs.values()) {
      unsub();
    }
    profileUnsubs.clear();
  };
}

export async function fetchGlobalSchoolDirectory(): Promise<SchoolDirectoryEntry[]> {
  try {
    const snap = await getDoc(doc(db, 'schoolDirectory', 'global'));
    if (!snap.exists()) return [];
    const rawSchools = snap.data().schools;
    if (!Array.isArray(rawSchools)) return [];
    return rawSchools
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as { name?: unknown }).name === 'string'
      )
      .map((item) => ({
        id:
          typeof item.id === 'string' && item.id.trim().length > 0
            ? item.id
            : slugifySchoolId(String(item.name)),
        name: String(item.name).trim(),
        classes: Array.isArray(item.classes)
          ? item.classes.filter((c): c is string => typeof c === 'string')
          : [],
      }));
  } catch {
    return [];
  }
}

export async function pushGlobalSchoolDirectory(
  entries: SchoolDirectoryEntry[]
): Promise<void> {
  if (!auth.currentUser || entries.length === 0) return;
  const dirRef = doc(db, 'schoolDirectory', 'global');
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(dirRef);
      const remote: SchoolDirectoryEntry[] = snap.exists()
        ? ((snap.data().schools as SchoolDirectoryEntry[]) ?? []).filter(
            (s) => s && typeof s.name === 'string'
          )
        : [];
      const merged = mergeSchoolDirectories([remote, entries]).map((item) => ({
        id: slugifySchoolId(item.name),
        name: item.name.slice(0, 64),
        classes: item.classes.slice(0, 40),
      }));
      if (merged.length === 0) return;
      tx.set(dirRef, {
        schools: merged.slice(0, 100),
        updatedAt: serverTimestamp(),
      });
    });
  } catch {
    // Non-fatal: directory remains available locally
  }
}

export function getSchoolArenaBoardId(schoolName: string): string {
  return `school-${slugifySchoolId(schoolName)}`;
}

async function upsertArenaBoardPlayers(
  boardId: string,
  uid: string,
  cards: ArenaPlayerCard[]
): Promise<void> {
  if (cards.length === 0) return;
  const safeBoardId = sanitizeFirestoreId(boardId, 'global');
  const boardRef = doc(db, 'arenaBoards', safeBoardId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(boardRef);
      const existing = snap.exists()
        ? parseArenaPlayers(snap.data().players)
        : [];
      const byId = new Map<string, ArenaPlayerCard>();
      for (const p of existing) {
        byId.set(p.profileId, p);
      }
      for (const card of cards) {
        const prev = byId.get(card.profileId);
        if (!prev || card.xp >= prev.xp || card.updatedAtMs >= prev.updatedAtMs) {
          byId.set(card.profileId, card);
        }
      }
      const nextPlayers = Array.from(byId.values())
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 100);

      tx.set(boardRef, {
        id: safeBoardId,
        players: stripUndefinedDeep(nextPlayers),
        updatedByUid: uid,
        updatedAt: serverTimestamp(),
      });
    });
  } catch {
    // Non-fatal background competition sync
  }
}

const PUBLIC_ARENA_DISABLED = true;

export async function syncProfilesToArenaBoards(
  uid: string,
  profiles: UserProfile[]
): Promise<void> {
  // Wyniki są teraz widoczne wyłącznie w grupach wybranych przez gracza (circles/*),
  // więc nie publikujemy ich już na ogólnodostępnej tablicy.
  if (PUBLIC_ARENA_DISABLED) return;
  const realProfiles = profiles.filter((p) => p.id && p.id !== 'guest-preview');
  if (realProfiles.length === 0) return;

  const now = Date.now();
  const cards = realProfiles.map((p) => profileToArenaPlayerCard(p, now));
  await upsertArenaBoardPlayers('global', uid, cards);

  const bySchool = new Map<string, ArenaPlayerCard[]>();
  for (const card of cards) {
    if (!card.schoolName) continue;
    const boardId = getSchoolArenaBoardId(card.schoolName);
    const list = bySchool.get(boardId) ?? [];
    list.push(card);
    bySchool.set(boardId, list);
  }
  for (const [boardId, schoolCards] of bySchool.entries()) {
    await upsertArenaBoardPlayers(boardId, uid, schoolCards);
  }
}

export async function fetchArenaBoard(boardId: string): Promise<ArenaPlayerCard[]> {
  try {
    const snap = await getDoc(
      doc(db, 'arenaBoards', sanitizeFirestoreId(boardId, 'global'))
    );
    if (!snap.exists()) return [];
    return parseArenaPlayers(snap.data().players);
  } catch {
    return [];
  }
}

export function subscribeToArenaBoard(
  boardId: string,
  onPlayers: (players: ArenaPlayerCard[]) => void
): Unsubscribe {
  const safeBoardId = sanitizeFirestoreId(boardId, 'global');
  return onSnapshot(
    doc(db, 'arenaBoards', safeBoardId),
    (snap) => {
      if (!snap.exists()) return;
      onPlayers(parseArenaPlayers(snap.data().players));
    },
    () => {
      // Non-fatal if user is signed out or board doesn't exist yet
    }
  );
}
