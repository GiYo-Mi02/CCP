'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

async function resolveOAuthOrigin() {
  const headerStore = await headers();
  const forwardedHost = headerStore.get('x-forwarded-host');
  const host = forwardedHost ?? headerStore.get('host');
  const forwardedProto = headerStore.get('x-forwarded-proto');
  const protocol = (forwardedProto ?? 'http').split(',')[0].trim() || 'http';

  if (host) {
    return `${protocol}://${host}`;
  }

  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (configuredOrigin) {
    return configuredOrigin;
  }

  return 'http://localhost:3000';
}

/**
 * Sign in with email and password.
 * Redirects to /home (delegate) or /admin (admin) on success.
 */
export async function loginWithEmail(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Fetch the user's role to determine redirect target
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Authentication failed.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') {
    redirect('/admin');
  }

  redirect('/home');
}

/**
 * Initiate Google OAuth sign-in flow.
 * User is redirected to Google, then back to /auth/callback.
 */
export async function loginWithGoogle() {
  const supabase = await createClient();
  const origin = await resolveOAuthOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect(data.url);
}

/**
 * Sign out the current user and redirect to login.
 */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
