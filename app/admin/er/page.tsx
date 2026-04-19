import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getActiveElection, getElectionVoteSummary } from '@/lib/actions/elections';

type VoteAggregate = {
  adapt: number;
  quash: number;
  abstain: number;
  total: number;
};

function toPeriodName(periodType: string) {
  switch (periodType) {
    case 'election':
      return 'Plenary & Committee Elections';
    case 'quash':
      return 'Quashing Period';
    case 'amendment':
      return 'Amendment Period';
    case 'insertion':
      return 'Insertion Period';
    case 'quick_motion':
      return 'Quick Motion Votation';
    case 'final_votation':
      return 'Final Votation';
    default:
      return periodType;
  }
}

function toAdminReviewRoute(periodType: string) {
  switch (periodType) {
    case 'quash':
      return '/admin/periods/quash';
    case 'amendment':
      return '/admin/periods/amendment';
    case 'insertion':
      return '/admin/periods/insertion';
    case 'quick_motion':
      return '/admin/periods/quick-motion';
    default:
      return null;
  }
}

export default async function AdminERPage() {
  const supabase = await createClient();

  const { data: activeSession } = await supabase
    .from('sessions')
    .select('id, name, status')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .maybeSingle();

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">ER Monitoring</h1>
        <p className="text-zinc-400 mt-4">No active session found. Start a session from the admin panel first.</p>
        <Link href="/admin" className="inline-block mt-6 px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-900">
          Back to Admin
        </Link>
      </div>
    );
  }

  const { data: periods } = await supabase
    .from('periods')
    .select('id, period_type, state, deadline, sort_order')
    .eq('session_id', activeSession.id)
    .order('sort_order', { ascending: true });

  const periodIds = (periods ?? []).map((period) => period.id);

  const { data: motions } = periodIds.length
    ? await supabase
        .from('motions')
        .select('id, period_id, motion_type, article_ref, section_ref, status, author:profiles!author_id(full_name, committee)')
        .in('period_id', periodIds)
    : { data: [] };

  const motionIds = (motions ?? []).map((motion) => motion.id);

  const { data: votes } = motionIds.length
    ? await supabase.from('votes').select('motion_id, vote_value').in('motion_id', motionIds)
    : { data: [] };

  const aggregateMap = new Map<string, VoteAggregate>();
  for (const motionId of motionIds) {
    aggregateMap.set(motionId, { adapt: 0, quash: 0, abstain: 0, total: 0 });
  }

  for (const vote of votes ?? []) {
    const entry = aggregateMap.get(vote.motion_id);
    if (!entry) continue;

    if (vote.vote_value === 'adapt') entry.adapt += 1;
    if (vote.vote_value === 'quash') entry.quash += 1;
    if (vote.vote_value === 'abstain') entry.abstain += 1;
    entry.total += 1;
  }

  const electionResult = await getActiveElection(activeSession.id);
  const electionSummary =
    electionResult.data?.election?.id
      ? await getElectionVoteSummary(electionResult.data.election.id)
      : { data: [] as Array<Record<string, unknown>> };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 lg:px-12 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Admin ER Dashboard</p>
            <h1 className="font-serif text-4xl mt-2">Voting Monitoring</h1>
            <p className="text-zinc-400 mt-2">Session: {activeSession.name}</p>
          </div>
          <Link href="/admin" className="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-900">
            Back to Admin
          </Link>
        </div>

        <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Configured Periods</p>
            <p className="font-serif text-4xl mt-2">{periods?.length ?? 0}</p>
          </article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Total Motions</p>
            <p className="font-serif text-4xl mt-2">{motions?.length ?? 0}</p>
          </article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Total Votes Cast</p>
            <p className="font-serif text-4xl mt-2">{votes?.length ?? 0}</p>
          </article>
        </section>

        <section className="mt-8 space-y-5">
          {(periods ?? []).map((period) => {
            const periodMotions = (motions ?? []).filter((motion) => motion.period_id === period.id);
            const periodVotes = periodMotions.reduce((sum, motion) => sum + (aggregateMap.get(motion.id)?.total ?? 0), 0);

            return (
              <article key={period.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-2xl">{toPeriodName(period.period_type)}</h2>
                    <p className="text-zinc-400 text-sm mt-1">State: {period.state}</p>
                    {period.deadline && <p className="text-zinc-400 text-xs mt-1">Deadline: {new Date(period.deadline).toLocaleString()}</p>}
                    {toAdminReviewRoute(period.period_type) && (
                      <Link
                        href={toAdminReviewRoute(period.period_type) || '/admin'}
                        className="inline-block mt-3 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs uppercase tracking-[0.12em] text-zinc-200 hover:bg-zinc-800"
                      >
                        Open Detailed Review Page
                      </Link>
                    )}
                  </div>
                  <div className="text-sm text-zinc-300">
                    <p>Motions: {periodMotions.length}</p>
                    <p>Votes: {periodVotes}</p>
                  </div>
                </div>

                {periodMotions.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {periodMotions.map((motion) => {
                      const agg = aggregateMap.get(motion.id) ?? { adapt: 0, quash: 0, abstain: 0, total: 0 };
                      const author = Array.isArray(motion.author) ? motion.author[0] : motion.author;

                      return (
                        <div key={motion.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                          <p className="text-sm text-zinc-200 font-semibold">{motion.article_ref || 'Article'} - {motion.section_ref || 'Section'}</p>
                          <p className="text-xs text-zinc-500 mt-1">{motion.motion_type} | {author?.full_name ?? 'Unknown'} | {author?.committee ?? 'No committee'}</p>
                          <div className="mt-2 text-xs text-zinc-400 flex flex-wrap gap-3">
                            <span>Adapt: {agg.adapt}</span>
                            <span>Quash: {agg.quash}</span>
                            <span>Abstain: {agg.abstain}</span>
                            <span>Total: {agg.total}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm mt-4">No motions yet for this period.</p>
                )}
              </article>
            );
          })}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
          <h2 className="font-serif text-2xl">Election Monitoring</h2>
          {!electionResult.data ? (
            <p className="text-zinc-500 mt-3">No active election configured.</p>
          ) : (
            <>
              <p className="text-zinc-400 mt-1">{electionResult.data.election.name}</p>
              <div className="mt-5 space-y-3">
                {(electionSummary.data ?? []).map((position) => {
                  const candidates = (position.candidates ?? []) as Array<Record<string, unknown>>;
                  return (
                    <div key={String(position.id)} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <p className="font-semibold">{String(position.title)}</p>
                      <p className="text-xs text-zinc-500">Scope: {String(position.scope)}</p>
                      <div className="mt-2 space-y-1 text-sm text-zinc-300">
                        {candidates.map((candidate) => {
                          const profile = (candidate.profile as Record<string, unknown>) || {};
                          return (
                            <p key={String(candidate.id)}>
                              {String(profile.full_name ?? 'Candidate')} ({String(profile.college ?? 'Unknown')}) - {Number(candidate.vote_count ?? 0)} vote(s)
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
