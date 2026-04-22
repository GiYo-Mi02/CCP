import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getActiveElection, getElectionVoteSummary } from '@/lib/actions/elections';
import { ElectionResultsBoard } from './ElectionResultsBoard';

interface PositionCandidateResult {
  id: string;
  name: string;
  college: string;
  voteCount: number;
}

interface PositionResult {
  id: string;
  title: string;
  scope: string;
  candidates: PositionCandidateResult[];
}

export default async function AdminElectionResultsPage() {
  const supabase = await createClient();

  const { data: activeSession } = await supabase
    .from('sessions')
    .select('id, name')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .maybeSingle();

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-ccd-bg text-ccd-text p-8">
        <h1 className="font-serif text-4xl">Election Results Board</h1>
        <p className="text-ccd-text-sec mt-4">No active session found. Start a session from the admin dashboard first.</p>
        <div className="flex gap-3 mt-6">
          <Link href="/admin" className="inline-block px-4 py-2 rounded-lg border border-ccd-accent/30 bg-white hover:bg-ccd-surface">
            Back to Admin
          </Link>
          <Link href="/admin/er" className="inline-block px-4 py-2 rounded-lg border border-ccd-accent/30 bg-white hover:bg-ccd-surface">
            Open ER Monitoring
          </Link>
        </div>
      </div>
    );
  }

  const electionResult = await getActiveElection(activeSession.id);

  const { data: latestElection } = await supabase
    .from('elections')
    .select('id, name, status')
    .eq('session_id', activeSession.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const resolvedElection = electionResult.data?.election ?? latestElection;

  if (electionResult.error || !resolvedElection) {
    return (
      <div className="min-h-screen bg-ccd-bg text-ccd-text p-8">
        <h1 className="font-serif text-4xl">Election Results Board</h1>
        <p className="text-ccd-text-sec mt-4">No election found for the active session.</p>
        <div className="flex gap-3 mt-6">
          <Link href="/admin/elections" className="inline-block px-4 py-2 rounded-lg border border-ccd-accent/30 bg-white hover:bg-ccd-surface">
            Candidate Manager
          </Link>
          <Link href="/admin/er" className="inline-block px-4 py-2 rounded-lg border border-ccd-accent/30 bg-white hover:bg-ccd-surface">
            Open ER Monitoring
          </Link>
        </div>
      </div>
    );
  }

  const summaryResult = await getElectionVoteSummary(resolvedElection.id);

  if (summaryResult.error) {
    return (
      <div className="min-h-screen bg-ccd-bg text-ccd-text p-8">
        <h1 className="font-serif text-4xl">Election Results Board</h1>
        <p className="text-ccd-text-sec mt-4">{summaryResult.error}</p>
        <div className="flex gap-3 mt-6">
          <Link href="/admin/elections" className="inline-block px-4 py-2 rounded-lg border border-ccd-accent/30 bg-white hover:bg-ccd-surface">
            Candidate Manager
          </Link>
          <Link href="/admin/er" className="inline-block px-4 py-2 rounded-lg border border-ccd-accent/30 bg-white hover:bg-ccd-surface">
            Open ER Monitoring
          </Link>
        </div>
      </div>
    );
  }

  const positions: PositionResult[] = ((summaryResult.data ?? []) as Array<Record<string, unknown>>).map((position) => {
    const candidates = ((position.candidates ?? []) as Array<Record<string, unknown>>)
      .map((candidate) => {
        const profileRaw = candidate.profile as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
        const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;

        return {
          id: String(candidate.id ?? ''),
          name: String(profile?.full_name ?? 'Candidate'),
          college: String(profile?.college ?? 'Unknown College'),
          voteCount: Number(candidate.vote_count ?? 0),
        };
      })
      .sort((left, right) => right.voteCount - left.voteCount);

    return {
      id: String(position.id ?? ''),
      title: String(position.title ?? 'Untitled Position'),
      scope: String(position.scope ?? 'committee'),
      candidates,
    };
  });

  return (
    <ElectionResultsBoard
      electionId={resolvedElection.id}
      sessionName={activeSession.name}
      electionName={resolvedElection.name}
      positions={positions}
    />
  );
}
