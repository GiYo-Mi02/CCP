import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/actions/profile';
import { getMotionsByAuthor } from '@/lib/actions/motions';
import { DashboardClient } from './DashboardClient';

/**
 * Dashboard Page — Async Server Component
 *
 * Fetches the authenticated user's profile and their submitted motions,
 * then passes the data down to the interactive DashboardClient component.
 */
export default async function DashboardPage() {
  // Fetch profile and motions in parallel
  const [profileResult, motionsResult] = await Promise.all([
    getCurrentProfile(),
    getCurrentProfile().then(p => 
      p.data ? getMotionsByAuthor(p.data.id) : { data: [] }
    ),
  ]);

  // If not authenticated, redirect to login
  if (profileResult.error || !profileResult.data) {
    redirect('/login');
  }

  const profile = profileResult.data;

  // Map DB motions to the shape DashboardClient expects
  const contributions = (motionsResult.data ?? []).map((m: Record<string, unknown>) => ({
    id:           m.id as string,
    articleRef:   (m.article_ref as string) || '',
    sectionRef:   (m.section_ref as string) || '',
    originalText: (m.original_text as string) || undefined,
    proposedText: (m.proposed_text as string) || undefined,
    type:         ((m.motion_type as string) || '').toUpperCase() as 'QUASH' | 'AMENDMENT' | 'INSERTION',
    committee:    profile.committee || '',
  }));

  return (
    <DashboardClient
      profile={{
        id:          profile.id,
        name:        profile.full_name || '',
        college:     profile.college || '',
        committee:   profile.committee || '',
        credentials: profile.credentials ?? [],
        electedPositions: profile.elected_positions ?? [],
        avatarUrl:   profile.avatar_url ?? undefined,
      }}
      contributions={contributions}
    />
  );
}
