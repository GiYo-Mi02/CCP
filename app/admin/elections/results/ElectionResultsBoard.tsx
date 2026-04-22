'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';

interface CandidateResult {
  id: string;
  name: string;
  college: string;
  voteCount: number;
}

interface PositionResult {
  id: string;
  title: string;
  scope: string;
  candidates: CandidateResult[];
}

interface ElectionResultsBoardProps {
  electionId: string;
  sessionName: string;
  electionName: string;
  positions: PositionResult[];
}

type SectionFilter = 'all' | 'plenary' | 'committee';

const CHART_COLORS = ['#16A34A', '#DC2626', '#6B7280', '#0EA5E9', '#F59E0B', '#14B8A6', '#8B5CF6', '#F97316'];
const PODIUM_COLORS = {
  top1: '#16A34A',
  top2: '#0EA5E9',
  top3: '#F59E0B',
};

interface ChartEntry {
  label: string;
  value: number;
}

function toScopeLabel(scope: string) {
  const normalized = scope.trim().toLowerCase();

  if (normalized === 'plenary') return 'Plenary';
  if (normalized === 'committee') return 'Committee (Any)';

  return scope;
}

function toCandidateKey(name: string, college: string) {
  return `${name}::${college}`;
}

function totalVotesByPosition(position: PositionResult) {
  return position.candidates.reduce((sum, candidate) => sum + candidate.voteCount, 0);
}

function aggregateSectionCandidates(positionList: PositionResult[]) {
  const map = new Map<string, { label: string; value: number }>();

  for (const position of positionList) {
    for (const candidate of position.candidates) {
      const key = toCandidateKey(candidate.name, candidate.college);
      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          label: `${candidate.name} (${candidate.college})`,
          value: candidate.voteCount,
        });
        continue;
      }

      existing.value += candidate.voteCount;
      map.set(key, existing);
    }
  }

  return Array.from(map.values()).sort((left, right) => right.value - left.value);
}

function VoteDistributionChart({
  title,
  subtitle,
  data,
  totalLabel = 'Total Votes',
}: {
  title: string;
  subtitle?: string;
  data: ChartEntry[];
  totalLabel?: string;
}) {
  const totalVotes = data.reduce((sum, entry) => sum + entry.value, 0);
  const pieData =
    totalVotes === 0
      ? [{ name: 'No Votes Yet', value: 1, color: '#D4D4D8' }]
      : data.map((entry, index) => ({
          name: entry.label,
          value: entry.value,
          color: CHART_COLORS[index % CHART_COLORS.length],
        }));

  return (
    <div className="bg-white rounded-3xl border border-ccd-accent/20 p-5 sm:p-6 shadow-sm">
      <h3 className="font-serif text-2xl text-ccd-text">{title}</h3>
      {subtitle && <p className="text-sm text-ccd-text-sec mt-1">{subtitle}</p>}

      <div className="h-[300px] w-full mt-2 relative">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={82}
              outerRadius={122}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {pieData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value} vote(s)`, 'Votes']} />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-serif text-5xl font-bold text-ccd-text">{totalVotes}</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-ccd-text-sec">{totalLabel}</span>
        </div>
      </div>

      <div className="space-y-2 mt-2">
        {data.length === 0 ? (
          <p className="text-sm text-ccd-text-sec">No votes recorded yet.</p>
        ) : (
          data.map((entry, index) => (
            <div key={entry.label} className="rounded-xl border border-ccd-accent/20 px-3 py-2 text-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-ccd-text min-w-0">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                <span className="truncate">{entry.label}</span>
              </div>
              <span className="font-semibold text-ccd-text">{entry.value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PodiumCandidateChart({
  rank,
  candidate,
  totalVotes,
  color,
}: {
  rank: 1 | 2 | 3;
  candidate: CandidateResult | null;
  totalVotes: number;
  color: string;
}) {
  const name = candidate ? candidate.name : `No #${rank} Candidate`;
  const votes = candidate?.voteCount ?? 0;
  const othersVotes = Math.max(totalVotes - votes, 0);

  const pieData =
    totalVotes === 0
      ? [{ name: 'No Votes Yet', value: 1, color: '#E5E7EB' }]
      : [
          { name: `${name} Votes`, value: votes, color },
          { name: 'Others', value: othersVotes, color: '#E5E7EB' },
        ];

  return (
    <div className="rounded-2xl border border-ccd-accent/20 bg-ccd-surface/20 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-ccd-text-sec">Top {rank}</p>
      <p className="font-semibold text-ccd-text mt-1 truncate">{name}</p>
      <p className="text-xs text-ccd-text-sec mt-1">{candidate ? candidate.college : 'No candidate data'}</p>

      <div className="h-[160px] w-full mt-2 relative">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={62}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {pieData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value} vote(s)`, 'Votes']} />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-serif text-3xl font-bold text-ccd-text">{votes}</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-ccd-text-sec">Votes</span>
        </div>
      </div>
    </div>
  );
}

function PositionResultsCard({ position }: { position: PositionResult }) {
  const sortedCandidates = [...position.candidates].sort((left, right) => right.voteCount - left.voteCount);
  const totalVotes = totalVotesByPosition(position);

  const positionChartData: ChartEntry[] = sortedCandidates.map((candidate) => ({
    label: `${candidate.name} (${candidate.college})`,
    value: candidate.voteCount,
  }));

  const top1 = sortedCandidates[0] ?? null;
  const top2 = sortedCandidates[1] ?? null;
  const top3 = sortedCandidates[2] ?? null;

  return (
    <article className="bg-white rounded-3xl border border-ccd-accent/20 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h4 className="font-serif text-2xl text-ccd-text">{position.title}</h4>
          <p className="text-xs uppercase tracking-[0.2em] text-ccd-text-sec mt-1">Scope: {toScopeLabel(position.scope)}</p>
        </div>
        <div className="rounded-xl border border-ccd-accent/20 px-3 py-2 bg-ccd-bg">
          <p className="text-[10px] uppercase tracking-[0.18em] text-ccd-text-sec">Position Total</p>
          <p className="font-serif text-2xl text-ccd-text">{totalVotes}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7">
          <VoteDistributionChart
            title="Position Vote Distribution"
            subtitle="All candidates for this position"
            data={positionChartData}
          />
        </div>

        <div className="xl:col-span-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:auto-rows-fr">
            <div className="md:row-span-2">
              <PodiumCandidateChart rank={3} candidate={top3} totalVotes={totalVotes} color={PODIUM_COLORS.top3} />
            </div>
            <div>
              <PodiumCandidateChart rank={2} candidate={top2} totalVotes={totalVotes} color={PODIUM_COLORS.top2} />
            </div>
            <div>
              <PodiumCandidateChart rank={1} candidate={top1} totalVotes={totalVotes} color={PODIUM_COLORS.top1} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function SectionBlock({
  title,
  description,
  positions,
}: {
  title: string;
  description: string;
  positions: PositionResult[];
}) {
  const overallData = useMemo(() => aggregateSectionCandidates(positions), [positions]);

  return (
    <section className="mt-8 space-y-6">
      <div>
        <h2 className="font-serif text-4xl text-ccd-text">{title}</h2>
        <p className="text-ccd-text-sec mt-2">{description}</p>
      </div>

      <VoteDistributionChart
        title={`${title} - Overall Votes`}
        subtitle="Combined votes across all candidates in this section"
        data={overallData}
      />

      {positions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-ccd-accent/20 p-8 text-center text-ccd-text-sec shadow-sm">
          No positions found for this section.
        </div>
      ) : (
        positions.map((position) => <PositionResultsCard key={position.id} position={position} />)
      )}
    </section>
  );
}

export function ElectionResultsBoard({ electionId, sessionName, electionName, positions }: ElectionResultsBoardProps) {
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');

  useRealtimeRefresh({
    channelName: `admin-election-results-${electionId}`,
    tables: [
      { table: 'elections', filter: `id=eq.${electionId}` },
      { table: 'election_positions' },
      { table: 'candidates' },
      { table: 'election_votes' },
      { table: 'profiles' },
    ],
  });

  const plenaryPositions = useMemo(
    () => positions.filter((position) => position.scope.trim().toLowerCase() === 'plenary'),
    [positions]
  );

  const committeePositions = useMemo(
    () => positions.filter((position) => position.scope.trim().toLowerCase() !== 'plenary'),
    [positions]
  );

  const showPlenary = sectionFilter === 'all' || sectionFilter === 'plenary';
  const showCommittee = sectionFilter === 'all' || sectionFilter === 'committee';

  return (
    <div className="min-h-screen bg-ccd-bg text-ccd-text px-4 sm:px-8 lg:px-12 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-3xl border border-ccd-accent/20 p-6 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-ccd-text-sec">Admin Election Results</p>
            <h1 className="font-serif text-4xl mt-2">Plenary and Committee Elections Dashboard</h1>
            <p className="text-ccd-text-sec mt-2">Session: {sessionName}</p>
            <p className="text-ccd-text-sec text-sm mt-1">{electionName}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="px-4 py-2 rounded-lg border border-ccd-accent/30 bg-white hover:bg-ccd-surface text-sm">
              Back to Admin
            </Link>
            <Link href="/admin/elections" className="px-4 py-2 rounded-lg border border-ccd-accent/30 bg-white hover:bg-ccd-surface text-sm">
              Candidate Manager
            </Link>
            <Link href="/admin/er" className="px-4 py-2 rounded-lg border border-ccd-accent/30 bg-white hover:bg-ccd-surface text-sm">
              ER Monitor
            </Link>
          </div>
        </div>

        <section className="mt-6 bg-white rounded-3xl border border-ccd-accent/20 p-5 sm:p-6 shadow-sm">
          <label htmlFor="section-filter" className="text-xs uppercase tracking-[0.2em] text-ccd-text-sec block mb-2">
            View Section
          </label>
          <select
            id="section-filter"
            value={sectionFilter}
            onChange={(event) => setSectionFilter(event.target.value as SectionFilter)}
            className="w-full sm:w-[320px] rounded-xl bg-white border border-ccd-accent/30 px-4 py-3 text-ccd-text focus:outline-none focus:ring-2 focus:ring-ccd-active"
          >
            <option value="all">Show Plenary and Committee</option>
            <option value="plenary">Plenary Elections Only</option>
            <option value="committee">Committee Elections Only</option>
          </select>
        </section>

        {showPlenary && (
          <SectionBlock
            title="Plenary Elections Section"
            description="Overall and per-position vote distribution for plenary positions."
            positions={plenaryPositions}
          />
        )}

        {showCommittee && (
          <SectionBlock
            title="Committee Chairs Section"
            description="Overall and per-position vote distribution for committee positions."
            positions={committeePositions}
          />
        )}

        {!showPlenary && !showCommittee && (
          <div className="mt-8 bg-white rounded-3xl border border-ccd-accent/20 p-8 text-center text-ccd-text-sec shadow-sm">
            No section selected.
          </div>
        )}
      </div>
    </div>
  );
}
