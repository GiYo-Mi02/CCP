'use client';

import { BellRing } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';

type ToastMessage = {
  id: string;
  title: string;
  description: string;
  expiresAt: number;
};

type PeriodSnapshot = {
  periodType: string;
  state: string;
};

const TOAST_TTL_MS = 7000;

function titleCase(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildPeriodToast(periodType: string, state: string): Pick<ToastMessage, 'title' | 'description'> {
  const periodName = titleCase(periodType);

  if (state === 'active') {
    return {
      title: `${periodName} Period Opened`,
      description: `Submissions are now open for ${periodName}.`,
    };
  }

  if (state === 'votation') {
    return {
      title: `${periodName} Voting Opened`,
      description: `You can now cast your vote for ${periodName}.`,
    };
  }

  if (state === 'results') {
    return {
      title: `${periodName} Results Published`,
      description: `Results are now available for ${periodName}.`,
    };
  }

  if (state === 'closed') {
    return {
      title: `${periodName} Period Closed`,
      description: `${periodName} is now closed by the admin panel.`,
    };
  }

  return {
    title: `${periodName} Updated`,
    description: `${periodName} moved to ${titleCase(state)}.`,
  };
}

export function DelegatePeriodNotifier() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const knownPeriodStates = useRef<Map<string, PeriodSnapshot>>(new Map());
  const knownSessionStatus = useRef<Map<string, string>>(new Map());

  const addToast = useCallback((title: string, description: string) => {
    const now = Date.now();
    const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;

    setToasts((previous) => {
      const hasRecentDuplicate = previous.some(
        (toast) =>
          toast.title === title &&
          toast.description === description &&
          toast.expiresAt - now > TOAST_TTL_MS - 2500
      );

      if (hasRecentDuplicate) {
        return previous;
      }

      const next = [...previous, { id, title, description, expiresAt: now + TOAST_TTL_MS }];
      return next.slice(-4);
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setToasts((previous) => {
        const next = previous.filter((toast) => toast.expiresAt > now);
        return next.length === previous.length ? previous : next;
      });
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const startFallbackPolling = () => {
      if (fallbackInterval) return;

      fallbackInterval = setInterval(() => {
        void syncSnapshots(true);
      }, 5000);
    };

    const stopFallbackPolling = () => {
      if (!fallbackInterval) return;
      clearInterval(fallbackInterval);
      fallbackInterval = null;
    };

    const syncSnapshots = async (notify: boolean) => {
      const [periodsResult, sessionsResult] = await Promise.all([
        supabase.from('periods').select('id, period_type, state'),
        supabase.from('sessions').select('id, status, name'),
      ]);

      const periodRows = periodsResult.data ?? [];
      for (const row of periodRows) {
        const previous = knownPeriodStates.current.get(row.id);

        if (notify && previous?.state && previous.state !== row.state) {
          const toast = buildPeriodToast(row.period_type, row.state);
          addToast(toast.title, toast.description);
        }

        knownPeriodStates.current.set(row.id, {
          periodType: row.period_type,
          state: row.state,
        });
      }

      const sessionRows = sessionsResult.data ?? [];
      for (const row of sessionRows) {
        const previousStatus = knownSessionStatus.current.get(row.id);

        if (notify && previousStatus && previousStatus !== row.status && row.status === 'active') {
          addToast('Convention Session Opened', `${row.name ?? 'The current session'} is now active.`);
        }

        knownSessionStatus.current.set(row.id, row.status);
      }
    };

    async function boot() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user) return;

      await syncSnapshots(false);

      const channel = supabase.channel(`delegate-period-notifier-${user.id}`);

      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'periods',
        },
        (payload) => {
          const next = payload.new as { id?: string; period_type?: string; state?: string } | null;
          if (!next?.id || !next.period_type || !next.state) {
            return;
          }

          const previous = knownPeriodStates.current.get(next.id);
          knownPeriodStates.current.set(next.id, {
            periodType: next.period_type,
            state: next.state,
          });

          const previousState = previous?.state;
          if (!previousState || previousState === next.state) {
            return;
          }

          const toast = buildPeriodToast(next.period_type, next.state);
          addToast(toast.title, toast.description);
        }
      );

      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
        },
        (payload) => {
          const next = payload.new as { id?: string; status?: string; name?: string } | null;
          if (!next?.id || !next.status) {
            return;
          }

          const previousStatus = knownSessionStatus.current.get(next.id);
          knownSessionStatus.current.set(next.id, next.status);

          if (previousStatus !== next.status && next.status === 'active') {
            addToast('Convention Session Opened', `${next.name ?? 'The current session'} is now active.`);
          }
        }
      );

      // Keep snapshot polling running even when realtime is healthy.
      // This guarantees notifications still fire if websocket delivery is delayed.
      startFallbackPolling();

      channel.subscribe((status) => {
        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          startFallbackPolling();
        }
      });

      return () => {
        stopFallbackPolling();
        void supabase.removeChannel(channel);
      };
    }

    let cleanup: (() => void) | undefined;
    let unmounted = false;

    void boot().then((teardown) => {
      if (unmounted) {
        teardown?.();
        return;
      }
      cleanup = teardown;
    });

    return () => {
      cancelled = true;
      unmounted = true;
      if (cleanup) {
        cleanup();
      }

      stopFallbackPolling();
    };
  }, [addToast]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(92vw,380px)] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-xl border border-emerald-500/35 bg-zinc-900/95 p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <div>
              <p className="text-sm font-semibold text-zinc-100">{toast.title}</p>
              <p className="mt-1 text-sm text-zinc-300">{toast.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
