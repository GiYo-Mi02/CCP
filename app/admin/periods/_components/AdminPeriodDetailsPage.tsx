import Link from 'next/link';
import type { AdminPeriodMotionDetail } from '../_lib/getAdminPeriodDetails';

interface AdminPeriodDetailsPageProps {
  heading: string;
  summary: string;
  sessionName: string;
  state: string;
  deadline: string | null;
  motionDetails: AdminPeriodMotionDetail[];
}

function titleCase(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function VoteList({
  label,
  items,
}: {
  label: string;
  items: AdminPeriodMotionDetail['votes'];
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 mt-2">No voters yet.</p>
      ) : (
        <div className="mt-2 space-y-1 text-sm text-zinc-300">
          {items.map((vote, index) => (
            <p key={`${vote.motion_id}-${vote.cast_at}-${index}`}>
              {vote.voter?.full_name ?? 'Unknown Voter'}
              <span className="text-zinc-500"> | {vote.voter?.college ?? 'Unknown College'} | {vote.voter?.committee ?? 'No committee'}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminPeriodDetailsPage({
  heading,
  summary,
  sessionName,
  state,
  deadline,
  motionDetails,
}: AdminPeriodDetailsPageProps) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 lg:px-12 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Admin Period Review</p>
            <h1 className="font-serif text-4xl mt-2">{heading}</h1>
            <p className="text-zinc-400 mt-2 max-w-3xl">{summary}</p>
            <p className="text-zinc-500 text-sm mt-3">
              Session: {sessionName} | State: {titleCase(state)}
              {deadline ? ` | Deadline: ${new Date(deadline).toLocaleString()}` : ''}
            </p>
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

        {motionDetails.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 text-center text-zinc-400">
            No proposals submitted yet for this period.
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {motionDetails.map(({ motion, votes, counts }) => {
              const quashVotes = votes.filter((vote) => vote.vote_value === 'quash');
              const adaptVotes = votes.filter((vote) => vote.vote_value === 'adapt');
              const abstainVotes = votes.filter((vote) => vote.vote_value === 'abstain');

              return (
                <article key={motion.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-serif text-2xl text-zinc-100">
                        {motion.article_ref || 'Article Unspecified'} - {motion.section_ref || 'Section Unspecified'}
                      </h2>
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mt-1">
                        Submitted by {motion.author?.full_name ?? 'Unknown Author'}
                        {' | '}
                        {motion.author?.committee ?? 'No committee'}
                        {' | '}
                        {new Date(motion.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-300">
                      <p>Status: {titleCase(motion.status)}</p>
                      <p>Total Votes: {counts.total}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">What They Want To Change</p>
                      {motion.proposed_text ? (
                        <p className="text-zinc-200 mt-2 whitespace-pre-wrap">{motion.proposed_text}</p>
                      ) : (
                        <p className="text-zinc-400 mt-2">No proposed text provided.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Original / Target Text</p>
                      {motion.original_text ? (
                        <p className="text-zinc-300 mt-2 whitespace-pre-wrap">{motion.original_text}</p>
                      ) : (
                        <p className="text-zinc-400 mt-2">No original text attached.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Why They Submitted This (Justification)</p>
                    {motion.justification ? (
                      <p className="text-zinc-200 mt-2 whitespace-pre-wrap">{motion.justification}</p>
                    ) : (
                      <p className="text-zinc-400 mt-2">No justification provided by the proposer.</p>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <VoteList label={`Quash Voters (${counts.quash})`} items={quashVotes} />
                    <VoteList label={`Adapt Voters (${counts.adapt})`} items={adaptVotes} />
                    <VoteList label={`Abstain Voters (${counts.abstain})`} items={abstainVotes} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
