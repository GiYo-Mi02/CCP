'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { PeriodState, PeriodType } from '@/lib/types/database';

type AdminStatus = 'OPEN' | 'CLOSED' | 'ACTIVE';

function mapAdminStatusToPeriodState(status: AdminStatus): PeriodState {
  switch (status) {
    case 'OPEN':
      return 'pending';
    case 'CLOSED':
      return 'closed';
    case 'ACTIVE':
      return 'active';
    default:
      return 'pending';
  }
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

  return { supabase, user };
}

const REQUIRED_PERIODS: Array<{ period_type: PeriodType; sort_order: number }> = [
  { period_type: 'election', sort_order: 1 },
  { period_type: 'quash', sort_order: 2 },
  { period_type: 'amendment', sort_order: 3 },
  { period_type: 'insertion', sort_order: 4 },
  { period_type: 'quick_motion', sort_order: 5 },
  { period_type: 'final_votation', sort_order: 6 },
];

const PLENARY_POSITION_TITLES = [
  'Presiding Officer',
  'Deputy P.O.',
  'Secretary General',
  'Deputy S.G.',
  'Majority Floor Leader',
  'Minority Floor Leader',
];

const COMMITTEE_POSITION_TITLES = [
  'Committee Chairperson',
  'Deputy Chairperson',
  'Committee Secretary',
];

const PERIOD_LIFECYCLE: PeriodState[] = [
  'pending',
  'active',
  'votation',
  'results',
  'closed',
];

async function ensureElectionScaffold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  electionId: string
) {
  const { data: delegates, error: delegatesError } = await supabase
    .from('profiles')
    .select('id, committee, role')
    .eq('role', 'delegate');

  if (delegatesError) {
    return { error: delegatesError.message };
  }

  let delegateRows = delegates ?? [];

  if (delegateRows.length === 0) {
    const { data: fallbackProfiles, error: fallbackProfilesError } = await supabase
      .from('profiles')
      .select('id, committee, role');

    if (fallbackProfilesError) {
      return { error: fallbackProfilesError.message };
    }

    delegateRows = fallbackProfiles ?? [];
  }

  const committeeScopes = Array.from(
    new Set(
      delegateRows
        .map((delegate) => delegate.committee?.trim())
        .filter((committee): committee is string => Boolean(committee && committee.length > 0))
    )
  );

  const desiredPositions: Array<{ title: string; scope: string }> = [
    ...PLENARY_POSITION_TITLES.map((title) => ({ title, scope: 'plenary' })),
    ...(committeeScopes.length > 0
      ? committeeScopes.flatMap((scope) =>
          COMMITTEE_POSITION_TITLES.map((title) => ({ title, scope }))
        )
      : COMMITTEE_POSITION_TITLES.map((title) => ({ title, scope: 'committee' }))),
  ];

  const { data: existingPositions, error: positionsError } = await supabase
    .from('election_positions')
    .select('id, title, scope')
    .eq('election_id', electionId);

  if (positionsError) {
    return { error: positionsError.message };
  }

  const existingKeys = new Set(
    (existingPositions ?? []).map((position) => `${position.title}::${position.scope}`)
  );

  const missingPositions = desiredPositions.filter(
    (position) => !existingKeys.has(`${position.title}::${position.scope}`)
  );

  if (missingPositions.length > 0) {
    const { error: insertPositionsError } = await supabase.from('election_positions').insert(
      missingPositions.map((position) => ({
        election_id: electionId,
        title: position.title,
        scope: position.scope,
      }))
    );

    if (insertPositionsError) {
      return { error: insertPositionsError.message };
    }
  }

  const { data: allPositions, error: allPositionsError } = await supabase
    .from('election_positions')
    .select('id, scope')
    .eq('election_id', electionId);

  if (allPositionsError) {
    return { error: allPositionsError.message };
  }

  if (!allPositions || allPositions.length === 0 || delegateRows.length === 0) {
    return { success: true };
  }

  const candidateRows: Array<{ profile_id: string; position_id: string }> = [];

  for (const position of allPositions) {
    let pool =
      position.scope === 'plenary'
        ? delegateRows
        : delegateRows.filter((delegate) => delegate.committee === position.scope);

    if (pool.length === 0) {
      pool = delegateRows;
    }

    for (const delegate of pool) {
      candidateRows.push({ profile_id: delegate.id, position_id: position.id });
    }
  }

  if (candidateRows.length > 0) {
    const { error: candidatesError } = await supabase
      .from('candidates')
      .upsert(candidateRows, { onConflict: 'profile_id,position_id' });

    if (candidatesError) {
      return { error: candidatesError.message };
    }
  }

  return { success: true };
}

async function syncElectionLifecycle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  status: AdminStatus
) {
  if (status === 'ACTIVE') {
    const { data: existingActive, error: existingActiveError } = await supabase
      .from('elections')
      .select('id')
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingActiveError) {
      return { error: existingActiveError.message };
    }

    let electionId = existingActive?.id ?? null;

    if (!electionId) {
      const { data: pendingElection, error: pendingError } = await supabase
        .from('elections')
        .select('id, name')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingError) {
        return { error: pendingError.message };
      }

      if (pendingElection) {
        const { error: activateError } = await supabase
          .from('elections')
          .update({ status: 'active' })
          .eq('id', pendingElection.id);

        if (activateError) {
          return { error: activateError.message };
        }

        electionId = pendingElection.id;
      } else {
        const { data: createdElection, error: createElectionError } = await supabase
          .from('elections')
          .insert({
            session_id: sessionId,
            name: `Plenary & Committee Elections ${new Date().toISOString().slice(0, 10)}`,
            status: 'active',
          })
          .select('id')
          .single();

        if (createElectionError || !createdElection) {
          return { error: createElectionError?.message ?? 'Failed to create election.' };
        }

        electionId = createdElection.id;
      }
    }

    const scaffoldResult = await ensureElectionScaffold(supabase, electionId);
    if ('error' in scaffoldResult) {
      return scaffoldResult;
    }
  }

  if (status === 'CLOSED' || status === 'OPEN') {
    const targetStatus = status === 'CLOSED' ? 'closed' : 'pending';
    const { error: closeError } = await supabase
      .from('elections')
      .update({ status: targetStatus })
      .eq('session_id', sessionId)
      .eq('status', 'active');

    if (closeError) {
      return { error: closeError.message };
    }
  }

  return { success: true };
}

async function syncElectionForPeriodState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  periodState: PeriodState
) {
  if (periodState === 'active') {
    return syncElectionLifecycle(supabase, sessionId, 'ACTIVE');
  }

  if (periodState === 'pending') {
    return syncElectionLifecycle(supabase, sessionId, 'OPEN');
  }

  if (periodState === 'results' || periodState === 'closed') {
    return syncElectionLifecycle(supabase, sessionId, 'CLOSED');
  }

  return { success: true };
}

/**
 * Ensure there is one active session and all required admin periods.
 */
export async function initializeConventionFlow(sessionName?: string) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return { error: adminCheck.error };
  }

  const { supabase } = adminCheck;

  const { data: activeSession, error: activeSessionError } = await supabase
    .from('sessions')
    .select('id, name')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .maybeSingle();

  if (activeSessionError) {
    return { error: activeSessionError.message };
  }

  let sessionId = activeSession?.id ?? null;

  if (!sessionId) {
    const normalizedName = sessionName?.trim();
    const fallbackName = `Convention Session ${new Date().toISOString().slice(0, 10)}`;

    const { data: createdSession, error: createError } = await supabase
      .from('sessions')
      .insert({
        name: normalizedName && normalizedName.length > 0 ? normalizedName : fallbackName,
        status: 'active',
      })
      .select('id')
      .single();

    if (createError || !createdSession) {
      return { error: createError?.message ?? 'Failed to create active session.' };
    }

    sessionId = createdSession.id;
  }

  const { data: existingPeriods, error: existingError } = await supabase
    .from('periods')
    .select('period_type')
    .eq('session_id', sessionId);

  if (existingError) {
    return { error: existingError.message };
  }

  const existingTypes = new Set((existingPeriods ?? []).map((p) => p.period_type as PeriodType));

  const missingPeriods = REQUIRED_PERIODS.filter((period) => !existingTypes.has(period.period_type));

  if (missingPeriods.length > 0) {
    const { error: insertError } = await supabase.from('periods').insert(
      missingPeriods.map((period) => ({
        session_id: sessionId,
        period_type: period.period_type,
        state: 'pending' as const,
        deadline: null,
        sort_order: period.sort_order,
      }))
    );

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath('/admin');
  revalidatePath('/home');
  revalidatePath('/plencommelec');
  revalidatePath('/periods/quash');
  revalidatePath('/periods/amendment');
  revalidatePath('/periods/insertion');
  revalidatePath('/quick-motion');
  revalidatePath('/periods/final');

  return { success: true, sessionId };
}

/**
 * Update period state using admin-friendly status values.
 */
export async function updatePeriodStatus(
  periodId: string,
  status: 'OPEN' | 'CLOSED' | 'ACTIVE',
  durationInMinutes?: number
) {
  if (!periodId) {
    return { error: 'Period ID is required.' };
  }

  let clampedMinutes: number | null = null;
  if (durationInMinutes !== undefined) {
    if (!Number.isFinite(durationInMinutes) || durationInMinutes <= 0) {
      return { error: 'Timer duration must be a positive number.' };
    }

    clampedMinutes = Math.min(durationInMinutes, 720);
  }

  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return { error: adminCheck.error };
  }

  const { supabase } = adminCheck;

  const { data: targetPeriod, error: targetPeriodError } = await supabase
    .from('periods')
    .select('id, session_id, period_type')
    .eq('id', periodId)
    .single();

  if (targetPeriodError || !targetPeriod) {
    return { error: targetPeriodError?.message ?? 'Period not found.' };
  }

  const nextState = mapAdminStatusToPeriodState(status);

  const updatePayload: { state: PeriodState; updated_at: string; deadline?: string | null } = {
    state: nextState,
    updated_at: new Date().toISOString(),
  };

  if (status === 'OPEN' || status === 'CLOSED') {
    updatePayload.deadline = null;
  } else if (status === 'ACTIVE' && clampedMinutes !== null) {
    const deadline = new Date();
    deadline.setMinutes(deadline.getMinutes() + clampedMinutes);
    updatePayload.deadline = deadline.toISOString();
  }

  const { error } = await supabase
    .from('periods')
    .update(updatePayload)
    .eq('id', periodId);

  if (error) {
    return { error: error.message };
  }

  if (targetPeriod.period_type === 'election') {
    const electionSyncResult = await syncElectionLifecycle(
      supabase,
      targetPeriod.session_id,
      status
    );

    if ('error' in electionSyncResult) {
      return electionSyncResult;
    }
  }

  revalidatePath('/admin');
  revalidatePath('/home');
  revalidatePath('/plencommelec');
  revalidatePath('/admin/er');
  revalidatePath('/periods/final');
  return { success: true };
}

/**
 * Set a global countdown timer (minutes) across all votation periods
 * in the currently active session.
 */
export async function setGlobalTimer(durationInMinutes: number) {
  if (!Number.isFinite(durationInMinutes) || durationInMinutes <= 0) {
    return { error: 'Duration must be a positive number.' };
  }

  const clampedMinutes = Math.min(durationInMinutes, 720);

  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return { error: adminCheck.error };
  }

  const { supabase } = adminCheck;

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id')
    .eq('status', 'active')
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  if (!session) {
    return { error: 'No active session found.' };
  }

  const deadline = new Date();
  deadline.setMinutes(deadline.getMinutes() + clampedMinutes);

  const { data: targetPeriods, error: targetError } = await supabase
    .from('periods')
    .select('id')
    .eq('session_id', session.id)
    .eq('state', 'votation');

  if (targetError) {
    return { error: targetError.message };
  }

  if (!targetPeriods || targetPeriods.length === 0) {
    return { error: 'No votation periods are currently active.' };
  }

  const targetIds = targetPeriods.map((p) => p.id);

  const { error: updateError } = await supabase
    .from('periods')
    .update({ deadline: deadline.toISOString() })
    .in('id', targetIds);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath('/admin');
  revalidatePath('/home');
  revalidatePath('/periods/final');
  return { success: true, deadline: deadline.toISOString() };
}

/**
 * Advance a period to its next lifecycle state.
 */
export async function advancePeriodStage(periodId: string) {
  if (!periodId) {
    return { error: 'Period ID is required.' };
  }

  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return { error: adminCheck.error };
  }

  const { supabase } = adminCheck;

  const { data: period, error: periodError } = await supabase
    .from('periods')
    .select('id, session_id, period_type, state')
    .eq('id', periodId)
    .single();

  if (periodError || !period) {
    return { error: periodError?.message ?? 'Period not found.' };
  }

  const currentIndex = PERIOD_LIFECYCLE.indexOf(period.state as PeriodState);
  if (currentIndex < 0) {
    return { error: `Unknown period state: ${period.state}` };
  }

  if (currentIndex >= PERIOD_LIFECYCLE.length - 1) {
    return { error: 'Period is already at the final stage.' };
  }

  const nextState = PERIOD_LIFECYCLE[currentIndex + 1];

  const payload: { state: PeriodState; deadline?: string | null } = {
    state: nextState,
  };

  if (nextState === 'results' || nextState === 'closed') {
    payload.deadline = null;
  }

  const { error: updateError } = await supabase
    .from('periods')
    .update(payload)
    .eq('id', period.id);

  if (updateError) {
    return { error: updateError.message };
  }

  if (period.period_type === 'election') {
    const syncResult = await syncElectionForPeriodState(
      supabase,
      period.session_id,
      nextState
    );

    if ('error' in syncResult) {
      return syncResult;
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/er');
  revalidatePath('/home');
  revalidatePath('/plencommelec');
  revalidatePath('/periods/quash');
  revalidatePath('/periods/amendment');
  revalidatePath('/periods/insertion');
  revalidatePath('/quick-motion');
  revalidatePath('/periods/final');

  return { success: true, nextState };
}

/**
 * Reset votes for a period.
 * - Non-election periods: clears motion votes.
 * - Election period: clears election ballots.
 */
export async function resetPeriodVotes(periodId: string) {
  if (!periodId) {
    return { error: 'Period ID is required.' };
  }

  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) {
    return { error: adminCheck.error };
  }

  const { supabase } = adminCheck;

  const { data: period, error: periodError } = await supabase
    .from('periods')
    .select('id, session_id, period_type')
    .eq('id', periodId)
    .single();

  if (periodError || !period) {
    return { error: periodError?.message ?? 'Period not found.' };
  }

  if (period.period_type === 'election') {
    const { data: election, error: electionError } = await supabase
      .from('elections')
      .select('id')
      .eq('session_id', period.session_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (electionError) {
      return { error: electionError.message };
    }

    if (election) {
      const { data: positions, error: positionsError } = await supabase
        .from('election_positions')
        .select('id')
        .eq('election_id', election.id);

      if (positionsError) {
        return { error: positionsError.message };
      }

      const positionIds = (positions ?? []).map((position) => position.id);
      if (positionIds.length > 0) {
        const { error: deleteElectionVotesError } = await supabase
          .from('election_votes')
          .delete()
          .in('position_id', positionIds);

        if (deleteElectionVotesError) {
          return { error: deleteElectionVotesError.message };
        }
      }
    }
  } else {
    const { data: motions, error: motionsError } = await supabase
      .from('motions')
      .select('id')
      .eq('period_id', period.id);

    if (motionsError) {
      return { error: motionsError.message };
    }

    const motionIds = (motions ?? []).map((motion) => motion.id);
    if (motionIds.length > 0) {
      const { error: deleteVotesError } = await supabase
        .from('votes')
        .delete()
        .in('motion_id', motionIds);

      if (deleteVotesError) {
        return { error: deleteVotesError.message };
      }
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/er');
  revalidatePath('/home');
  revalidatePath('/plencommelec');
  revalidatePath('/periods/quash');
  revalidatePath('/periods/amendment');
  revalidatePath('/periods/insertion');
  revalidatePath('/quick-motion');
  revalidatePath('/periods/final');

  return { success: true };
}
