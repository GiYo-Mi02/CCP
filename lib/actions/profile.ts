'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Update the current user's profile.
 */
export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const fullName    = formData.get('full_name') as string;
  const college     = formData.get('college') as string;
  const committee   = formData.get('committee') as string;
  const credentials = formData.get('credentials') as string;

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name:   fullName,
      college:     college,
      committee:   committee,
      credentials: credentials ? JSON.parse(credentials) : [],
      updated_at:  new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Fetch the current user's profile.
 */
export async function getCurrentProfile() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) return { error: error.message };
  return { data };
}

/**
 * Fetch a delegate's profile by ID (public info).
 */
export async function getProfile(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, college, committee, credentials, avatar_url, role')
    .eq('id', userId)
    .single();

  if (error) return { error: error.message };
  return { data };
}
