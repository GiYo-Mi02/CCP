'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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

  if (profileRoleResult.error) {
    return null;
  }

  if (!profileRoleResult.data?.role) {
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

  return { supabase };
}

function revalidateElectionPaths() {
  revalidatePath('/admin');
  revalidatePath('/admin/elections');
  revalidatePath('/admin/er');
  revalidatePath('/plencommelec');
}

export async function addElectionPosition(
  electionId: string,
  title: string,
  scope: string
) {
  if (!electionId) {
    return { error: 'Election ID is required.' };
  }

  const normalizedTitle = title.trim();
  const normalizedScope = scope.trim();

  if (!normalizedTitle) {
    return { error: 'Position title is required.' };
  }

  if (!normalizedScope) {
    return { error: 'Position scope is required.' };
  }

  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return { error: adminCheck.error };
  }

  const { supabase } = adminCheck;

  const { error } = await supabase.from('election_positions').insert({
    election_id: electionId,
    title: normalizedTitle,
    scope: normalizedScope,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateElectionPaths();
  return { success: true };
}

export async function removeElectionPosition(positionId: string) {
  if (!positionId) {
    return { error: 'Position ID is required.' };
  }

  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return { error: adminCheck.error };
  }

  const { supabase } = adminCheck;

  const { error } = await supabase
    .from('election_positions')
    .delete()
    .eq('id', positionId);

  if (error) {
    return { error: error.message };
  }

  revalidateElectionPaths();
  return { success: true };
}

export async function addCandidateToPosition(positionId: string, profileId: string) {
  if (!positionId || !profileId) {
    return { error: 'Position and profile are required.' };
  }

  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return { error: adminCheck.error };
  }

  const { supabase } = adminCheck;

  const [{ data: position, error: positionError }, { data: profile, error: profileError }] = await Promise.all([
    supabase
      .from('election_positions')
      .select('id, scope')
      .eq('id', positionId)
      .single(),
    supabase
      .from('profiles')
      .select('id, committee, role')
      .eq('id', profileId)
      .single(),
  ]);

  if (positionError || !position) {
    return { error: positionError?.message ?? 'Position not found.' };
  }

  if (profileError || !profile) {
    return { error: profileError?.message ?? 'Delegate profile not found.' };
  }

  if (profile.role !== 'delegate') {
    return { error: 'Only delegate profiles can be assigned as candidates.' };
  }

  const normalizedScope = position.scope.trim().toLowerCase();
  const delegateCommittee = (profile.committee ?? '').trim().toLowerCase();

  if (
    normalizedScope !== 'plenary' &&
    normalizedScope !== 'committee' &&
    delegateCommittee !== normalizedScope
  ) {
    return {
      error: `Delegate committee mismatch. Position scope is ${position.scope}.`,
    };
  }

  const { error } = await supabase.from('candidates').upsert(
    {
      profile_id: profileId,
      position_id: positionId,
    },
    { onConflict: 'profile_id,position_id' }
  );

  if (error) {
    return { error: error.message };
  }

  revalidateElectionPaths();
  return { success: true };
}

export async function removeCandidate(candidateId: string) {
  if (!candidateId) {
    return { error: 'Candidate ID is required.' };
  }

  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return { error: adminCheck.error };
  }

  const { supabase } = adminCheck;

  const { error } = await supabase.from('candidates').delete().eq('id', candidateId);

  if (error) {
    return { error: error.message };
  }

  revalidateElectionPaths();
  return { success: true };
}
