import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/actions/profile';
import { getActiveSession } from '@/lib/actions/periods';
import { getMotionsByPeriod } from '@/lib/actions/motions';
import { getUserVotesByMotionIds, getVoteAggregatesByMotionIds } from '@/lib/actions/votes';
import { PeriodPageClient } from '../_components/PeriodPageClient';

export default async function AmendmentPeriodPage() {
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
          <p className="text-ccd-text-sec mt-2">Amendment period will be available once an active session is started by the administration.</p>
        </div>
      </div>
    );
  }

  const period = sessionData.periods.find((item) => item.period_type === 'amendment');

  if (!period) {
    return (
      <div className="min-h-screen bg-ccd-bg flex items-center justify-center px-6">
        <div className="max-w-xl bg-white rounded-2xl border border-ccd-accent/20 p-8 text-center">
          <h1 className="font-serif text-3xl text-ccd-text">Amendment Period Not Configured</h1>
          <p className="text-ccd-text-sec mt-2">Ask an admin to initialize the convention flow.</p>
        </div>
      </div>
    );
  }

  const motionsResult = await getMotionsByPeriod(period.id);
  const motions = motionsResult.data ?? [];

  const motionIds = motions.map((motion) => motion.id);

  const [aggregatesResult, userVotesResult] = await Promise.all([
    getVoteAggregatesByMotionIds(motionIds),
    getUserVotesByMotionIds(motionIds),
  ]);

  return (
    <PeriodPageClient
      delegateName={profileResult.data.full_name || 'Delegate'}
      delegateAvatarUrl={profileResult.data.avatar_url ?? undefined}
      sessionName={sessionData.session.name}
      periodId={period.id}
      periodState={period.state}
      deadline={period.deadline}
      periodTitle="Amendment Period"
      periodDescription="Submit and vote on amendments that modify existing constitutional language."
      motionType="amendment"
      motions={motions.map((motion) => ({
        id: motion.id,
        article_ref: motion.article_ref,
        section_ref: motion.section_ref,
        original_text: motion.original_text,
        proposed_text: motion.proposed_text,
        justification: motion.justification,
        status: motion.status,
        author_name: motion.author?.full_name,
        author_committee: motion.author?.committee,
      }))}
      voteAggregates={aggregatesResult.data ?? []}
      userVotes={userVotesResult.data ?? []}
    />
  );
}
