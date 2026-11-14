import { BarChart3, Bell, Flame, Home, Palette, Trophy, User } from 'lucide-react';
import { HelpButton } from '../help/HelpButton';
import type { DeviceProfile } from '../types/math';

export type NavTab = 'trening' | 'turnieje' | 'statystyki' | 'szablony' | 'konto';

interface TopNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onQuickStart: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  userName: string;
  xp: number;
  streakDays: number;
  device: DeviceProfile;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: 'trening', label: 'Trening', icon: Home },
  { id: 'turnieje', label: 'Turnieje', icon: Trophy },
  { id: 'statystyki', label: 'Statystyki', icon: BarChart3 },
  { id: 'szablony', label: 'Szablony', icon: Palette },
  { id: 'konto', label: 'Konto', icon: User },
];

export function TopNav({
  activeTab,
  onSelectTab,
  onQuickStart,
  onOpenNotifications,
  unreadNotificationsCount,
  userName,
  xp,
  streakDays,
}: TopNavProps) {
  return (
    <>
      {/* Desktop & Tablet Top Bar (3-zone contract) */}
      <header
        style={{ backgroundColor: 'var(--th-surface)' }}
        className="sticky top-0 z-30 border-b border-[var(--th-border)] transition-colors"
      >
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-6">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => onSelectTab('trening')}
            className="font-display text-base sm:text-xl font-bold tracking-tight text-[var(--th-text)] whitespace-nowrap shrink-0 hover:text-[var(--th-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--th-primary)] rounded-md cursor-pointer"
          >
            Mistrz Tabliczki
          </button>

          {/* Zone 2: 5 single-line nav links (Desktop & Tablet) */}
          <nav
            aria-label="Nawigacja główna"
            className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-semibold"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--th-primary)] ${
                    isActive
                      ? 'border-[var(--th-primary)] text-[var(--th-primary)]'
                      : 'border-transparent text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:border-[var(--th-border)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Mobile compact quiet stats + Bell OR Desktop Bell + Primary CTA */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <div className="flex md:hidden items-center gap-1.5 text-[11px] font-semibold text-[var(--th-text-muted)] tabular-nums">
              <span className="inline-flex items-center gap-0.5 text-amber-600">
                <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                {streakDays}d
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[var(--th-text)]">{xp} XP</span>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[54px] text-[var(--th-text)]">{userName}</span>
            </div>

            <HelpButton section="start" label="Pomoc" />
            <button
              type="button"
              onClick={onOpenNotifications}
              data-testid="notifications-bell-btn"
              aria-label={
                unreadNotificationsCount > 0
                  ? `Powiadomienia (${unreadNotificationsCount} nieprzeczytane)`
                  : 'Powiadomienia rodzinne'
              }
              className="relative min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] rounded-xl border border-[var(--th-border)] bg-[var(--th-surface-muted)] text-[var(--th-text)] hover:border-[var(--th-primary)] inline-flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {unreadNotificationsCount > 0 && (
                <span
                  data-testid="notifications-unread-badge"
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--th-accent)] text-[var(--th-accent-fg)] text-[10px] font-extrabold leading-none flex items-center justify-center tabular-nums shadow-sm"
                >
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onQuickStart}
              className="hidden md:inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-[var(--th-primary-fg)] bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] active:translate-y-[1px] border-b-3 border-[var(--th-primary-dark)] rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--th-primary)]"
            >
              Szybki Trening
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Thumb-Zone Navigation (5 tabs) */}
      <nav
        aria-label="Nawigacja mobilna"
        style={{ backgroundColor: 'var(--th-surface)' }}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--th-border)]"
      >
        <div className="grid grid-cols-5 h-16">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[var(--th-primary)] font-bold'
                    : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)] font-medium'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                <span className="text-[10px] leading-none whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
