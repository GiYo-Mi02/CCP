'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PeriodState, PeriodType, Session } from '@/lib/types/database';
import {
  advancePeriodStage,
  initializeConventionFlow,
  resetPeriodVotes,
  setGlobalTimer,
  updatePeriodStatus,
} from './actions';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';

type AdminPeriod = {
  id: string;
  period_type: PeriodType;
  state: PeriodState;
  deadline: string | null;
  sort_order: number;
};

interface AdminDashboardClientProps {
  session: Pick<Session, 'id' | 'name' | 'status'> | null;
  periods: AdminPeriod[];
  totalMotions: number;
}

const PERIOD_LABELS: Record<PeriodType, string> = {
  election: 'Plenary & Committee Elections',
  quash: 'Quashing Period',
  amendment: 'Amendment Period',
  insertion: 'Insertion Period',
  quick_motion: 'Quick Motion Votation',
  final_votation: 'Final Votation',
};

const PERIOD_ROUTE_MAP: Record<PeriodType, string> = {
  election: '/plencommelec',
  quash: '/periods/quash',
  amendment: '/periods/amendment',
  insertion: '/periods/insertion',
  quick_motion: '/quick-motion',
  final_votation: '/periods/final',
};

const ADMIN_REVIEW_ROUTE_MAP: Partial<Record<PeriodType, string>> = {
  election: '/admin/elections',
  quash: '/admin/periods/quash',
  amendment: '/admin/periods/amendment',
  insertion: '/admin/periods/insertion',
  quick_motion: '/admin/periods/quick-motion',
};

const TEMPLATE_PERIODS: AdminPeriod[] = [
  {
    id: 'template-election',
    period_type: 'election',
    state: 'pending',
    deadline: null,
    sort_order: 1,
  },
  {
    id: 'template-quash',
    period_type: 'quash',
    state: 'pending',
    deadline: null,
    sort_order: 2,
  },
  {
    id: 'template-amendment',
    period_type: 'amendment',
    state: 'pending',
    deadline: null,
    sort_order: 3,
  },
  {
    id: 'template-insertion',
    period_type: 'insertion',
    state: 'pending',
    deadline: null,
    sort_order: 4,
  },
  {
    id: 'template-quick-motion',
    period_type: 'quick_motion',
    state: 'pending',
    deadline: null,
    sort_order: 5,
  },
  {
    id: 'template-final-votation',
    period_type: 'final_votation',
    state: 'pending',
    deadline: null,
    sort_order: 6,
  },
];

const DEFAULT_PERIOD_TIMER_MINUTES = 10;

function stateToChip(state: PeriodState) {
  switch (state) {
    case 'active':
      return { label: 'ACTIVE', className: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40' };
    case 'votation':
      return { label: 'VOTATION', className: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' };
    case 'closed':
      return { label: 'CLOSED', className: 'bg-zinc-500/20 text-zinc-300 border-zinc-400/40' };
    case 'results':
      return { label: 'RESULTS', className: 'bg-amber-500/20 text-amber-200 border-amber-400/40' };
    default:
      return { label: 'OPEN', className: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40' };
  }
}

function formatDeadline(deadline: string | null) {
  if (!deadline) return 'No timer';

  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return 'No timer';

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return 'Timer elapsed';

  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s remaining`;
}

export function AdminDashboardClient({ session, periods, totalMotions }: AdminDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [durationMinutes, setDurationMinutes] = useState<number>(10);
  const [periodTimerMinutes, setPeriodTimerMinutes] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useRealtimeRefresh({
    channelName: 'admin-dashboard-live-refresh',
    tables: [
      { table: 'sessions' },
      { table: 'periods' },
      { table: 'motions' },
      { table: 'votes' },
      { table: 'elections' },
      { table: 'election_votes' },
    ],
  });

  const hasActiveSession = Boolean(session);
  const displayPeriods = hasActiveSession ? periods : TEMPLATE_PERIODS;

  const timersActive = useMemo(
    () => periods.filter((period) => period.deadline !== null).length,
    [periods]
  );

  const handlePeriodUpdate = (
    periodId: string,
    status: 'OPEN' | 'CLOSED' | 'ACTIVE',
    customMinutes?: number
  ) => {
    if (!hasActiveSession) {
      setFeedback('Initialize convention flow first to activate period controls.');
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await updatePeriodStatus(
        periodId,
        status,
        status === 'ACTIVE' ? customMinutes : undefined
      );

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      if (status === 'ACTIVE' && customMinutes && customMinutes > 0) {
        setFeedback(`Period updated to ${status} with a ${customMinutes}-minute timer.`);
      } else {
        setFeedback(`Period updated to ${status}.`);
      }
      router.refresh();
    });
  };

  const handleStartTimer = () => {
    if (!hasActiveSession) {
      setFeedback('Initialize convention flow first to use the global timer.');
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await setGlobalTimer(durationMinutes);

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setFeedback(`Global timer started for ${durationMinutes} minute(s).`);
      router.refresh();
    });
  };

  const handleInitializeFlow = () => {
    setFeedback(null);

    startTransition(async () => {
      const result = await initializeConventionFlow();

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setFeedback('Convention flow initialized. Period controls are now live.');
      router.refresh();
    });
  };

  const handleAdvanceStage = (periodId: string) => {
    if (!hasActiveSession) {
      setFeedback('Initialize convention flow first to advance period stages.');
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await advancePeriodStage(periodId);

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      const nextStateLabel =
        result && 'nextState' in result && result.nextState
          ? String(result.nextState)
          : 'next stage';

      setFeedback(`Period advanced to ${nextStateLabel}.`);
      router.refresh();
    });
  };

  const handleResetVotes = (periodId: string) => {
    if (!hasActiveSession) {
      setFeedback('Initialize convention flow first to reset votes.');
      return;
    }

    if (!window.confirm('Reset all votes for this period? This cannot be undone.')) {
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await resetPeriodVotes(periodId);

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setFeedback('Votes reset for selected period.');
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 text-zinc-100 px-4 sm:px-8 lg:px-12 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10">
          <p className="text-xs tracking-[0.28em] uppercase text-zinc-400 font-semibold">Constitutional Convention Platform</p>
          <h1 className="font-serif text-3xl sm:text-5xl tracking-tight text-white mt-3">Admin Control Panel</h1>
          <p className="text-zinc-400 mt-3 text-sm sm:text-base max-w-2xl leading-relaxed">
            Manage live period flow, start global votation countdowns, and coordinate session state in real time.
          </p>
        </header>

        {!hasActiveSession && (
          <div className="rounded-3xl border border-amber-400/25 bg-amber-500/10 p-6 mb-6 sm:mb-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl text-amber-100">No Active Session</h2>
              <p className="text-amber-200/80 mt-2">Your required periods are shown below as a template. Initialize the flow to make controls live.</p>
            </div>
            <button
              type="button"
              onClick={handleInitializeFlow}
              disabled={isPending}
              className="rounded-xl border border-amber-300/40 bg-amber-400/20 hover:bg-amber-300/30 px-5 py-3 text-sm font-semibold text-amber-100 disabled:opacity-60"
            >
              {isPending ? 'Initializing...' : 'Initialize Convention Flow'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
            <section className="lg:col-span-8 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-7">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="font-serif text-2xl text-white">Period Controller</h2>
                  <p className="text-zinc-400 text-sm mt-1">Session: {session?.name ?? 'Not initialized yet'}</p>
                </div>
                <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">Bento Box 01</span>
              </div>

              <div className="space-y-4">
                {displayPeriods.map((period) => {
                  const chip = stateToChip(period.state);
                  const reviewHref = ADMIN_REVIEW_ROUTE_MAP[period.period_type];
                  const reviewLabel =
                    period.period_type === 'election'
                      ? 'Manage Candidates'
                      : 'Review Proposals';
                  return (
                    <article
                      key={period.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 sm:p-5 flex flex-col gap-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-serif text-xl text-zinc-100">{PERIOD_LABELS[period.period_type]}</h3>
                          <p className="text-zinc-500 text-xs uppercase tracking-[0.2em] mt-1">Sort #{period.sort_order}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full border text-xs tracking-wide font-semibold ${chip.className}`}>
                          {chip.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-full sm:w-auto">
                          <label
                            htmlFor={`period-timer-${period.id}`}
                            className="block text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2"
                          >
                            Period Timer (Minutes)
                          </label>
                          <input
                            id={`period-timer-${period.id}`}
                            type="number"
                            min={1}
                            max={720}
                            value={periodTimerMinutes[period.id] ?? DEFAULT_PERIOD_TIMER_MINUTES}
                            onChange={(event) => {
                              const parsed = Number(event.target.value);
                              setPeriodTimerMinutes((previous) => ({
                                ...previous,
                                [period.id]: Number.isFinite(parsed) ? parsed : DEFAULT_PERIOD_TIMER_MINUTES,
                              }));
                            }}
                            disabled={isPending || !hasActiveSession}
                            className="w-full sm:w-44 rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-60"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {reviewHref && (
                          <Link
                            href={reviewHref}
                            className="px-4 py-2 rounded-xl border border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-100 text-sm font-semibold"
                          >
                            {reviewLabel}
                          </Link>
                        )}
                        <Link
                          href={PERIOD_ROUTE_MAP[period.period_type]}
                          className="px-4 py-2 rounded-xl border border-zinc-500/40 bg-zinc-800/50 hover:bg-zinc-700/60 text-zinc-200 text-sm font-semibold"
                        >
                          Open Page
                        </Link>
                        <button
                          type="button"
                          onClick={() => handlePeriodUpdate(period.id, 'OPEN')}
                          disabled={isPending || !hasActiveSession}
                          className="px-4 py-2 rounded-xl border border-indigo-400/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-100 text-sm font-semibold disabled:opacity-60"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handlePeriodUpdate(
                              period.id,
                              'ACTIVE',
                              periodTimerMinutes[period.id] ?? DEFAULT_PERIOD_TIMER_MINUTES
                            )
                          }
                          disabled={isPending || !hasActiveSession}
                          className="px-4 py-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-100 text-sm font-semibold disabled:opacity-60"
                        >
                          Activate
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePeriodUpdate(period.id, 'CLOSED')}
                          disabled={isPending || !hasActiveSession}
                          className="px-4 py-2 rounded-xl border border-zinc-500/40 bg-zinc-600/20 hover:bg-zinc-500/30 text-zinc-200 text-sm font-semibold disabled:opacity-60"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdvanceStage(period.id)}
                          disabled={isPending || !hasActiveSession}
                          className="px-4 py-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-100 text-sm font-semibold disabled:opacity-60"
                        >
                          Advance Stage
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetVotes(period.id)}
                          disabled={isPending || !hasActiveSession}
                          className="px-4 py-2 rounded-xl border border-rose-400/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-100 text-sm font-semibold disabled:opacity-60"
                        >
                          Reset Votes
                        </button>
                      </div>

                      <p className="text-xs text-zinc-500 uppercase tracking-[0.12em]">Timer: {formatDeadline(period.deadline)}</p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="lg:col-span-4 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-7 flex flex-col">
              <div className="flex items-center justify-between gap-4 mb-6">
                <h2 className="font-serif text-2xl text-white">Global Votation Timer</h2>
                <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">Bento Box 02</span>
              </div>

              <label htmlFor="timer-minutes" className="text-xs uppercase tracking-[0.2em] text-zinc-400 mb-2">
                Duration (Minutes)
              </label>
              <input
                id="timer-minutes"
                type="number"
                min={1}
                max={720}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />

              <button
                type="button"
                onClick={handleStartTimer}
                disabled={isPending || !hasActiveSession}
                className="mt-4 w-full rounded-xl border border-emerald-400/40 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 font-semibold py-3 disabled:opacity-60"
              >
                {isPending ? 'Starting Timer...' : 'Start Global Timer'}
              </button>

              <div className="mt-6 pt-5 border-t border-zinc-800 space-y-2 text-sm text-zinc-400">
                <p>Current session status: <span className="text-zinc-200 uppercase tracking-wide">{session?.status ?? 'not initialized'}</span></p>
                <p>Periods with timer: <span className="text-zinc-200">{timersActive}</span></p>
              </div>
            </section>

            <section className="lg:col-span-12 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-7">
              <div className="flex items-center justify-between gap-4 mb-6">
                <h2 className="font-serif text-2xl text-white">Quick Overview</h2>
                <div className="flex items-center gap-3">
                  <Link
                    href="/admin/elections"
                    className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-800 text-xs uppercase tracking-[0.12em]"
                  >
                    Manage Candidates
                  </Link>
                  <Link
                    href="/admin/er"
                    className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-800 text-xs uppercase tracking-[0.12em]"
                  >
                    Open ER Monitoring
                  </Link>
                  <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">Bento Box 03</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <article className="rounded-2xl bg-zinc-950/60 border border-zinc-800 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Total Motions Submitted</p>
                  <p className="font-serif text-4xl text-white mt-2">{totalMotions}</p>
                </article>
                <article className="rounded-2xl bg-zinc-950/60 border border-zinc-800 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Configured Periods</p>
                  <p className="font-serif text-4xl text-white mt-2">{displayPeriods.length}</p>
                </article>
                <article className="rounded-2xl bg-zinc-950/60 border border-zinc-800 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Live Timers</p>
                  <p className="font-serif text-4xl text-white mt-2">{timersActive}</p>
                </article>
              </div>

              {feedback && (
                <p className="mt-6 text-sm text-zinc-200 bg-zinc-950/70 border border-zinc-700 rounded-xl px-4 py-3">
                  {feedback}
                </p>
              )}
            </section>
          </div>
      </div>
    </div>
  );
}
