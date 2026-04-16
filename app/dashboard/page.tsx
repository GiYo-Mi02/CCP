'use client';
import React, { useState } from 'react';
import { TopNav } from '@/components/shared/TopNav';
import { ProfileAvatar } from '@/components/shared/ProfileAvatar';
import { MotionCard } from '@/components/shared/MotionCard';
import { Plus, Edit2, Check, X } from 'lucide-react';

export default function DashboardPage() {
  const [isEditing, setIsEditing] = useState(false);
  
  // MOCK DATA
  const delegate = {
    name: "Alexander Hamilton",
    college: "College of Law",
    committee: "Committee on the Executive",
    credentials: ["Chief Drafter", "Floor Debater", "Author - Article IV"],
    avatarUrl: undefined
  };

  const contributions = [
    {
      id: "cont1",
      articleRef: "Article II - The Executive",
      sectionRef: "Section 3",
      originalText: "The executive power shall be vested in a President...",
      proposedText: "The executive power shall be vested in a President, who shall serve a single six-year term...",
      type: "AMENDMENT" as const,
      committee: "Committee on the Executive"
    },
    {
      id: "cont2",
      articleRef: "Article VI - General Provisions",
      sectionRef: "Section 1",
      originalText: "All state symbols must be approved by the assembly.",
      type: "QUASH" as const,
      committee: "Committee on General Provisions"
    }
  ];

  return (
    <div className="min-h-screen bg-ccd-bg">
      <TopNav 
        delegateName={delegate.name} 
        delegateAvatarUrl={delegate.avatarUrl} 
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16">
          
          {/* LEFT COLUMN - Profile */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-white rounded-3xl p-8 border border-ccd-accent/20 shadow-sm relative">
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="absolute top-6 right-6 p-2 text-ccd-text-sec hover:text-ccd-active bg-ccd-surface/30 rounded-full transition-colors"
                title="Edit Profile"
              >
                {isEditing ? <X className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
              </button>

              <div className="flex flex-col items-center text-center pb-8 border-b border-ccd-accent/20">
                <div className="mb-6">
                  <ProfileAvatar name={delegate.name} url={delegate.avatarUrl} size="xl" />
                </div>
                
                {isEditing ? (
                  <input 
                    type="text" 
                    defaultValue={delegate.name} 
                    className="font-serif text-3xl font-bold text-ccd-text text-center bg-ccd-surface/20 border-b border-ccd-active focus:outline-none mb-2 px-2"
                  />
                ) : (
                  <h1 className="font-serif text-3xl font-bold text-ccd-text mb-2 tracking-tight">
                    {delegate.name}
                  </h1>
                )}
                
                <div className="space-y-1 w-full max-w-xs mt-4">
                  {/* College */}
                  <div className="flex flex-col text-sm">
                    <span className="uppercase tracking-widest text-[10px] font-bold text-ccd-text-sec mb-1">College</span>
                    {isEditing ? (
                      <input type="text" defaultValue={delegate.college} className="bg-ccd-surface/20 border-b border-ccd-active focus:outline-none px-1 text-center" />
                    ) : (
                      <span className="font-medium text-ccd-text">{delegate.college}</span>
                    )}
                  </div>
                  {/* Committee */}
                  <div className="flex flex-col text-sm mt-4">
                    <span className="uppercase tracking-widest text-[10px] font-bold text-ccd-text-sec mb-1">Committee</span>
                    {isEditing ? (
                      <input type="text" defaultValue={delegate.committee} className="bg-ccd-surface/20 border-b border-ccd-active focus:outline-none px-1 text-center" />
                    ) : (
                      <span className="font-medium text-ccd-text">{delegate.committee}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Credentials Board */}
              <div className="pt-8 text-center sm:text-left">
                <h3 className="font-serif text-xl font-bold text-ccd-text mb-4">Credentials Board</h3>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  {delegate.credentials.map((cred, i) => (
                    <span key={i} className="px-3 py-1.5 bg-ccd-surface rounded-full text-xs font-semibold text-ccd-text-sec border border-ccd-accent/30 flex items-center gap-1 group">
                      {cred}
                      {isEditing && <X className="w-3 h-3 cursor-pointer hover:text-ccd-danger ml-1" />}
                    </span>
                  ))}
                  {isEditing && (
                    <button className="px-3 py-1.5 bg-white border border-dashed border-ccd-active text-ccd-active rounded-full text-xs font-bold hover:bg-ccd-active/5 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-8">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="w-full py-3 bg-ccd-active hover:bg-ccd-active/90 text-white rounded-xl font-bold tracking-widest uppercase text-sm shadow-md transition-all flex justify-center items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Save Profile
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Contributions */}
          <div className="lg:col-span-7 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif text-3xl font-bold text-ccd-text">
                ConCon Contributions
              </h2>
            </div>

            <div className="space-y-6">
              {contributions.map(c => (
                <MotionCard 
                  key={c.id}
                  id={c.id}
                  articleRef={c.articleRef}
                  sectionRef={c.sectionRef}
                  originalText={c.originalText}
                  proposedText={c.proposedText}
                  type={c.type}
                  committee={c.committee}
                />
              ))}

              <button className="w-full p-6 border-2 border-dashed border-ccd-accent/40 rounded-2xl hover:border-ccd-active hover:bg-ccd-active/5 transition-all flex flex-col items-center justify-center gap-2 text-ccd-text-sec hover:text-ccd-active group">
                <div className="p-3 bg-ccd-surface/50 group-hover:bg-ccd-surface rounded-full">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="font-bold uppercase tracking-widest text-sm">Add ConCon Contribution</span>
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
