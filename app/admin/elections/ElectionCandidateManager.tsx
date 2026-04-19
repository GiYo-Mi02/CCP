'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, UserPlus, Search } from 'lucide-react';
import {
  addCandidateToPosition,
  addElectionPosition,
  removeCandidate,
  removeElectionPosition,
} from './actions';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';

interface DelegateOption {
  id: string;
  full_name: string;
  college: string;
  committee: string;
}

interface PositionCandidate {
  id: string;
  profile_id: string;
  profile: {
    id: string;
    full_name: string;
    college: string;
    committee: string;
  } | null;
}

interface PositionBlock {
  id: string;
  title: string;
  scope: string;
  candidates: PositionCandidate[];
}

interface ElectionCandidateManagerProps {
  electionId: string;
  electionName: string;
  electionStatus: string;
  delegates: DelegateOption[];
  positions: PositionBlock[];
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function formatScopeLabel(scope: string) {
  if (scope.toLowerCase() === 'plenary') {
    return 'Plenary';
  }

  if (scope.toLowerCase() === 'committee') {
    return 'Committee (Any)';
  }

  return scope;
}

export function ElectionCandidateManager({
  electionId,
  electionName,
  electionStatus,
  delegates,
  positions,
}: ElectionCandidateManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedByPosition, setSelectedByPosition] = useState<Record<string, string>>({});
  const [newPositionTitle, setNewPositionTitle] = useState('');
  const [newPositionScope, setNewPositionScope] = useState('plenary');

  useRealtimeRefresh({
    channelName: `admin-election-manager-${electionId}`,
    tables: [
      { table: 'elections', filter: `id=eq.${electionId}` },
      { table: 'election_positions' },
      { table: 'candidates' },
      { table: 'election_votes' },
      { table: 'profiles' },
    ],
  });

  const committeeScopes = useMemo(
    () =>
      Array.from(
        new Set(
          delegates
            .map((delegate) => delegate.committee.trim())
            .filter((committee) => committee.length > 0)
        )
      ).sort((left, right) => left.localeCompare(right)),
    [delegates]
  );

  const scopeOptions = useMemo(() => ['plenary', 'committee', ...committeeScopes], [committeeScopes]);

  const filteredDelegates = useMemo(() => {
    const needle = normalizeText(search);
    if (!needle) return delegates;

    return delegates.filter((delegate) => {
      const name = normalizeText(delegate.full_name);
      const college = normalizeText(delegate.college);
      const committee = normalizeText(delegate.committee);
      return name.includes(needle) || college.includes(needle) || committee.includes(needle);
    });
  }, [delegates, search]);

  const groupedPositions = useMemo(() => {
    const groups = new Map<string, PositionBlock[]>();

    for (const position of positions) {
      const key = position.scope || 'committee';
      const current = groups.get(key) ?? [];
      current.push(position);
      groups.set(key, current);
    }

    return Array.from(groups.entries()).sort(([scopeA], [scopeB]) => {
      if (scopeA === 'plenary') return -1;
      if (scopeB === 'plenary') return 1;
      return scopeA.localeCompare(scopeB);
    });
  }, [positions]);

  const optionsForScope = (scope: string) => {
    const normalizedScope = normalizeText(scope);

    if (normalizedScope === 'plenary' || normalizedScope === 'committee') {
      return filteredDelegates;
    }

    return filteredDelegates.filter(
      (delegate) => normalizeText(delegate.committee) === normalizedScope
    );
  };

  const onCreatePosition = () => {
    setFeedback(null);

    startTransition(async () => {
      const result = await addElectionPosition(electionId, newPositionTitle, newPositionScope);

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setNewPositionTitle('');
      setFeedback('Election position created.');
      router.refresh();
    });
  };

  const onAddCandidate = (positionId: string) => {
    const profileId = selectedByPosition[positionId];
    if (!profileId) {
      setFeedback('Select a delegate before adding a candidate.');
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await addCandidateToPosition(positionId, profileId);

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setFeedback('Candidate assigned to position.');
      router.refresh();
    });
  };

  const onRemoveCandidate = (candidateId: string) => {
    if (!window.confirm('Remove this candidate from the position?')) {
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await removeCandidate(candidateId);

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setFeedback('Candidate removed.');
      router.refresh();
    });
  };

  const onDeletePosition = (positionId: string) => {
    if (!window.confirm('Delete this position? Existing candidates and votes for this position will be removed.')) {
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await removeElectionPosition(positionId);

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setFeedback('Position deleted.');
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 lg:px-12 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Admin Election Studio</p>
            <h1 className="font-serif text-4xl mt-2">Candidate Management</h1>
            <p className="text-zinc-400 mt-2">{electionName}</p>
            <p className="text-zinc-500 text-sm mt-1">Status: {electionStatus}</p>
          </div>

          <div className="flex gap-3">
            <Link href="/admin" className="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-900 text-sm">
              Back to Admin
            </Link>
            <Link href="/admin/er" className="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-900 text-sm">
              Open ER Monitoring
            </Link>
          </div>
        </div>

        {feedback && (
          <p className="mt-6 text-sm text-zinc-200 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3">
            {feedback}
          </p>
        )}

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
          <h2 className="font-serif text-2xl">Create Position</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Add new elective positions and assign a scope to keep candidate pools organized.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              value={newPositionTitle}
              onChange={(event) => setNewPositionTitle(event.target.value)}
              placeholder="Position title"
              className="md:col-span-6 rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
            <select
              value={newPositionScope}
              onChange={(event) => setNewPositionScope(event.target.value)}
              className="md:col-span-4 rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            >
              {scopeOptions.map((scope) => (
                <option key={scope} value={scope}>
                  {formatScopeLabel(scope)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onCreatePosition}
              disabled={isPending || !newPositionTitle.trim()}
              className="md:col-span-2 rounded-xl border border-emerald-400/40 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 font-semibold py-3 disabled:opacity-60"
            >
              <Plus className="w-4 h-4 inline mr-1" /> Add
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
          <h2 className="font-serif text-2xl">Delegate Search</h2>
          <div className="mt-4 relative max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-zinc-500" />
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by delegate name, college, or committee"
              className="w-full pl-10 rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
        </section>

        <section className="mt-6 space-y-6">
          {groupedPositions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 text-center text-zinc-400">
              No positions configured yet.
            </div>
          ) : (
            groupedPositions.map(([scope, scopePositions]) => (
              <div key={scope} className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <h3 className="font-serif text-2xl">{formatScopeLabel(scope)}</h3>
                  <p className="text-sm text-zinc-400">{scopePositions.length} position(s)</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {scopePositions.map((position) => {
                    const scopedOptions = optionsForScope(position.scope);

                    return (
                      <article key={position.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-zinc-100">{position.title}</h4>
                            <p className="text-xs text-zinc-500 mt-1">Scope: {position.scope}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onDeletePosition(position.id)}
                            disabled={isPending}
                            className="px-3 py-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-100 text-xs font-semibold disabled:opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Delete
                          </button>
                        </div>

                        <div className="mt-4 space-y-2">
                          {position.candidates.length === 0 ? (
                            <p className="text-sm text-zinc-500">No candidates assigned.</p>
                          ) : (
                            position.candidates.map((candidate) => (
                              <div
                                key={candidate.id}
                                className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 flex items-center justify-between gap-3"
                              >
                                <div className="text-sm text-zinc-300">
                                  <p>{candidate.profile?.full_name ?? 'Unknown Candidate'}</p>
                                  <p className="text-xs text-zinc-500">
                                    {candidate.profile?.college ?? 'Unknown College'} | {candidate.profile?.committee ?? 'No committee'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onRemoveCandidate(candidate.id)}
                                  disabled={isPending}
                                  className="px-2.5 py-1 rounded-md border border-rose-400/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-100 text-xs disabled:opacity-60"
                                >
                                  Remove
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-12 gap-2">
                          <select
                            value={selectedByPosition[position.id] || ''}
                            onChange={(event) =>
                              setSelectedByPosition((prev) => ({
                                ...prev,
                                [position.id]: event.target.value,
                              }))
                            }
                            className="col-span-9 rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                          >
                            <option value="">Select delegate</option>
                            {scopedOptions.map((delegate) => (
                              <option key={`${position.id}-${delegate.id}`} value={delegate.id}>
                                {delegate.full_name} ({delegate.college} | {delegate.committee || 'No committee'})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => onAddCandidate(position.id)}
                            disabled={isPending || !selectedByPosition[position.id]}
                            className="col-span-3 rounded-xl border border-cyan-400/40 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100 text-sm font-semibold disabled:opacity-60"
                          >
                            <UserPlus className="w-4 h-4 inline mr-1" /> Add
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
