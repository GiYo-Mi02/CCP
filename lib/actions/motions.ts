'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { MotionType } from '@/lib/types/database';

// ─── Admin guard (self-contained to avoid circular imports) ──────────

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated.' as const };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required.' as const };
  }

  return { supabase, user };
}

// ─── Revalidation helper ─────────────────────────────────────────────

function revalidateMotionPaths() {
  revalidatePath('/admin');
  revalidatePath('/home');
  revalidatePath('/periods/amendment');
  revalidatePath('/periods/insertion');
  revalidatePath('/periods/quash');
  revalidatePath('/quick-motion');
  revalidatePath('/periods');
}

// ─── Submission Actions ──────────────────────────────────────────────

/**
 * Submit a motion (amendment, insertion, quash) to the specified period.
 * Validates that the period is in 'active' state before accepting.
 */
export async function submitMotion(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const periodId      = formData.get('period_id') as string;
  const motionType    = formData.get('motion_type') as MotionType;
  const articleRef    = formData.get('article_ref') as string;
  const sectionRef    = formData.get('section_ref') as string;
  const originalText  = (formData.get('original_text') as string) || null;
  const proposedText  = (formData.get('proposed_text') as string) || null;
  const justification = (formData.get('justification') as string) || null;

  if (!periodId || !motionType) {
    return { error: 'Period ID and motion type are required.' };
  }

  // Verify the period is accepting submissions
  const { data: period } = await supabase
    .from('periods')
    .select('state')
    .eq('id', periodId)
    .single();

  if (!period) {
    return { error: 'Period not found.' };
  }

  if (period.state !== 'active') {
    return { error: 'This period is not currently accepting submissions.' };
  }

  const { error } = await supabase.from('motions').insert({
    period_id: periodId,
    author_id: user.id,
    motion_type: motionType,
    article_ref: articleRef || '',
    section_ref: sectionRef || '',
    original_text: originalText,
    proposed_text: proposedText,
    justification: justification,
  });

  if (error) return { error: error.message };

  revalidatePath('/periods');
  return { success: true };
}

/**
 * Submit a Quick Motion (simplified: no article/section reference).
 * Quick motions are standalone proposals that go directly to vote.
 */
export async function submitQuickMotion(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const periodId     = formData.get('period_id') as string;
  const proposedText = formData.get('proposed_text') as string;

  if (!periodId || !proposedText) {
    return { error: 'Period ID and proposed text are required.' };
  }

  const { error } = await supabase.from('motions').insert({
    period_id: periodId,
    author_id: user.id,
    motion_type: 'quick_motion' as const,
    proposed_text: proposedText,
  });

  if (error) return { error: error.message };

  revalidatePath('/quick-motion');
  return { success: true };
}

// ─── Delete / Hide / Unhide Actions (Admin-Only) ────────────────────

/**
 * Permanently delete a motion and its cascaded votes from the database.
 * Admin-only.
 */
export async function deleteMotion(motionId: string) {
  if (!motionId) return { error: 'Motion ID is required.' };

  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return { error: adminCheck.error };

  const { supabase } = adminCheck;

  const { error } = await supabase
    .from('motions')
    .delete()
    .eq('id', motionId);

  if (error) return { error: error.message };

  revalidateMotionPaths();
  return { success: true };
}

/**
 * Soft-hide a motion. It stays in the database but is not shown to delegates.
 * Admin-only.
 */
export async function hideMotion(motionId: string) {
  if (!motionId) return { error: 'Motion ID is required.' };

  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return { error: adminCheck.error };

  const { supabase } = adminCheck;

  const { error } = await supabase
    .from('motions')
    .update({ is_hidden: true, updated_at: new Date().toISOString() })
    .eq('id', motionId);

  if (error) return { error: error.message };

  revalidateMotionPaths();
  return { success: true };
}

/**
 * Restore a previously hidden motion so it becomes visible to delegates again.
 * Admin-only.
 */
export async function unhideMotion(motionId: string) {
  if (!motionId) return { error: 'Motion ID is required.' };

  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return { error: adminCheck.error };

  const { supabase } = adminCheck;

  const { error } = await supabase
    .from('motions')
    .update({ is_hidden: false, updated_at: new Date().toISOString() })
    .eq('id', motionId);

  if (error) return { error: error.message };

  revalidateMotionPaths();
  return { success: true };
}

// ─── Query Actions ───────────────────────────────────────────────────

/**
 * Fetch all motions for a given period, ordered by creation date.
 * When includeHidden is false (default), hidden motions are filtered out.
 */
export async function getMotionsByPeriod(periodId: string, includeHidden = false) {
  const supabase = await createClient();

  let query = supabase
    .from('motions')
    .select(`
      *,
      author:profiles!author_id (full_name, college, committee)
    `)
    .eq('period_id', periodId);

  if (!includeHidden) {
    query = query.eq('is_hidden', false);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) return { error: error.message };
  return { data };
}

/**
 * Fetch motions and all related votes in a single query.
 * This avoids the common server-component waterfall caused by follow-up vote queries.
 * When includeHidden is false (default), hidden motions are filtered out.
 */
export async function getMotionsWithVotesByPeriod(periodId: string, includeHidden = false) {
  const supabase = await createClient();

  let query = supabase
    .from('motions')
    .select(`
      *,
      author:profiles!author_id (full_name, college, committee),
      votes (
        voter_id,
        vote_value
      )
    `)
    .eq('period_id', periodId);

  if (!includeHidden) {
    query = query.eq('is_hidden', false);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) return { error: error.message };
  return { data };
}

/**
 * Fetch all motions authored by a specific user (for dashboard contributions).
 */
export async function getMotionsByAuthor(authorId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('motions')
    .select(`
      *,
      period:periods!period_id (period_type, state, session_id)
    `)
    .eq('author_id', authorId)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };
  return { data };
}
