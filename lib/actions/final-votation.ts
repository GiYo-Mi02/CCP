'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { VoteValue } from '@/lib/types/database';

const FINAL_MOTION_ARTICLE_REF = 'FINAL PAPER';
const FINAL_MOTION_SECTION_REF = 'OVERALL CONCON';
const MAX_PDF_SIZE_BYTES = 8 * 1024 * 1024;

interface FinalMotionVoteRow {
  voter_id: string;
  vote_value: VoteValue;
}

interface FinalMotionRow {
  id: string;
  votes?: FinalMotionVoteRow[];
}

async function resolveUserRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const userRoleResult = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!userRoleResult.error && userRoleResult.data?.role) {
    return String(userRoleResult.data.role);
  }

  const profileRoleResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profileRoleResult.error || !profileRoleResult.data?.role) {
    return null;
  }

  return String(profileRoleResult.data.role);
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated.' as const };
  }

  const role = await resolveUserRole(supabase, user.id);

  if (!role || role.toLowerCase() !== 'admin') {
    return { error: 'Unauthorized: Admin access required.' as const };
  }

  return { supabase, userId: user.id };
}

export async function ensureFinalVotationMotion(
  periodId: string,
  authorId: string
) {
  const supabase = await createClient();

  const { data: existingMotion, error: existingMotionError } = await supabase
    .from('motions')
    .select('id')
    .eq('period_id', periodId)
    .eq('article_ref', FINAL_MOTION_ARTICLE_REF)
    .eq('section_ref', FINAL_MOTION_SECTION_REF)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingMotionError) {
    return { error: existingMotionError.message };
  }

  if (existingMotion?.id) {
    return { data: existingMotion.id };
  }

  const { data: createdMotion, error: createMotionError } = await supabase
    .from('motions')
    .insert({
      period_id: periodId,
      author_id: authorId,
      motion_type: 'quick_motion',
      article_ref: FINAL_MOTION_ARTICLE_REF,
      section_ref: FINAL_MOTION_SECTION_REF,
      original_text: null,
      proposed_text: 'Final Constitutional Paper for Overall ConCon Committees',
      justification: 'Final votation paper uploaded by admin.',
      status: 'pending',
    })
    .select('id')
    .single();

  if (createMotionError || !createdMotion) {
    return { error: createMotionError?.message ?? 'Failed to create final votation motion.' };
  }

  return { data: createdMotion.id };
}

export async function uploadFinalVotationPaper(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return { error: adminCheck.error };
  }

  const { supabase, userId } = adminCheck;

  const periodId = String(formData.get('period_id') ?? '').trim();
  const file = formData.get('paper');

  if (!periodId) {
    return { error: 'Final votation period is required.' };
  }

  if (!(file instanceof File)) {
    return { error: 'PDF file is required.' };
  }

  if (file.size <= 0) {
    return { error: 'Uploaded PDF is empty.' };
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return { error: 'PDF exceeds 8MB upload limit.' };
  }

  const mimeType = file.type || 'application/pdf';
  if (!mimeType.toLowerCase().includes('pdf')) {
    return { error: 'Only PDF uploads are allowed.' };
  }

  const { data: period, error: periodError } = await supabase
    .from('periods')
    .select('id, period_type')
    .eq('id', periodId)
    .single();

  if (periodError || !period) {
    return { error: periodError?.message ?? 'Period not found.' };
  }

  if (period.period_type !== 'final_votation') {
    return { error: 'Selected period is not Final Votation.' };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString('base64');
  const nowIso = new Date().toISOString();

  const { error: upsertError } = await supabase
    .from('final_votation_papers')
    .upsert(
      {
        period_id: period.id,
        file_name: file.name,
        mime_type: mimeType,
        pdf_base64: base64,
        uploaded_by: userId,
        uploaded_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'period_id' }
    );

  if (upsertError) {
    return { error: upsertError.message };
  }

  const ensureMotionResult = await ensureFinalVotationMotion(period.id, userId);
  if (ensureMotionResult.error) {
    return { error: ensureMotionResult.error };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/periods/final');
  revalidatePath('/periods/final');
  revalidatePath('/home');

  return { success: true };
}

export async function getFinalVotationSummary(periodId: string, currentUserId?: string) {
  const supabase = await createClient();

  const [{ data: paper, error: paperError }, { data: motion, error: motionError }] = await Promise.all([
    supabase
      .from('final_votation_papers')
      .select(
        `
        id,
        period_id,
        file_name,
        mime_type,
        pdf_base64,
        uploaded_at,
        uploader:profiles!uploaded_by (full_name)
      `
      )
      .eq('period_id', periodId)
      .maybeSingle(),
    supabase
      .from('motions')
      .select(
        `
        id,
        votes (
          voter_id,
          vote_value
        )
      `
      )
      .eq('period_id', periodId)
      .eq('article_ref', FINAL_MOTION_ARTICLE_REF)
      .eq('section_ref', FINAL_MOTION_SECTION_REF)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (paperError) {
    return { error: paperError.message };
  }

  if (motionError) {
    return { error: motionError.message };
  }

  const votes = ((motion as FinalMotionRow | null)?.votes ?? []) as FinalMotionVoteRow[];

  let approve = 0;
  let reject = 0;
  let abstain = 0;
  let userVote: VoteValue | null = null;

  for (const vote of votes) {
    if (vote.vote_value === 'adapt') approve += 1;
    if (vote.vote_value === 'quash') reject += 1;
    if (vote.vote_value === 'abstain') abstain += 1;

    if (currentUserId && vote.voter_id === currentUserId) {
      userVote = vote.vote_value;
    }
  }

  const uploader = Array.isArray((paper as { uploader?: unknown } | null)?.uploader)
    ? ((paper as { uploader?: Array<{ full_name?: string | null }> }).uploader?.[0] ?? null)
    : ((paper as { uploader?: { full_name?: string | null } | null } | null)?.uploader ?? null);

  return {
    data: {
      paper: paper
        ? {
            id: String((paper as { id: string }).id),
            fileName: String((paper as { file_name: string }).file_name),
            mimeType: String((paper as { mime_type: string }).mime_type),
            pdfBase64: String((paper as { pdf_base64: string }).pdf_base64),
            uploadedAt: String((paper as { uploaded_at: string }).uploaded_at),
            uploaderName: uploader?.full_name ?? null,
          }
        : null,
      motionId: (motion as { id?: string } | null)?.id ?? null,
      aggregate: {
        approve,
        reject,
        abstain,
        total: votes.length,
      },
      userVote,
    },
  };
}
