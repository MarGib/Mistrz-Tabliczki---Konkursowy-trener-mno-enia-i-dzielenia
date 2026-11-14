import { useMemo, useState } from 'react';
import { Check, Shuffle, Sparkles, Wand2 } from 'lucide-react';
import { AVATAR_CATEGORIES, ILLUSTRATED_MASCOTS, PRESET_AVATARS } from '../data/avatars';
import {
  ACCESSORY_OPTIONS,
  AVATAR_PALETTE_SWATCHES,
  CHARACTER_OPTIONS,
  PROP_OPTIONS,
  parseAvatarPrompt,
} from '../engine/avatarComposer';
import type { AvatarPreset, AvatarSpec } from '../types/math';
import { AvatarDisplay } from './AvatarDisplay';

interface AvatarStudioProps {
  profileName: string;
  currentAvatarId: string;
  currentCustomSpec?: AvatarSpec;
  onSelectPresetAvatar: (avatarId: string) => void;
  onSaveCustomAvatar: (spec: AvatarSpec) => void;
}

const EXAMPLE_PROMPTS = [
  'fioletowy smok w okularach z pucharem',
  'niebieski robot z kalkulatorem',
  'czerwony lew w czapce z błyskawicą',
  'złoty jednorożec w koronie z gwiazdką',
];

export function AvatarStudio({
  profileName,
  currentAvatarId,
  currentCustomSpec,
  onSelectPresetAvatar,
  onSaveCustomAvatar,
}: AvatarStudioProps) {
  const [prompt, setPrompt] = useState(
    currentCustomSpec?.prompt || 'fioletowy smok w okularach z pucharem'
  );
  const [draftSpec, setDraftSpec] = useState<AvatarSpec>(
    () =>
      currentCustomSpec ?? {
        character: 'dragon',
        bgColor: '#EDE9FE',
        bodyColor: '#7C3AED',
        accessory: 'glasses',
        prop: 'trophy',
        prompt: 'fioletowy smok w okularach z pucharem',
      }
  );
  const [categoryFilter, setCategoryFilter] = useState<
    'Wszystkie' | AvatarPreset['category']
  >('Wszystkie');
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  const filteredPresets = useMemo(() => {
    if (categoryFilter === 'Wszystkie') return PRESET_AVATARS;
    return PRESET_AVATARS.filter((a) => a.category === categoryFilter);
  }, [categoryFilter]);

  const handleGenerateFromPrompt = () => {
    const generated = parseAvatarPrompt(prompt);
    setDraftSpec(generated);
    onSaveCustomAvatar(generated);
    setAppliedNotice('Wygenerowano i ustawiono Twój własny awatar!');
    window.setTimeout(() => setAppliedNotice(null), 2400);
  };

  const handleRandomDraft = () => {
    const char =
      CHARACTER_OPTIONS[Math.floor(Math.random() * CHARACTER_OPTIONS.length)].id;
    const pal =
      AVATAR_PALETTE_SWATCHES[
        Math.floor(Math.random() * AVATAR_PALETTE_SWATCHES.length)
      ];
    const acc =
      ACCESSORY_OPTIONS[Math.floor(Math.random() * ACCESSORY_OPTIONS.length)].id;
    const prop =
      PROP_OPTIONS[Math.floor(Math.random() * PROP_OPTIONS.length)].id;
    const next: AvatarSpec = {
      character: char,
      bgColor: pal.bg,
      bodyColor: pal.body,
      accessory: acc,
      prop,
      prompt: prompt.trim(),
    };
    setDraftSpec(next);
  };

  const handleApplyDraft = () => {
    onSaveCustomAvatar(draftSpec);
    setAppliedNotice('Zapisano własny awatar dla konta!');
    window.setTimeout(() => setAppliedNotice(null), 2200);
  };

  const handlePickPreset = (avatarId: string, label: string) => {
    onSelectPresetAvatar(avatarId);
    setAppliedNotice(`Ustawiono awatar: ${label}`);
    window.setTimeout(() => setAppliedNotice(null), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Custom Polish Description Avatar Generator */}
      <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AvatarDisplay
              avatarId="custom"
              overrideSpec={draftSpec}
              name={profileName}
              sizeClass="w-20 h-20 sm:w-24 sm:h-24"
            />
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold text-[var(--th-text)] flex items-center gap-1.5">
                <Wand2 className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
                <span>Kreator Własnego Awatara</span>
              </h3>
              <p className="text-xs sm:text-sm text-[var(--th-text-muted)] mt-0.5 max-w-xl">
                Opisz w kilku słowach, co chcesz zobaczyć na swoim awatarze (np. postać, kolor, okulary lub puchar), albo dostosuj elementy ręcznie.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRandomDraft}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:opacity-90 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Losuj pomysł</span>
          </button>
        </div>

        {/* Prompt Input Row */}
        <div className="space-y-2">
          <label
            htmlFor="avatar-prompt-input"
            className="block text-xs font-bold text-[var(--th-text)]"
          >
            Opisz swój wymarzony awatar
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="avatar-prompt-input"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="np. fioletowy smok w okularach z pucharem"
              maxLength={90}
              className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] text-sm font-medium focus:outline-2 focus:outline-[var(--th-primary)]"
            />
            <button
              type="button"
              onClick={handleGenerateFromPrompt}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] text-sm font-bold border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>Stwórz awatar z opisu</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-[var(--th-text-muted)]">Podpowiedzi:</span>
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setPrompt(ex);
                  setDraftSpec(parseAvatarPrompt(ex));
                }}
                className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text-muted)] hover:text-[var(--th-text)] cursor-pointer"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* 4-Layer Fine-Tuner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[var(--th-border)]">
          <div>
            <label
              htmlFor="avatar-char-select"
              className="block text-xs font-bold text-[var(--th-text)] mb-1"
            >
              Postać
            </label>
            <select
              id="avatar-char-select"
              value={draftSpec.character}
              onChange={(e) =>
                setDraftSpec((prev) => ({
                  ...prev,
                  character: e.target.value as AvatarSpec['character'],
                }))
              }
              className="w-full min-h-[40px] px-2.5 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] text-xs font-semibold"
            >
              {CHARACTER_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-bold text-[var(--th-text)] mb-1">
              Kolor postaci
            </span>
            <div className="flex flex-wrap items-center gap-1.5 min-h-[40px]">
              {AVATAR_PALETTE_SWATCHES.map((sw) => {
                const active = draftSpec.bodyColor.toUpperCase() === sw.body.toUpperCase();
                return (
                  <button
                    key={sw.label}
                    type="button"
                    aria-label={`Kolor awatara: ${sw.label}`}
                    title={sw.label}
                    onClick={() =>
                      setDraftSpec((prev) => ({
                        ...prev,
                        bgColor: sw.bg,
                        bodyColor: sw.body,
                      }))
                    }
                    style={{ backgroundColor: sw.body }}
                    className={`w-6 h-6 rounded-lg border-2 cursor-pointer transition-transform ${
                      active ? 'border-[var(--th-text)] scale-110' : 'border-white/60'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="avatar-acc-select"
              className="block text-xs font-bold text-[var(--th-text)] mb-1"
            >
              Dodatek
            </label>
            <select
              id="avatar-acc-select"
              value={draftSpec.accessory}
              onChange={(e) =>
                setDraftSpec((prev) => ({
                  ...prev,
                  accessory: e.target.value as AvatarSpec['accessory'],
                }))
              }
              className="w-full min-h-[40px] px-2.5 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] text-xs font-semibold"
            >
              {ACCESSORY_OPTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="avatar-prop-select"
              className="block text-xs font-bold text-[var(--th-text)] mb-1"
            >
              Symbol w rogu
            </label>
            <select
              id="avatar-prop-select"
              value={draftSpec.prop}
              onChange={(e) =>
                setDraftSpec((prev) => ({
                  ...prev,
                  prop: e.target.value as AvatarSpec['prop'],
                }))
              }
              className="w-full min-h-[40px] px-2.5 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] text-xs font-semibold"
            >
              {PROP_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleApplyDraft}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--th-surface)] border border-[var(--th-border)] hover:border-[var(--th-primary)] text-[var(--th-text)] text-xs sm:text-sm font-bold cursor-pointer inline-flex items-center gap-1.5"
          >
            <Check className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
            <span>Ustaw ten awatar na moim koncie</span>
          </button>

          {appliedNotice && (
            <span className="text-xs font-bold text-[var(--th-primary)]">
              {appliedNotice}
            </span>
          )}
        </div>
      </div>

      {/* 9 Illustrated Mascots (Owl Style) */}
      <div className="space-y-3">
        <div>
          <h3 className="font-display text-base sm:text-lg font-bold text-[var(--th-text)]">
            Ilustrowane Maskotki ({ILLUSTRATED_MASCOTS.length})
          </h3>
          <p className="text-xs text-[var(--th-text-muted)]">
            Gotowe, ręcznie zaprojektowane postacie w stylu Mądrej Sowy — wybierz jedną kliknięciem.
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2.5">
          {ILLUSTRATED_MASCOTS.map((mascot) => {
            const isSelected =
              currentAvatarId === mascot.id ||
              (mascot.id === 'owl' && currentAvatarId === 'owl-classic');
            return (
              <button
                key={mascot.id}
                type="button"
                data-testid={`avatar-mascot-${mascot.id}`}
                onClick={() => handlePickPreset(mascot.id, mascot.name)}
                aria-label={`Wybierz maskotkę: ${mascot.name}`}
                aria-pressed={isSelected}
                className={`p-1.5 rounded-2xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] ring-2 ring-[var(--th-primary)]'
                    : 'bg-[var(--th-surface)] border-[var(--th-border)] hover:border-[var(--th-primary)]'
                }`}
              >
                <AvatarDisplay
                  avatarId={mascot.id}
                  name={mascot.name}
                  sizeClass="w-14 h-14 sm:w-16 sm:h-16"
                />
                <span className="text-[11px] font-semibold text-[var(--th-text)] truncate w-full text-center">
                  {mascot.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 54 Ready-to-Pick Curated Vector Avatars */}
      <div className="space-y-3 pt-2 border-t border-[var(--th-border)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-[var(--th-text)]">
              Dodatkowe ikony i odznaki ({PRESET_AVATARS.length})
            </h3>
            <p className="text-xs text-[var(--th-text-muted)]">
              Jeszcze więcej wariantów tematycznych pogrupowanych w 4 kategorie.
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-1 p-1 bg-[var(--th-surface-muted)] rounded-xl border border-[var(--th-border)]"
            role="group"
            aria-label="Kategorie awatarów"
          >
            {(['Wszystkie', ...AVATAR_CATEGORIES] as const).map((cat) => {
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-sm'
                      : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9 gap-2.5 max-h-[360px] overflow-y-auto pr-1"
          data-testid="preset-avatars-grid"
        >

          {filteredPresets.map((preset) => {
            const isSelected = currentAvatarId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`avatar-preset-${preset.id}`}
                onClick={() => handlePickPreset(preset.id, preset.name)}
                aria-label={`Wybierz awatar: ${preset.name}`}
                aria-pressed={isSelected}
                className={`p-1.5 rounded-2xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] ring-2 ring-[var(--th-primary)]'
                    : 'bg-[var(--th-surface)] border-[var(--th-border)] hover:border-[var(--th-primary)]'
                }`}
              >
                <AvatarDisplay
                  avatarId={preset.id}
                  name={preset.name}
                  sizeClass="w-12 h-12 sm:w-14 sm:h-14"
                />
                <span className="text-[11px] font-semibold text-[var(--th-text)] truncate w-full text-center">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
