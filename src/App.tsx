import { type ComponentType, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ExerciseArena } from './components/ExerciseArena';
import { GroupsPanel } from './components/GroupsPanel';
import { DbNotice, SyncPrompt } from './components/SyncPrompt';
import { InstallBanner } from './components/InstallBanner';
import { InviteCard, capturePendingInvite } from './components/InviteCard';

capturePendingInvite();
import { FamilyWelcomeGate } from './components/FamilyWelcomeGate';
import { NotificationCenter } from './components/NotificationCenter';
import { TopNav, type NavTab } from './components/TopNav';
import { TrainingHome } from './components/TrainingHome';
import { findPresetAvatar } from './data/avatars';
import { resolveThemeById } from './data/themes';
import { classifyDevice } from './engine/deviceDetector';
import { getUnreadNotificationsForProfile } from './engine/familyNotifications';
import { themeToCssVariables } from './engine/themeEngine';
import { useAppStore } from './store/useAppStore';
import { AppStatusLayer } from './components/AppStatusLayer';
import { FairPlayNotice } from './components/FairPlayNotice';
import { NextDotSplash } from './components/NextDotSplash';
import { findLesson } from './data/path';
import { type PathStep, nextPathStep } from './engine/nextStep';
import { WhatsNewDialog, markReleaseSeen } from './components/WhatsNewDialog';
import { HowWePlayDialog, playedBeforePath, rulesSeen } from './components/HowWePlayDialog';
import { GuidedTour } from './help/GuidedTour';
import type { ActiveSeriesConfig, DeviceProfile } from './types/math';

// Rzadziej używane ekrany wczytują się dopiero przy pierwszym otwarciu (szybszy start na słabszych telefonach).
/**
 * Ekrany ładowane na żądanie. Gdy w międzyczasie wyszła nowa wersja i plik starej już nie istnieje,
 * przeładowujemy stronę raz (dane są zapisane na urządzeniu), zamiast pokazywać błąd.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithReload<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((err: unknown) => {
      const KEY = 'mt_chunk_reload_at';
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    })
  );
}

const StatsView = lazyWithReload(() => import('./components/StatsView').then((m) => ({ default: m.StatsView })));
const ThemesView = lazyWithReload(() => import('./components/ThemesView').then((m) => ({ default: m.ThemesView })));
const TournamentsView = lazyWithReload(() => import('./components/TournamentsView').then((m) => ({ default: m.TournamentsView })));
const ProfileSettingsView = lazyWithReload(() => import('./components/ProfileSettingsView').then((m) => ({ default: m.ProfileSettingsView })));
const AdminPanel = lazyWithReload(() => import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const TrueFalseGame = lazyWithReload(() => import('./components/TrueFalseGame').then((m) => ({ default: m.TrueFalseGame })));
const PairsGame = lazyWithReload(() => import('./components/PairsGame').then((m) => ({ default: m.PairsGame })));
const MyCertificates = lazyWithReload(() => import('./components/MyCertificates').then((m) => ({ default: m.MyCertificates })));

function ScreenFallback() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10 text-center text-sm text-[var(--th-text-muted)]" role="status">
      Wczytywanie…
    </div>
  );
}

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
    deviceThemeId,
    saveCustomTheme,
    deleteCustomTheme,
    connectGoogleCloud,
    disconnectGoogleCloud,
    joinGroupCode,
    resetLocalData,
    accountSync,
    retrySync,
    dbIssue,
    logoutAccount,
    deleteAccountForever,
    loginToCloudAccount,
    createAccountWithCloud,
    selectedCircleId,
    setSelectedCircleId,
    circles,
    circleError,
    createGroup,
    joinGroup,
    leaveGroup,
    changeGroupCode,
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
    () => resolveThemeById(deviceThemeId, activeProfile.customThemes),
    [deviceThemeId, activeProfile.customThemes]
  );

  const cssVars = useMemo(() => themeToCssVariables(activeTheme), [activeTheme]);
  // Te same zmienne na <html>, żeby nakładki (np. pomoc) poza głównym kontenerem miały kolory motywu.
  useEffect(() => {
    for (const [k, v] of Object.entries(cssVars)) {
      document.documentElement.style.setProperty(k, String(v));
    }
  }, [cssVars]);
  // Duży tekst: cała aplikacja w rem, więc wystarczy powiększyć czcionkę bazową.
  const largeText = Boolean(activeProfile?.settings.largeText);
  useEffect(() => {
    document.documentElement.style.fontSize = largeText ? '112.5%' : '';
  }, [largeText]);

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
      // miejsce także na rodziny działań (7×8 → 8×7, 56:7, 56:8)
      taskCount: Math.min(14, Math.max(8, focusIds.length * 2)),
      focusFactIds: focusIds,
    });
  };

  // „Dalej po ścieżce”: od razu następna kropka (z krótkim ekranem „co teraz”), a po wyjściu
  // z kropki — powrót dokładnie do bieżącego miejsca na ścieżce, a nie na górę strony.
  const [pathSplash, setPathSplash] = useState<{ step: PathStep; newModule: boolean } | null>(null);
  const scrollToCurrentDot = () => {
    let tries = 0;
    const tick = () => {
      const el = document.querySelector('[data-current-dot]') ?? document.querySelector('[data-testid=module-path]');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      else if (tries++ < 20) window.setTimeout(tick, 60);
    };
    window.setTimeout(tick, 60);
  };
  const exitSeries = () => {
    const wasPath = Boolean(activeSeries?.lessonId || activeSeries?.stageId);
    setActiveSeries(null);
    setPathSplash(null);
    if (wasPath) {
      setActiveTab('trening');
      scrollToCurrentDot();
    }
  };
  const continuePath = () => {
    const prevStage = activeSeries?.stageId ?? (activeSeries?.lessonId ? findLesson(activeSeries.lessonId)?.stageId : undefined);
    const step = nextPathStep(activeProfile);
    if (!step) {
      exitSeries();
      return;
    }
    const newModule = Boolean(prevStage && prevStage !== step.stageId);
    if (step.config.intro && !newModule) {
      // Kropka „Poznaj” ma własną kartę powitalną — startujemy od razu.
      setPathSplash(null);
      setActiveSeries(step.config);
      window.scrollTo(0, 0);
      return;
    }
    setActiveSeries(null);
    setPathSplash({ step, newModule });
  };

  const handleSelectTab = (tab: NavTab) => {
    setPathSplash(null);
    setActiveTab(tab);
    window.scrollTo(0, 0);
  };

  const [rulesTick, setRulesTick] = useState(0);
  const [adminOpen, setAdminOpen] = useState(() => window.location.hash === '#admin');
  useEffect(() => {
    const onHash = () => setAdminOpen(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const closeAdmin = () => {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setAdminOpen(false);
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
      onChangeCode={changeGroupCode}
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
      {adminOpen && (
        <Suspense fallback={null}>
          <AdminPanel onClose={closeAdmin} />
        </Suspense>
      )}
      {activeProfile && !showWelcomeGate && (
        <>
          {/* Nowe zasady (ścieżka z kropkami) — raz dla każdego, kto już grał; nowi dostają przewodnik. */}
          <HowWePlayDialog
            profileId={activeProfile.id}
            enabled={!activeSeries && !adminOpen && playedBeforePath(activeProfile.sessions)}
            onClose={() => {
              markReleaseSeen(); // nowe zasady już opisują nowości — bez drugiego okienka
              setRulesTick((t) => t + 1);
            }}
          />
          <WhatsNewDialog
            key={`wn-${rulesTick}`}
            enabled={!activeSeries && !adminOpen && rulesSeen(activeProfile.id)}
            isNewPlayer={(activeProfile.sessions?.length ?? 0) < 3}
          />
        </>
      )}
      {activeProfile && !showWelcomeGate && (
        <GuidedTour
          profileId={activeProfile.id}
          autoStart={(activeProfile.sessions?.length ?? 0) < 3}
          enabled={!activeSeries && !adminOpen}
          onSelectTab={setActiveTab}
        />
      )}
      {showWelcomeGate && <AppStatusLayer />}
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

          <main className={`flex-1 ${!activeSeries ? 'pb-[calc(5.5rem+var(--mt-install-h,0px)+env(safe-area-inset-bottom))] md:pb-[calc(2rem+var(--mt-install-h,0px))]' : 'pb-6'}`}>
            {!activeSeries && <InstallBanner />}
            {!activeSeries && !adminOpen && <AppStatusLayer />}
            {!activeSeries && !adminOpen && (
              <FairPlayNotice profile={activeProfile} onLogout={() => void logoutAccount(activeProfile.id)} />
            )}
            {!activeSeries && (
              <InviteCard
                canJoin={accountSync[activeProfile.id]?.state === 'synced'}
                alreadyMemberCodes={circles.map((c) => c.code)}
                onJoin={joinGroup}
                onJoined={() => handleSelectTab('statystyki')}
              />
            )}
            {!activeSeries &&
              (dbIssue && dbIssue.until > Date.now() && accountSync[activeProfile.id]?.state !== 'needs-password' ? (
                <DbNotice until={dbIssue.until} onRetry={() => retrySync(activeProfile.id)} />
              ) : (
                <SyncPrompt
                  key={activeProfile.id}
                  profile={activeProfile}
                  state={accountSync[activeProfile.id]}
                  onSubmitPassword={setProfileCredentials}
                  onRetry={retrySync}
                />
              ))}
            <Suspense fallback={<ScreenFallback />}>
            {activeSeries?.game === 'truefalse' ? (
              <TrueFalseGame
                key={`tf-${activeSeries.lessonId}`}
                config={activeSeries}
                memories={activeProfile.memories}
                soundEnabled={activeProfile.settings.soundEnabled}
                onCompleteSession={recordCompletedSession}
                onExit={exitSeries}
                onContinue={continuePath}
              />
            ) : activeSeries?.game === 'pairs' ? (
              <PairsGame
                key={`pairs-${activeSeries.lessonId}`}
                config={activeSeries}
                memories={activeProfile.memories}
                soundEnabled={activeProfile.settings.soundEnabled}
                onCompleteSession={recordCompletedSession}
                onExit={exitSeries}
                onContinue={continuePath}
              />
            ) : activeSeries ? (
              <ExerciseArena
                key={`${activeSeries.lessonId ?? activeSeries.stageId ?? ''}-${activeSeries.title}-${activeSeries.taskCount}-${activeSeries.maxRange}-${activeSeries.focusFactIds?.join(',') ?? ''}`}
                config={activeSeries}
                pastSessions={activeProfile.sessions}
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
                onExit={exitSeries}
                onContinue={continuePath}
                onRestartWithFocus={handleRestartWithFocus}
              />
            ) : pathSplash ? (
              <NextDotSplash
                key={pathSplash.step.config.lessonId ?? pathSplash.step.stageId}
                step={pathSplash.step}
                newModule={pathSplash.newModule}
                onStart={() => {
                  setActiveSeries(pathSplash.step.config);
                  setPathSplash(null);
                  window.scrollTo(0, 0);
                }}
                onBack={() => {
                  setPathSplash(null);
                  setActiveTab('trening');
                  scrollToCurrentDot();
                }}
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
              <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pb-6">
                <MyCertificates
                  profile={activeProfile}
                  primaryColor={activeTheme.tokens.primary}
                  accentColor={activeTheme.tokens.accent}
                />
              </div>
              </>
            ) : activeTab === 'statystyki' ? (
              <>
              {groupsPanel}
              <StatsView
                profile={activeProfile}
                profiles={competitionProfiles}
                trendProfiles={selectedCircleId ? competitionProfiles : profiles}
                groupName={circles.find((c) => c.id === selectedCircleId)?.name}
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
                onDeleteAccount={async (pid) => {
                  const res = await deleteAccountForever(pid);
                  if (res.ok) handleSelectTab('trening');
                  return res;
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
            </Suspense>
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
