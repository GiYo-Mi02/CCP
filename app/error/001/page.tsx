import React from 'react';
import Link from 'next/link';
import { Gavel } from 'lucide-react';

export default function Error001Page() {
  return (
    <div className="min-h-screen bg-ccd-bg flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-[2rem] border border-ccd-accent/20 shadow-xl shadow-ccd-text/5 p-10 sm:p-16 text-center transform hover:-translate-y-1 transition-transform duration-500">
        
        <div className="mx-auto w-20 h-20 bg-ccd-surface/50 rounded-full flex items-center justify-center mb-8 border border-ccd-accent/20">
          <Gavel className="w-10 h-10 text-ccd-text-sec opacity-80" />
        </div>
        
        <h1 className="font-serif text-5xl sm:text-6xl font-bold text-ccd-text mb-4 tracking-tight">
          Error 001
        </h1>
        
        <div className="h-px w-24 bg-ccd-accent/30 mx-auto my-6"></div>
        
        <h2 className="font-serif text-2xl text-ccd-text-sec italic mb-8">
          This section is currently unavailable
        </h2>
        
        <ul className="text-left max-w-md mx-auto space-y-4 mb-12">
          {/* Custom styled list items instead of raw bullets */}
          {[
            "Technical troubleshooting is ongoing",
            "This feature has not been opened by the administration yet",
            "The section is temporarily closed for archival purposes"
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="shrink-0 w-2 h-2 mt-2 bg-ccd-active rounded-full" />
              <span className="text-ccd-text-sec leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
        
        <Link 
          href="/home"
          className="inline-flex items-center justify-center px-10 py-4 bg-ccd-text hover:bg-ccd-active text-white rounded-xl font-bold tracking-widest uppercase text-sm transition-all shadow-lg hover:shadow-ccd-active/20"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
