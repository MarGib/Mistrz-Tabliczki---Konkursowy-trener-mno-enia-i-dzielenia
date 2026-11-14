import type { UserProfile } from '../types/math';

export interface SchoolDirectoryEntry {
  id: string;
  name: string;
  classes: string[];
}

export const SCHOOL_DIRECTORY_STORAGE_KEY = 'mistrz_tabliczki_school_dir_v1';

function stripPolishAndFold(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\u0142/g, 'l')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalizes a school name for duplicate detection:
 * case-insensitive, diacritic-insensitive, ignores "nr." vs "nr", collapses whitespace.
 */
export function normalizeSchoolKey(raw: string): string {
  return stripPolishAndFold(raw)
    .replace(/\bnr\./g, 'nr')
    .replace(/\s+/g, ' ');
}

/**
 * URL/Firestore-safe slug ID for a school entry.
 */
export function slugifySchoolId(raw: string): string {
  const folded = normalizeSchoolKey(raw)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return folded || 'szkola';
}

/**
 * Normalizes a class label for duplicate detection within a school:
 * "4A", "4 a", "kl. 4a", "Klasa 4 A" -> "4a".
 */
export function normalizeClassKey(raw: string): string {
  return stripPolishAndFold(raw)
    .replace(/^(klasa|kl\.?)\s+/i, '')
    .replace(/\s+/g, '');
}

/**
 * Formats a freshly created class label cleanly (e.g. "4 a" -> "4a", " 4A " -> "4a").
 */
export function formatCanonicalClassName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^(klasa|kl\.?)\s+/i, '')
    .replace(/\s+/g, ' ');
  // Collapse single space between grade digits and section letters: "4 a" -> "4a"
  const compactGrade = cleaned.replace(/^(\d+)\s+([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]{1,3})$/, '$1$2');
  return compactGrade.slice(0, 24);
}

function sortClassesNaturally(classes: string[]): string[] {
  return [...classes].sort((a, b) =>
    a.localeCompare(b, 'pl', { numeric: true, sensitivity: 'base' })
  );
}

export function mergeSchoolDirectories(
  entriesLists: SchoolDirectoryEntry[][],
  profiles: Pick<UserProfile, 'schoolName' | 'className'>[] = []
): SchoolDirectoryEntry[] {
  const byKey = new Map<
    string,
    { id: string; name: string; classMap: Map<string, string> }
  >();

  const ensureSchool = (rawName: string) => {
    const trimmed = rawName.trim().slice(0, 64);
    if (!trimmed) return null;
    const key = normalizeSchoolKey(trimmed);
    let rec = byKey.get(key);
    if (!rec) {
      rec = {
        id: slugifySchoolId(trimmed),
        name: trimmed,
        classMap: new Map<string, string>(),
      };
      byKey.set(key, rec);
    }
    return rec;
  };

  const addClassToRec = (
    rec: { classMap: Map<string, string> },
    rawClass: string
  ) => {
    const trimmed = formatCanonicalClassName(rawClass);
    if (!trimmed) return;
    const clsKey = normalizeClassKey(trimmed);
    if (!clsKey) return;
    if (!rec.classMap.has(clsKey)) {
      rec.classMap.set(clsKey, trimmed);
    }
  };

  for (const list of entriesLists) {
    for (const entry of list) {
      const rec = ensureSchool(entry.name);
      if (!rec) continue;
      for (const cls of entry.classes) {
        addClassToRec(rec, cls);
      }
    }
  }

  for (const prof of profiles) {
    if (!prof.schoolName) continue;
    const rec = ensureSchool(prof.schoolName);
    if (!rec) continue;
    if (prof.className) {
      addClassToRec(rec, prof.className);
    }
  }

  return Array.from(byKey.values())
    .map((rec) => ({
      id: rec.id,
      name: rec.name,
      classes: sortClassesNaturally(Array.from(rec.classMap.values())).slice(0, 40),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }))
    .slice(0, 100);
}

export function findMatchingSchool(
  directory: SchoolDirectoryEntry[],
  rawSchool: string
): SchoolDirectoryEntry | undefined {
  const key = normalizeSchoolKey(rawSchool);
  if (!key) return undefined;
  return directory.find((s) => normalizeSchoolKey(s.name) === key);
}

export function findMatchingClassInSchool(
  school: SchoolDirectoryEntry | undefined,
  rawClass: string
): string | undefined {
  if (!school) return undefined;
  const clsKey = normalizeClassKey(rawClass);
  if (!clsKey) return undefined;
  return school.classes.find((c) => normalizeClassKey(c) === clsKey);
}

export interface DuplicateClassCheckResult {
  isDuplicate: boolean;
  existingSchool?: SchoolDirectoryEntry;
  existingClass?: string;
}

export function checkDuplicateClassAttempt(
  directory: SchoolDirectoryEntry[],
  rawSchool: string,
  rawClassInput: string
): DuplicateClassCheckResult {
  const existingSchool = findMatchingSchool(directory, rawSchool);
  if (!existingSchool) {
    return { isDuplicate: false };
  }
  const existingClass = findMatchingClassInSchool(existingSchool, rawClassInput);
  if (existingClass) {
    return {
      isDuplicate: true,
      existingSchool,
      existingClass,
    };
  }
  return { isDuplicate: false, existingSchool };
}

/**
 * Guarantees that submitting a school + class always snaps to an existing canonical
 * school name and an existing canonical class name if one already exists in that school.
 */
export function resolveCanonicalSchoolAndClass(
  directory: SchoolDirectoryEntry[],
  rawSchool?: string,
  rawClass?: string
): { schoolName?: string; className?: string; matchedExistingClass: boolean } {
  const trimmedSchool = rawSchool?.trim().slice(0, 64) ?? '';
  if (!trimmedSchool) {
    return { schoolName: undefined, className: undefined, matchedExistingClass: false };
  }
  const matchedSchool = findMatchingSchool(directory, trimmedSchool);
  const canonicalSchool = matchedSchool ? matchedSchool.name : trimmedSchool;

  const trimmedClass = rawClass?.trim() ?? '';
  if (!trimmedClass) {
    return { schoolName: canonicalSchool, className: undefined, matchedExistingClass: false };
  }
  const matchedClass = findMatchingClassInSchool(matchedSchool, trimmedClass);
  if (matchedClass) {
    return {
      schoolName: canonicalSchool,
      className: matchedClass,
      matchedExistingClass: true,
    };
  }
  const formatted = formatCanonicalClassName(trimmedClass);
  return {
    schoolName: canonicalSchool,
    className: formatted || undefined,
    matchedExistingClass: false,
  };
}

export function loadLocalSchoolDirectory(): SchoolDirectoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SCHOOL_DIRECTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SchoolDirectoryEntry =>
          Boolean(item) &&
          typeof item.name === 'string' &&
          Array.isArray(item.classes)
      )
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : slugifySchoolId(item.name),
        name: item.name.trim(),
        classes: item.classes.filter((c): c is string => typeof c === 'string'),
      }));
  } catch {
    return [];
  }
}

export function saveLocalSchoolDirectory(entries: SchoolDirectoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SCHOOL_DIRECTORY_STORAGE_KEY,
      JSON.stringify(entries.slice(0, 100))
    );
  } catch {
    // Ignore storage quota errors
  }
}
