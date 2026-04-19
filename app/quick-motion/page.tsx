import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/actions/profile';
import { getActiveSession } from '@/lib/actions/periods';
import { getMotionsWithVotesByPeriod } from '@/lib/actions/motions';
import { QuickMotionClient } from './QuickMotionClient';
import type { VoteValue } from '@/lib/types/database';

interface MotionVoteRow {
  voter_id: string;
  vote_value: VoteValue;
}

interface QuickMotionWithVotesRow {
  id: string;
  article_ref: string;
  section_ref: string;
  proposed_text: string | null;
  author?: {
    full_name?: string | null;
    committee?: string | null;
  } | null;
  votes?: MotionVoteRow[];
}

export default async function QuickMotionPage() {
  const [profileResult, sessionResult] = await Promise.all([
    getCurrentProfile(),
    getActiveSession(),
  ]);

  if (profileResult.error || !profileResult.data) {
    redirect('/login');
  }

  const sessionData = sessionResult.data;

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-ccd-bg flex items-center justify-center px-6">
        <div className="max-w-xl bg-white rounded-2xl border border-ccd-accent/20 p-8 text-center">
          <h1 className="font-serif text-3xl text-ccd-text">No Active Session</h1>
          <p className="text-ccd-text-sec mt-2">Quick motion votation becomes available once the admin activates a session.</p>
        </div>
      </div>
    );
  }

  const period = sessionData.periods.find((item) => item.period_type === 'quick_motion');

  if (!period) {
    return (
      <div className="min-h-screen bg-ccd-bg flex items-center justify-center px-6">
        <div className="max-w-xl bg-white rounded-2xl border border-ccd-accent/20 p-8 text-center">
          <h1 className="font-serif text-3xl text-ccd-text">Quick Motion Period Not Configured</h1>
          <p className="text-ccd-text-sec mt-2">Ask an admin to initialize the convention flow.</p>
        </div>
      </div>
    );
  }

  const motionsResult = await getMotionsWithVotesByPeriod(period.id);
  const rawMotions = (motionsResult.data ?? []) as QuickMotionWithVotesRow[];
  const userId = profileResult.data.id;

  const aggregatesData: Array<{
    motion_id: string;
    adapt: number;
    quash: number;
    abstain: number;
    total: number;
  }> = [];

  const userVotesData: Array<{ motion_id: string; vote_value: VoteValue }> = [];

  const formattedMotions = rawMotions.map((motion) => {
    let adapt = 0;
    let quash = 0;
    let abstain = 0;

    const motionVotes = motion.votes ?? [];

    for (const vote of motionVotes) {
      if (vote.vote_value === 'adapt') adapt += 1;
      if (vote.vote_value === 'quash') quash += 1;
      if (vote.vote_value === 'abstain') abstain += 1;

      if (vote.voter_id === userId) {
        userVotesData.push({ motion_id: motion.id, vote_value: vote.vote_value });
      }
    }

    aggregatesData.push({
      motion_id: motion.id,
      adapt,
      quash,
      abstain,
      total: motionVotes.length,
    });

    return {
      id: motion.id,
      article_ref: motion.article_ref,
      section_ref: motion.section_ref,
      proposed_text: motion.proposed_text,
      author_name: motion.author?.full_name ?? undefined,
      author_committee: motion.author?.committee ?? undefined,
    };
  });

  return (
    <QuickMotionClient
      delegateName={profileResult.data.full_name || 'Delegate'}
      delegateAvatarUrl={profileResult.data.avatar_url ?? undefined}
      sessionName={sessionData.session.name}
      periodId={period.id}
      periodState={period.state}
      deadline={period.deadline}
      motions={formattedMotions}
      voteAggregates={aggregatesData}
      userVotes={userVotesData}
    />
  );
}
