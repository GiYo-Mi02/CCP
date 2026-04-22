import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/actions/profile';
import { getActiveSession } from '@/lib/actions/periods';
import { getFinalVotationSummary } from '@/lib/actions/final-votation';
import { FinalVotationClient } from './FinalVotationClient';

export default async function FinalVotationPage() {
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
          <p className="text-ccd-text-sec mt-2">Final votation is available once an active session is started.</p>
        </div>
      </div>
    );
  }

  const period = sessionData.periods.find((item) => item.period_type === 'final_votation');

  if (!period) {
    return (
      <div className="min-h-screen bg-ccd-bg flex items-center justify-center px-6">
        <div className="max-w-xl bg-white rounded-2xl border border-ccd-accent/20 p-8 text-center">
          <h1 className="font-serif text-3xl text-ccd-text">Final Votation Not Configured</h1>
          <p className="text-ccd-text-sec mt-2">Ask the admin to initialize or update the session periods.</p>
        </div>
      </div>
    );
  }

  const canAccessPeriod = period.state === 'pending' || period.state === 'active' || period.state === 'votation';
  if (!canAccessPeriod) {
    redirect('/home');
  }

  const summaryResult = await getFinalVotationSummary(period.id, profileResult.data.id);

  const summary = summaryResult.data ?? {
    paper: null,
    motionId: null,
    aggregate: { approve: 0, reject: 0, abstain: 0, total: 0 },
    userVote: null,
  };

  return (
    <FinalVotationClient
      delegateName={profileResult.data.full_name || 'Delegate'}
      delegateAvatarUrl={profileResult.data.avatar_url ?? undefined}
      sessionName={sessionData.session.name}
      periodId={period.id}
      periodState={period.state}
      deadline={period.deadline}
      motionId={summary.motionId}
      paper={summary.paper}
      aggregate={summary.aggregate}
      userVote={summary.userVote}
    />
  );
}
