import { createClient } from '@/lib/supabase/server';
import type { Period, Session } from '@/lib/types/database';
import { AdminDashboardClient } from './AdminDashboardClient';

type SessionWithPeriods = {
  session: Pick<Session, 'id' | 'name' | 'status'> | null;
  periods: Array<Pick<Period, 'id' | 'period_type' | 'state' | 'deadline' | 'sort_order'>>;
};

async function getAdminDashboardData(): Promise<{
  sessionData: SessionWithPeriods;
  totalMotions: number;
}> {
  const supabase = await createClient();

  const { data: activeSession, error: sessionError } = await supabase
    .from('sessions')
    .select('id, name, status')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .maybeSingle();

  if (sessionError) {
    return {
      sessionData: { session: null, periods: [] },
      totalMotions: 0,
    };
  }

  if (!activeSession) {
    return {
      sessionData: { session: null, periods: [] },
      totalMotions: 0,
    };
  }

  const { data: periods, error: periodsError } = await supabase
    .from('periods')
    .select('id, period_type, state, deadline, sort_order')
    .eq('session_id', activeSession.id)
    .order('sort_order', { ascending: true });

  if (periodsError || !periods) {
    return {
      sessionData: { session: activeSession, periods: [] },
      totalMotions: 0,
    };
  }

  const periodIds = periods.map((period) => period.id);

  let totalMotions = 0;

  if (periodIds.length > 0) {
    const { count } = await supabase
      .from('motions')
      .select('id', { count: 'exact', head: true })
      .in('period_id', periodIds);

    totalMotions = count ?? 0;
  }

  return {
    sessionData: {
      session: activeSession,
      periods,
    },
    totalMotions,
  };
}

export default async function AdminPage() {
  const { sessionData, totalMotions } = await getAdminDashboardData();

  return (
    <AdminDashboardClient
      session={sessionData.session}
      periods={sessionData.periods}
      totalMotions={totalMotions}
    />
  );
}
