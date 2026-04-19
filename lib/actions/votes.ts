'use server';

import { createClient } from '@/lib/supabase/server';
import type { VoteValue } from '@/lib/types/database';

/**
 * Cast a vote on a motion using the atomic `cast_vote` DB function.
 * Prevents double-voting at the database level via UNIQUE constraint.
 * Validates that the parent period is in 'votation' state.
 */
export async function castVote(motionId: string, voteValue: VoteValue) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const { data, error } = await supabase.rpc('cast_vote', {
    p_motion_id: motionId,
    p_voter_id: user.id,
    p_value: voteValue,
  });

  if (error) {
    // Unique constraint violation = already voted
    if (error.code === '23505') {
      return { error: 'You have already voted on this motion.' };
    }
    return { error: error.message };
  }

  return { success: true, voteId: data };
}

/**
 * Get aggregated vote results for a motion.
 * Returns counts and percentages for adapt/quash/abstain.
 */
export async function getMotionResults(motionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_motion_results', {
    p_motion_id: motionId,
  });

  if (error) return { error: error.message };

  // rpc returns an array; we want the single result row
  return { data: data?.[0] ?? null };
}

/**
 * Check if the current user has already voted on a motion.
 * Returns the vote record if found, null otherwise.
 */
export async function getUserVote(motionId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('votes')
    .select('id, vote_value')
    .eq('motion_id', motionId)
    .eq('voter_id', user.id)
    .maybeSingle();

  return data;
}

/**
 * Get all individual votes for a motion (for detailed results view).
 * Includes voter profile information.
 */
export async function getVoteDetails(motionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('votes')
    .select(`
      id,
      vote_value,
      cast_at,
      voter:profiles!voter_id (full_name, college, committee)
    `)
    .eq('motion_id', motionId)
    .order('cast_at', { ascending: true });

  if (error) return { error: error.message };
  return { data };
}
