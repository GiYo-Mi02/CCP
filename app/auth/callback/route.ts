import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

/**
 * OAuth Callback Handler
 *
 * After a user signs in with Google (or any OAuth provider), Supabase
 * redirects them here with an authorization `code`. This route handler
 * exchanges that code for a session, sets the auth cookies, then
 * redirects the user to /home (or /admin for admin users).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeNextPath(searchParams.get('next'), '/home');

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookies may not be settable in some edge cases
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, privacy_consented_at')
          .eq('id', user.id)
          .maybeSingle();

        const role = profile?.role ?? 'delegate';
        const targetPath = role === 'admin' ? '/admin' : next;

        if (role !== 'admin' && !isUmakEmail(user.email)) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=umak_email_required`);
        }

        if (!profile?.privacy_consented_at) {
          const consentUrl = new URL('/consent', origin);
          consentUrl.searchParams.set('next', targetPath);
          return NextResponse.redirect(consentUrl.toString());
        }

        return NextResponse.redirect(`${origin}${targetPath}`);
      }

      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }
  }

  // If code exchange failed, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
