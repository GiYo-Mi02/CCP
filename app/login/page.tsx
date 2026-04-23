'use client';
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginWithEmail, loginWithGoogle } from '@/lib/actions/auth';

function LoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);

  React.useEffect(() => {
    const errorCode = searchParams.get('error');

    if (errorCode === 'umak_email_required') {
      setError('Only official UMak email accounts are allowed for delegate access.');
      return;
    }

    if (errorCode === 'auth_callback_failed') {
      setError('Authentication callback failed. Please try signing in again.');
    }
  }, [searchParams]);

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await loginWithEmail(formData);

    // If we get here, the redirect didn't happen — meaning there was an error
    if (result?.error) {
      setError(result.error);
    }
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsGoogleLoading(true);

    const result = await loginWithGoogle();

    // If we get here, the redirect didn't happen — meaning there was an error
    if (result?.error) {
      setError(result.error);
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-ccd-bg">
      {/* LEFT COLUMN */}
      <div className="relative w-full md:w-5/12 lg:w-1/2 flex flex-col justify-center items-start p-8 sm:p-12 md:p-16 lg:p-24 overflow-hidden border-b md:border-b-0 md:border-r border-ccd-accent/30 bg-ccd-surface/40">
        <div className="relative z-10 max-w-lg">
          <svg className="w-16 h-16 sm:w-20 sm:h-20 text-ccd-active mb-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
          <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-semibold text-ccd-text tracking-tight leading-[1.1] mb-6">
            Constitutional Convention Platform
          </h1>
          <p className="font-serif text-xl sm:text-2xl text-ccd-text-sec italic opacity-90 border-l-4 border-ccd-active pl-4 py-1">
            &quot;Shaping the Constitution, One Vote at a Time.&quot;
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-ccd-text/5 p-8 sm:p-10 border border-ccd-accent/10 relative z-10">
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl font-bold text-ccd-text mb-2">Delegate Access</h2>
            <p className="text-ccd-text-sec text-sm">Sign in with your official credentials</p>
          </div>

          <form className="space-y-6" onSubmit={handleEmailLogin}>
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest font-bold text-ccd-text-sec ml-1">
                Delegate Email
              </label>
              <input 
                name="email"
                type="email" 
                placeholder="delegate@college.edu"
                required
                className="w-full px-5 py-4 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active focus:border-transparent transition-all placeholder:text-ccd-text-sec/40"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest font-bold text-ccd-text-sec ml-1">
                Password
              </label>
              <input 
                name="password"
                type="password" 
                placeholder="••••••••"
                required
                className="w-full px-5 py-4 bg-ccd-surface/20 border border-ccd-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-ccd-active focus:border-transparent transition-all placeholder:text-ccd-text-sec/40"
              />
            </div>

            {error && (
              <div className="p-4 bg-ccd-danger/10 border border-ccd-danger/20 rounded-xl text-ccd-danger text-sm font-medium flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{error}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-ccd-text hover:bg-ccd-active text-white rounded-xl font-bold tracking-wider uppercase text-sm transition-colors shadow-lg hover:shadow-ccd-active/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-ccd-accent/20"></div>
            <span className="text-xs uppercase tracking-widest font-semibold text-ccd-text-sec">Or</span>
            <div className="flex-1 h-px bg-ccd-accent/20"></div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="w-full py-4 bg-white border-2 border-ccd-surface hover:border-ccd-accent/50 hover:bg-ccd-surface/20 text-ccd-text rounded-xl font-bold flex items-center justify-center gap-3 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {isGoogleLoading ? 'Redirecting...' : 'Sign in with Google'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-ccd-bg flex items-center justify-center">
        <p className="text-ccd-text-sec text-sm">Loading...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
