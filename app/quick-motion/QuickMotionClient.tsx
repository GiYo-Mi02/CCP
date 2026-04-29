'use client';

import { useMemo, useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowLeft, Check, Minus, X, MoreVertical, Trash2, EyeOff, Eye } from 'lucide-react';
import { castVote } from '@/lib/actions/votes';
import { submitQuickMotion, deleteMotion, hideMotion, unhideMotion } from '@/lib/actions/motions';
import { TopNav } from '@/components/shared/TopNav';
import { Timer } from '@/components/shared/Timer';
import type { PeriodState, VoteValue } from '@/lib/types/database';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';

interface QuickMotionClientProps {
  delegateName: string;
  delegateAvatarUrl?: string;
  sessionName?: string;
  periodId: string;
  periodState: PeriodState;
  deadline: string | null;
  motions: Array<{
    id: string;
    article_ref: string;
    section_ref: string;
    proposed_text: string | null;
    is_hidden?: boolean;
    author_name?: string;
    author_committee?: string;
  }>;
  voteAggregates: Array<{
    motion_id: string;
    adapt: number;
    quash: number;
    abstain: number;
    total: number;
  }>;
  userVotes: Array<{ motion_id: string; vote_value: VoteValue }>;
  isAdmin?: boolean;
}

// ─── Kebab Menu Component ────────────────────────────────────────────

function MotionKebabMenu({
  motionId,
  isHidden,
  onAction,
}: {
  motionId: string;
  isHidden: boolean;
  onAction: (action: 'delete' | 'hide' | 'unhide', motionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="p-1 rounded-lg text-ccd-text-sec hover:text-ccd-text hover:bg-ccd-surface/60 transition-colors"
        aria-label="Motion actions"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-ccd-accent/20 rounded-xl shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAction(isHidden ? 'unhide' : 'hide', motionId);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ccd-text hover:bg-ccd-surface/40 transition-colors"
          >
            {isHidden ? (
              <>
                <Eye className="w-3.5 h-3.5 text-ccd-success" />
                <span>Unhide</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-ccd-neutral" />
                <span>Hide</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAction('delete', motionId);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ccd-danger hover:bg-ccd-danger/5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Delete Confirmation Dialog ──────────────────────────────────────

function DeleteConfirmDialog({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ccd-text/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative z-10 p-6 sm:p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-ccd-danger/10 flex items-center justify-center mb-4">
          <Trash2 className="w-6 h-6 text-ccd-danger" />
        </div>
        <h3 className="font-serif text-xl font-bold text-ccd-text mb-2">Delete Quick Motion?</h3>
        <p className="text-ccd-text-sec text-sm mb-6">
          This action is <strong>permanent</strong>. The quick motion and all associated votes will be removed from the database.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 py-3 rounded-xl border border-ccd-accent/30 text-ccd-text font-bold uppercase text-xs tracking-widest hover:bg-ccd-surface/40 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-3 rounded-xl bg-ccd-danger text-white font-bold uppercase text-xs tracking-widest hover:bg-ccd-danger/90 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function QuickMotionClient({
  delegateName,
  delegateAvatarUrl,
  sessionName,
  periodId,
  periodState,
  deadline,
  motions,
  voteAggregates,
  userVotes,
  isAdmin = false,
}: QuickMotionClientProps) {
  const router = useRouter();
  const [selectedMotionId, setSelectedMotionId] = useState<string>(motions[0]?.id ?? '');
  const [newMotionText, setNewMotionText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useRealtimeRefresh({
    channelName: `quick-motion-live-${periodId}`,
    tables: [
      { table: 'periods', filter: `id=eq.${periodId}` },
      { table: 'motions', filter: `period_id=eq.${periodId}` },
      { table: 'votes' },
    ],
  });

  const aggregateMap = useMemo(() => new Map(voteAggregates.map((row) => [row.motion_id, row])), [voteAggregates]);
  const userVoteMap = useMemo(() => new Map(userVotes.map((row) => [row.motion_id, row.vote_value])), [userVotes]);

  const selectedAggregate = selectedMotionId
    ? aggregateMap.get(selectedMotionId) ?? { motion_id: selectedMotionId, adapt: 0, quash: 0, abstain: 0, total: 0 }
    : null;

  const chartData = [
    { name: 'ADAPT', value: selectedAggregate?.adapt ?? 0, color: '#16A34A' },
    { name: 'QUASH', value: selectedAggregate?.quash ?? 0, color: '#DC2626' },
    { name: 'ABSTAIN', value: selectedAggregate?.abstain ?? 0, color: '#6B7280' },
  ];

  const handleVote = (voteValue: VoteValue) => {
    if (!selectedMotionId) return;

    setFeedback(null);

    startTransition(async () => {
      const result = await castVote(selectedMotionId, voteValue);
      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setFeedback(`Quick motion vote recorded: ${voteValue.toUpperCase()}.`);
      router.refresh();
    });
  };

  const handleSubmitQuickMotion = () => {
    if (!newMotionText.trim()) {
      setFeedback('Please enter your quick motion text.');
      return;
    }

    const formData = new FormData();
    formData.set('period_id', periodId);
    formData.set('proposed_text', newMotionText.trim());

    setFeedback(null);

    startTransition(async () => {
      const result = await submitQuickMotion(formData);
      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setNewMotionText('');
      setFeedback('Quick motion submitted successfully.');
      router.refresh();
    });
  };

  // ─── Admin actions ──────────────────────────────────────────────

  const handleMotionAction = (action: 'delete' | 'hide' | 'unhide', motionId: string) => {
    if (action === 'delete') {
      setDeleteTarget(motionId);
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const result = action === 'hide'
        ? await hideMotion(motionId)
        : await unhideMotion(motionId);

      if (result?.error) {
        setFeedback(typeof result.error === 'string' ? result.error : 'Action failed.');
        return;
      }

      setFeedback(action === 'hide' ? 'Quick motion hidden from delegates.' : 'Quick motion is now visible to delegates.');
      router.refresh();
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    setFeedback(null);
    startTransition(async () => {
      const result = await deleteMotion(deleteTarget);
      if (result?.error) {
        setFeedback(typeof result.error === 'string' ? result.error : 'Delete failed.');
        setDeleteTarget(null);
        return;
      }

      // If the deleted motion was selected, clear selection
      if (deleteTarget === selectedMotionId) {
        const remaining = motions.filter((m) => m.id !== deleteTarget);
        setSelectedMotionId(remaining[0]?.id ?? '');
      }

      setDeleteTarget(null);
      setFeedback('Quick motion permanently deleted.');
      router.refresh();
    });
  };

  const showVoting = periodState === 'votation';
  const showSubmission = periodState === 'active';

  return (
    <div className="min-h-screen bg-ccd-bg pb-20">
      <TopNav
        delegateName={delegateName}
        delegateAvatarUrl={delegateAvatarUrl}
        sessionName={sessionName}
        leftComponent={
          showSubmission || showVoting ? (
            <Timer targetDate={deadline ? new Date(deadline) : null} className="ml-4" />
          ) : (
            <div className="ml-4 flex items-center gap-2 font-mono text-sm px-3 py-1 rounded-full bg-ccd-danger/10 text-ccd-danger border border-ccd-danger/20 shadow-sm">
              <span className="font-bold tracking-widest">CLOSED</span>
            </div>
          )
        }
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/home" className="inline-flex items-center gap-2 text-ccd-text-sec hover:text-ccd-active mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ccd-text mb-2">Quick Motion Votation</h1>
          <p className="text-ccd-text-sec uppercase tracking-widest text-xs font-bold">Live Database Results</p>
          <div className="mt-5 flex justify-center">
            {showSubmission || showVoting ? (
              <div className="inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-ccd-accent/30 bg-white px-4 py-3 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ccd-text-sec">Timer Status</span>
                <Timer targetDate={deadline ? new Date(deadline) : null} />
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-ccd-danger/30 bg-ccd-danger/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-ccd-danger">
                Timer Closed
              </div>
            )}
          </div>
        </div>

        {feedback && <p className="mb-6 text-sm bg-white border border-ccd-accent/30 rounded-xl px-4 py-3">{feedback}</p>}

        {motions.length === 0 ? (
          <div className="bg-white rounded-3xl border border-ccd-accent/20 p-8 text-center text-ccd-text-sec">
            No quick motions yet for this period.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 bg-white rounded-3xl border border-ccd-accent/20 p-6 sm:p-8">
              <div className="h-[280px] w-full relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-serif text-4xl font-bold text-ccd-text">{selectedAggregate?.total ?? 0}</span>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-ccd-text-sec">Total Votes</span>
                </div>
              </div>

              {showVoting && selectedMotionId && (
                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => handleVote('quash')}
                    disabled={isPending || userVoteMap.has(selectedMotionId)}
                    className="flex-1 py-3 bg-white hover:bg-ccd-danger text-ccd-danger hover:text-white border-2 border-ccd-danger/30 rounded-2xl font-bold tracking-widest uppercase disabled:opacity-50"
                  >
                    <X className="w-5 h-5 inline mr-1" /> Quash
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVote('abstain')}
                    disabled={isPending || userVoteMap.has(selectedMotionId)}
                    className="flex-1 py-3 bg-white hover:bg-ccd-neutral text-ccd-neutral hover:text-white border-2 border-ccd-neutral/30 rounded-2xl font-bold tracking-widest uppercase disabled:opacity-50"
                  >
                    <Minus className="w-5 h-5 inline mr-1" /> Abstain
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVote('adapt')}
                    disabled={isPending || userVoteMap.has(selectedMotionId)}
                    className="flex-1 py-3 bg-white hover:bg-ccd-success text-ccd-success hover:text-white border-2 border-ccd-success/30 rounded-2xl font-bold tracking-widest uppercase disabled:opacity-50"
                  >
                    <Check className="w-5 h-5 inline mr-1" /> Adapt
                  </button>
                </div>
              )}
            </section>

            <section className="lg:col-span-5 bg-white rounded-3xl border border-ccd-accent/20 p-6 sm:p-8 space-y-4">
              <h2 className="font-serif text-2xl text-ccd-text">Quick Motion Queue</h2>
              {motions.map((motion) => {
                const motionIsHidden = motion.is_hidden ?? false;

                return (
                  <div key={motion.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setSelectedMotionId(motion.id)}
                      className={`w-full text-left rounded-2xl border p-4 transition-all ${
                        selectedMotionId === motion.id
                          ? 'border-ccd-active bg-ccd-active/5'
                          : 'border-ccd-accent/20 hover:border-ccd-active/40'
                      } ${motionIsHidden ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-widest text-ccd-text-sec">
                          {motion.author_committee || 'Committee Unassigned'}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {motionIsHidden && (
                            <span className="px-2 py-0.5 bg-ccd-neutral/10 text-ccd-neutral text-[9px] font-bold uppercase tracking-widest rounded-full border border-ccd-neutral/20">
                              Hidden
                            </span>
                          )}
                          {isAdmin && (
                            <MotionKebabMenu
                              motionId={motion.id}
                              isHidden={motionIsHidden}
                              onAction={handleMotionAction}
                            />
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-ccd-text font-medium line-clamp-3">{motion.proposed_text || 'No text provided.'}</p>
                      {userVoteMap.has(motion.id) && (
                        <p className="mt-2 text-[11px] uppercase tracking-widest text-ccd-success">You voted: {userVoteMap.get(motion.id)}</p>
                      )}
                    </button>
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {showSubmission && (
          <section className="mt-8 bg-white rounded-3xl border border-ccd-accent/20 p-6 sm:p-8">
            <h2 className="font-serif text-2xl text-ccd-text mb-4">Submit Quick Motion</h2>
            <textarea
              rows={5}
              value={newMotionText}
              onChange={(event) => setNewMotionText(event.target.value)}
              className="w-full p-4 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active resize-none"
              placeholder="Write your quick motion proposal here."
            />
            <button
              type="button"
              onClick={handleSubmitQuickMotion}
              disabled={isPending}
              className="mt-4 px-6 py-3 bg-ccd-text hover:bg-ccd-active text-white rounded-xl font-bold tracking-widest uppercase text-sm disabled:opacity-60"
            >
              {isPending ? 'Submitting...' : 'Submit Quick Motion'}
            </button>
          </section>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirmDialog
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
          isPending={isPending}
        />
      )}
    </div>
  );
}
