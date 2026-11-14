import { useEffect, useMemo, useState } from 'react';
import { ExerciseArena } from './components/ExerciseArena';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { StatsView } from './components/StatsView';
import { ThemesView } from './components/ThemesView';
import { TopNav, type NavTab } from './components/TopNav';
import { TournamentsView } from './components/TournamentsView';
import { TrainingHome } from './components/TrainingHome';
import { findPresetAvatar } from './data/avatars';
import { resolveThemeById } from './data/themes';
import { classifyDevice } from './engine/deviceDetector';
import { themeToCssVariables } from './engine/themeEngine';
import { useAppStore } from './store/useAppStore';
import type { ActiveSeriesConfig, DeviceProfile } from './types/math';

function detectCurrentDevice(): DeviceProfile {
  if (typeof window === 'undefined') {
    return classifyDevice(1440, 900, false);
  }
  const hasTouch =
    'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
  return classifyDevice(window.innerWidth, window.innerHeight, hasTouch);
}

export default function App() {
  const {
    profiles,
    activeProfile,
    switchProfile,
    createProfile,
    deleteProfile,
    addMissingFamilyProfiles,
    updateProfileMeta,
    updateSettings,
    recordCompletedSession,
    setActiveTheme,
    saveCustomTheme,
    deleteCustomTheme,
    resetDemoData,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<NavTab>('trening');
  const [device, setDevice] = useState<DeviceProfile>(detectCurrentDevice);
  const [activeSeries, setActiveSeries] = useState<ActiveSeriesConfig | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return {
          title: 'Szybki Trening Konkursowy',
          mode: 'mixed',
          maxRange: activeProfile.settings.maxRange,
          taskCount: 8,
        };
      }
    }
    return null;
  });

  const activeTheme = useMemo(
    () => resolveThemeById(activeProfile.activeThemeId, activeProfile.customThemes),
    [activeProfile.activeThemeId, activeProfile.customThemes]
  );

  const cssVars = useMemo(() => themeToCssVariables(activeTheme), [activeTheme]);

  // Keep <body> synced with the active user's theme canvas & text colors
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.backgroundColor = activeTheme.tokens.canvas;
    document.body.style.color = activeTheme.tokens.text;
    document.documentElement.dataset.theme = activeTheme.id;
    document.documentElement.dataset.themeDark = activeTheme.tokens.isDark ? 'true' : 'false';
  }, [activeTheme]);

  // Automatically re-detect phone / tablet / desktop & orientation on resize
  useEffect(() => {
    const onResize = () => {
      setDevice(detectCurrentDevice());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleQuickStart = () => {
    setActiveSeries({
      title: `Szybki Trening do ${activeProfile.settings.maxRange}`,
      mode: 'mixed',
      maxRange: activeProfile.settings.maxRange,
      taskCount: activeProfile.settings.defaultSeriesLength,
    });
  };

  const handleRestartWithFocus = (focusIds: string[], title: string) => {
    setActiveSeries({
      title,
      mode: 'mixed',
      maxRange: activeProfile.settings.maxRange,
      taskCount: Math.max(6, focusIds.length),
      focusFactIds: focusIds,
    });
  };

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    window.scrollTo(0, 0);
  };

  return (
    <div
      style={cssVars as React.CSSProperties}
      className="min-h-screen bg-[var(--th-canvas)] text-[var(--th-text)] flex flex-col transition-colors duration-200"
      data-device={device.category}
      data-orientation={device.orientation}
      data-active-theme={activeTheme.id}
      data-theme-dark={activeTheme.tokens.isDark ? 'true' : 'false'}
    >
      {!activeSeries && (
        <TopNav
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onQuickStart={handleQuickStart}
          userName={activeProfile.name}
          xp={activeProfile.xp}
          streakDays={activeProfile.streakDays}
          device={device}
        />
      )}

      <main className={`flex-1 ${!activeSeries ? 'pb-20 md:pb-8' : 'pb-6'}`}>
        {activeSeries ? (
          <ExerciseArena
            key={`${activeSeries.title}-${activeSeries.taskCount}-${activeSeries.maxRange}-${activeSeries.focusFactIds?.join(',') ?? ''}`}
            config={activeSeries}
            memories={activeProfile.memories}
            settings={activeProfile.settings}
            device={device}
            isDark={activeTheme.tokens.isDark}
            playerName={activeProfile.name}
            avatarSpec={
              activeProfile.avatarId === 'custom' && activeProfile.customAvatarSpec
                ? activeProfile.customAvatarSpec
                : findPresetAvatar(activeProfile.avatarId)?.spec
            }
            themePrimary={activeTheme.tokens.primary}
            themeAccent={activeTheme.tokens.accent}
            onUpdateSettings={updateSettings}
            onCompleteSession={recordCompletedSession}
            onExit={() => setActiveSeries(null)}
            onRestartWithFocus={handleRestartWithFocus}
          />
        ) : activeTab === 'trening' ? (
          <TrainingHome
            profile={activeProfile}
            profiles={profiles}
            device={device}
            onSwitchProfile={switchProfile}
            onStartSeries={(cfg) => setActiveSeries(cfg)}
            onOpenSettings={() => handleSelectTab('konto')}
          />
        ) : activeTab === 'turnieje' ? (
          <TournamentsView
            profile={activeProfile}
            profiles={profiles}
            onStartTournament={(cfg) => setActiveSeries(cfg)}
          />
        ) : activeTab === 'statystyki' ? (
          <StatsView
            profile={activeProfile}
            profiles={profiles}
            isDark={activeTheme.tokens.isDark}
            onSwitchProfile={switchProfile}
            onStartFocusedDrill={(cfg) => setActiveSeries(cfg)}
          />
        ) : activeTab === 'szablony' ? (
          <ThemesView
            activeProfileName={activeProfile.name}
            activeThemeId={activeTheme.id}
            customThemes={activeProfile.customThemes ?? []}
            onSelectTheme={setActiveTheme}
            onSaveCustomTheme={saveCustomTheme}
            onDeleteCustomTheme={deleteCustomTheme}
          />
        ) : (
          <ProfileSettingsView
            profiles={profiles}
            activeProfile={activeProfile}
            activeTheme={activeTheme}
            device={device}
            onSwitchProfile={switchProfile}
            onCreateProfile={createProfile}
            onDeleteProfile={deleteProfile}
            onAddMissingFamily={addMissingFamilyProfiles}
            onUpdateProfileMeta={updateProfileMeta}
            onSelectTheme={setActiveTheme}
            onOpenThemesTab={() => handleSelectTab('szablony')}
            onUpdateSettings={updateSettings}
            onResetDemo={resetDemoData}
          />
        )}
      </main>
    </div>
  );
}
