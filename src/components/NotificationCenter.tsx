import { Award, Bell, CheckCheck, Flame, Trophy, X, Zap } from 'lucide-react';
import { HelpButton } from '../help/HelpButton';
import type { FamilyNotification } from '../types/math';

interface NotificationCenterProps {
  open: boolean;
  notifications: FamilyNotification[];
  activeProfileId: string;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenFamilyStats: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (diffMin < 1) return 'przed chwilą';
  if (diffMin < 60) return `${diffMin} min temu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} godz. temu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} dni temu`;
}

export function NotificationCenter({
  open,
  notifications,
  activeProfileId,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onOpenFamilyStats,
}: NotificationCenterProps) {
  if (!open) return null;

  const visible = notifications.slice(0, 12);
  const unreadCount = visible.filter(
    (n) => n.actorProfileId !== activeProfileId && !n.readByProfileIds.includes(activeProfileId)
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:justify-end bg-black/40 p-0 sm:p-4 sm:pt-16"
      role="dialog"
      aria-modal="true"
      aria-label="Powiadomienia i rekordy"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[var(--th-surface)] border border-[var(--th-border)] rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden max-h-[82vh] flex flex-col animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 border-b border-[var(--th-border)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="w-4 h-4 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-[var(--th-text)] truncate">
              Powiadomienia i Rekordy <HelpButton section="notifications" label="Powiadomienia" className="align-middle" />
            </h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-[var(--th-accent)] text-[var(--th-accent-fg)] text-xs font-extrabold tabular-nums">
                {unreadCount} nowe
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs font-bold text-[var(--th-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Oznacz</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij powiadomienia"
              className="p-1.5 rounded-xl bg-[var(--th-surface-muted)] text-[var(--th-text-muted)] hover:text-[var(--th-text)] cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-3 space-y-2.5 flex-1">
          {visible.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--th-text-muted)]">
              Brak nowych powiadomień. Zagraj serię lub turniej, aby ustanowić rekord!
            </div>
          ) : (
            visible.map((item) => {
              const isUnread =
                item.actorProfileId !== activeProfileId &&
                !item.readByProfileIds.includes(activeProfileId);

              const Icon =
                item.type === 'tournament_record'
                  ? Trophy
                  : item.type === 'speed_record'
                  ? Flame
                  : item.type === 'badge_earned'
                  ? Award
                  : Zap;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onMarkRead(item.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition-colors flex items-start gap-3 cursor-pointer ${
                    isUnread
                      ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)]'
                      : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] opacity-85'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isUnread
                        ? 'bg-[var(--th-primary)] text-[var(--th-primary-fg)]'
                        : 'bg-[var(--th-surface)] text-[var(--th-text-muted)] border border-[var(--th-border)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold text-[var(--th-text)] truncate">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-[var(--th-text-muted)] shrink-0">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--th-text-muted)] leading-snug">
                      {item.message}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-[var(--th-border)] bg-[var(--th-surface-muted)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFamilyStats();
            }}
            className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-display font-bold text-sm border-b-3 border-[var(--th-primary-dark)] cursor-pointer transition-all"
          >
            Porównaj wyniki graczy w Statystykach
          </button>
        </div>
      </div>
    </div>
  );
}
