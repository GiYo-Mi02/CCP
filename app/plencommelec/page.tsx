import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/actions/profile';
import { getActiveSession } from '@/lib/actions/periods';
import { getActiveElection, hasUserVotedInElection } from '@/lib/actions/elections';
import { PlenaryElectionClient } from './PlenaryElectionClient';

export default async function PlenaryElectionsPage() {
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
          <p className="text-ccd-text-sec mt-2">Election page becomes available once an active session is started.</p>
        </div>
      </div>
    );
  }

  const electionResult = await getActiveElection(sessionData.session.id);

  if (electionResult.error || !electionResult.data) {
    return (
      <div className="min-h-screen bg-ccd-bg flex items-center justify-center px-6">
        <div className="max-w-xl bg-white rounded-2xl border border-ccd-accent/20 p-8 text-center">
          <h1 className="font-serif text-3xl text-ccd-text">No Active Election</h1>
          <p className="text-ccd-text-sec mt-2">Ask an admin to start the plenary and committee election cycle.</p>
        </div>
      </div>
    );
  }

  const electionPeriod = sessionData.periods.find((period) => period.period_type === 'election');

  const hasVoted = await hasUserVotedInElection(electionResult.data.election.id);

  const positions = (electionResult.data.positions ?? []).map((position) => ({
    id: position.id,
    title: position.title,
    scope: position.scope,
    candidates: (position.candidates ?? []).map((candidate) => {
      const profile = Array.isArray(candidate.profile) ? candidate.profile[0] : candidate.profile;
      return {
        id: candidate.id,
        name: profile?.full_name ?? 'Unnamed Candidate',
        college: profile?.college ?? 'Unknown College',
      };
    }),
  }));

  return (
    <PlenaryElectionClient
      delegateName={profileResult.data.full_name || 'Delegate'}
      delegateAvatarUrl={profileResult.data.avatar_url ?? undefined}
      sessionName={sessionData.session.name}
      periodState={electionPeriod?.state ?? 'pending'}
      deadline={electionPeriod?.deadline ?? null}
      electionId={electionResult.data.election.id}
      electionName={electionResult.data.election.name}
      hasSubmitted={hasVoted}
      positions={positions}
    />
  );
}
