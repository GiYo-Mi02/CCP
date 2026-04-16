import React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { StatusBadge, Status } from './StatusBadge';
import { cn } from '@/lib/utils';

interface PeriodCardProps {
  title: string;
  icon: React.ElementType;
  status: Status;
  href: string;
}

export function PeriodCard({ title, icon: Icon, status, href }: PeriodCardProps) {
  const isClosed = status === 'CLOSED';
  const Wrapper = isClosed ? 'div' : Link;

  return (
    <Wrapper
      href={href}
      className={cn(
        "group relative flex flex-col items-center justify-center text-center p-[32px_24px] bg-ccd-surface rounded-[16px] border border-transparent transition-all duration-200 shadow-[0_8px_24px_rgba(44,24,16,0.05)]",
        isClosed 
          ? "opacity-60 cursor-not-allowed" 
          : "cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(44,24,16,0.1)] hover:border-ccd-accent",
        status === 'ACTIVE' && "border-2 border-ccd-active shadow-[0_0_20px_rgba(139,105,20,0.2)]"
      )}
    >
      {status === 'ACTIVE' && (
        <div className="absolute -inset-[2px] rounded-[16px] border-2 border-ccd-active animate-[pulse_2s_infinite] pointer-events-none" />
      )}
      
      <div className="w-[56px] h-[56px] mb-[20px] text-ccd-active flex items-center justify-center">
        <Icon className="w-full h-full" strokeWidth={1.5} />
      </div>

      <h3 className="font-serif text-[16px] font-bold text-ccd-text leading-[1.2] mb-[12px]">
        {title}
      </h3>
      
      <StatusBadge status={status} />

      {isClosed && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-ccd-surface/90 p-3 rounded-full shadow-sm backdrop-blur-md">
          <Lock className="w-6 h-6 text-ccd-neutral" />
        </div>
      )}
    </Wrapper>
  );
}
