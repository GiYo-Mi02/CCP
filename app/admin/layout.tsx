import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Server-side admin route guard.
 * - Unauthenticated users are redirected to /login.
 * - Authenticated non-admin users are redirected to /error/001.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let resolvedRole: string | null = null;

  const userRoleResult = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!userRoleResult.error && userRoleResult.data?.role) {
    resolvedRole = String(userRoleResult.data.role);
  }

  if (!resolvedRole) {
    const profileRoleResult = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileRoleResult.error) {
      redirect('/error/001');
    }

    if (profileRoleResult.data?.role) {
      resolvedRole = String(profileRoleResult.data.role);
    }
  }

  if (!resolvedRole || resolvedRole.toLowerCase() !== 'admin') {
    redirect('/error/001');
  }

  return <>{children}</>;
}
