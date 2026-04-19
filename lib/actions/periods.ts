'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { PeriodState } from '@/lib/types/database';

/**
 * Admin only: Transition a period to a new state.
 * Optionally sets a deadline timer (in minutes from now).
 *
 * State transitions:
 *   pending → active      (opens submissions, optionally starts timer)
 *   active  → votation    (closes submissions, opens voting, optionally starts timer)
 *   votation → results    (closes voting, clears timer, shows results)
 *   results → closed      (archives the period)
 */
export async function setPeriodState(
  periodId: string,
  newState: PeriodState,
  deadlineMinutes?: number
) {
  const supabase = await createClient();

  // Verify caller is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  // Verify caller is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required.' };
  }

  // Build the update payload
  const update: Record<string, unknown> = {
    state: newState,
    updated_at: new Date().toISOString(),
  };

  // Set deadline when transitioning to active or votation with a timer
  if (deadlineMinutes && (newState === 'active' || newState === 'votation')) {
    const deadline = new Date();
    deadline.setMinutes(deadline.getMinutes() + deadlineMinutes);
    update.deadline = deadline.toISOString();
  }

  // Clear deadline when moving to results or closed
  if (newState === 'results' || newState === 'closed') {
    update.deadline = null;
  }

  const { error } = await supabase
    .from('periods')
    .update(update)
    .eq('id', periodId);

  if (error) return { error: error.message };

  revalidatePath('/home');
  revalidatePath('/periods');
  return { success: true };
}

/**
 * Fetch all periods for a session, ordered by sort_order.
 */
export async function getPeriodsBySession(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('periods')
    .select('*')
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: true });

  if (error) return { error: error.message };
  return { data };
}

/**
 * Fetch the currently active session and its periods.
 */
export async function getActiveSession() {
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('status', 'active')
    .maybeSingle();

  if (sessionError) return { error: sessionError.message };
  if (!session) return { data: null };

  const { data: periods, error: periodsError } = await supabase
    .from('periods')
    .select('*')
    .eq('session_id', session.id)
    .order('sort_order', { ascending: true });

  if (periodsError) return { error: periodsError.message };

  return { data: { session, periods } };
}

/**
 * Fetch a single period by ID with its parent session.
 */
export async function getPeriod(periodId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('periods')
    .select(`
      *,
      session:sessions!session_id (id, name, status)
    `)
    .eq('id', periodId)
    .single();

  if (error) return { error: error.message };
  return { data };
}
