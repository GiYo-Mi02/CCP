'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

const PRIVACY_CONSENT_VERSION = 'ra10173-v1';

function isUmakEmail(email: string | null | undefined) {
  if (!email) return false;
  return email.toLowerCase().endsWith('@umak.edu.ph');
}

function sanitizeNextPath(nextPath: string | null | undefined, fallback = '/home') {
  if (!nextPath) return fallback;
  if (!nextPath.startsWith('/')) return fallback;
  if (nextPath.startsWith('//')) return fallback;
  return nextPath;
}

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
    .select('role, privacy_consented_at')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role ?? 'delegate';

  if (role !== 'admin' && !isUmakEmail(user.email)) {
    await supabase.auth.signOut();
    return { error: 'Please use your official UMak email address to access CCP.' };
  }

  const nextPath = role === 'admin' ? '/admin' : '/home';

  if (!profile?.privacy_consented_at) {
    redirect(`/consent?next=${encodeURIComponent(nextPath)}`);
  }

  if (role === 'admin') {
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
 * Records first-login Data Privacy consent and redirects to the intended page.
 */
export async function acceptDataPrivacyConsent(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Please sign in first.' };
  }

  const agreedRaw = String(formData.get('agree') ?? '').toLowerCase();
  const agreed = agreedRaw === 'true' || agreedRaw === 'on' || agreedRaw === '1';

  if (!agreed) {
    return { error: 'You must agree to the Data Privacy Consent to continue.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role ?? 'delegate';

  if (role !== 'admin' && !isUmakEmail(user.email)) {
    await supabase.auth.signOut();
    return { error: 'Only official UMak email accounts are allowed for delegate access.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      privacy_consented_at: new Date().toISOString(),
      privacy_consent_version: PRIVACY_CONSENT_VERSION,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    return { error: error.message };
  }

  const requestedNextPath = sanitizeNextPath(formData.get('next') as string | null, role === 'admin' ? '/admin' : '/home');
  redirect(requestedNextPath);
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
