import { useEffect, useState } from 'react';
import { HelpButton } from '../help/HelpButton';
import {
  Award,
  Check,
  Cloud,
  Copy,
  GraduationCap,
  KeyRound,
  Lock,
  LogOut,
  Monitor,
  Palette,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Smartphone,
  Tablet,
  Trash2,
  Unlock,
  UserPlus,
  Users,
} from 'lucide-react';
import { ALL_BADGES } from '../data/curriculum';
import { PRESET_THEMES } from '../data/themes';
import {
  hasAccountPassword,
  normalizeLogin,
  verifyAccountCredentials,
} from '../engine/accountSecurity';
import { parseAvatarPrompt } from '../engine/avatarComposer';
import type { CloudSessionMeta } from '../engine/cloudSync';
import type { SchoolDirectoryEntry } from '../engine/schoolDirectory';
import { computeUserLevel } from '../engine/spacedRepetition';
import type { AccountSyncState, CloudSyncStatus } from '../store/useAppStore';
import type {
  AppSettings,
  AvatarSpec,
  ColorTheme,
  DeviceProfile,
  UserProfile,
} from '../types/math';
import { AvatarDisplay } from './AvatarDisplay';
import { PasswordInput } from './PasswordInput';
import { AvatarStudio } from './AvatarStudio';

interface ProfileSettingsViewProps {
  accountState?: AccountSyncState;
  onLogout: () => void;
  onCreateAccount: (
    name: string,
    avatarId: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  ownedProfiles: UserProfile[];
  activeProfile: UserProfile;
  schoolDirectory: SchoolDirectoryEntry[];
  activeTheme: ColorTheme;
  device: DeviceProfile;
  cloudMeta: CloudSessionMeta | null;
  cloudStatus: CloudSyncStatus;
  cloudError: string | null;
  onSwitchProfile: (id: string) => void;
  onCreateProfile: (
    name: string,
    avatarId: string,
    customAvatarSpec?: AvatarSpec,
    login?: string,
    password?: string,
    schoolName?: string,
    className?: string
  ) => void;
  onDeleteProfile: (id: string) => void;
  onUpdateProfileMeta: (
    name: string,
    avatarId: string,
    customAvatarSpec?: AvatarSpec,
    schoolName?: string,
    className?: string
  ) => void;
  onSetProfileCredentials: (profileId: string, login: string, password: string) => void;
  onClearProfilePassword: (profileId: string) => void;
  onSelectTheme: (themeId: string) => void;
  onOpenThemesTab: () => void;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onJoinGroupCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onResetLocalData: () => void;
  onReopenProfilePicker?: () => void;
}

const RANGE_OPTIONS = [
  { value: 50, label: 'Do 50 (Rozgrzewka)' },
  { value: 100, label: 'Do 100 (Konkursowy)' },
  { value: 144, label: 'Do 144 (Tabliczka do 12)' },
  { value: 200, label: 'Do 200 (Rozszerzony)' },
  { value: 500, label: 'Do 500 (Zaawansowany)' },
  { value: 1000, label: 'Do 1000 (Mistrzowski)' },
];

const QUICK_THEME_IDS = [
  'royal-purple',
  'chicago-bulls',
  'blekit-oceanu',
  'szmaragdowe-studio',
  'nocny-kosmos',
];

export function ProfileSettingsView({
  ownedProfiles,
  activeProfile,
  schoolDirectory,
  activeTheme,
  device,
  cloudMeta,
  cloudStatus,
  cloudError,
  onSwitchProfile,
  onCreateProfile,
  accountState,
  onCreateAccount,
  onLogout,
  onDeleteProfile,
  onUpdateProfileMeta,
  onSetProfileCredentials,
  onClearProfilePassword,
  onSelectTheme,
  onOpenThemesTab,
  onUpdateSettings,
  onConnectGoogle,
  onDisconnectGoogle,
  onJoinGroupCode,
  onResetLocalData,
  onReopenProfilePicker,
}: ProfileSettingsViewProps) {
  const [newName, setNewName] = useState('');
  const [newSchool, setNewSchool] = useState('');
  const [newClass, setNewClass] = useState('');
  const [newDupBlocked, setNewDupBlocked] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newAvatarPrompt, setNewAvatarPrompt] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  const [editName, setEditName] = useState(activeProfile.name);
  const [editSchool, setEditSchool] = useState(activeProfile.schoolName ?? '');
  const [editClass, setEditClass] = useState(activeProfile.className ?? '');
  const [editDupBlocked, setEditDupBlocked] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [loginEdit, setLoginEdit] = useState(
    activeProfile.login || normalizeLogin(activeProfile.name)
  );
  const [passwordEdit, setPasswordEdit] = useState('');
  const [credNotice, setCredNotice] = useState<string | null>(null);
  const [credError, setCredError] = useState<string | null>(null);

  const [unlockTargetId, setUnlockTargetId] = useState<string | null>(null);
  const [unlockPwdInput, setUnlockPwdInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinCodeMessage, setJoinCodeMessage] = useState<string | null>(null);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const [joiningCode, setJoiningCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setEditName(activeProfile.name);
    setEditSchool(activeProfile.schoolName ?? '');
    setEditClass(activeProfile.className ?? '');
    setLoginEdit(activeProfile.login || normalizeLogin(activeProfile.name));
    setPasswordEdit('');
    setCredNotice(null);
    setCredError(null);
    setUnlockTargetId(null);
    setUnlockPwdInput('');
    setUnlockError(null);
  }, [
    activeProfile.id,
    activeProfile.name,
    activeProfile.schoolName,
    activeProfile.className,
    activeProfile.login,
  ]);

  const levelInfo = computeUserLevel(activeProfile.xp);
  const activeHasPassword = hasAccountPassword(activeProfile);

  const handleSaveProfileDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || editDupBlocked) return;
    onUpdateProfileMeta(
      editName.trim(),
      activeProfile.avatarId,
      activeProfile.customAvatarSpec,
      editSchool,
      editClass
    );
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setCredError(null);
    const trimmedPwd = passwordEdit.trim();
    if (trimmedPwd.length > 0 && trimmedPwd.length < 4) {
      setCredError('Hasło lub PIN musi mieć minimum 4 znaki.');
      return;
    }
    if (trimmedPwd.length === 0 && (!activeHasPassword || accountState?.state !== 'synced')) {
      setCredError('Wpisz hasło (min. 4 znaki) — zabezpieczy konto i włączy synchronizację w chmurze.');
      return;
    }
    onSetProfileCredentials(
      activeProfile.id,
      loginEdit || activeProfile.name,
      trimmedPwd
    );
    setPasswordEdit('');
    setCredNotice(
      trimmedPwd
        ? 'Zapisano hasło. Łączę konto z chmurą…'
        : 'Zaktualizowano login konta.'
    );
    window.setTimeout(() => setCredNotice(null), 2400);
  };

  const handleRequestSwitch = (target: UserProfile) => {
    if (target.id === activeProfile.id) return;
    if (!hasAccountPassword(target)) {
      onSwitchProfile(target.id);
      return;
    }
    setUnlockTargetId(target.id);
    setUnlockPwdInput('');
    setUnlockError(null);
  };

  const handleUnlockTargetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = ownedProfiles.find((p) => p.id === unlockTargetId);
    if (!target) return;
    if (!verifyAccountCredentials(target, unlockPwdInput)) {
      setUnlockError('Nieprawidłowe hasło dla tego konta.');
      return;
    }
    setUnlockTargetId(null);
    setUnlockError(null);
    // Przełącz i (w tle) wznów synchronizację konta w chmurze.
    onSetProfileCredentials(target.id, target.login || target.name, unlockPwdInput.trim());
    setUnlockPwdInput('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    if (newPassword.trim().length < 4) {
      setCredError('Nowe konto potrzebuje hasła lub PIN-u (min. 4 znaki).');
      return;
    }
    void onCreateProfile;
    void parseAvatarPrompt;
    const res = await onCreateAccount(newName.trim(), 'owl', newPassword.trim());
    if (!res.ok) {
      setCredError(res.error ?? 'Nie udało się utworzyć konta.');
      return;
    }
    setNewName('');
    setNewSchool('');
    setNewClass('');
    setNewDupBlocked(false);
    setNewPassword('');
    setNewAvatarPrompt('');
    setShowNewForm(false);
  };

  const handleCopyJoinCode = () => {
    if (!cloudMeta?.joinCode) return;
    void navigator.clipboard?.writeText(cloudMeta.joinCode);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleJoinCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinCodeError(null);
    setJoinCodeMessage(null);
    setJoiningCode(true);
    const res = await onJoinGroupCode(joinCodeInput);
    setJoiningCode(false);
    if (res.ok) {
      setJoinCodeInput('');
      setJoinCodeMessage('Dołączono do grupy / klasy! Wyniki synchronizują się na żywo.');
    } else {
      setJoinCodeError(res.error ?? 'Nie udało się dołączyć tym kodem.');
    }
  };

  const DeviceIcon =
    device.category === 'telefon'
      ? Smartphone
      : device.category === 'tablet'
      ? Tablet
      : Monitor;

  const quickThemes = PRESET_THEMES.filter((t) => QUICK_THEME_IDS.includes(t.id));
  const schoolClassDisplay = [activeProfile.schoolName, activeProfile.className]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--th-text)]">
          Konto i synchronizacja
        </h1>
        <p className="mt-1 text-xs sm:text-base text-[var(--th-text-muted)]">
          Zarządzaj kontem, hasłem i kolorami. Konto z hasłem synchronizuje się automatycznie między urządzeniami.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left: User Account, School/Class, Cloud Sync, Credentials & Owned Accounts */}
        <section className="lg:col-span-6 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-4 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-[var(--th-border)]">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--th-text-muted)]">
                Aktywny użytkownik{schoolClassDisplay ? ` · ${schoolClassDisplay}` : ''}
              </p>
              <h2 className="font-display text-xl font-bold text-[var(--th-text)] truncate">
                {activeProfile.name} · Poziom {levelInfo.level}
              </h2>
              <p className="text-xs text-[var(--th-text-muted)] tabular-nums">
                {activeProfile.xp} XP · Seria {activeProfile.streakDays} dni ·{' '}
                {activeProfile.sessions.length} ukończonych serii
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 shrink-0">
              <AvatarDisplay
                avatarId={activeProfile.avatarId}
                customSpec={activeProfile.customAvatarSpec}
                name={activeProfile.name}
                sizeClass="w-14 h-14"
              />
              <button
                type="button"
                onClick={onLogout}
                data-testid="logout-btn"
                className="min-h-[36px] px-3 rounded-xl border border-[var(--th-border)] text-xs font-bold text-[var(--th-text)] hover:border-red-400 hover:text-red-500 cursor-pointer"
              >
                Wyloguj
              </button>
              <HelpButton section="logout" label="Wylogowanie" />
            </div>
          </div>
          {!activeProfile.cloudUid && (
            <p className="text-[11px] text-[var(--th-text-muted)] -mt-2">
              To konto nie jest jeszcze w chmurze — „Wyloguj” wróci do wyboru kont, a wyniki zostaną na tym urządzeniu.
            </p>
          )}

          {/* Edit Current User Name, School & Class */}
          <form onSubmit={handleSaveProfileDetails} className="space-y-3">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
              <h3 className="font-display text-base font-bold text-[var(--th-text)]">
                Dane ucznia / gracza
              </h3>
            </div>

            <div>
              <label
                htmlFor="profile-name-input"
                className="block text-xs font-bold text-[var(--th-text)] mb-1"
              >
                Nazwa użytkownika lub imię
              </label>
              <input
                id="profile-name-input"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={24}
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm font-medium focus:outline-2 focus:outline-[var(--th-primary)]"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              {savedNotice ? (
                <p className="text-xs font-semibold text-[var(--th-primary)]">
                  Zapisano dane gracza.
                </p>
              ) : (
                <span className="text-[11px] text-[var(--th-text-muted)]">
                  Porównuj wyniki w grupach — zakładka Statystyki.
                </span>
              )}
              <button
                type="submit"
                disabled={false}
                className="min-h-[40px] px-4 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] border-b-3 border-[var(--th-primary-dark)] text-sm font-bold disabled:opacity-50 cursor-pointer shrink-0"
              >
                Zapisz dane
              </button>
            </div>
          </form>

          {/* Personal Theme Template Quick Switcher */}
          <div className="pt-4 border-t border-[var(--th-border)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-bold text-[var(--th-text)] flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
                  <span>Kolorystyka Twojego konta</span>
                </h3>
                <p className="text-xs text-[var(--th-text-muted)]">
                  Aktywny szablon: <strong className="text-[var(--th-text)]">{activeTheme.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenThemesTab}
                className="text-xs font-bold text-[var(--th-primary)] hover:underline cursor-pointer whitespace-nowrap"
              >
                Wszystkie i kreator (11+)
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {quickThemes.map((t) => {
                const selected = activeTheme.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTheme(t.id)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-all ${
                      selected
                        ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] text-[var(--th-text)]'
                        : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-black/15 shrink-0"
                      style={{ backgroundColor: t.tokens.primary }}
                    />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Login & Password Account Protection */}
          <form
            onSubmit={handleSaveCredentials}
            className="pt-4 border-t border-[var(--th-border)] space-y-3"
            data-testid="account-security-form"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {activeHasPassword ? (
                  <Lock className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
                )}
                <h3 className="font-display text-base font-bold text-[var(--th-text)]">
                  Login i hasło · synchronizacja
                </h3>
                <HelpButton section="sync" label="Synchronizacja" />
              </div>
              <span
                data-testid="account-sync-status"
                className={`text-[11px] font-bold ${
                  accountState?.state === 'synced'
                    ? 'text-emerald-600'
                    : accountState?.state === 'error'
                    ? 'text-red-500'
                    : 'text-[var(--th-text-muted)]'
                }`}
              >
                {accountState?.state === 'synced'
                  ? '☁ Zsynchronizowano'
                  : accountState?.state === 'syncing'
                  ? 'Łączenie…'
                  : accountState?.state === 'error'
                  ? 'Błąd synchronizacji'
                  : 'Tylko na tym urządzeniu'}
              </span>
              {activeHasPassword && !activeProfile.cloudUid && (
                <button
                  type="button"
                  onClick={() => {
                    onClearProfilePassword(activeProfile.id);
                    setCredNotice('Usunięto blokadę hasłem dla tego konta.');
                  }}
                  className="text-xs font-bold text-[var(--th-text-muted)] hover:text-red-500 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Usuń hasło</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="account-login-input"
                  className="block text-xs font-bold text-[var(--th-text)] mb-1"
                >
                  Twój login
                </label>
                <input
                  id="account-login-input"
                  type="text"
                  value={loginEdit}
                  onChange={(e) => setLoginEdit(e.target.value)}
                  maxLength={24}
                  placeholder={normalizeLogin(activeProfile.name)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm font-medium focus:outline-2 focus:outline-[var(--th-primary)]"
                />
              </div>
              <div>
                <label
                  htmlFor="account-password-input"
                  className="block text-xs font-bold text-[var(--th-text)] mb-1"
                >
                  {activeHasPassword ? 'Nowe hasło / PIN (opcjonalnie)' : 'Ustaw hasło lub PIN'}
                </label>
                <PasswordInput
                  id="account-password-input"
                 
                  value={passwordEdit}
                  onChange={(e) => {
                    setPasswordEdit(e.target.value);
                    setCredError(null);
                  }}
                  maxLength={32}
                  placeholder={activeHasPassword ? '•••• (zmień)' : 'np. 1234'}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm font-medium focus:outline-2 focus:outline-[var(--th-primary)]"
                />
              </div>
            </div>

            {accountState?.message && accountState.state !== 'synced' && (
              <p className="text-xs font-semibold text-[var(--th-text-muted)]">{accountState.message}</p>
            )}
            {credError && (
              <p className="text-xs font-bold text-red-500" role="alert">
                {credError}
              </p>
            )}
            {credNotice && (
              <p className="text-xs font-semibold text-[var(--th-primary)]">{credNotice}</p>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--th-text-muted)]">
                {activeHasPassword
                  ? 'Konto zabezpieczone — nikt nie przełączy się tu bez hasła.'
                  : 'Ustaw hasło, aby inni użytkownicy nie weszli na Twoje konto.'}
              </span>
              <button
                type="submit"
                className="min-h-[38px] px-3.5 rounded-xl bg-[var(--th-surface-muted)] hover:border-[var(--th-primary)] border border-[var(--th-border)] text-xs font-bold text-[var(--th-text)] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <KeyRound className="w-3.5 h-3.5 text-[var(--th-primary)]" aria-hidden="true" />
                <span>{activeHasPassword ? 'Zaktualizuj' : 'Zabezpiecz'}</span>
              </button>
            </div>
          </form>

          {/* Owned User Accounts on This Device */}
          <div className="pt-4 border-t border-[var(--th-border)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-[var(--th-text)] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
                <span>Twoje konta na tym urządzeniu ({ownedProfiles.length})</span>
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewForm((v) => !v)}
                  className="text-xs font-bold text-[var(--th-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Nowe konto</span>
                </button>
                {onReopenProfilePicker && (
                  <button
                    type="button"
                    onClick={onReopenProfilePicker}
                    className="text-xs font-bold text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:underline cursor-pointer"
                  >
                    Ekran startowy kont
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {ownedProfiles.map((p) => {
                const isCurrent = p.id === activeProfile.id;
                const isProtected = hasAccountPassword(p);
                const isUnlocking = unlockTargetId === p.id;
                const cohort = [p.schoolName, p.className].filter(Boolean).join(' · ');
                return (
                  <div
                    key={p.id}
                    className={`w-full px-3 py-2 rounded-xl border transition-colors ${
                      isCurrent
                        ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] text-[var(--th-text)]'
                        : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text)]'
                    }`}
                  >
                    <div className="min-h-[44px] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleRequestSwitch(p)}
                        className="flex-1 flex items-center gap-3 text-left cursor-pointer min-w-0"
                      >
                        <AvatarDisplay
                          avatarId={p.avatarId}
                          customSpec={p.customAvatarSpec}
                          name={p.name}
                          sizeClass="w-9 h-9"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate inline-flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {isProtected && (
                              <Lock
                                className="w-3.5 h-3.5 text-[var(--th-primary)] shrink-0"
                                aria-label="Wymaga hasła"
                              />
                            )}
                          </div>
                          <div className="text-xs text-[var(--th-text-muted)] tabular-nums truncate">
                            {cohort ? `${cohort} · ` : ''}
                            {p.xp} XP · {p.sessions.length} serii
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--th-primary)]">
                            <Check className="w-4 h-4" aria-hidden="true" />
                            Aktywny
                          </span>
                        )}
                        {ownedProfiles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteProfile(p.id)}
                            aria-label={`Usuń konto ${p.name}`}
                            className="p-2 rounded-lg text-[var(--th-text-muted)] hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isUnlocking && (
                      <form
                        onSubmit={handleUnlockTargetSubmit}
                        className="mt-2 pt-2 border-t border-[var(--th-border)] space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <PasswordInput
                           
                            value={unlockPwdInput}
                            onChange={(e) => {
                              setUnlockPwdInput(e.target.value);
                              setUnlockError(null);
                            }}
                            placeholder={`Wpisz hasło dla ${p.name}...`}
                            aria-label={`Hasło dla ${p.name}`}
                            className="flex-1 min-h-[38px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] text-xs font-semibold"
                          />
                          <button
                            type="submit"
                            className="min-h-[38px] px-3 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-xs font-bold cursor-pointer"
                          >
                            Wejdź
                          </button>
                          <button
                            type="button"
                            onClick={() => setUnlockTargetId(null)}
                            className="min-h-[38px] px-2 text-xs font-semibold text-[var(--th-text-muted)] cursor-pointer"
                          >
                            Anuluj
                          </button>
                        </div>
                        {unlockError && (
                          <p className="text-xs font-bold text-red-500" role="alert">
                            {unlockError}
                          </p>
                        )}
                      </form>
                    )}
                  </div>
                );
              })}
            </div>

            {showNewForm && (
              <form
                onSubmit={handleCreate}
                className="p-3.5 sm:p-4 rounded-2xl bg-[var(--th-surface-muted)] border border-[var(--th-border)] space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="new-profile-input"
                      className="block text-xs font-bold text-[var(--th-text)] mb-1"
                    >
                      Nazwa nowego użytkownika
                    </label>
                    <input
                      id="new-profile-input"
                      type="text"
                      placeholder="np. Kuba, Zosia"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      maxLength={24}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-profile-password"
                      className="block text-xs font-bold text-[var(--th-text)] mb-1"
                    >
                      Hasło / PIN (min. 4 znaki)
                    </label>
                    <PasswordInput
                      id="new-profile-password"
                     
                      placeholder="np. 1234"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      maxLength={32}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="new-profile-avatar-prompt"
                    className="block text-xs font-bold text-[var(--th-text)] mb-1"
                  >
                    Pomysł na awatar (opcjonalnie)
                  </label>
                  <input
                    id="new-profile-avatar-prompt"
                    type="text"
                    placeholder="np. niebieski robot w okularach"
                    value={newAvatarPrompt}
                    onChange={(e) => setNewAvatarPrompt(e.target.value)}
                    maxLength={60}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] text-sm"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newName.trim()}
                    className="min-h-[44px] px-4 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] border-b-3 border-[var(--th-primary-dark)] text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>Utwórz konto</span>
                  </button>
                </div>
              </form>
            )}
          </div>
          {/* Cloud Sync & Group / Class Code */}
          <details
            className="pt-4 border-t border-[var(--th-border)] space-y-3"
            data-testid="cloud-sync-card"
          >
            <summary className="flex items-center justify-between gap-2 cursor-pointer min-h-[40px]">
              <div className="flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
                <h3 className="font-display text-base font-bold text-[var(--th-text)]">
                  Konto Google (opcjonalnie)
                </h3>
              </div>
              <span className="text-[11px] font-bold text-[var(--th-primary)]">
                {cloudStatus === 'synced'
                  ? 'Zsynchronizowano'
                  : cloudStatus === 'connecting'
                  ? 'Łączenie...'
                  : 'Tylko lokalnie'}
              </span>
            </summary>

            {!cloudMeta ? (
              <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-3.5 space-y-2.5">
                <p className="text-xs text-[var(--th-text-muted)]">
                  Połącz z Google, aby mieć te same wyniki na telefonie i komputerze oraz zapraszać znajomych z klasy lub szkoły kodem.
                </p>
                <button
                  type="button"
                  onClick={onConnectGoogle}
                  disabled={cloudStatus === 'connecting'}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-display font-bold text-xs sm:text-sm border-b-3 border-[var(--th-primary-dark)] cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Cloud className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {cloudStatus === 'connecting'
                      ? 'Łączenie z Google...'
                      : 'Połącz z Google (Synchronizacja wyników)'}
                  </span>
                </button>
                {cloudError && (
                  <p className="text-xs font-bold text-red-500" role="alert">
                    {cloudError}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-[var(--th-soft-tint)] border border-[var(--th-soft-tint-border)] rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--th-text)] truncate">
                      Konto Google: {cloudMeta.displayName}
                    </div>
                    {cloudMeta.email && (
                      <div className="text-[11px] text-[var(--th-text-muted)] truncate">
                        {cloudMeta.email}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onDisconnectGoogle}
                    className="text-xs font-bold text-[var(--th-text-muted)] hover:text-red-500 inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Wyloguj</span>
                  </button>
                </div>

                {/* Invite Code */}
                <div className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-[var(--th-text-muted)]">
                      Twój Kod Grupy / Klasy (podaj znajomym lub na drugim urządzeniu)
                    </div>
                    <div className="font-mono text-base font-extrabold text-[var(--th-primary)] tracking-wider">
                      {cloudMeta.joinCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyJoinCode}
                    className="min-h-[36px] px-3 rounded-xl bg-[var(--th-surface-muted)] border border-[var(--th-border)] text-xs font-bold text-[var(--th-text)] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[var(--th-primary)]" aria-hidden="true" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Kopiuj</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Join Another Class / Group Code */}
                <form onSubmit={handleJoinCodeSubmit} className="space-y-2">
                  <label
                    htmlFor="join-group-code-input"
                    className="block text-xs font-bold text-[var(--th-text)]"
                  >
                    Masz kod grupy (np. G-AB12C)? Wpisz go tutaj:
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="join-group-code-input"
                      type="text"
                      value={joinCodeInput}
                      onChange={(e) => {
                        setJoinCodeInput(e.target.value.toUpperCase());
                        setJoinCodeError(null);
                      }}
                      placeholder="np. MT-ABCD"
                      maxLength={16}
                      className="flex-1 min-h-[40px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] font-mono text-sm font-bold uppercase"
                    />
                    <button
                      type="submit"
                      disabled={joiningCode || !joinCodeInput.trim()}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-xs font-bold disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {joiningCode ? 'Łączę...' : 'Dołącz'}
                    </button>
                  </div>
                  {joinCodeError && (
                    <p className="text-xs font-bold text-red-500" role="alert">
                      {joinCodeError}
                    </p>
                  )}
                  {joinCodeMessage && (
                    <p className="text-xs font-semibold text-[var(--th-primary)]">
                      {joinCodeMessage}
                    </p>
                  )}
                </form>
              </div>
            )}
          </details>

        </section>

        {/* Right: Expandable Range & Ergonomic Settings */}
        <section className="lg:col-span-6 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-4 sm:p-6 space-y-5 sm:space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[var(--th-border)]">
            <Sliders className="w-5 h-5 text-[var(--th-primary)]" aria-hidden="true" />
            <div>
              <h2 className="font-display text-xl font-bold text-[var(--th-text)]">
                Ustawienia Zakresu i Treningu
              </h2>
              <p className="text-xs text-[var(--th-text-muted)]">
                Domyślnie ćwiczymy w zakresie 100, ale możesz powiększyć limit w każdej chwili.
              </p>
            </div>
          </div>

          {/* Range Expansion Selector */}
          <div>
            <span className="block text-sm font-bold text-[var(--th-text)] mb-2">
              Zakres wyników (maksymalny iloczyn / dzielna)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {RANGE_OPTIONS.map((opt) => {
                const active = activeProfile.settings.maxRange === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdateSettings({ maxRange: opt.value })}
                    className={`min-h-[46px] px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] text-[var(--th-text)] font-bold'
                        : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text-muted)] hover:text-[var(--th-text)] font-medium'
                    }`}
                  >
                    <div className="text-sm tabular-nums">{opt.value}</div>
                    <div className="text-[11px] opacity-80 truncate">
                      {opt.label.replace(`Do ${opt.value} `, '')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto-Hint Delay */}
          <div>
            <span className="block text-sm font-bold text-[var(--th-text)] mb-2">
              Automatyczna podpowiedź wizualna przy dłuższym namyśle
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: 5, label: 'Po 5 s' },
                { val: 7, label: 'Po 7 s' },
                { val: 12, label: 'Po 12 s' },
                { val: 0, label: 'Ręczna' },
              ].map((item) => {
                const active = activeProfile.settings.autoHintDelaySec === item.val;
                return (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => onUpdateSettings({ autoHintDelaySec: item.val })}
                    className={`min-h-[44px] px-2 rounded-xl border text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                      active
                        ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] text-[var(--th-text)]'
                        : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t border-[var(--th-border)]">
            <label className="flex items-center justify-between gap-4 min-h-[44px] cursor-pointer">
              <div>
                <div className="text-sm font-bold text-[var(--th-text)]">Stoper czasu na żywo</div>
                <div className="text-xs text-[var(--th-text-muted)]">
                  Pokazuj licznik sekund podczas rozwiązywania zadania
                </div>
              </div>
              <input
                type="checkbox"
                checked={activeProfile.settings.showLiveTimer}
                onChange={(e) => onUpdateSettings({ showLiveTimer: e.target.checked })}
                className="w-5 h-5 cursor-pointer"
                style={{ accentColor: 'var(--th-primary)' }}
              />
            </label>

            <label className="flex items-center justify-between gap-4 min-h-[44px] cursor-pointer">
              <div>
                <div className="text-sm font-bold text-[var(--th-text)]">Dźwięki klawiatury i nagród</div>
                <div className="text-xs text-[var(--th-text-muted)]">
                  Delikatne sygnały przy wpisaniu wyniku, tykaniu zegara i zaliczeniu serii
                </div>
              </div>
              <input
                type="checkbox"
                checked={activeProfile.settings.soundEnabled}
                onChange={(e) => onUpdateSettings({ soundEnabled: e.target.checked })}
                className="w-5 h-5 cursor-pointer"
                style={{ accentColor: 'var(--th-primary)' }}
              />
            </label>

            <label className="flex items-center justify-between gap-4 min-h-[44px] cursor-pointer">
              <div>
                <div className="text-sm font-bold text-[var(--th-text)]">Muzyczka w tle podczas treningu</div>
                <div className="text-xs text-[var(--th-text-muted)]">
                  Łagodna, rytmiczna melodia umilająca rozwiązywanie zadań
                </div>
              </div>
              <input
                type="checkbox"
                checked={activeProfile.settings.musicEnabled ?? true}
                onChange={(e) => onUpdateSettings({ musicEnabled: e.target.checked })}
                className="w-5 h-5 cursor-pointer"
                style={{ accentColor: 'var(--th-primary)' }}
              />
            </label>
          </div>

          {/* Automatic Device Detection Info */}
          <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <DeviceIcon className="w-5 h-5 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
              <div>
                <div className="text-xs font-semibold text-[var(--th-text-muted)]">
                  Automatyczne dopasowanie ekranu
                </div>
                <div className="text-sm font-bold text-[var(--th-text)]">
                  Wykryto: {device.label} · {device.width} × {device.height} px
                </div>
              </div>
            </div>
          </div>

          {/* Clean Local Reset with Inline 2-step confirmation */}
          <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="text-xs font-semibold text-[var(--th-text-muted)] hover:text-red-500 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Wyczyść dane lokalne na tym urządzeniu</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-[var(--th-text-muted)]">Na pewno?</span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmReset(false);
                    onResetLocalData();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold cursor-pointer"
                >
                  Tak, wyczyść
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2 py-1 rounded-lg bg-[var(--th-surface-muted)] border border-[var(--th-border)] font-semibold cursor-pointer"
                >
                  Anuluj
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Full-Width Avatar Studio for Active User */}
      <section className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-6">
        <div className="mb-5 pb-4 border-b border-[var(--th-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--th-text)]">
              Awatar użytkownika: {activeProfile.name}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--th-text-muted)]">
              Stwórz własny awatar z opisu albo wybierz jeden z 55 gotowych wzorów.
            </p>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--th-text-muted)]">
            <AvatarDisplay
              avatarId={activeProfile.avatarId}
              customSpec={activeProfile.customAvatarSpec}
              name={activeProfile.name}
              sizeClass="w-10 h-10"
            />
            <span>Aktualny awatar</span>
          </div>
        </div>

        <AvatarStudio
          profileName={activeProfile.name}
          currentAvatarId={activeProfile.avatarId}
          currentCustomSpec={activeProfile.customAvatarSpec}
          onSelectPresetAvatar={(avatarId) =>
            onUpdateProfileMeta(
              activeProfile.name,
              avatarId,
              activeProfile.customAvatarSpec,
              activeProfile.schoolName,
              activeProfile.className
            )
          }
          onSaveCustomAvatar={(spec) =>
            onUpdateProfileMeta(
              activeProfile.name,
              'custom',
              spec,
              activeProfile.schoolName,
              activeProfile.className
            )
          }
        />
      </section>

      {/* Earned Badges & Trophies Cabinet */}
      <section className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Award className="w-5 h-5 text-[var(--th-accent)]" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-[var(--th-text)]">
            Gablota Odznak i Osiągnięć ({activeProfile.earnedBadges.length} / {ALL_BADGES.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ALL_BADGES.map((badge) => {
            const earned = activeProfile.earnedBadges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  earned
                    ? 'bg-[var(--th-soft-tint)] border-[var(--th-soft-tint-border)]'
                    : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] opacity-65'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-bold">
                  <span className={earned ? 'text-[var(--th-primary)]' : 'text-[var(--th-text-muted)]'}>
                    {earned ? 'Zdobyta' : 'Do zdobycia'}
                  </span>
                </div>
                <div className="mt-1.5 font-display text-base font-bold text-[var(--th-text)]">
                  {badge.title}
                </div>
                <p className="mt-1 text-xs text-[var(--th-text-muted)]">{badge.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
