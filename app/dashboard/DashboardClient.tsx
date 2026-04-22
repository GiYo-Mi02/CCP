'use client';

import React, { useState, useTransition } from 'react';
import { TopNav } from '@/components/shared/TopNav';
import { ProfileAvatar } from '@/components/shared/ProfileAvatar';
import { MotionCard } from '@/components/shared/MotionCard';
import { Plus, Edit2, Check, X, Loader2 } from 'lucide-react';
import { updateProfile } from '@/lib/actions/profile';

// ─── Prop Types ──────────────────────────────────────────────────────

interface DelegateProfile {
  id: string;
  name: string;
  college: string;
  committee: string;
  credentials: string[];
  electedPositions: string[];
  avatarUrl?: string;
}

interface Contribution {
  id: string;
  articleRef: string;
  sectionRef: string;
  originalText?: string;
  proposedText?: string;
  type: 'QUASH' | 'AMENDMENT' | 'INSERTION';
  committee: string;
}

interface DashboardClientProps {
  profile: DelegateProfile;
  contributions: Contribution[];
}

// ─── Client Component ────────────────────────────────────────────────

export function DashboardClient({ profile, contributions }: DashboardClientProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local state for credentials editing
  const [credentials, setCredentials] = useState<string[]>(profile.credentials);
  const [newCredential, setNewCredential] = useState('');

  const handleRemoveCredential = (index: number) => {
    setCredentials(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddCredential = () => {
    if (newCredential.trim()) {
      setCredentials(prev => [...prev, newCredential.trim()]);
      setNewCredential('');
    }
  };

  const handleSaveProfile = (formData: FormData) => {
    setError(null);

    // Inject credentials as JSON since they're managed in state
    formData.set('credentials', JSON.stringify(credentials));

    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setIsEditing(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-ccd-bg">
      <TopNav 
        delegateName={profile.name || 'Delegate'} 
        delegateAvatarUrl={profile.avatarUrl} 
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16">
          
          {/* LEFT COLUMN - Profile */}
          <div className="lg:col-span-5 space-y-8">
            <form action={handleSaveProfile}>
              <div className="bg-white rounded-3xl p-8 border border-ccd-accent/20 shadow-sm relative">
                <button 
                  type="button"
                  onClick={() => {
                    if (isEditing) {
                      // Cancel editing — reset credentials to original
                      setCredentials(profile.credentials);
                      setError(null);
                    }
                    setIsEditing(!isEditing);
                  }}
                  className="absolute top-6 right-6 p-2 text-ccd-text-sec hover:text-ccd-active bg-ccd-surface/30 rounded-full transition-colors"
                  title={isEditing ? "Cancel" : "Edit Profile"}
                >
                  {isEditing ? <X className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                </button>

                <div className="flex flex-col items-center text-center pb-8 border-b border-ccd-accent/20">
                  <div className="mb-6">
                    <ProfileAvatar name={profile.name || 'D'} url={profile.avatarUrl} size="xl" />
                  </div>
                  
                  {isEditing ? (
                    <input 
                      name="full_name"
                      type="text" 
                      defaultValue={profile.name} 
                      className="font-serif text-3xl font-bold text-ccd-text text-center bg-ccd-surface/20 border-b border-ccd-active focus:outline-none mb-2 px-2"
                    />
                  ) : (
                    <h1 className="font-serif text-3xl font-bold text-ccd-text mb-2 tracking-tight">
                      {profile.name || 'Unnamed Delegate'}
                    </h1>
                  )}
                  
                  <div className="space-y-1 w-full max-w-xs mt-4">
                    {/* College */}
                    <div className="flex flex-col text-sm">
                      <span className="uppercase tracking-widest text-[10px] font-bold text-ccd-text-sec mb-1">College</span>
                      {isEditing ? (
                        <input name="college" type="text" defaultValue={profile.college} className="bg-ccd-surface/20 border-b border-ccd-active focus:outline-none px-1 text-center" />
                      ) : (
                        <span className="font-medium text-ccd-text">{profile.college || '—'}</span>
                      )}
                    </div>
                    {/* Committee */}
                    <div className="flex flex-col text-sm mt-4">
                      <span className="uppercase tracking-widest text-[10px] font-bold text-ccd-text-sec mb-1">Committee</span>
                      <span className="font-medium text-ccd-text">{profile.committee || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Credentials Board */}
                <div className="pt-8 text-center sm:text-left">
                  <h3 className="font-serif text-xl font-bold text-ccd-text mb-4">Credentials Board</h3>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {credentials.map((cred, i) => (
                      <span key={i} className="px-3 py-1.5 bg-ccd-surface rounded-full text-xs font-semibold text-ccd-text-sec border border-ccd-accent/30 flex items-center gap-1 group">
                        {cred}
                        {isEditing && (
                          <button type="button" onClick={() => handleRemoveCredential(i)}>
                            <X className="w-3 h-3 cursor-pointer hover:text-ccd-danger ml-1" />
                          </button>
                        )}
                      </span>
                    ))}
                    {isEditing && (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newCredential}
                          onChange={(e) => setNewCredential(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCredential(); } }}
                          placeholder="New credential"
                          className="px-2 py-1 text-xs bg-white border border-ccd-accent/30 rounded-full focus:outline-none focus:ring-1 focus:ring-ccd-active w-28"
                        />
                        <button 
                          type="button"
                          onClick={handleAddCredential}
                          className="px-3 py-1.5 bg-white border border-dashed border-ccd-active text-ccd-active rounded-full text-xs font-bold hover:bg-ccd-active/5 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8 text-center sm:text-left border-t border-ccd-accent/20 mt-8">
                  <h3 className="font-serif text-xl font-bold text-ccd-text mb-4">Elected Positions</h3>
                  {profile.electedPositions.length === 0 ? (
                    <p className="text-sm text-ccd-text-sec">No elected position assigned yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      {profile.electedPositions.map((position) => (
                        <span
                          key={position}
                          className="px-3 py-1.5 bg-ccd-active/10 rounded-full text-xs font-semibold text-ccd-text border border-ccd-active/30"
                        >
                          {position}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-ccd-danger/10 border border-ccd-danger/20 rounded-xl text-ccd-danger text-sm font-medium">
                    {error}
                  </div>
                )}

                {isEditing && (
                  <div className="mt-8">
                    <button 
                      type="submit"
                      disabled={isPending}
                      className="w-full py-3 bg-ccd-active hover:bg-ccd-active/90 text-white rounded-xl font-bold tracking-widest uppercase text-sm shadow-md transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" /> Save Profile
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* RIGHT COLUMN - Contributions */}
          <div className="lg:col-span-7 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif text-3xl font-bold text-ccd-text">
                ConCon Contributions
              </h2>
            </div>

            <div className="space-y-6">
              {contributions.length > 0 ? (
                contributions.map(c => (
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
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-ccd-accent/10">
                  <p className="text-ccd-text-sec font-medium">No contributions yet.</p>
                  <p className="text-sm text-ccd-text-sec opacity-60 mt-1">
                    Submit motions during active periods to see them here.
                  </p>
                </div>
              )}

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
