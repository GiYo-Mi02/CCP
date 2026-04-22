'use client';

import React from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { ProfileAvatar } from './ProfileAvatar';
import { logout } from '@/lib/actions/auth';

interface TopNavProps {
  sessionName?: string;
  delegateName: string;
  delegateAvatarUrl?: string;
  leftComponent?: React.ReactNode;
}

export function TopNav({ sessionName, delegateName, delegateAvatarUrl, leftComponent }: TopNavProps) {
  return (
    <nav className="sticky top-0 z-40 w-full bg-ccd-surface border-b-2 border-ccd-accent shadow-[0_4px_12px_rgba(44,24,16,0.08)] h-[72px] flex items-center">
      <div className="w-full px-4 sm:px-10 flex justify-between items-center">
        {/* LEFT */}
        <div className="flex justify-start items-center gap-4 flex-1">
          <Link href="/home" className="flex items-center gap-2 group">
            <span className="font-serif text-[28px] font-bold text-ccd-text tracking-[-0.5px] group-hover:text-ccd-active transition-colors">
              Constitutional Convention Platform
            </span>
          </Link>
          {leftComponent}
        </div>

        {/* CENTER */}
        <div className="flex-1 flex justify-center hidden md:flex">
          {sessionName && (
            <span className="font-serif text-[14px] text-ccd-text-sec uppercase tracking-[2px] opacity-80">
              {sessionName}
            </span>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex items-center justify-end gap-5 flex-1">
          <Link 
            href="/quick-motion"
            className="hidden sm:flex items-center justify-center px-4 py-2 bg-ccd-active hover:bg-ccd-active/90 text-white rounded-full text-[12px] font-bold tracking-[1px] shadow-[0_2px_4px_rgba(139,105,20,0.3)] transition-all"
          >
            Q.M. VOTE
          </Link>
          
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
            <ProfileAvatar url={delegateAvatarUrl} name={delegateName} size="sm" />
            <span className="font-semibold text-[14px] text-ccd-text hidden sm:block">Hon. {delegateName.split(' ').pop()}</span>
          </Link>

          <button 
            onClick={() => logout()}
            className="text-ccd-text-sec hover:text-ccd-danger transition-colors p-2" 
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
