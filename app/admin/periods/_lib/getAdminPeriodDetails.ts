import { createClient } from '@/lib/supabase/server';
import type { PeriodType, VoteValue } from '@/lib/types/database';

export interface AdminPeriodVoteRow {
  motion_id: string;
  vote_value: VoteValue;
  cast_at: string;
  voter: {
    full_name: string;
    college: string;
    committee: string;
  } | null;
}

export interface AdminPeriodMotionRow {
  id: string;
  article_ref: string;
  section_ref: string;
  original_text: string | null;
  proposed_text: string | null;
  justification: string | null;
  status: string;
  is_hidden: boolean;
  created_at: string;
  author: {
    full_name: string;
    college: string;
    committee: string;
  } | null;
}

export interface AdminPeriodMotionDetail {
  motion: AdminPeriodMotionRow;
  votes: AdminPeriodVoteRow[];
  counts: {
    adapt: number;
    quash: number;
    abstain: number;
    total: number;
  };
}

export interface AdminPeriodDetailsResult {
  session: { id: string; name: string; status: string } | null;
  period: { id: string; state: string; deadline: string | null } | null;
  motionDetails: AdminPeriodMotionDetail[];
}

export async function getAdminPeriodDetails(
  periodType: PeriodType
): Promise<AdminPeriodDetailsResult> {
  const supabase = await createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('id, name, status')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .maybeSingle();

  if (!session) {
    return {
      session: null,
      period: null,
      motionDetails: [],
    };
  }

  const { data: period } = await supabase
    .from('periods')
    .select('id, state, deadline')
    .eq('session_id', session.id)
    .eq('period_type', periodType)
    .maybeSingle();

  if (!period) {
    return {
      session,
      period: null,
      motionDetails: [],
    };
  }

  const { data: motions } = await supabase
    .from('motions')
    .select(
      `
      id,
      article_ref,
      section_ref,
      original_text,
      proposed_text,
      justification,
      status,
      is_hidden,
      created_at,
      author:profiles!author_id (full_name, college, committee)
    `
    )
    .eq('period_id', period.id)
    .order('created_at', { ascending: true });

  const motionRows = (motions ?? []) as unknown as AdminPeriodMotionRow[];
  const motionIds = motionRows.map((motion) => motion.id);

  const { data: voteRows } = motionIds.length
    ? await supabase
        .from('votes')
        .select(
          `
          motion_id,
          vote_value,
          cast_at,
          voter:profiles!voter_id (full_name, college, committee)
        `
        )
        .in('motion_id', motionIds)
        .order('cast_at', { ascending: true })
    : { data: [] };

  const votes = (voteRows ?? []) as unknown as AdminPeriodVoteRow[];
  const voteMap = new Map<string, AdminPeriodVoteRow[]>();

  for (const vote of votes) {
    const existing = voteMap.get(vote.motion_id) ?? [];
    existing.push(vote);
    voteMap.set(vote.motion_id, existing);
  }

  const motionDetails: AdminPeriodMotionDetail[] = motionRows.map((motion) => {
    const motionVotes = voteMap.get(motion.id) ?? [];

    const counts = {
      adapt: motionVotes.filter((vote) => vote.vote_value === 'adapt').length,
      quash: motionVotes.filter((vote) => vote.vote_value === 'quash').length,
      abstain: motionVotes.filter((vote) => vote.vote_value === 'abstain').length,
      total: motionVotes.length,
    };

    return {
      motion,
      votes: motionVotes,
      counts,
    };
  });

  return {
    session,
    period,
    motionDetails,
  };
}
