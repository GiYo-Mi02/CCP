'use client';
import React, { useState } from 'react';
import { TopNav } from '@/components/shared/TopNav';
import { Check, Search } from 'lucide-react';

export default function PlenaryElectionsPage() {
  const delegate = { name: "Alexander Hamilton" };
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedCommittee, setSelectedCommittee] = useState("Committee on the Executive");
  const [searchTerm, setSearchTerm] = useState("");

  // State for selections
  const [selections, setSelections] = useState<Record<string, string>>({});

  const handleSelect = (position: string, candidate: string) => {
    setSelections(prev => ({ ...prev, [position]: candidate }));
  };

  const positionsPlenary = ["Presiding Officer", "Deputy P.O.", "Secretary General", "Deputy S.G.", "Majority Floor Leader", "Minority Floor Leader"];
  const positionsCommittee = ["Committee Chairperson", "Deputy Chairperson", "Committee Secretary"];

  const candidates = [
    { id: "c1", name: "John Marshall", college: "Law" },
    { id: "c2", name: "James Madison", college: "Arts" },
    { id: "c3", name: "Thomas Jefferson", college: "Science" },
    { id: "c4", name: "George Washington", college: "Military Science" },
    { id: "c5", name: "Benjamin Franklin", college: "Engineering" },
  ];

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.college.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allRequiredSelected = positionsPlenary.every(p => selections[p]) && positionsCommittee.every(p => selections[p]);

  const handleSubmit = () => {
    if (window.confirm("Submit your votes for all positions? This action cannot be undone.")) {
      setHasSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-ccd-bg pb-24">
      <TopNav delegateName={delegate.name} sessionName="First Plenary Session" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ccd-text mb-4">
            Plenary & Committee Elections
          </h1>
          <p className="text-ccd-text-sec max-w-2xl mx-auto">
            Cast your vote for the leadership positions of the Constitutional Convention.
          </p>
        </div>

        {hasSubmitted ? (
          <div className="max-w-md mx-auto bg-white p-10 rounded-3xl border border-ccd-success/30 shadow-xl text-center">
            <div className="mx-auto w-20 h-20 bg-ccd-success/20 rounded-full flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-ccd-success" />
            </div>
            <h2 className="font-serif text-3xl font-bold text-ccd-text mb-2">Votes Recorded</h2>
            <p className="text-ccd-text-sec">Your electoral votes have been successfully submitted to the Secretariat.</p>
          </div>
        ) : (
          <>
            <div className="max-w-md mx-auto mb-8 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-ccd-text-sec opacity-50" />
              </div>
              <input
                type="text"
                placeholder="Search candidates by name or college..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-ccd-accent/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ccd-active focus:border-transparent transition-all shadow-sm placeholder:text-ccd-text-sec/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
              
              {/* LEFT COLUMN: Plenary */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-ccd-accent/20 shadow-sm">
                <h2 className="font-serif text-2xl font-bold text-ccd-text mb-6 border-b border-ccd-accent/20 pb-4">
                  Plenary Positions
                </h2>
                
                <div className="space-y-6">
                  {positionsPlenary.map(pos => (
                    <div key={pos} className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec block">{pos}</label>
                      <div className="relative">
                        <select 
                          className="w-full p-4 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active appearance-none cursor-pointer"
                          value={selections[pos] || ""}
                          onChange={(e) => handleSelect(pos, e.target.value)}
                        >
                          <option value="" disabled>Select a candidate...</option>
                          {filteredCandidates.map(c => (
                            <option key={`${pos}-${c.id}`} value={c.id}>{c.name} ({c.college})</option>
                          ))}
                          {filteredCandidates.length === 0 && (
                            <option value="" disabled>No candidates found matching "{searchTerm}"</option>
                          )}
                        </select>
                        {/* Arrow icon */}
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-ccd-text-sec">
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT COLUMN: Committee */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-ccd-accent/20 shadow-sm h-fit gap-6 flex flex-col">
                <div>
                  <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec block mb-2 mt-1">Assigning Votes For</label>
                  <select 
                    className="w-full p-3 bg-ccd-bg font-serif text-lg border border-ccd-accent/40 rounded-xl focus:outline-none font-bold"
                    value={selectedCommittee}
                    onChange={(e) => setSelectedCommittee(e.target.value)}
                  >
                    <option>Committee on the Executive</option>
                    <option>Committee on the Judiciary</option>
                    <option>Committee on the Legislature</option>
                  </select>
                </div>

                <div className="border-t border-ccd-accent/20 w-full mb-2"></div>
                
                <h2 className="font-serif text-2xl font-bold text-ccd-text">
                  Committee Positions
                </h2>

                <div className="space-y-6">
                  {positionsCommittee.map(pos => (
                    <div key={pos} className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-bold text-ccd-text-sec block">{pos}</label>
                      <div className="relative">
                        <select 
                          className="w-full p-4 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active appearance-none cursor-pointer"
                          value={selections[pos] || ""}
                          onChange={(e) => handleSelect(pos, e.target.value)}
                        >
                          <option value="" disabled>Select a candidate...</option>
                          {filteredCandidates.map(c => (
                            <option key={`${pos}-${c.id}`} value={c.id}>{c.name} ({c.college})</option>
                          ))}
                          {filteredCandidates.length === 0 && (
                            <option value="" disabled>No candidates found matching "{searchTerm}"</option>
                          )}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-ccd-text-sec">
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SUBMIT */}
              <div className="md:col-span-2 mt-8 flex justify-center">
                <button
                  onClick={handleSubmit}
                  disabled={!allRequiredSelected}
                  className="w-full max-w-md py-5 bg-ccd-text hover:bg-ccd-active text-white rounded-2xl font-bold tracking-widest uppercase text-lg transition-all shadow-xl hover:shadow-ccd-active/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ccd-text disabled:hover:shadow-none"
                >
                  Submit Electoral Votes
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
