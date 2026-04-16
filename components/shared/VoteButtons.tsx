'use client';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface VoteButtonsProps {
  onVote: (vote: 'QUASH' | 'ADAPT') => void;
  className?: string;
}

export function VoteButtons({ onVote, className }: VoteButtonsProps) {
  const [hasVoted, setHasVoted] = useState(false);
  const [voteType, setVoteType] = useState<'QUASH' | 'ADAPT' | null>(null);

  // In a real implementation this would use a dialog/modal component,
  // Using native confirm for this scaffolding
  const handleVote = (vote: 'QUASH' | 'ADAPT') => {
    if (hasVoted) return;
    
    if (window.confirm(`Confirm your vote: ${vote}?`)) {
      setVoteType(vote);
      setHasVoted(true);
      onVote(vote);
    }
  };

  if (hasVoted) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 min-w-[120px]", className)}>
        <span className="text-xs uppercase tracking-widest font-semibold text-ccd-text-sec">You voted</span>
        <div className={cn(
          "px-4 py-2 rounded-full font-bold text-sm shadow-sm flex items-center gap-2",
          voteType === 'ADAPT' ? "bg-ccd-success/10 text-ccd-success border border-ccd-success/20" : "bg-ccd-danger/10 text-ccd-danger border border-ccd-danger/20"
        )}>
          {voteType === 'ADAPT' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {voteType}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3 items-center", className)}>
      <button 
        onClick={() => handleVote('QUASH')}
        disabled={hasVoted}
        className="min-w-[100px] flex-1 px-4 py-2 bg-ccd-surface hover:bg-ccd-danger text-ccd-danger hover:text-white border border-ccd-danger/20 rounded-full font-bold text-sm tracking-widest uppercase transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <span className="flex items-center justify-center gap-2">
          <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
          Quash
        </span>
      </button>
      
      <button 
        onClick={() => handleVote('ADAPT')}
        disabled={hasVoted}
        className="min-w-[100px] flex-1 px-4 py-2 bg-ccd-surface hover:bg-ccd-success text-ccd-success hover:text-white border border-ccd-success/20 rounded-full font-bold text-sm tracking-widest uppercase transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <span className="flex items-center justify-center gap-2">
          <Check className="w-4 h-4 group-hover:scale-110 transition-transform" />
          Adapt
        </span>
      </button>
    </div>
  );
}
