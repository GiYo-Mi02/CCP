'use client';
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface TimerProps {
  targetDate: Date | null;
  className?: string;
}

export function Timer({ targetDate, className }: TimerProps) {
  const calculateTimeLeft = React.useCallback(() => {
    if (!targetDate) return null;
    const difference = targetDate.getTime() - new Date().getTime();
    return difference > 0 ? difference : 0;
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!targetDate) return;

    // Use a short timeout for the initial set to avoid calling synchronously during mount effect layout
    const initialTimer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 0);

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 100);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [targetDate, calculateTimeLeft]);

  if (!targetDate || timeLeft === null) {
    return (
      <div className={cn("flex items-center gap-2 font-mono text-sm px-3 py-1 rounded-full bg-ccd-surface", className)}>
        <Clock className="w-4 h-4 text-ccd-text-sec" />
        <span>--:--.--</span>
      </div>
    );
  }

  if (timeLeft === 0) {
    return (
      <div className={cn("flex items-center gap-2 font-mono text-sm px-3 py-1 rounded-full bg-ccd-danger/10 text-ccd-danger border border-ccd-danger/20 shadow-sm", className)}>
        <Clock className="w-4 h-4" />
        <span className="font-bold">CLOSED</span>
      </div>
    );
  }
const hours = Math.floor(timeLeft / 1000 / 60 / 60);
  const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);
  const ms = Math.floor((timeLeft % 1000) / 10); // get 2 digits for ms

  const formatTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;

  const isWarning = timeLeft < 5 * 60 * 1000 && timeLeft >= 60 * 1000; // between 1 and 5 minutes
  const isDanger = timeLeft < 60 * 1000; // under 1 minute

  return (
    <div className={cn(
        "flex items-center gap-2 font-mono text-sm sm:text-base px-3 py-1 sm:px-4 sm:py-1.5 rounded-full shadow-sm border transition-colors duration-500",
        {
          'bg-ccd-success/10 text-ccd-success border-ccd-success/20': !isWarning && !isDanger,
          'bg-ccd-warning/10 text-ccd-warning border-ccd-warning/20': isWarning,
          'bg-ccd-danger/10 text-ccd-danger border-ccd-danger/20 animate-pulse': isDanger,
        },
        className
      )}
    >
      <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
      <span className="font-bold tracking-widest">{formatTime}</span>
    </div>
  );
}
