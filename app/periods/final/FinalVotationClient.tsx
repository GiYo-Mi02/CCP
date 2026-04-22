'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowLeft, Check, Minus, X, FileText } from 'lucide-react';
import { castVote } from '@/lib/actions/votes';
import { TopNav } from '@/components/shared/TopNav';
import { Timer } from '@/components/shared/Timer';
import type { PeriodState, VoteValue } from '@/lib/types/database';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';

interface FinalVotationClientProps {
  delegateName: string;
  delegateAvatarUrl?: string;
  sessionName?: string;
  periodId: string;
  periodState: PeriodState;
  deadline: string | null;
  motionId: string | null;
  paper: {
    fileName: string;
    pdfBase64: string;
    mimeType: string;
    uploadedAt: string;
    uploaderName: string | null;
  } | null;
  aggregate: {
    approve: number;
    reject: number;
    abstain: number;
    total: number;
  };
  userVote: VoteValue | null;
}

export function FinalVotationClient({
  delegateName,
  delegateAvatarUrl,
  sessionName,
  periodId,
  periodState,
  deadline,
  motionId,
  paper,
  aggregate,
  userVote: initialUserVote,
}: FinalVotationClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [userVote, setUserVote] = useState<VoteValue | null>(initialUserVote);

  useRealtimeRefresh({
    channelName: `final-votation-live-${periodId}`,
    tables: [
      { table: 'periods', filter: `id=eq.${periodId}` },
      { table: 'motions', filter: `period_id=eq.${periodId}` },
      { table: 'votes' },
      { table: 'final_votation_papers' },
    ],
  });

  const chartData = [
    { name: 'APPROVE', value: aggregate.approve, color: '#16A34A' },
    { name: 'REJECT', value: aggregate.reject, color: '#DC2626' },
    { name: 'ABSTAIN', value: aggregate.abstain, color: '#6B7280' },
  ];

  const showVoting = periodState === 'votation';
  const showTimer = periodState === 'active' || periodState === 'votation';

  const handleVote = (voteValue: VoteValue) => {
    if (!motionId) {
      setFeedback('No final votation motion found. Ask admin to upload a paper first.');
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await castVote(motionId, voteValue);
      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setUserVote(voteValue);

      const labelMap: Record<VoteValue, string> = {
        adapt: 'APPROVE',
        quash: 'REJECT',
        abstain: 'ABSTAIN',
      };
      setFeedback(`Final votation vote recorded: ${labelMap[voteValue]}.`);
      router.refresh();
    });
  };

  const pdfDataUri = paper ? `data:${paper.mimeType};base64,${paper.pdfBase64}` : null;

  return (
    <div className="min-h-screen bg-ccd-bg pb-20">
      <TopNav
        delegateName={delegateName}
        delegateAvatarUrl={delegateAvatarUrl}
        sessionName={sessionName}
        leftComponent={
          showTimer ? (
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
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ccd-text mb-2">Final Votation</h1>
          <p className="text-ccd-text-sec uppercase tracking-widest text-xs font-bold">Live Database Results</p>
          <div className="mt-5 flex justify-center">
            {showTimer ? (
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

        {/* PDF Document Section */}
        {paper ? (
          <section className="mb-8 bg-white rounded-3xl border border-ccd-accent/20 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-ccd-active" />
              <div>
                <h2 className="font-serif text-2xl text-ccd-text">Final Constitutional Paper</h2>
                <p className="text-xs text-ccd-text-sec mt-1">
                  {paper.fileName} • Uploaded {new Date(paper.uploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {paper.uploaderName ? ` by ${paper.uploaderName}` : ''}
                </p>
              </div>
            </div>

            {pdfDataUri && (
              <div className="rounded-2xl border border-ccd-accent/20 overflow-hidden bg-ccd-surface/20">
                <iframe
                  src={pdfDataUri}
                  title="Final Votation Paper"
                  className="w-full h-[600px] sm:h-[700px]"
                  style={{ border: 'none' }}
                />
              </div>
            )}
          </section>
        ) : (
          <div className="mb-8 bg-white rounded-3xl border border-ccd-accent/20 p-8 text-center text-ccd-text-sec shadow-sm">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="font-serif text-xl text-ccd-text">No Paper Uploaded yet</p>
            <p className="text-sm mt-2">The admin has not uploaded the final constitutional paper. Please wait for the document to become available.</p>
          </div>
        )}

        {/* Voting Section — same layout as Quick Motion */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 bg-white rounded-3xl border border-ccd-accent/20 p-6 sm:p-8">
            <h2 className="font-serif text-2xl text-ccd-text mb-2">Vote Distribution</h2>
            <p className="text-xs uppercase tracking-widest text-ccd-text-sec mb-4">Live Results</p>

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
                <span className="font-serif text-4xl font-bold text-ccd-text">{aggregate.total}</span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-ccd-text-sec">Total Votes</span>
              </div>
            </div>

            {showVoting && motionId && (
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => handleVote('quash')}
                  disabled={isPending || userVote !== null}
                  className="flex-1 py-3 bg-white hover:bg-ccd-danger text-ccd-danger hover:text-white border-2 border-ccd-danger/30 rounded-2xl font-bold tracking-widest uppercase disabled:opacity-50"
                >
                  <X className="w-5 h-5 inline mr-1" /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleVote('abstain')}
                  disabled={isPending || userVote !== null}
                  className="flex-1 py-3 bg-white hover:bg-ccd-neutral text-ccd-neutral hover:text-white border-2 border-ccd-neutral/30 rounded-2xl font-bold tracking-widest uppercase disabled:opacity-50"
                >
                  <Minus className="w-5 h-5 inline mr-1" /> Abstain
                </button>
                <button
                  type="button"
                  onClick={() => handleVote('adapt')}
                  disabled={isPending || userVote !== null}
                  className="flex-1 py-3 bg-white hover:bg-ccd-success text-ccd-success hover:text-white border-2 border-ccd-success/30 rounded-2xl font-bold tracking-widest uppercase disabled:opacity-50"
                >
                  <Check className="w-5 h-5 inline mr-1" /> Approve
                </button>
              </div>
            )}

            {userVote && (
              <p className="mt-4 text-center text-xs uppercase tracking-widest text-ccd-text-sec">
                You voted: {userVote === 'adapt' ? 'Approve' : userVote === 'quash' ? 'Reject' : 'Abstain'}
              </p>
            )}
          </section>

          <section className="lg:col-span-5 bg-white rounded-3xl border border-ccd-accent/20 p-6 sm:p-8 space-y-4">
            <h2 className="font-serif text-2xl text-ccd-text">Vote Summary</h2>
            <p className="text-xs uppercase tracking-widest text-ccd-text-sec">Overall ConCon Committees Paper</p>

            <div className="space-y-3 mt-4">
              <div className="rounded-2xl border border-ccd-success/30 bg-ccd-success/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-ccd-success" />
                  <span className="font-bold text-ccd-text uppercase tracking-widest text-sm">Approve</span>
                </div>
                <span className="font-serif text-2xl font-bold text-ccd-text">{aggregate.approve}</span>
              </div>

              <div className="rounded-2xl border border-ccd-danger/30 bg-ccd-danger/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-ccd-danger" />
                  <span className="font-bold text-ccd-text uppercase tracking-widest text-sm">Reject</span>
                </div>
                <span className="font-serif text-2xl font-bold text-ccd-text">{aggregate.reject}</span>
              </div>

              <div className="rounded-2xl border border-ccd-neutral/30 bg-ccd-neutral/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-ccd-neutral" />
                  <span className="font-bold text-ccd-text uppercase tracking-widest text-sm">Abstain</span>
                </div>
                <span className="font-serif text-2xl font-bold text-ccd-text">{aggregate.abstain}</span>
              </div>

              <div className="rounded-2xl border border-ccd-accent/20 bg-ccd-surface/20 p-4 flex items-center justify-between">
                <span className="font-bold text-ccd-text-sec uppercase tracking-widest text-sm">Total Votes</span>
                <span className="font-serif text-2xl font-bold text-ccd-text">{aggregate.total}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
