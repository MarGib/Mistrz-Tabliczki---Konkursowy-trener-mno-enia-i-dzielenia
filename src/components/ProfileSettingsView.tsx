import { useEffect, useState } from 'react';
import {
  Award,
  Check,
  Monitor,
  Palette,
  Plus,
  RotateCcw,
  Sliders,
  Smartphone,
  Tablet,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { ALL_BADGES, STARTER_FAMILY_TEMPLATES } from '../data/curriculum';
import { PRESET_THEMES } from '../data/themes';
import { parseAvatarPrompt } from '../engine/avatarComposer';
import { computeUserLevel } from '../engine/spacedRepetition';
import type {
  AppSettings,
  AvatarSpec,
  ColorTheme,
  DeviceProfile,
  UserProfile,
} from '../types/math';
import { AvatarDisplay } from './AvatarDisplay';
import { AvatarStudio } from './AvatarStudio';

interface ProfileSettingsViewProps {
  profiles: UserProfile[];
  activeProfile: UserProfile;
  activeTheme: ColorTheme;
  device: DeviceProfile;
  onSwitchProfile: (id: string) => void;
  onCreateProfile: (name: string, avatarId: string, customAvatarSpec?: AvatarSpec) => void;
  onDeleteProfile: (id: string) => void;
  onAddMissingFamily: () => void;
  onUpdateProfileMeta: (name: string, avatarId: string, customAvatarSpec?: AvatarSpec) => void;
  onSelectTheme: (themeId: string) => void;
  onOpenThemesTab: () => void;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onResetDemo: () => void;
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
  profiles,
  activeProfile,
  activeTheme,
  device,
  onSwitchProfile,
  onCreateProfile,
  onDeleteProfile,
  onAddMissingFamily,
  onUpdateProfileMeta,
  onSelectTheme,
  onOpenThemesTab,
  onUpdateSettings,
  onResetDemo,
}: ProfileSettingsViewProps) {
  const [newName, setNewName] = useState('');
  const [newAvatarPrompt, setNewAvatarPrompt] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [editName, setEditName] = useState(activeProfile.name);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setEditName(activeProfile.name);
  }, [activeProfile.id, activeProfile.name]);

  const levelInfo = computeUserLevel(activeProfile.xp);

  const missingFamilyMembers = STARTER_FAMILY_TEMPLATES.filter(
    (name) => !profiles.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())
  );

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    onUpdateProfileMeta(editName.trim(), activeProfile.avatarId, activeProfile.customAvatarSpec);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    if (newAvatarPrompt.trim()) {
      const customSpec = parseAvatarPrompt(newAvatarPrompt.trim());
      onCreateProfile(newName.trim(), 'custom', customSpec);
    } else {
      const spec = parseAvatarPrompt(newName.trim());
      onCreateProfile(newName.trim(), 'custom', spec);
    }
    setNewName('');
    setNewAvatarPrompt('');
    setShowNewForm(false);
  };

  const DeviceIcon =
    device.category === 'telefon'
      ? Smartphone
      : device.category === 'tablet'
      ? Tablet
      : Monitor;

  const quickThemes = PRESET_THEMES.filter((t) => QUICK_THEME_IDS.includes(t.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--th-text)]">
          Konta Rodzinne, Awatar i Ustawienia
        </h1>
        <p className="mt-1 text-sm sm:text-base text-[var(--th-text-muted)]">
          Każdy gracz (Ola, Mama, Tata, Natalka i nowi uczestnicy) ma własną nazwę, awatar, ulubiony szablon kolorów i osobiste wyniki.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: User Account & Family Switcher */}
        <section className="lg:col-span-6 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-[var(--th-border)]">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--th-text-muted)]">Aktywne konto</p>
              <h2 className="font-display text-xl font-bold text-[var(--th-text)] truncate">
                {activeProfile.name} · Poziom {levelInfo.level}
              </h2>
              <p className="text-xs text-[var(--th-text-muted)] tabular-nums">
                {activeProfile.xp} XP · Seria {activeProfile.streakDays} dni ·{' '}
                {activeProfile.sessions.length} ukończonych serii
              </p>
            </div>
            <AvatarDisplay
              avatarId={activeProfile.avatarId}
              customSpec={activeProfile.customAvatarSpec}
              name={activeProfile.name}
              sizeClass="w-14 h-14"
            />
          </div>

          {/* Edit Current Profile Name */}
          <form onSubmit={handleSaveName} className="space-y-3">
            <div>
              <label
                htmlFor="profile-name-input"
                className="block text-sm font-bold text-[var(--th-text)] mb-1.5"
              >
                Zmień swoją nazwę lub pseudonim
              </label>
              <div className="flex gap-2">
                <input
                  id="profile-name-input"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={24}
                  className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] font-medium focus:outline-2 focus:outline-[var(--th-primary)]"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] border-b-3 border-[var(--th-primary-dark)] text-sm font-bold cursor-pointer"
                >
                  Zapisz
                </button>
              </div>
              {savedNotice && (
                <p className="mt-1.5 text-xs font-semibold text-[var(--th-primary)]">
                  Zaktualizowano nazwę konta.
                </p>
              )}
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

          {/* Switch Profile or Create New Family Member */}
          <div className="pt-4 border-t border-[var(--th-border)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-[var(--th-text)] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
                <span>Konta rodzinne ({profiles.length})</span>
              </h3>
              <div className="flex items-center gap-3">
                {missingFamilyMembers.length > 0 && (
                  <button
                    type="button"
                    onClick={onAddMissingFamily}
                    className="text-xs font-bold text-[var(--th-primary)] hover:underline cursor-pointer"
                  >
                    + Dodaj rodzinę ({missingFamilyMembers.join(', ')})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNewForm((v) => !v)}
                  className="text-xs font-bold text-[var(--th-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Nowe konto</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {profiles.map((p) => {
                const isCurrent = p.id === activeProfile.id;
                return (
                  <div
                    key={p.id}
                    className={`w-full min-h-[54px] px-3 py-2 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                      isCurrent
                        ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] text-[var(--th-text)]'
                        : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSwitchProfile(p.id);
                        setEditName(p.name);
                      }}
                      className="flex-1 flex items-center gap-3 text-left cursor-pointer min-w-0"
                    >
                      <AvatarDisplay
                        avatarId={p.avatarId}
                        customSpec={p.customAvatarSpec}
                        name={p.name}
                        sizeClass="w-9 h-9"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{p.name}</div>
                        <div className="text-xs text-[var(--th-text-muted)] tabular-nums">
                          {p.xp} XP · {p.sessions.length} serii · {p.earnedBadges.length} odznak
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
                      {profiles.length > 1 && (
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
                );
              })}
            </div>

            {showNewForm && (
              <form
                onSubmit={handleCreate}
                className="p-4 rounded-2xl bg-[var(--th-surface-muted)] border border-[var(--th-border)] space-y-3"
              >
                <div>
                  <label
                    htmlFor="new-profile-input"
                    className="block text-xs font-bold text-[var(--th-text)] mb-1"
                  >
                    Imię nowego członka rodziny lub ucznia
                  </label>
                  <input
                    id="new-profile-input"
                    type="text"
                    placeholder="np. Babcia, Dziadek, Tomek"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={24}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] text-sm"
                  />
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
                    className="min-h-[44px] px-4 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] border-b-3 border-[var(--th-primary-dark)] text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>Utwórz konto</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Right: Expandable Range & Ergonomic Settings */}
        <section className="lg:col-span-6 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-6 space-y-6">
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

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onResetDemo}
              className="text-xs font-semibold text-[var(--th-text-muted)] hover:text-[var(--th-text)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Przywróć startowy zestaw rodziny (Ola, Mama, Tata, Natalka)</span>
            </button>
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
            onUpdateProfileMeta(activeProfile.name, avatarId, activeProfile.customAvatarSpec)
          }
          onSaveCustomAvatar={(spec) =>
            onUpdateProfileMeta(activeProfile.name, 'custom', spec)
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
