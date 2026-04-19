'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Submit election votes for all positions.
 * Accepts a map of { positionId: candidateId } entries.
 * Each vote is inserted individually with a UNIQUE constraint per voter+position.
 */
export async function submitElectionVotes(
  votes: Record<string, string> // { [positionId]: candidateId }
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const entries = Object.entries(votes);
  if (entries.length === 0) {
    return { error: 'No votes provided.' };
  }

  // Build the rows to insert
  const rows = entries.map(([positionId, candidateId]) => ({
    voter_id: user.id,
    position_id: positionId,
    candidate_id: candidateId,
  }));

  const { error } = await supabase
    .from('election_votes')
    .insert(rows);

  if (error) {
    // Unique constraint means they already voted for some position
    if (error.code === '23505') {
      return { error: 'You have already submitted votes for one or more positions.' };
    }
    return { error: error.message };
  }

  revalidatePath('/plencommelec');
  return { success: true };
}

/**
 * Fetch the active election for the current session, with positions and candidates.
 */
export async function getActiveElection(sessionId: string) {
  const supabase = await createClient();

  const { data: election, error: electionError } = await supabase
    .from('elections')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .maybeSingle();

  if (electionError) return { error: electionError.message };
  if (!election) return { data: null };

  // Fetch positions with candidates (including their profile info)
  const { data: positions, error: positionsError } = await supabase
    .from('election_positions')
    .select(`
      id,
      title,
      scope,
      candidates (
        id,
        profile:profiles!profile_id (id, full_name, college, avatar_url)
      )
    `)
    .eq('election_id', election.id)
    .order('title', { ascending: true });

  if (positionsError) return { error: positionsError.message };

  return { data: { election, positions } };
}

/**
 * Check if the current user has already submitted election votes.
 */
export async function hasUserVotedInElection(electionId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: positions, error: positionsError } = await supabase
    .from('election_positions')
    .select('id')
    .eq('election_id', electionId);

  if (positionsError || !positions || positions.length === 0) return false;

  const positionIds = positions.map((position) => position.id);

  const { data } = await supabase
    .from('election_votes')
    .select('id')
    .eq('voter_id', user.id)
    .in('position_id', positionIds)
    .limit(1);

  if (!data || data.length === 0) return false;
  return true;
}

/**
 * Admin: Aggregate election vote totals per candidate.
 */
export async function getElectionVoteSummary(electionId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required.' };
  }

  const { data: positions, error } = await supabase
    .from('election_positions')
    .select(
      `
      id,
      title,
      scope,
      candidates (
        id,
        profile:profiles!profile_id (id, full_name, college),
        votes:election_votes!candidate_id (id)
      )
    `
    )
    .eq('election_id', electionId)
    .order('title', { ascending: true });

  if (error) return { error: error.message };

  const data = (positions ?? []).map((position) => {
    const candidates = (position.candidates ?? []).map((candidate: Record<string, unknown>) => {
      const votes = Array.isArray(candidate.votes) ? candidate.votes : [];
      return {
        ...candidate,
        vote_count: votes.length,
      };
    });

    return {
      ...position,
      candidates,
    };
  });

  return { data };
}

/**
 * Admin: Get election results (vote counts per candidate per position).
 */
export async function getElectionResults(electionId: string) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required.' };
  }

  const { data: positions, error } = await supabase
    .from('election_positions')
    .select(`
      id,
      title,
      scope,
      candidates (
        id,
        profile:profiles!profile_id (full_name, college),
        votes:election_votes!candidate_id (id)
      )
    `)
    .eq('election_id', electionId);

  if (error) return { error: error.message };

  // Transform to include vote counts
  const results = positions?.map(pos => ({
    ...pos,
    candidates: pos.candidates?.map((c: Record<string, unknown>) => ({
      ...c,
      vote_count: Array.isArray(c.votes) ? c.votes.length : 0,
    })),
  }));

  return { data: results };
}
