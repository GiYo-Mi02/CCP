import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export type Status = 'OPEN' | 'CLOSED' | 'ACTIVE';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'px-[10px] py-[4px] rounded-full text-[10px] font-[800] uppercase tracking-[1px]',
        {
          'bg-[#DCFCE7] text-ccd-success': status === 'OPEN',
          'bg-[#F3F4F6] text-ccd-neutral': status === 'CLOSED',
          'bg-[#FEF3C7] text-ccd-active': status === 'ACTIVE',
        },
        className
      )}
    >
      {status}
    </span>
  );
}
