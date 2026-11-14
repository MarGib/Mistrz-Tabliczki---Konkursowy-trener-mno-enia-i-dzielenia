import { useEffect, useState } from 'react';
import { HelpButton } from '../help/HelpButton';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cloud,
  KeyRound,
  Lock,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { ILLUSTRATED_MASCOTS } from '../data/avatars';
import { resolveThemeById } from '../data/themes';
import {
  hasAccountPassword,
  normalizeLogin,
  verifyAccountCredentials,
} from '../engine/accountSecurity';
import type { CloudSessionMeta } from '../engine/cloudSync';
import { computeUserLevel } from '../engine/spacedRepetition';
import type { CloudSyncStatus } from '../store/useAppStore';
import type { DeviceProfile, UserProfile } from '../types/math';
import { AvatarDisplay } from './AvatarDisplay';
import { PasswordInput } from './PasswordInput';
import { LEGACY_GOOGLE_SYNC_ENABLED } from '../engine/cloudSync';
import { readPendingInvite } from './InviteCard';

interface FamilyWelcomeGateProps {
  ownedProfiles: UserProfile[];
  device: DeviceProfile;
  cloudMeta?: CloudSessionMeta | null;
  cloudStatus: CloudSyncStatus;
  cloudError: string | null;
  onSelectProfile: (profileId: string) => void;
  onSetCredentialsAndEnter: (profileId: string, login: string, password: string) => void;
  onLoginWithCredentials: (
    login: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onCreateProfile: (
    name: string,
    avatarId: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onConnectGoogle: () => void;
}

type GateMode = 'list' | 'create' | 'existing';

export function FamilyWelcomeGate({
  ownedProfiles,
  device,
  cloudMeta = null,
  cloudStatus,
  cloudError,
  onSelectProfile,
  onSetCredentialsAndEnter,
  onLoginWithCredentials,
  onCreateProfile,
  onConnectGoogle,
}: FamilyWelcomeGateProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [mode, setMode] = useState<GateMode>(
    ownedProfiles.length > 0 ? 'list' : 'create'
  );

  // Create account form
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [existingBusy, setExistingBusy] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState(
    ILLUSTRATED_MASCOTS[0]?.id ?? 'owl'
  );

  // Existing login + password form
  const [existingLogin, setExistingLogin] = useState('');
  const [existingPassword, setExistingPassword] = useState('');
  const [existingError, setExistingError] = useState<string | null>(null);

  // Automatically show restored cloud accounts as soon as Google sign-in loads them
  useEffect(() => {
    if (cloudStatus === 'synced' && ownedProfiles.length > 0 && mode === 'existing') {
      setMode('list');
    }
  }, [cloudStatus, ownedProfiles.length, mode]);

  const selectedMember = ownedProfiles.find((p) => p.id === selectedMemberId) ?? null;
  const activeMode: GateMode =
    ownedProfiles.length === 0 && mode === 'list' ? 'create' : mode;

  const handleChooseCard = (member: UserProfile) => {
    setSelectedMemberId(member.id);
    setLoginInput(member.login || normalizeLogin(member.name));
    setPasswordInput('');
    setAuthError(null);
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    if (hasAccountPassword(selectedMember)) {
      const ok = verifyAccountCredentials(selectedMember, passwordInput, loginInput);
      if (!ok) {
        setAuthError('Nieprawidłowy login lub hasło. Spróbuj ponownie.');
        return;
      }
      // Hasło poprawne — wejdź i (w tle) włącz synchronizację konta w chmurze.
      onSetCredentialsAndEnter(
        selectedMember.id,
        selectedMember.login || loginInput || selectedMember.name,
        passwordInput.trim()
      );
      return;
    }

    if (passwordInput.trim().length > 0 && passwordInput.trim().length < 4) {
      setAuthError('Hasło lub PIN powinno mieć przynajmniej 4 znaki (albo wejdź bez hasła).');
      return;
    }
    if (passwordInput.trim().length >= 4) {
      onSetCredentialsAndEnter(
        selectedMember.id,
        loginInput || selectedMember.name,
        passwordInput.trim()
      );
    } else {
      onSelectProfile(selectedMember.id);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || createBusy) return;
    if (newPassword.trim().length < 4) {
      setCreateError('Hasło lub PIN musi mieć co najmniej 4 znaki.');
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    const result = await onCreateProfile(trimmed, selectedAvatarId, newPassword.trim());
    setCreateBusy(false);
    if (!result.ok) setCreateError(result.error ?? 'Nie udało się utworzyć konta.');
  };

  const handleExistingLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExistingError(null);
    if (!existingLogin.trim()) {
      setExistingError('Wpisz swój login.');
      return;
    }
    setExistingBusy(true);
    const result = await onLoginWithCredentials(existingLogin, existingPassword);
    setExistingBusy(false);
    if (!result.ok) {
      setExistingError(result.error ?? 'Nie udało się zalogować.');
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-3.5 sm:px-6 py-4 sm:py-8 bg-[var(--th-canvas)] text-[var(--th-text)]"
      data-testid="family-welcome-gate"
    >
      <div className="w-full max-w-xl mx-auto">
        {/* Welcome Header */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--th-soft-tint)] border border-[var(--th-soft-tint-border)] text-[var(--th-primary)] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Mistrz Tabliczki · {device.category}</span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--th-text)]">
            {selectedMember
              ? `Konto: ${selectedMember.name}`
              : ownedProfiles.length > 0
              ? 'Wybierz swoje konto'
              : 'Witaj w Mistrzu Tabliczki!'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--th-text-muted)] max-w-md mx-auto">
            {selectedMember
              ? hasAccountPassword(selectedMember)
                ? 'To konto jest chronione hasłem, aby Twoje postępy i ustawienia były bezpieczne.'
                : 'Możesz ustawić login i hasło lub PIN albo wejść od razu do treningu.'
              : ownedProfiles.length > 0
              ? 'Widzisz tutaj tylko swoje konta z tego urządzenia.'
              : 'Załóż konto z loginem i hasłem albo zaloguj się — wyniki zapiszą się w chmurze i będą na każdym urządzeniu.'}
          </p>
        </div>

        {readPendingInvite() && (
          <div className="max-w-md mx-auto mb-4 rounded-2xl border-2 border-[var(--th-primary)] bg-[var(--th-soft-tint)] px-4 py-3 text-sm text-[var(--th-text)] text-center">
            <strong>Masz zaproszenie do grupy {readPendingInvite()}.</strong> Zaloguj się albo załóż konto — zaraz potem dołączysz jednym kliknięciem.
          </div>
        )}

        {/* Step 2: Unlock / Set Password for Chosen Owned Profile */}
        {selectedMember ? (
          <form
            onSubmit={handleUnlockSubmit}
            className="max-w-md mx-auto bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 animate-pop-in"
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--th-border)]">
              <div className="flex items-center gap-3 min-w-0">
                <AvatarDisplay
                  avatarId={selectedMember.avatarId}
                  customSpec={selectedMember.customAvatarSpec}
                  name={selectedMember.name}
                  sizeClass="w-12 h-12 sm:w-14 sm:h-14"
                />
                <div className="min-w-0">
                  <div className="font-display text-lg font-extrabold text-[var(--th-text)] truncate">
                    {selectedMember.name}
                  </div>
                  <div className="text-xs text-[var(--th-text-muted)] flex items-center gap-1">
                    {hasAccountPassword(selectedMember) ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-[var(--th-primary)]" aria-hidden="true" />
                        <span>Wymagane hasło do konta</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-[var(--th-primary)]" aria-hidden="true" />
                        <span>Konto lokalne / możesz dodać PIN</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedMemberId(null);
                  setAuthError(null);
                }}
                className="text-xs font-bold text-[var(--th-text-muted)] hover:text-[var(--th-text)] inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Wróć</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="gate-login-input"
                  className="block text-xs font-bold text-[var(--th-text)] mb-1"
                >
                  Login
                </label>
                <input
                  id="gate-login-input"
                  type="text"
                  value={loginInput}
                  onChange={(e) => {
                    setLoginInput(e.target.value);
                    setAuthError(null);
                  }}
                  autoComplete="username"
                  placeholder={normalizeLogin(selectedMember.name)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm font-semibold focus:outline-2 focus:outline-[var(--th-primary)]"
                />
              </div>

              <div>
                <label
                  htmlFor="gate-password-input"
                  className="block text-xs font-bold text-[var(--th-text)] mb-1"
                >
                  {hasAccountPassword(selectedMember)
                    ? 'Twoje hasło lub PIN'
                    : 'Ustaw hasło lub PIN (opcjonalnie, min. 3 znaki)'}
                </label>
                <PasswordInput
                  id="gate-password-input"
                 
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setAuthError(null);
                  }}
                  autoComplete={
                    hasAccountPassword(selectedMember) ? 'current-password' : 'new-password'
                  }
                  placeholder={
                    hasAccountPassword(selectedMember)
                      ? 'Wpisz hasło...'
                      : 'np. 1234 lub ulubione słowo'
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm font-semibold focus:outline-2 focus:outline-[var(--th-primary)]"
                />
              </div>

              {authError && (
                <p className="text-xs font-bold text-red-500" role="alert">
                  {authError}
                </p>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-display font-bold text-sm sm:text-base border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                <span>
                  {hasAccountPassword(selectedMember)
                    ? 'Odblokuj i wejdź'
                    : passwordInput.trim().length > 0
                    ? 'Zapisz hasło i zacznij trening'
                    : 'Wejdź do konta'}
                </span>
              </button>

              {!hasAccountPassword(selectedMember) && (
                <button
                  type="button"
                  onClick={() => onSelectProfile(selectedMember.id)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[var(--th-surface-muted)] border border-[var(--th-border)] text-xs font-bold text-[var(--th-text-muted)] hover:text-[var(--th-text)] cursor-pointer transition-colors"
                >
                  Wejdź na razie bez hasła (ustawisz je później w Konto)
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Mode Switcher Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-2xl max-w-md mx-auto">
              {ownedProfiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className={`flex-1 min-h-[38px] px-3 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    activeMode === 'list'
                      ? 'bg-[var(--th-primary)] text-[var(--th-primary-fg)]'
                      : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                  }`}
                >
                  Moje konta ({ownedProfiles.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode('create')}
                data-testid="tab-create-account"
                className={`flex-1 min-h-[38px] px-3 rounded-xl text-xs font-bold cursor-pointer transition-colors inline-flex items-center justify-center gap-1.5 ${
                  activeMode === 'create'
                    ? 'bg-[var(--th-primary)] text-[var(--th-primary-fg)]'
                    : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Utwórz nowe konto</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('existing')}
                data-testid="tab-existing-account"
                className={`flex-1 min-h-[38px] px-3 rounded-xl text-xs font-bold cursor-pointer transition-colors inline-flex items-center justify-center gap-1.5 ${
                  activeMode === 'existing'
                    ? 'bg-[var(--th-primary)] text-[var(--th-primary-fg)]'
                    : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Mam już konto</span>
              </button>
            </div>

            {/* Tab A: Owned Accounts on this Device */}
            {activeMode === 'list' && ownedProfiles.length > 0 && (
              <div
                className="grid grid-cols-2 gap-2.5 sm:gap-4"
                role="list"
                aria-label="Twoje konta na tym urządzeniu"
              >
                {ownedProfiles.map((member) => {
                  const level = computeUserLevel(member.xp);
                  const memberTheme = resolveThemeById(
                    member.activeThemeId,
                    member.customThemes
                  );
                  const isProtected = hasAccountPassword(member);
                  const cohortLabel = [member.schoolName, member.className]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <div key={member.id} role="listitem">
                      <button
                        type="button"
                        onClick={() => handleChooseCard(member)}
                        data-testid={`welcome-pick-${member.id}`}
                        aria-label={`Wybierz konto ${member.name}, Poziom ${level.level}, ${member.xp} XP`}
                        className="group w-full h-full bg-[var(--th-surface)] border-2 border-[var(--th-border)] hover:border-[var(--th-primary)] border-b-4 rounded-2xl sm:rounded-3xl p-3 sm:p-5 flex flex-col items-center text-center transition-all duration-150 active:translate-y-[2px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--th-primary)] relative overflow-hidden"
                      >
                        <span
                          className="absolute top-0 inset-x-0 h-1.5"
                          style={{ backgroundColor: memberTheme.tokens.primary }}
                          aria-hidden="true"
                        />

                        {isProtected && (
                          <span
                            className="absolute top-2.5 right-2.5 p-1 rounded-lg bg-[var(--th-surface-muted)] text-[var(--th-text-muted)]"
                            title="Konto chronione hasłem"
                          >
                            <Lock className="w-3 h-3" aria-hidden="true" />
                          </span>
                        )}

                        <div className="mt-1 mb-2 transition-transform duration-150 group-hover:scale-105">
                          <AvatarDisplay
                            avatarId={member.avatarId}
                            customSpec={member.customAvatarSpec}
                            name={member.name}
                            sizeClass="w-14 h-14 sm:w-16 sm:h-16"
                          />
                        </div>

                        <span className="font-display text-base sm:text-xl font-extrabold text-[var(--th-text)] leading-tight truncate max-w-full">
                          {member.name}
                        </span>

                        {cohortLabel && (
                          <span className="mt-0.5 text-[11px] font-semibold text-[var(--th-text-muted)] truncate max-w-full">
                            {cohortLabel}
                          </span>
                        )}

                        <span className="mt-0.5 text-[11px] sm:text-xs font-semibold text-[var(--th-text-muted)] tabular-nums">
                          Poz. {level.level} · {member.xp} XP
                        </span>

                        <span
                          className="mt-2.5 w-full py-1.5 sm:py-2 px-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1 transition-colors"
                          style={{
                            backgroundColor: memberTheme.tokens.softTint,
                            color: memberTheme.tokens.primary,
                          }}
                        >
                          <span>{isProtected ? 'Zaloguj' : 'To moje konto'}</span>
                          <ArrowRight
                            className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab B: Create New User Account (0 XP Clean Start + School & Class) */}
            {activeMode === 'create' && (
              <form
                onSubmit={handleCreateSubmit}
                data-testid="create-account-form"
                className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-4 sm:p-6 text-left space-y-3.5 shadow-sm"
              >
                <div>
                  <h2 className="font-display text-base sm:text-lg font-extrabold text-[var(--th-text)] flex items-center justify-between gap-2">
                    Nowe konto gracza
                    <HelpButton section="start" label="Zakładanie konta" />
                  </h2>
                  <p className="text-xs text-[var(--th-text-muted)]">
                    Zaczynasz od 0 XP. Twoja nazwa to też login — zapamiętaj ją razem z hasłem, aby zalogować się na innym urządzeniu.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="welcome-new-name"
                      className="block text-xs font-bold text-[var(--th-text)] mb-1"
                    >
                      Login (nazwa gracza) *
                    </label>
                    <input
                      id="welcome-new-name"
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="np. Kuba, Zosia, Mistrz7"
                      maxLength={24}
                      required
                      className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm font-semibold focus:outline-2 focus:outline-[var(--th-primary)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="welcome-new-password"
                      className="block text-xs font-bold text-[var(--th-text)] mb-1"
                    >
                      Hasło lub PIN (min. 4 znaki) *
                    </label>
                    <PasswordInput
                      id="welcome-new-password"
                     
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="np. 1234"
                      maxLength={32}
                      minLength={4}
                      required
                      autoComplete="new-password"
                      className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm font-semibold focus:outline-2 focus:outline-[var(--th-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-[var(--th-text)] mb-1">
                    Wybierz awatar startowy
                  </span>
                  <p className="text-[11px] text-[var(--th-text-muted)] mb-2">
                    To tylko awatar startowy — zawsze możesz go później zmienić w zakładce Konto albo stworzyć własny.
                  </p>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {ILLUSTRATED_MASCOTS.map((av) => {
                      const active = av.id === selectedAvatarId;
                      return (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => setSelectedAvatarId(av.id)}
                          aria-label={`Awatar startowy: ${av.name}`}
                          aria-pressed={active}
                          className={`shrink-0 p-1.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-1 w-[72px] ${
                            active
                              ? 'border-[var(--th-primary)] bg-[var(--th-soft-tint)]'
                              : 'border-[var(--th-border)] bg-[var(--th-surface)]'
                          }`}
                        >
                          <AvatarDisplay
                            avatarId={av.id}
                            name={av.name}
                            sizeClass="w-11 h-11"
                          />
                          <span className="text-[10px] font-bold text-[var(--th-text)] truncate w-full text-center">
                            {av.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!newName.trim() || createBusy}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-display font-bold text-sm sm:text-base border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] disabled:opacity-50 cursor-pointer transition-all"
                >
                  {createBusy ? 'Zakładam konto…' : 'Utwórz konto i zacznij trening'}
                </button>
                {createError && (
                  <p className="text-xs font-bold text-red-500" role="alert">
                    {createError}
                  </p>
                )}

              </form>
            )}

            {/* Tab C: Existing Account (Google Cloud Sync or Hidden Login + Password) */}
            {activeMode === 'existing' && (
              <div className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-4 sm:p-6 flex flex-col-reverse gap-4 shadow-sm">
                <div className={`space-y-2 pt-4 border-t border-[var(--th-border)] ${LEGACY_GOOGLE_SYNC_ENABLED ? '' : 'hidden'}`}>
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
                    <h2 className="font-display text-base sm:text-lg font-extrabold text-[var(--th-text)]">
                      Albo przez konto Google (opcjonalnie)
                    </h2>
                  </div>
                  <p className="text-xs text-[var(--th-text-muted)]">
                    Dla rodziców lub osób, które wolą logować się kontem Google.
                  </p>
                  <button
                    type="button"
                    onClick={onConnectGoogle}
                    disabled={cloudStatus === 'connecting'}
                    data-testid="welcome-google-btn"
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-display font-bold text-sm border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] disabled:opacity-60 cursor-pointer transition-all inline-flex items-center justify-center gap-2"
                  >
                    <Cloud className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {cloudStatus === 'connecting'
                        ? 'Łączenie z chmurą...'
                        : 'Zaloguj się przez Google'}
                    </span>
                  </button>
                  {cloudError && (
                    <p className="text-xs font-bold text-red-500" role="alert">
                      {cloudError}
                    </p>
                  )}
                </div>

                {(
                  <form
                    onSubmit={handleExistingLoginSubmit}
                    className="space-y-3"
                  >
                    <div>
                      <h3 className="font-display text-sm font-bold text-[var(--th-text)]">
                        Zaloguj się loginem i hasłem
                        <HelpButton section="login" label="Logowanie" className="align-middle ml-1" />
                      </h3>
                      <p className="text-xs text-[var(--th-text-muted)]">
                        Wpisz login i hasło swojego konta — pobierzemy Twoje wyniki z chmury.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={existingLogin}
                        onChange={(e) => {
                          setExistingLogin(e.target.value);
                          setExistingError(null);
                        }}
                        placeholder="Twój login..."
                        aria-label="Login"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm font-semibold"
                      />
                      <PasswordInput
                       
                        value={existingPassword}
                        onChange={(e) => {
                          setExistingPassword(e.target.value);
                          setExistingError(null);
                        }}
                        placeholder="Hasło / PIN..."
                        aria-label="Hasło"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm font-semibold"
                      />
                    </div>

                    {existingError && (
                      <p className="text-xs font-bold text-red-500" role="alert">
                        {existingError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={existingBusy}
                      className="w-full min-h-[46px] px-4 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-display font-bold text-sm border-b-4 border-[var(--th-primary-dark)] cursor-pointer transition-colors disabled:opacity-60"
                    >
                      {existingBusy ? 'Logowanie…' : 'Zaloguj się'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
