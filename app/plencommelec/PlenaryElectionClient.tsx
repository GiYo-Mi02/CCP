'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/shared/TopNav';
import { Timer } from '@/components/shared/Timer';
import { submitElectionVotes } from '@/lib/actions/elections';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import type { PeriodState } from '@/lib/types/database';

interface CandidateOption {
  id: string;
  name: string;
  college: string;
}

interface PositionBlock {
  id: string;
  title: string;
  scope: string;
  candidates: CandidateOption[];
}

interface PlenaryElectionClientProps {
  delegateName: string;
  delegateAvatarUrl?: string;
  sessionName?: string;
  periodState: PeriodState;
  deadline: string | null;
  electionId: string;
  electionName: string;
  hasSubmitted: boolean;
  positions: PositionBlock[];
}

export function PlenaryElectionClient({
  delegateName,
  delegateAvatarUrl,
  sessionName,
  periodState,
  deadline,
  electionId,
  electionName,
  hasSubmitted,
  positions,
}: PlenaryElectionClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(hasSubmitted);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [positionSearch, setPositionSearch] = useState<Record<string, string>>({});

  useRealtimeRefresh({
    channelName: `election-live-${electionId}`,
    tables: [
      { table: 'elections', filter: `id=eq.${electionId}` },
      { table: 'election_positions' },
      { table: 'candidates' },
      { table: 'election_votes' },
      { table: 'periods' },
    ],
  });

  const plenaryPositions = useMemo(
    () => positions.filter((position) => position.scope === 'plenary'),
    [positions]
  );

  const committeeGroups = useMemo(() => {
    const grouped = new Map<string, PositionBlock[]>();

    for (const position of positions) {
      if (position.scope === 'plenary') {
        continue;
      }

      const key = position.scope || 'committee';
      const existing = grouped.get(key) ?? [];
      existing.push(position);
      grouped.set(key, existing);
    }

    return Array.from(grouped.entries()).sort(([scopeA], [scopeB]) => scopeA.localeCompare(scopeB));
  }, [positions]);

  const positionsWithoutCandidates = positions.filter((position) => position.candidates.length === 0);
  const requiredPositionIds = positions
    .filter((position) => position.candidates.length > 0)
    .map((position) => position.id);
  const allRequiredSelected = requiredPositionIds.every((positionId) => selections[positionId]);
  const showElectionTimer = periodState === 'active' || periodState === 'votation';

  const handleSelect = (positionId: string, candidateId: string) => {
    setSelections((prev) => ({ ...prev, [positionId]: candidateId }));
  };

  const formatCandidateOption = (candidate: CandidateOption) => {
    return `${candidate.name} (${candidate.college})`;
  };

  const handleAutocompleteInput = (position: PositionBlock, value: string) => {
    setPositionSearch((prev) => ({
      ...prev,
      [position.id]: value,
    }));

    const matched = position.candidates.find(
      (candidate) => formatCandidateOption(candidate).toLowerCase() === value.trim().toLowerCase()
    );

    if (matched) {
      handleSelect(position.id, matched.id);
      return;
    }

    setSelections((prev) => {
      if (!prev[position.id]) {
        return prev;
      }

      const next = { ...prev };
      delete next[position.id];
      return next;
    });
  };

  const getSelectionLabel = (position: PositionBlock) => {
    const selectedId = selections[position.id];
    if (!selectedId) {
      return null;
    }

    const selectedCandidate = position.candidates.find((candidate) => candidate.id === selectedId);
    if (!selectedCandidate) {
      return null;
    }

    return formatCandidateOption(selectedCandidate);
  };

  const renderPositionAutocomplete = (position: PositionBlock) => {
    const datalistId = `position-candidates-${position.id}`;
    const selectedLabel = getSelectionLabel(position);

    return (
      <div key={position.id} className="space-y-2">
        <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec block">{position.title}</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-ccd-text-sec opacity-60" />
          </div>
          <input
            type="search"
            list={datalistId}
            placeholder={`Search ${position.title}`}
            className="w-full pl-10 pr-3 py-2.5 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active"
            value={positionSearch[position.id] ?? ''}
            onChange={(event) => handleAutocompleteInput(position, event.target.value)}
          />
          <datalist id={datalistId}>
            {position.candidates.map((candidate) => (
              <option key={`${position.id}-${candidate.id}`} value={formatCandidateOption(candidate)} />
            ))}
          </datalist>
        </div>

        {position.candidates.length === 0 ? (
          <p className="text-xs text-ccd-text-sec">No candidates available</p>
        ) : selectedLabel ? (
          <p className="text-xs text-ccd-active font-semibold">Selected: {selectedLabel}</p>
        ) : (
          <p className="text-xs text-ccd-text-sec">Start typing and choose from autocomplete suggestions.</p>
        )}
      </div>
    );
  };

  const handleSubmit = () => {
    setFeedback(null);

    startTransition(async () => {
      const result = await submitElectionVotes(selections);
      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setIsSubmitted(true);
      setFeedback('Election votes submitted successfully.');
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-ccd-bg pb-24">
      <TopNav delegateName={delegateName} delegateAvatarUrl={delegateAvatarUrl} sessionName={sessionName} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ccd-text mb-4">Plenary & Committee Elections</h1>
          <p className="text-ccd-text-sec max-w-2xl mx-auto">{electionName}</p>
          <div className="mt-5 flex justify-center">
            {showElectionTimer ? (
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

        {feedback && <p className="max-w-3xl mx-auto mb-6 text-sm bg-white border border-ccd-accent/30 rounded-xl px-4 py-3">{feedback}</p>}

        {positionsWithoutCandidates.length > 0 && (
          <p className="max-w-3xl mx-auto mb-6 text-sm bg-ccd-warning/10 border border-ccd-warning/30 rounded-xl px-4 py-3 text-ccd-text">
            Some positions have no candidates yet. Add candidate profiles to enable full voting.
          </p>
        )}

        {isSubmitted ? (
          <div className="max-w-md mx-auto bg-white p-10 rounded-3xl border border-ccd-success/30 shadow-xl text-center">
            <div className="mx-auto w-20 h-20 bg-ccd-success/20 rounded-full flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-ccd-success" />
            </div>
            <h2 className="font-serif text-3xl font-bold text-ccd-text mb-2">Votes Recorded</h2>
            <p className="text-ccd-text-sec">Your electoral votes have been submitted to the database.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-ccd-accent/20 shadow-sm">
                <h2 className="font-serif text-2xl font-bold text-ccd-text mb-6 border-b border-ccd-accent/20 pb-4">Plenary Positions</h2>

                <div className="space-y-6">
                  {plenaryPositions.map((position) => renderPositionAutocomplete(position))}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-ccd-accent/20 shadow-sm h-fit gap-6 flex flex-col">
                <h2 className="font-serif text-2xl font-bold text-ccd-text">Committee Positions</h2>

                <div className="space-y-6">
                  {committeeGroups.length === 0 ? (
                    <p className="text-sm text-ccd-text-sec">No committee positions available.</p>
                  ) : (
                    committeeGroups.map(([scope, scopePositions]) => (
                      <div key={scope} className="space-y-4">
                        <h3 className="text-sm uppercase tracking-[0.18em] font-bold text-ccd-text-sec border-b border-ccd-accent/20 pb-2">
                          {scope}
                        </h3>

                        {scopePositions.map((position) => (
                          renderPositionAutocomplete(position)
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="md:col-span-2 mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!allRequiredSelected || isPending || positionsWithoutCandidates.length > 0}
                  className="w-full max-w-md py-5 bg-ccd-text hover:bg-ccd-active text-white rounded-2xl font-bold tracking-widest uppercase text-lg transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Submitting...' : 'Submit Electoral Votes'}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
