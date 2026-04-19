import React from 'react';
import { redirect } from 'next/navigation';
import { TopNav } from '@/components/shared/TopNav';
import { PeriodCard } from '@/components/shared/PeriodCard';
import { Scale, XCircle, PenLine, PlusCircle, Vote } from 'lucide-react';
import { getCurrentProfile } from '@/lib/actions/profile';
import { getActiveSession } from '@/lib/actions/periods';
import type { PeriodType, PeriodState } from '@/lib/types/database';
import type { Status } from '@/components/shared/StatusBadge';

// ─── Helpers to map DB types to UI props ─────────────────────────────

const PERIOD_ICON_MAP: Record<PeriodType, React.ElementType> = {
  election:        Scale,
  quash:           XCircle,
  amendment:       PenLine,
  insertion:       PlusCircle,
  quick_motion:    Vote,
  final_votation:  Vote,
};

const PERIOD_TITLE_MAP: Record<PeriodType, string> = {
  election:        'Plenary & Committee Elections',
  quash:           'Quashing Period',
  amendment:       'Amendment Period',
  insertion:       'Insertion Period',
  quick_motion:    'Quick Motion',
  final_votation:  'Final Votation',
};

const PERIOD_HREF_MAP: Record<PeriodType, string> = {
  election:        '/plencommelec',
  quash:           '/periods/quash',
  amendment:       '/periods/amendment',
  insertion:       '/periods/insertion',
  quick_motion:    '/quick-motion',
  final_votation:  '/periods/final',
};

function mapPeriodStateToStatus(state: PeriodState): Status {
  switch (state) {
    case 'active':
    case 'votation':
      return 'ACTIVE';
    case 'closed':
    case 'results':
      return 'CLOSED';
    default: // 'pending'
      return 'OPEN';
  }
}

// ─── Page (Async Server Component) ───────────────────────────────────

export default async function HomePage() {
  // Fetch data in parallel
  const [profileResult, sessionResult] = await Promise.all([
    getCurrentProfile(),
    getActiveSession(),
  ]);

  // If not authenticated, redirect to login
  if (profileResult.error || !profileResult.data) {
    redirect('/login');
  }

  const profile = profileResult.data;
  const sessionData = sessionResult.data;

  // Map DB periods to PeriodCard props
  const periods = (sessionData?.periods ?? []).map((p: { id: string; period_type: PeriodType; state: PeriodState }) => ({
    id:     p.id,
    title:  PERIOD_TITLE_MAP[p.period_type] ?? p.period_type,
    icon:   PERIOD_ICON_MAP[p.period_type]  ?? Vote,
    status: mapPeriodStateToStatus(p.state),
    href:   PERIOD_HREF_MAP[p.period_type]  ?? '#',
  }));

  return (
    <div className="min-h-screen bg-ccd-bg flex flex-col relative">
      <TopNav 
        delegateName={profile.full_name || 'Delegate'} 
        delegateAvatarUrl={profile.avatar_url ?? undefined} 
        sessionName={sessionData?.session?.name ?? 'No Active Session'}
      />
      
      <main className="flex-1 px-[40px] py-[60px] flex flex-col items-center">
        {periods.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[32px] w-full max-w-[900px] mx-auto">
            {/* Top Row (up to 3) */}
            {periods.slice(0, 3).map((p: { id: string; title: string; icon: React.ElementType; status: Status; href: string }) => (
              <PeriodCard
                key={p.id}
                title={p.title}
                icon={p.icon}
                status={p.status}
                href={p.href}
              />
            ))}
            
            {/* Bottom Row (remaining, centered) */}
            {periods.length > 3 && (
              <div className="md:col-span-3 flex flex-col md:flex-row justify-center gap-[32px]">
                {periods.slice(3).map((p: { id: string; title: string; icon: React.ElementType; status: Status; href: string }) => (
                  <div key={p.id} className="w-full md:w-[calc(33.333%-21px)]">
                    <PeriodCard
                      title={p.title}
                      icon={p.icon}
                      status={p.status}
                      href={p.href}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="font-serif text-2xl text-ccd-text-sec opacity-60">
              No active session at this time.
            </p>
            <p className="text-sm text-ccd-text-sec mt-2 opacity-40">
              Please wait for the administrator to open a session.
            </p>
          </div>
        )}
      </main>

      {/* Bottom Info Footer */}
      <div className="absolute bottom-0 left-0 w-full bg-ccd-text text-ccd-bg px-[40px] py-[12px] flex justify-between items-center text-[12px] z-30">
        <div className="flex items-center gap-[8px] opacity-80">
          <span className="opacity-60">COLLEGE:</span> {profile.college || '—'}
        </div>
        <div className="flex items-center gap-[8px] opacity-80">
          <span className="opacity-60">COMMITTEE:</span> {profile.committee || '—'}
        </div>
        <div className="flex items-center gap-[8px] text-ccd-active font-bold">
          <span className="inline-block w-[8px] h-[8px] rounded-full bg-ccd-active"></span>
          SYSTEM SECURED: AES-256
        </div>
      </div>
    </div>
  );
}
