'use client';
import React, { useState } from 'react';
import { TopNav } from '@/components/shared/TopNav';
import { Timer } from '@/components/shared/Timer';
import { MotionCard } from '@/components/shared/MotionCard';
import { Plus, X } from 'lucide-react';

export default function QuashingPeriodPage() {
  // MOCK DATA
  const delegate = { name: "Alexander Hamilton" };
  
  // Set timer to expire in 3 minutes for testing
  const futureDate = new Date();
  futureDate.setMinutes(futureDate.getMinutes() + 3);

  const motions = [
    {
      id: "q1",
      articleRef: "Article III - Legislature",
      sectionRef: "Section 2",
      originalText: "The assembly shall convene annually on the first Monday of August.",
      type: "QUASH" as const,
      committee: "Committee on the Legislature",
      passPercentage: 45 // For results state
    },
    {
      id: "q2",
      articleRef: "Article V - Judiciary",
      sectionRef: "Section 4",
      originalText: "All judges shall be appointed for a term of ten years without reappointment.",
      type: "QUASH" as const,
      committee: "Committee on the Judiciary",
      passPercentage: 62
    }
  ];

  // For demonstration, we handle "ACTIVE" -> "VOTATION" -> "RESULTS" via state, 
  // though realistically this is driven by server data based on time.
  const [periodState, setPeriodState] = useState<'ACTIVE' | 'VOTATION' | 'RESULTS'>('ACTIVE');
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ccd-bg pb-24">
      <TopNav 
        delegateName={delegate.name} 
        sessionName="First Plenary Session"
        leftComponent={
          periodState === 'ACTIVE' ? <Timer targetDate={futureDate} className="ml-4" /> : 
          <div className="ml-4 flex items-center gap-2 font-mono text-sm sm:text-base px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-ccd-danger/10 text-ccd-danger border border-ccd-danger/20 shadow-sm">
            <span className="font-bold tracking-widest">CLOSED</span>
          </div>
        }
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        
        {/* State Toggles (Dev only) */}
        <div className="mb-12 flex justify-center gap-2 text-xs font-mono opacity-50 hover:opacity-100 transition-opacity">
          <span>[Dev states:]</span>
          <button onClick={() => setPeriodState('ACTIVE')} className={periodState==='ACTIVE'?'font-bold':''}>ACTIVE</button>
          <button onClick={() => setPeriodState('VOTATION')} className={periodState==='VOTATION'?'font-bold':''}>VOTATION</button>
          <button onClick={() => setPeriodState('RESULTS')} className={periodState==='RESULTS'?'font-bold':''}>RESULTS</button>
        </div>

        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-ccd-active text-white font-bold uppercase tracking-widest text-xs rounded-full shadow-md mb-6">
            Quashing Period
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ccd-text mb-4">
            Review Quash Motions
          </h1>
          <p className="text-ccd-text-sec max-w-2xl mx-auto">
            Review and vote on proposed motions to entirely remove sections from the working constitution.
          </p>
        </div>

        <div className="space-y-6">
          {motions.map(m => (
            <MotionCard
              key={m.id}
              {...m}
              isVotationState={periodState === 'VOTATION'}
              isResultsState={periodState === 'RESULTS'}
            />
          ))}
        </div>
      </main>

      {/* Floating Action Button for ACTIVE state */}
      {periodState === 'ACTIVE' && (
        <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-ccd-bg via-ccd-bg/90 to-transparent flex justify-center pb-8 z-40">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full max-w-md py-4 bg-white border-2 border-dashed border-ccd-active hover:bg-ccd-active/5 text-ccd-active rounded-2xl font-bold tracking-widest uppercase text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 group backdrop-blur-md"
          >
            <Plus className="w-5 h-5 group-hover:scale-125 transition-transform" />
            Propose a Section to Quash
          </button>
        </div>
      )}

      {/* Proposal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ccd-text/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-ccd-accent/20 flex justify-between items-center bg-ccd-surface/30">
              <h2 className="font-serif text-2xl font-bold text-ccd-text">Propose Quash Motion</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-ccd-text-sec hover:text-ccd-danger rounded-full hover:bg-ccd-danger/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec">Article</label>
                  <select className="w-full p-3 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active">
                    <option>Select Article...</option>
                    <option>Article I</option>
                    <option>Article II</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec">Section</label>
                  <select className="w-full p-3 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active">
                    <option>Select Section...</option>
                    <option>Section 1</option>
                    <option>Section 2</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec">Justification</label>
                <textarea 
                  rows={5}
                  placeholder="Explain why this section should be quashed..."
                  className="w-full p-4 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active resize-none"
                ></textarea>
              </div>
            </div>

            <div className="p-6 border-t border-ccd-accent/20 bg-ccd-bg/50">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-full py-4 bg-ccd-text hover:bg-ccd-active text-white rounded-xl font-bold tracking-widest uppercase text-sm transition-colors shadow-lg hover:shadow-ccd-active/20"
              >
                Submit Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
