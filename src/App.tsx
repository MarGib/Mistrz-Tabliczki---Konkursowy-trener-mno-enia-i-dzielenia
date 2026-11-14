import { useEffect, useMemo, useState } from 'react';
import { ExerciseArena } from './components/ExerciseArena';
import { GroupsPanel } from './components/GroupsPanel';
import { SyncPrompt } from './components/SyncPrompt';
import { InviteCard, capturePendingInvite } from './components/InviteCard';

capturePendingInvite();
import { FamilyWelcomeGate } from './components/FamilyWelcomeGate';
import { NotificationCenter } from './components/NotificationCenter';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { StatsView } from './components/StatsView';
import { ThemesView } from './components/ThemesView';
import { TopNav, type NavTab } from './components/TopNav';
import { TournamentsView } from './components/TournamentsView';
import { TrainingHome } from './components/TrainingHome';
import { findPresetAvatar } from './data/avatars';
import { resolveThemeById } from './data/themes';
import { classifyDevice } from './engine/deviceDetector';
import { getUnreadNotificationsForProfile } from './engine/familyNotifications';
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
    competitionProfiles,
    ownedProfiles,
    activeProfile,
    hasSelectedProfile,
    notifications,
    schoolDirectory,
    cloudMeta,
    cloudStatus,
    cloudError,
    switchProfile,
    loginWithCredentials,
    reopenProfilePicker,
    createProfile,
    deleteProfile,
    updateProfileMeta,
    setProfileCredentials,
    clearProfilePassword,
    markNotificationRead,
    markAllNotificationsRead,
    updateSettings,
    recordCompletedSession,
    setActiveTheme,
    saveCustomTheme,
    deleteCustomTheme,
    connectGoogleCloud,
    disconnectGoogleCloud,
    joinGroupCode,
    resetLocalData,
    accountSync,
    logoutAccount,
    loginToCloudAccount,
    createAccountWithCloud,
    selectedCircleId,
    setSelectedCircleId,
    circles,
    circleError,
    createGroup,
    joinGroup,
    leaveGroup,
    setGroupShare,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<NavTab>('trening');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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
  // Te same zmienne na <html>, żeby nakładki (np. pomoc) poza głównym kontenerem miały kolory motywu.
  useEffect(() => {
    for (const [k, v] of Object.entries(cssVars)) {
      document.documentElement.style.setProperty(k, String(v));
    }
  }, [cssVars]);

  const unreadNotifications = useMemo(
    () => getUnreadNotificationsForProfile(notifications, activeProfile.id),
    [notifications, activeProfile.id]
  );

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

  const showWelcomeGate =
    (!hasSelectedProfile || ownedProfiles.length === 0) && !activeSeries;


  const groupsPanel = (
    <GroupsPanel
      circles={circles}
      selectedCircleId={selectedCircleId}
      onSelectCircle={setSelectedCircleId}
      accountState={accountSync[activeProfile.id]}
      circleError={circleError}
      membersCount={competitionProfiles.length}
      onCreateGroup={createGroup}
      onJoinGroup={joinGroup}
      onLeaveGroup={leaveGroup}
      onSetShare={setGroupShare}
      onOpenAccount={() => handleSelectTab('konto')}
    />
  );

  return (
    <div
      style={cssVars as React.CSSProperties}
      className="min-h-screen bg-[var(--th-canvas)] text-[var(--th-text)] flex flex-col transition-colors duration-200 overflow-x-hidden"
      data-device={device.category}
      data-orientation={device.orientation}
      data-active-theme={activeTheme.id}
      data-theme-dark={activeTheme.tokens.isDark ? 'true' : 'false'}
    >
      {showWelcomeGate ? (
        <FamilyWelcomeGate
          ownedProfiles={ownedProfiles}
          device={device}
          cloudMeta={cloudMeta}
          cloudStatus={cloudStatus}
          cloudError={cloudError}
          onSelectProfile={(id) => {
            switchProfile(id);
            window.scrollTo(0, 0);
          }}
          onSetCredentialsAndEnter={(id, login, pwd) => {
            setProfileCredentials(id, login, pwd);
            window.scrollTo(0, 0);
          }}
          onLoginWithCredentials={loginToCloudAccount}
          onCreateProfile={async (name, avatarId, password) => {
            const res = await createAccountWithCloud(name, avatarId, password);
            if (res.ok) window.scrollTo(0, 0);
            return res;
          }}
          onConnectGoogle={connectGoogleCloud}
        />
      ) : (
        <>
          {!activeSeries && (
            <TopNav
              activeTab={activeTab}
              onSelectTab={handleSelectTab}
              onQuickStart={handleQuickStart}
              onOpenNotifications={() => setIsNotificationsOpen(true)}
              unreadNotificationsCount={unreadNotifications.length}
              userName={activeProfile.name}
              xp={activeProfile.xp}
              streakDays={activeProfile.streakDays}
              device={device}
            />
          )}

          <main className={`flex-1 ${!activeSeries ? 'pb-20 md:pb-8' : 'pb-6'}`}>
            {!activeSeries && (
              <InviteCard
                canJoin={accountSync[activeProfile.id]?.state === 'synced'}
                alreadyMemberCodes={circles.map((c) => c.code)}
                onJoin={joinGroup}
                onJoined={() => handleSelectTab('statystyki')}
              />
            )}
            {!activeSeries && (
              <SyncPrompt
                key={activeProfile.id}
                profile={activeProfile}
                state={accountSync[activeProfile.id]}
                onSubmitPassword={setProfileCredentials}
              />
            )}
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
                device={device}
                unreadNotifications={unreadNotifications}
                onReopenProfilePicker={reopenProfilePicker}
                onOpenNotifications={() => setIsNotificationsOpen(true)}
                onStartSeries={(cfg) => setActiveSeries(cfg)}
                onOpenSettings={() => handleSelectTab('konto')}
                onOpenStats={() => handleSelectTab('statystyki')}
                onOpenTournaments={() => handleSelectTab('turnieje')}
              />
            ) : activeTab === 'turnieje' ? (
              <>
              {groupsPanel}
              <TournamentsView
                profile={activeProfile}
                profiles={competitionProfiles}
                cloudStatus={cloudStatus}
                cloudError={cloudError}
                onStartTournament={(cfg) => setActiveSeries(cfg)}
              />
              </>
            ) : activeTab === 'statystyki' ? (
              <>
              {groupsPanel}
              <StatsView
                profile={activeProfile}
                profiles={competitionProfiles}
                trendProfiles={profiles}
                cloudStatus={cloudStatus}
                cloudError={cloudError}
                isDark={activeTheme.tokens.isDark}
                onStartFocusedDrill={(cfg) => setActiveSeries(cfg)}
              />
              </>
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
                accountState={accountSync[activeProfile.id]}
                onCreateAccount={createAccountWithCloud}
                onLogout={() => {
                  void logoutAccount(activeProfile.id);
                  handleSelectTab('trening');
                }}
                ownedProfiles={ownedProfiles}
                activeProfile={activeProfile}
                schoolDirectory={schoolDirectory}
                activeTheme={activeTheme}
                device={device}
                cloudMeta={cloudMeta}
                cloudStatus={cloudStatus}
                cloudError={cloudError}
                onSwitchProfile={switchProfile}
                onCreateProfile={createProfile}
                onDeleteProfile={deleteProfile}
                onUpdateProfileMeta={updateProfileMeta}
                onSetProfileCredentials={setProfileCredentials}
                onClearProfilePassword={clearProfilePassword}
                onSelectTheme={setActiveTheme}
                onOpenThemesTab={() => handleSelectTab('szablony')}
                onUpdateSettings={updateSettings}
                onConnectGoogle={connectGoogleCloud}
                onDisconnectGoogle={disconnectGoogleCloud}
                onJoinGroupCode={joinGroupCode}
                onResetLocalData={resetLocalData}
                onReopenProfilePicker={reopenProfilePicker}
              />
            )}
          </main>

          <NotificationCenter
            open={isNotificationsOpen && !activeSeries}
            notifications={notifications}
            activeProfileId={activeProfile.id}
            onClose={() => setIsNotificationsOpen(false)}
            onMarkRead={markNotificationRead}
            onMarkAllRead={markAllNotificationsRead}
            onOpenFamilyStats={() => handleSelectTab('statystyki')}
          />
        </>
      )}
    </div>
  );
}
