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
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { OperationType, auth, db, googleProvider, handleFirestoreError } from '../firebase';
import type { FamilyNotification, UserProfile } from '../types/math';
import {
  generateJoinCode,
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
    settings: data.settings as UserProfile['settings'],
    activeThemeId: typeof data.activeThemeId === 'string' ? data.activeThemeId : undefined,
    customThemes: Array.isArray(data.customThemes)
      ? (data.customThemes as UserProfile['customThemes'])
      : [],
  };
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
      const joinCode = grpSnap.exists()
        ? String(grpSnap.data().joinCode ?? generateJoinCode(uid))
        : generateJoinCode(uid);
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
  const profileIds = localProfiles.slice(0, 50).map((p) => p.id);

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
      activeProfileId: profileIds.includes(activeProfileId)
        ? activeProfileId
        : profileIds[0] ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch1.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}`);
  }

  // Commit user profiles + feed after member doc exists
  try {
    const batch2 = writeBatch(db);
    for (const prof of localProfiles.slice(0, 50)) {
      batch2.set(
        doc(db, 'groups', groupId, 'profiles', prof.id),
        {
          ...sanitizeProfileForFirestore(prof, groupId, uid),
          updatedAt: serverTimestamp(),
        }
      );
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
    throw new Error('Nie znaleziono grupy o tym kodzie. Sprawdź kod u organizatora lub znajomego.');
  }

  const targetGroupId = String(codeSnap.data().groupId);
  const uid = user.uid;
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
    await setDoc(
      doc(db, 'users', uid),
      {
        uid,
        displayName: (user.displayName || user.email || 'Gracz').slice(0, 80),
        groupId: targetGroupId,
        activeProfileId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `groups/${targetGroupId}/members/${uid}`);
  }

  return {
    meta: {
      uid,
      displayName: (user.displayName || user.email || 'Gracz').slice(0, 80),
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
  const path = `groups/${groupId}/profiles/${profile.id}`;
  try {
    await setDoc(doc(db, 'groups', groupId, 'profiles', profile.id), {
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
      profileIds: profileIds.slice(0, 50),
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
  const path = `groups/${groupId}/profiles/${profileId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId), {
      profileIds: remainingIds.slice(0, 50),
      updatedAt: serverTimestamp(),
    });
    await deleteDoc(doc(db, 'groups', groupId, 'profiles', profileId));
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
      activeProfileId: activeProfileId.slice(0, 64),
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

      // Remove unsubscribed profiles
      for (const [existingId, unsub] of profileUnsubs.entries()) {
        if (!ids.includes(existingId)) {
          unsub();
          profileUnsubs.delete(existingId);
          latestProfiles.delete(existingId);
        }
      }

      // Subscribe to new profiles
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
          Boolean(item) && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string'
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
  if (!auth.currentUser) return;
  try {
    const remote = await fetchGlobalSchoolDirectory();
    const merged = mergeSchoolDirectories([remote, entries]).map((item) => ({
      id: slugifySchoolId(item.name),
      name: item.name.slice(0, 64),
      classes: item.classes.slice(0, 40),
    }));
    if (merged.length === 0) return;
    await setDoc(doc(db, 'schoolDirectory', 'global'), {
      schools: merged.slice(0, 100),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal: directory remains available locally
  }
}
