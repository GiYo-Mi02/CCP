'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

function isLocalHostLike(value: string) {
  if (/^localhost(?::\d+)?$/i.test(value)) return true;
  if (/^127\.0\.0\.1(?::\d+)?$/.test(value)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(value)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(value)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(value)) return true;
  return false;
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;

  const candidate = value.split(',')[0].trim();
  if (!candidate) return null;

  const normalizedInput = /^https?:\/\//i.test(candidate)
    ? candidate
    : `${isLocalHostLike(candidate) ? 'http' : 'https'}://${candidate}`;

  try {
    return new URL(normalizedInput).origin;
  } catch {
    return null;
  }
}

async function resolveOAuthOrigin() {
  const headerStore = await headers();
  const originHeader = normalizeOrigin(headerStore.get('origin'));

  if (originHeader) {
    return originHeader;
  }

  const forwardedHost = headerStore.get('x-forwarded-host');
  const host = forwardedHost ?? headerStore.get('host');
  const forwardedProto = headerStore.get('x-forwarded-proto');
  const protocol = (forwardedProto ?? 'http').split(',')[0].trim() || 'http';

  if (host) {
    const hostOrigin = normalizeOrigin(`${protocol}://${host}`);
    if (hostOrigin) {
      return hostOrigin;
    }
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
