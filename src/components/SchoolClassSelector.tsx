import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  GraduationCap,
  Plus,
  School,
  X,
} from 'lucide-react';
import {
  type SchoolDirectoryEntry,
  checkDuplicateClassAttempt,
  findMatchingSchool,
  formatCanonicalClassName,
  normalizeSchoolKey,
} from '../engine/schoolDirectory';

interface SchoolClassSelectorProps {
  directory: SchoolDirectoryEntry[];
  schoolValue: string;
  classValue: string;
  onChangeSchool: (school: string) => void;
  onChangeClass: (cls: string) => void;
  idPrefix?: string;
  onDuplicateBlockChange?: (blocked: boolean) => void;
}

export function SchoolClassSelector({
  directory,
  schoolValue,
  classValue,
  onChangeSchool,
  onChangeClass,
  idPrefix = 'sc',
  onDuplicateBlockChange,
}: SchoolClassSelectorProps) {
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [addingNewSchool, setAddingNewSchool] = useState(false);
  const [newSchoolDraft, setNewSchoolDraft] = useState('');

  const [classOpen, setClassOpen] = useState(false);
  const [addingNewClass, setAddingNewClass] = useState(false);
  const [newClassDraft, setNewClassDraft] = useState('');

  const matchedSchool = useMemo(
    () => findMatchingSchool(directory, schoolValue),
    [directory, schoolValue]
  );

  const existingClasses = matchedSchool?.classes ?? [];

  const filteredSchools = useMemo(() => {
    const q = normalizeSchoolKey(schoolSearch);
    if (!q) return directory;
    return directory.filter((s) => normalizeSchoolKey(s.name).includes(q));
  }, [directory, schoolSearch]);

  const draftSchoolMatch = useMemo(
    () => findMatchingSchool(directory, newSchoolDraft),
    [directory, newSchoolDraft]
  );

  const duplicateCheck = useMemo(() => {
    if (!addingNewClass || !newClassDraft.trim()) {
      return { isDuplicate: false as const };
    }
    return checkDuplicateClassAttempt(directory, schoolValue, newClassDraft);
  }, [addingNewClass, newClassDraft, directory, schoolValue]);

  const notifyBlocked = (blocked: boolean) => {
    onDuplicateBlockChange?.(blocked);
  };

  const handleSelectExistingSchool = (entry: SchoolDirectoryEntry) => {
    onChangeSchool(entry.name);
    onChangeClass('');
    setSchoolOpen(false);
    setAddingNewSchool(false);
    setNewSchoolDraft('');
    setSchoolSearch('');
    setAddingNewClass(false);
    setNewClassDraft('');
    notifyBlocked(false);
    // Automatically reveal existing classes right after choosing a school with classes
    setClassOpen(entry.classes.length > 0);
  };

  const handleClearSchool = () => {
    onChangeSchool('');
    onChangeClass('');
    setSchoolOpen(false);
    setAddingNewSchool(false);
    setNewSchoolDraft('');
    setClassOpen(false);
    setAddingNewClass(false);
    setNewClassDraft('');
    notifyBlocked(false);
  };

  const handleConfirmNewSchool = () => {
    const trimmed = newSchoolDraft.trim();
    if (!trimmed) return;
    if (draftSchoolMatch) {
      handleSelectExistingSchool(draftSchoolMatch);
      return;
    }
    onChangeSchool(trimmed);
    onChangeClass('');
    setAddingNewSchool(false);
    setSchoolOpen(false);
    setNewSchoolDraft('');
    setAddingNewClass(true);
    setClassOpen(true);
    notifyBlocked(false);
  };

  const handleSelectExistingClass = (cls: string) => {
    onChangeClass(cls);
    setClassOpen(false);
    setAddingNewClass(false);
    setNewClassDraft('');
    notifyBlocked(false);
  };

  const handleNewClassDraftChange = (val: string) => {
    setNewClassDraft(val);
    const check = checkDuplicateClassAttempt(directory, schoolValue, val);
    if (check.isDuplicate) {
      notifyBlocked(true);
    } else {
      notifyBlocked(false);
      onChangeClass(formatCanonicalClassName(val));
    }
  };

  const handleJoinDuplicateExistingClass = () => {
    if (!duplicateCheck.existingClass) return;
    handleSelectExistingClass(duplicateCheck.existingClass);
  };

  const handleConfirmNewClass = () => {
    const formatted = formatCanonicalClassName(newClassDraft);
    if (!formatted) return;
    if (duplicateCheck.isDuplicate) {
      notifyBlocked(true);
      return;
    }
    onChangeClass(formatted);
    setAddingNewClass(false);
    setClassOpen(false);
    setNewClassDraft('');
    notifyBlocked(false);
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* School Dropdown Selector */}
        <div className="relative">
          <label
            htmlFor={`${idPrefix}-school-trigger`}
            className="block text-xs font-bold text-[var(--th-text)] mb-1"
          >
            Szkoła (opcjonalnie)
          </label>

          <button
            id={`${idPrefix}-school-trigger`}
            type="button"
            aria-expanded={schoolOpen}
            onClick={() => {
              setSchoolOpen((o) => !o);
              setClassOpen(false);
            }}
            data-testid={`${idPrefix}-school-trigger`}
            className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-left text-sm font-medium flex items-center justify-between gap-2 cursor-pointer hover:border-[var(--th-primary)] transition-colors"
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <School className="w-4 h-4 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
              <span
                className={`truncate ${
                  schoolValue ? 'text-[var(--th-text)] font-semibold' : 'text-[var(--th-text-muted)]'
                }`}
              >
                {schoolValue || 'Wybierz lub dodaj szkołę...'}
              </span>
            </span>
            <ChevronDown
              className={`w-4 h-4 text-[var(--th-text-muted)] shrink-0 transition-transform ${
                schoolOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {schoolOpen && (
            <div
              className="mt-1.5 rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface)] p-2.5 space-y-2 shadow-lg z-20"
              data-testid={`${idPrefix}-school-dropdown`}
            >
              {directory.length > 0 ? (
                <>
                  {directory.length > 4 && (
                    <input
                      type="text"
                      value={schoolSearch}
                      onChange={(e) => setSchoolSearch(e.target.value)}
                      placeholder="Szukaj szkoły..."
                      aria-label="Szukaj szkoły"
                      className="w-full min-h-[36px] px-2.5 rounded-lg border border-[var(--th-border)] bg-[var(--th-canvas)] text-xs text-[var(--th-text)]"
                    />
                  )}
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredSchools.map((entry) => {
                      const active =
                        normalizeSchoolKey(entry.name) === normalizeSchoolKey(schoolValue);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => handleSelectExistingSchool(entry)}
                          className={`w-full min-h-[38px] px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            active
                              ? 'bg-[var(--th-soft-tint)] text-[var(--th-primary)] font-bold'
                              : 'hover:bg-[var(--th-surface-muted)] text-[var(--th-text)] font-medium'
                          }`}
                        >
                          <span className="truncate">{entry.name}</span>
                          <span className="text-[11px] text-[var(--th-text-muted)] shrink-0 tabular-nums">
                            {entry.classes.length > 0
                              ? `${entry.classes.length} ${
                                  entry.classes.length === 1 ? 'klasa' : 'klas'
                                }`
                              : 'brak klas'}
                          </span>
                        </button>
                      );
                    })}
                    {filteredSchools.length === 0 && (
                      <p className="text-[11px] text-[var(--th-text-muted)] px-2 py-1">
                        Nie znaleziono takiej szkoły — możesz ją dodać poniżej.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-[var(--th-text-muted)] px-1">
                  Brak zapisanych szkół — dodaj pierwszą szkołę poniżej.
                </p>
              )}

              {!addingNewSchool ? (
                <div className="pt-1.5 border-t border-[var(--th-border)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingNewSchool(true);
                      setNewSchoolDraft(schoolSearch);
                    }}
                    data-testid={`${idPrefix}-add-school-btn`}
                    className="min-h-[34px] px-2.5 rounded-lg bg-[var(--th-soft-tint)] text-[var(--th-primary)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Dodaj nową szkołę</span>
                  </button>
                  {schoolValue && (
                    <button
                      type="button"
                      onClick={handleClearSchool}
                      className="min-h-[34px] px-2 text-[11px] font-semibold text-[var(--th-text-muted)] hover:text-[var(--th-text)] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                      <span>Wyczyść</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="pt-1.5 border-t border-[var(--th-border)] space-y-2">
                  <label
                    htmlFor={`${idPrefix}-new-school-input`}
                    className="block text-[11px] font-bold text-[var(--th-text)]"
                  >
                    Nazwa nowej szkoły
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id={`${idPrefix}-new-school-input`}
                      type="text"
                      value={newSchoolDraft}
                      onChange={(e) => {
                        setNewSchoolDraft(e.target.value);
                        // Also mirror so submitting form without pressing "Zatwierdź" still keeps it if unique
                        const match = findMatchingSchool(directory, e.target.value);
                        onChangeSchool(match ? match.name : e.target.value.trim());
                        onChangeClass('');
                      }}
                      placeholder="np. SP nr 5"
                      maxLength={60}
                      className="flex-1 min-h-[36px] px-2.5 rounded-lg border border-[var(--th-border)] bg-[var(--th-canvas)] text-xs text-[var(--th-text)] font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmNewSchool}
                      disabled={!newSchoolDraft.trim()}
                      className="min-h-[36px] px-3 rounded-lg bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-xs font-bold disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      OK
                    </button>
                  </div>
                  {draftSchoolMatch && (
                    <p className="text-[11px] font-semibold text-[var(--th-primary)]">
                      Ta szkoła już istnieje na liście — dołączasz do „{draftSchoolMatch.name}”.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Class Selector (Shows existing classes in chosen school & prevents duplicates) */}
        <div className="relative">
          <label
            htmlFor={`${idPrefix}-class-trigger`}
            className="block text-xs font-bold text-[var(--th-text)] mb-1"
          >
            Klasa (opcjonalnie)
          </label>

          <button
            id={`${idPrefix}-class-trigger`}
            type="button"
            disabled={!schoolValue.trim()}
            aria-expanded={classOpen}
            onClick={() => {
              if (!schoolValue.trim()) return;
              setClassOpen((o) => !o);
              setSchoolOpen(false);
            }}
            data-testid={`${idPrefix}-class-trigger`}
            className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-left text-sm font-medium flex items-center justify-between gap-2 cursor-pointer hover:border-[var(--th-primary)] disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <GraduationCap className="w-4 h-4 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
              <span
                className={`truncate ${
                  classValue ? 'text-[var(--th-text)] font-semibold' : 'text-[var(--th-text-muted)]'
                }`}
              >
                {!schoolValue.trim()
                  ? 'Najpierw wybierz szkołę'
                  : classValue ||
                    (existingClasses.length > 0
                      ? `Wybierz klasę (${existingClasses.length})`
                      : 'Wpisz lub wybierz klasę...')}
              </span>
            </span>
            <ChevronDown
              className={`w-4 h-4 text-[var(--th-text-muted)] shrink-0 transition-transform ${
                classOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {classOpen && schoolValue.trim() && (
            <div
              className="mt-1.5 rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface)] p-2.5 space-y-2 shadow-lg z-20"
              data-testid={`${idPrefix}-class-dropdown`}
            >
              {existingClasses.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-[var(--th-text-muted)] mb-1.5">
                    Istniejące klasy w szkole „{matchedSchool?.name ?? schoolValue}”:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {existingClasses.map((cls) => {
                      const active = classValue === cls;
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => handleSelectExistingClass(cls)}
                          className={`min-h-[34px] px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                            active
                              ? 'bg-[var(--th-primary)] border-[var(--th-primary)] text-[var(--th-primary-fg)]'
                              : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text)] hover:border-[var(--th-primary)]'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" aria-hidden="true" />}
                          <span>Klasa {cls}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!addingNewClass && existingClasses.length > 0 ? (
                <div className="pt-1.5 border-t border-[var(--th-border)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingNewClass(true);
                      setNewClassDraft('');
                      notifyBlocked(false);
                    }}
                    data-testid={`${idPrefix}-add-class-btn`}
                    className="min-h-[34px] px-2.5 rounded-lg bg-[var(--th-soft-tint)] text-[var(--th-primary)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Dodaj inną klasę</span>
                  </button>
                  {classValue && (
                    <button
                      type="button"
                      onClick={() => {
                        onChangeClass('');
                        setClassOpen(false);
                      }}
                      className="text-[11px] font-semibold text-[var(--th-text-muted)] hover:text-[var(--th-text)] cursor-pointer"
                    >
                      Wyczyść
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={`${
                    existingClasses.length > 0 ? 'pt-1.5 border-t border-[var(--th-border)]' : ''
                  } space-y-2`}
                >
                  <label
                    htmlFor={`${idPrefix}-new-class-input`}
                    className="block text-[11px] font-bold text-[var(--th-text)]"
                  >
                    {existingClasses.length > 0
                      ? 'Wpisz nową klasę (jeśli nie ma jej powyżej)'
                      : `Pierwsza klasa w szkole „${schoolValue}”`}
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id={`${idPrefix}-new-class-input`}
                      type="text"
                      value={newClassDraft}
                      onChange={(e) => {
                        setAddingNewClass(true);
                        handleNewClassDraftChange(e.target.value);
                      }}
                      placeholder="np. 4a"
                      maxLength={20}
                      className="flex-1 min-h-[36px] px-2.5 rounded-lg border border-[var(--th-border)] bg-[var(--th-canvas)] text-xs text-[var(--th-text)] font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmNewClass}
                      disabled={!newClassDraft.trim() || duplicateCheck.isDuplicate}
                      className="min-h-[36px] px-3 rounded-lg bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-xs font-bold disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      Użyj
                    </button>
                  </div>

                  {duplicateCheck.isDuplicate && duplicateCheck.existingClass && (
                    <div
                      className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-1.5"
                      role="alert"
                      data-testid={`${idPrefix}-duplicate-class-alert`}
                    >
                      <div className="flex items-start gap-1.5 text-[11px] font-bold text-[var(--th-text)]">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>
                          Klasa „{duplicateCheck.existingClass}” już istnieje w szkole „
                          {duplicateCheck.existingSchool?.name}” — nie można utworzyć drugiej takiej samej klasy.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleJoinDuplicateExistingClass}
                        className="w-full min-h-[32px] px-2.5 rounded-lg bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-xs font-bold cursor-pointer"
                      >
                        Dołącz do klasy {duplicateCheck.existingClass}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {schoolValue && classValue && !duplicateCheck.isDuplicate && (
        <p className="text-[11px] font-semibold text-[var(--th-primary)]">
          Wybrano: {schoolValue} · Klasa {classValue}
        </p>
      )}
    </div>
  );
}
