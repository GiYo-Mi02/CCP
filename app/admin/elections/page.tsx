import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ElectionCandidateManager } from './ElectionCandidateManager';

export default async function AdminElectionCandidatesPage() {
  const supabase = await createClient();

  const { data: activeSession } = await supabase
    .from('sessions')
    .select('id, name')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .maybeSingle();

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Candidate Management</h1>
        <p className="text-zinc-400 mt-4">No active session found. Start a session from the admin dashboard first.</p>
        <Link href="/admin" className="inline-block mt-6 px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-900">
          Back to Admin
        </Link>
      </div>
    );
  }

  const { data: elections } = await supabase
    .from('elections')
    .select('id, name, status, created_at')
    .eq('session_id', activeSession.id)
    .order('created_at', { ascending: false });

  const election = elections?.find((item) => item.status === 'active') ?? elections?.[0] ?? null;

  if (!election) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Candidate Management</h1>
        <p className="text-zinc-400 mt-4">No election found for the active session. Activate the election period from admin controls first.</p>
        <div className="flex gap-3 mt-6">
          <Link href="/admin" className="inline-block px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-900">
            Back to Admin
          </Link>
          <Link href="/admin/er" className="inline-block px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-900">
            Open ER Monitoring
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: positions }, { data: delegates }] = await Promise.all([
    supabase
      .from('election_positions')
      .select(
        `
        id,
        title,
        scope,
        candidates (
          id,
          profile_id,
          profile:profiles!profile_id (id, full_name, college, committee)
        )
      `
      )
      .eq('election_id', election.id)
      .order('scope', { ascending: true })
      .order('title', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, college, committee, role')
      .eq('role', 'delegate')
      .order('full_name', { ascending: true }),
  ]);

  const delegatePool = (delegates ?? []).map((delegate) => ({
    id: delegate.id,
    full_name: delegate.full_name || 'Unnamed Delegate',
    college: delegate.college || 'Unknown College',
    committee: delegate.committee || '',
  }));

  const positionBlocks = (positions ?? []).map((position) => ({
    id: position.id,
    title: position.title,
    scope: position.scope,
    candidates: (position.candidates ?? []).map((candidate) => {
      const profile = Array.isArray(candidate.profile) ? candidate.profile[0] : candidate.profile;

      return {
        id: candidate.id,
        profile_id: candidate.profile_id,
        profile: profile
          ? {
              id: profile.id,
              full_name: profile.full_name || 'Unnamed Candidate',
              college: profile.college || 'Unknown College',
              committee: profile.committee || '',
            }
          : null,
      };
    }),
  }));

  return (
    <ElectionCandidateManager
      electionId={election.id}
      electionName={election.name}
      electionStatus={election.status}
      delegates={delegatePool}
      positions={positionBlocks}
    />
  );
}
