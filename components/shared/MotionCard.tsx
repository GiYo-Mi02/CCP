'use client';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { VoteButtons } from './VoteButtons';

interface MotionCardProps {
  id: string;
  articleRef: string;
  sectionRef: string;
  originalText?: string;
  proposedText?: string;
  type: 'QUASH' | 'AMENDMENT' | 'INSERTION';
  committee: string;
  isVotationState?: boolean;
  isResultsState?: boolean;
  passPercentage?: number; // 0-100
}

export function MotionCard({ 
  articleRef, 
  sectionRef, 
  originalText, 
  proposedText, 
  type, 
  committee,
  isVotationState = false,
  isResultsState = false,
  passPercentage = 0
}: MotionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getPreviewText = () => {
    if (type === 'QUASH') return originalText;
    return proposedText;
  };

  const preview = getPreviewText();
  const isTruncated = preview && preview.length > 120;
  
  const passed = passPercentage >= 50;

  return (
    <div className={cn(
      "w-full bg-white rounded-2xl border border-ccd-accent/20 shadow-sm transition-all overflow-hidden relative group",
      isVotationState && "hover:border-ccd-accent hover:shadow-md",
      isResultsState && (passed ? "bg-ccd-success/5 border-ccd-success/20" : "bg-ccd-danger/5 border-ccd-danger/20")
    )}>
      {isResultsState && (
        <div 
          className={cn("absolute bottom-0 left-0 h-1 transition-all duration-1000", passed ? "bg-ccd-success" : "bg-ccd-danger")}
          style={{ width: `${passPercentage}%` }}
        />
      )}
      
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="font-serif font-bold text-lg text-ccd-text">
              {articleRef}
            </span>
            <span className="font-sans text-sm text-ccd-text-sec uppercase tracking-widest font-semibold">
              {sectionRef}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-ccd-surface rounded-full text-[10px] font-bold uppercase tracking-widest text-ccd-text-sec border border-ccd-accent/20">
              {committee}
            </span>
            {isResultsState && (
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold shadow-sm border",
                passed ? "bg-ccd-success text-white border-ccd-success" : "bg-ccd-danger text-white border-ccd-danger"
              )}>
                {passPercentage.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="text-ccd-text leading-relaxed mt-2 text-sm sm:text-base">
          {!expanded && isTruncated ? (
            <p className="line-clamp-3">
              {type === 'AMENDMENT' ? (
                <>
                  <span className="line-through opacity-60 mr-2">{originalText}</span>
                  <span className="underline decoration-ccd-active underline-offset-4 decoration-2">{proposedText}</span>
                </>
              ) : type === 'INSERTION' ? (
                <span className="font-medium">ADDED: {proposedText}</span>
              ) : (
                originalText
              )}
            </p>
          ) : (
            <div className="space-y-4">
              {type === 'AMENDMENT' && (
                <>
                  <div className="bg-ccd-danger/5 p-4 rounded-xl border border-ccd-danger/10">
                    <span className="text-xs uppercase tracking-widest font-bold text-ccd-danger mb-2 block">Original Text</span>
                    <p className="line-through opacity-70">{originalText}</p>
                  </div>
                  <div className="bg-ccd-success/5 p-4 rounded-xl border border-ccd-success/10">
                    <span className="text-xs uppercase tracking-widest font-bold text-ccd-success mb-2 block">Change To</span>
                    <p className="font-medium">{proposedText}</p>
                  </div>
                </>
              )}
              {type === 'INSERTION' && (
                <div className="bg-ccd-success/5 p-4 rounded-xl border border-ccd-success/10">
                  <span className="text-xs uppercase tracking-widest font-bold text-ccd-success mb-2 block">Add Section</span>
                  <p className="font-medium">{proposedText}</p>
                </div>
              )}
              {type === 'QUASH' && (
                <div className="bg-ccd-surface/50 p-4 rounded-xl border border-ccd-accent/10">
                  <p>{originalText}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-end mt-4 pt-4 border-t border-ccd-accent/10">
          {isTruncated && (
            <button 
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-sm font-semibold text-ccd-active hover:text-ccd-active/80 transition-colors"
            >
              {expanded ? 'Read Less' : 'Read More'}
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}

          {!isTruncated && <div />} {/* Spacer */}

          {isVotationState && !isResultsState && (
            <VoteButtons onVote={(v) => console.log('Voted', v)} />
          )}
        </div>
      </div>
    </div>
  );
}
