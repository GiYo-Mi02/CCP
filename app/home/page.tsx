import React from 'react';
import { TopNav } from '@/components/shared/TopNav';
import { PeriodCard } from '@/components/shared/PeriodCard';
import { Scale, XCircle, PenLine, PlusCircle, Vote } from 'lucide-react';

export default function HomePage() {
  // MOCK DATA - Replace with Supabase calls
  const delegate = {
    name: "Alexander Hamilton",
    avatarUrl: undefined,
  };

  const periods = [
    {
      id: "plenary",
      title: "Plenary & Committee Elections",
      icon: Scale,
      status: "OPEN" as const,
      href: "/plencommelec"
    },
    {
      id: "quash",
      title: "Quashing Period",
      icon: XCircle,
      status: "OPEN" as const,
      href: "/periods/quash"
    },
    {
      id: "amendment",
      title: "Amendment Period",
      icon: PenLine,
      status: "ACTIVE" as const,
      href: "/periods/amendment"
    },
    {
      id: "insertion",
      title: "Insertion Period",
      icon: PlusCircle,
      status: "OPEN" as const,
      href: "/periods/insertion"
    },
    {
      id: "final",
      title: "Final Votation",
      icon: Vote,
      status: "OPEN" as const,
      href: "/periods/final"
    }
  ];

  return (
    <div className="min-h-screen bg-ccd-bg flex flex-col relative">
      <TopNav 
        delegateName={delegate.name} 
        delegateAvatarUrl={delegate.avatarUrl} 
        sessionName="2024 Constitutional Convention • Session IV"
      />
      
      <main className="flex-1 px-[40px] py-[60px] flex flex-col items-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[32px] w-full max-w-[900px] mx-auto">
          {/* Top Row (3) */}
          {periods.slice(0, 3).map((p) => (
            <PeriodCard
              key={p.id}
              title={p.title}
              icon={p.icon}
              status={p.status}
              href={p.href}
            />
          ))}
          
          {/* Bottom Row (2) centered */}
          <div className="md:col-span-3 flex flex-col md:flex-row justify-center gap-[32px]">
            {periods.slice(3, 5).map((p) => (
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
        </div>
      </main>

      {/* Bottom Info Footer matching the design */}
      <div className="absolute bottom-0 left-0 w-full bg-ccd-text text-ccd-bg px-[40px] py-[12px] flex justify-between items-center text-[12px] z-30">
        <div className="flex items-center gap-[8px] opacity-80">
          <span className="opacity-60">COLLEGE:</span> Faculty of Civil Law
        </div>
        <div className="flex items-center gap-[8px] opacity-80">
          <span className="opacity-60">COMMITTEE:</span> Legislative & Judicial Oversight
        </div>
        <div className="flex items-center gap-[8px] text-ccd-active font-bold">
          <span className="inline-block w-[8px] h-[8px] rounded-full bg-ccd-active"></span>
          SYSTEM SECURED: AES-256
        </div>
      </div>
    </div>
  );
}
