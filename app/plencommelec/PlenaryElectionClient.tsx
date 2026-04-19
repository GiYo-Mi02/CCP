'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/shared/TopNav';
import { submitElectionVotes } from '@/lib/actions/elections';

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
  electionName: string;
  hasSubmitted: boolean;
  positions: PositionBlock[];
}

export function PlenaryElectionClient({
  delegateName,
  delegateAvatarUrl,
  sessionName,
  electionName,
  hasSubmitted,
  positions,
}: PlenaryElectionClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(hasSubmitted);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const scopes = useMemo(
    () => Array.from(new Set(positions.map((position) => position.scope).filter((scope) => scope !== 'plenary'))),
    [positions]
  );

  const [selectedCommitteeScope, setSelectedCommitteeScope] = useState(scopes[0] ?? 'committee');

  const filteredPositions = useMemo(() => {
    return positions.map((position) => ({
      ...position,
      candidates: position.candidates.filter((candidate) => {
        const needle = searchTerm.toLowerCase();
        return candidate.name.toLowerCase().includes(needle) || candidate.college.toLowerCase().includes(needle);
      }),
    }));
  }, [positions, searchTerm]);

  const plenaryPositions = filteredPositions.filter((position) => position.scope === 'plenary');
  const committeePositions = filteredPositions.filter((position) =>
    position.scope === selectedCommitteeScope || (selectedCommitteeScope === 'committee' && position.scope !== 'plenary')
  );

  const positionsWithoutCandidates = positions.filter((position) => position.candidates.length === 0);
  const requiredPositionIds = positions
    .filter((position) => position.candidates.length > 0)
    .map((position) => position.id);
  const allRequiredSelected = requiredPositionIds.every((positionId) => selections[positionId]);

  const handleSelect = (positionId: string, candidateId: string) => {
    setSelections((prev) => ({ ...prev, [positionId]: candidateId }));
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
            <div className="max-w-md mx-auto mb-8 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-ccd-text-sec opacity-50" />
              </div>
              <input
                type="text"
                placeholder="Search candidates by name or college"
                className="w-full pl-11 pr-4 py-3 bg-white border border-ccd-accent/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ccd-active focus:border-transparent transition-all shadow-sm"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-ccd-accent/20 shadow-sm">
                <h2 className="font-serif text-2xl font-bold text-ccd-text mb-6 border-b border-ccd-accent/20 pb-4">Plenary Positions</h2>

                <div className="space-y-6">
                  {plenaryPositions.map((position) => (
                    <div key={position.id} className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec block">{position.title}</label>
                      <select
                        className="w-full p-4 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active"
                        value={selections[position.id] || ''}
                        onChange={(event) => handleSelect(position.id, event.target.value)}
                      >
                        <option value="" disabled>
                          Select a candidate
                        </option>
                        {position.candidates.map((candidate) => (
                          <option key={`${position.id}-${candidate.id}`} value={candidate.id}>
                            {candidate.name} ({candidate.college})
                          </option>
                        ))}
                        {position.candidates.length === 0 && (
                          <option value="" disabled>
                            No candidates available
                          </option>
                        )}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-ccd-accent/20 shadow-sm h-fit gap-6 flex flex-col">
                <div>
                  <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec block mb-2 mt-1">Assigning Votes For</label>
                  <select
                    className="w-full p-3 bg-ccd-bg font-serif text-lg border border-ccd-accent/40 rounded-xl focus:outline-none font-bold"
                    value={selectedCommitteeScope}
                    onChange={(event) => setSelectedCommitteeScope(event.target.value)}
                  >
                    {scopes.map((scope) => (
                      <option key={scope} value={scope}>
                        {scope}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-ccd-accent/20 w-full mb-2" />

                <h2 className="font-serif text-2xl font-bold text-ccd-text">Committee Positions</h2>

                <div className="space-y-6">
                  {committeePositions.map((position) => (
                    <div key={position.id} className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec block">{position.title}</label>
                      <select
                        className="w-full p-4 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active"
                        value={selections[position.id] || ''}
                        onChange={(event) => handleSelect(position.id, event.target.value)}
                      >
                        <option value="" disabled>
                          Select a candidate
                        </option>
                        {position.candidates.map((candidate) => (
                          <option key={`${position.id}-${candidate.id}`} value={candidate.id}>
                            {candidate.name} ({candidate.college})
                          </option>
                        ))}
                        {position.candidates.length === 0 && (
                          <option value="" disabled>
                            No candidates available
                          </option>
                        )}
                      </select>
                    </div>
                  ))}
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
