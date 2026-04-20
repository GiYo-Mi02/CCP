'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Check, Minus } from 'lucide-react';
import { TopNav } from '@/components/shared/TopNav';
import { Timer } from '@/components/shared/Timer';
import { castVote } from '@/lib/actions/votes';
import { submitMotion } from '@/lib/actions/motions';
import type { MotionType, PeriodState, VoteValue } from '@/lib/types/database';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';

export interface PeriodMotionItem {
  id: string;
  article_ref: string;
  section_ref: string;
  original_text: string | null;
  proposed_text: string | null;
  justification: string | null;
  status: string;
  author_name?: string;
  author_committee?: string;
}

export interface PeriodVoteAggregate {
  motion_id: string;
  adapt: number;
  quash: number;
  abstain: number;
  total: number;
}

interface PeriodPageClientProps {
  delegateName: string;
  delegateAvatarUrl?: string;
  sessionName?: string;
  periodId: string;
  periodState: PeriodState;
  deadline: string | null;
  periodTitle: string;
  periodDescription: string;
  motionType: MotionType;
  motions: PeriodMotionItem[];
  voteAggregates: PeriodVoteAggregate[];
  userVotes: Array<{ motion_id: string; vote_value: VoteValue }>;
  allowSubmission?: boolean;
}

function toTitleCase(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function passRate(aggregate: PeriodVoteAggregate) {
  if (aggregate.total === 0) return 0;
  return (aggregate.adapt / aggregate.total) * 100;
}

export function PeriodPageClient({
  delegateName,
  delegateAvatarUrl,
  sessionName,
  periodId,
  periodState,
  deadline,
  periodTitle,
  periodDescription,
  motionType,
  motions,
  voteAggregates,
  userVotes,
  allowSubmission = true,
}: PeriodPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useRealtimeRefresh({
    channelName: `period-live-${periodId}`,
    tables: [
      { table: 'periods', filter: `id=eq.${periodId}` },
      { table: 'motions', filter: `period_id=eq.${periodId}` },
      { table: 'votes' },
    ],
  });

  const aggregateMap = useMemo(() => {
    const map = new Map<string, PeriodVoteAggregate>();
    for (const aggregate of voteAggregates) {
      map.set(aggregate.motion_id, aggregate);
    }
    return map;
  }, [voteAggregates]);

  const userVoteMap = useMemo(() => {
    const map = new Map<string, VoteValue>();
    for (const vote of userVotes) {
      map.set(vote.motion_id, vote.vote_value);
    }
    return map;
  }, [userVotes]);

  const handleCastVote = (motionId: string, voteValue: VoteValue) => {
    setFeedback(null);

    startTransition(async () => {
      const result = await castVote(motionId, voteValue);
      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setFeedback(`Vote recorded: ${toTitleCase(voteValue)}.`);
      router.refresh();
    });
  };

  const handleSubmitMotion = async (formData: FormData) => {
    setFeedback(null);

    formData.set('period_id', periodId);
    formData.set('motion_type', motionType);

    startTransition(async () => {
      const result = await submitMotion(formData);
      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setIsModalOpen(false);
      setFeedback(`${periodTitle} proposal submitted successfully.`);
      router.refresh();
    });
  };

  const showSubmissionState = periodState === 'active';
  const showSubmission = allowSubmission && showSubmissionState;
  const showVoting = periodState === 'votation';
  const showResults = periodState === 'results' || periodState === 'closed';

  return (
    <div className="min-h-screen bg-ccd-bg pb-24">
      <TopNav
        delegateName={delegateName}
        delegateAvatarUrl={delegateAvatarUrl}
        sessionName={sessionName}
        leftComponent={
          showSubmissionState || showVoting ? (
            <Timer targetDate={deadline ? new Date(deadline) : null} className="ml-4" />
          ) : (
            <div className="ml-4 flex items-center gap-2 font-mono text-sm sm:text-base px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-ccd-danger/10 text-ccd-danger border border-ccd-danger/20 shadow-sm">
              <span className="font-bold tracking-widest">CLOSED</span>
            </div>
          )
        }
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-ccd-active text-white font-bold uppercase tracking-widest text-xs rounded-full shadow-md mb-6">
            {periodTitle}
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ccd-text mb-4">{periodTitle}</h1>
          <p className="text-ccd-text-sec max-w-2xl mx-auto">{periodDescription}</p>
          <p className="text-xs uppercase tracking-widest mt-4 text-ccd-text-sec/70">Current State: {toTitleCase(periodState)}</p>
          <div className="mt-5 flex justify-center">
            {showSubmissionState || showVoting ? (
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

        {feedback && (
          <p className="mb-6 text-sm text-ccd-text bg-white border border-ccd-accent/30 rounded-xl px-4 py-3">{feedback}</p>
        )}

        {motions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-ccd-accent/20 p-10 text-center text-ccd-text-sec">
            No motions yet for this period.
          </div>
        ) : (
          <div className="space-y-6">
            {motions.map((motion) => {
              const aggregate =
                aggregateMap.get(motion.id) ??
                ({ motion_id: motion.id, adapt: 0, quash: 0, abstain: 0, total: 0 } as PeriodVoteAggregate);

              const userVote = userVoteMap.get(motion.id) ?? null;

              return (
                <article key={motion.id} className="bg-white rounded-2xl border border-ccd-accent/20 p-6 shadow-sm">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-serif text-2xl text-ccd-text">{motion.article_ref || 'Untitled Article'}</h3>
                      <p className="uppercase tracking-widest text-xs text-ccd-text-sec mt-1">{motion.section_ref || 'Unspecified Section'}</p>
                    </div>
                    <span className="px-3 py-1 bg-ccd-surface rounded-full text-[10px] font-bold uppercase tracking-widest text-ccd-text-sec border border-ccd-accent/20">
                      {motion.author_committee || 'Committee Unassigned'}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3 text-ccd-text">
                    {motion.original_text && (
                      <div className="bg-ccd-danger/5 border border-ccd-danger/20 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-widest font-bold text-ccd-danger mb-2">Original Text</p>
                        <p>{motion.original_text}</p>
                      </div>
                    )}

                    {motion.proposed_text && (
                      <div className="bg-ccd-success/5 border border-ccd-success/20 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-widest font-bold text-ccd-success mb-2">Proposed Text</p>
                        <p>{motion.proposed_text}</p>
                      </div>
                    )}

                    {motion.justification && (
                      <div className="bg-ccd-surface/40 border border-ccd-accent/20 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec mb-2">Justification</p>
                        <p className="text-ccd-text-sec">{motion.justification}</p>
                      </div>
                    )}
                  </div>

                  {(showVoting || showResults) && (
                    <div className="mt-6 border-t border-ccd-accent/20 pt-4">
                      <div className="flex flex-wrap gap-4 text-sm text-ccd-text-sec">
                        <span>Adapt: <strong>{aggregate.adapt}</strong></span>
                        <span>Quash: <strong>{aggregate.quash}</strong></span>
                        <span>Abstain: <strong>{aggregate.abstain}</strong></span>
                        <span>Total: <strong>{aggregate.total}</strong></span>
                        {showResults && <span>Pass Rate: <strong>{passRate(aggregate).toFixed(1)}%</strong></span>}
                      </div>

                      {showVoting && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => handleCastVote(motion.id, 'quash')}
                            disabled={isPending || userVote !== null}
                            className="px-4 py-2 rounded-xl border border-ccd-danger/30 text-ccd-danger hover:bg-ccd-danger hover:text-white font-bold uppercase text-xs tracking-widest disabled:opacity-50"
                          >
                            <X className="w-4 h-4 inline mr-1" /> Quash
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCastVote(motion.id, 'abstain')}
                            disabled={isPending || userVote !== null}
                            className="px-4 py-2 rounded-xl border border-ccd-neutral/30 text-ccd-neutral hover:bg-ccd-neutral hover:text-white font-bold uppercase text-xs tracking-widest disabled:opacity-50"
                          >
                            <Minus className="w-4 h-4 inline mr-1" /> Abstain
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCastVote(motion.id, 'adapt')}
                            disabled={isPending || userVote !== null}
                            className="px-4 py-2 rounded-xl border border-ccd-success/30 text-ccd-success hover:bg-ccd-success hover:text-white font-bold uppercase text-xs tracking-widest disabled:opacity-50"
                          >
                            <Check className="w-4 h-4 inline mr-1" /> Adapt
                          </button>
                          {userVote && (
                            <span className="text-xs uppercase tracking-widest text-ccd-text-sec self-center">You voted: {toTitleCase(userVote)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      {showSubmission && (
        <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-ccd-bg via-ccd-bg/90 to-transparent flex justify-center pb-8 z-40">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full max-w-md py-4 bg-white border-2 border-dashed border-ccd-active hover:bg-ccd-active/5 text-ccd-active rounded-2xl font-bold tracking-widest uppercase text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 group backdrop-blur-md"
          >
            <Plus className="w-5 h-5 group-hover:scale-125 transition-transform" />
            Submit {periodTitle} Proposal
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ccd-text/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form action={handleSubmitMotion} className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-ccd-accent/20 flex justify-between items-center bg-ccd-surface/30">
              <h2 className="font-serif text-2xl font-bold text-ccd-text">Submit {periodTitle} Proposal</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 text-ccd-text-sec hover:text-ccd-danger rounded-full hover:bg-ccd-danger/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec">Article Reference</label>
                  <input name="article_ref" required className="mt-2 w-full p-3 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active" placeholder="Article III" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec">Section Reference</label>
                  <input name="section_ref" required className="mt-2 w-full p-3 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active" placeholder="Section 2" />
                </div>
              </div>

              {motionType !== 'insertion' && (
                <div>
                  <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec">Original Text</label>
                  <textarea name="original_text" rows={4} className="mt-2 w-full p-4 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active resize-none" />
                </div>
              )}

              {motionType !== 'quash' && (
                <div>
                  <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec">Proposed Text</label>
                  <textarea name="proposed_text" rows={4} required className="mt-2 w-full p-4 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active resize-none" />
                </div>
              )}

              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec">Justification</label>
                <textarea name="justification" rows={4} className="mt-2 w-full p-4 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active resize-none" placeholder="Explain the rationale for this proposal." />
              </div>
            </div>

            <div className="p-6 border-t border-ccd-accent/20 bg-ccd-bg/50">
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-4 bg-ccd-text hover:bg-ccd-active text-white rounded-xl font-bold tracking-widest uppercase text-sm transition-colors shadow-lg hover:shadow-ccd-active/20 disabled:opacity-60"
              >
                {isPending ? 'Submitting...' : 'Submit Proposal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
