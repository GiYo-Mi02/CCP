'use client';

import { ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import React, { Suspense } from 'react';
import { acceptDataPrivacyConsent } from '@/lib/actions/auth';

const DATA_PRIVACY_CONSENT_TEXT =
  'By signing in or creating an account, you consent to the collection, processing, and storage of your personal data by the Constitutional Convention Platform (CCP) in compliance with the Data Privacy Act of 2012 (Republic Act No. 10173) of the Philippines. Your information will be used solely for authentication, role verification, and convention operations. We are committed to protecting your data against unauthorized access or disclosure.';

function ConsentContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/home';

  const [agreed, setAgreed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleContinue = () => {
    setError(null);

    if (!agreed) {
      setError('You must agree to the Data Privacy Consent before continuing.');
      return;
    }

    const formData = new FormData();
    formData.set('agree', 'true');
    formData.set('next', nextPath);

    startTransition(async () => {
      const result = await acceptDataPrivacyConsent(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="min-h-screen bg-ccd-bg flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-3xl border border-ccd-accent/20 bg-white shadow-2xl overflow-hidden">
        <div className="border-b border-ccd-accent/20 bg-ccd-surface/40 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-ccd-active/15 p-2.5">
              <ShieldCheck className="h-5 w-5 text-ccd-active" />
            </div>
            <div>
              <h1 className="font-serif text-2xl text-ccd-text">Data Privacy Consent</h1>
              <p className="text-sm text-ccd-text-sec mt-1">Required before you can access the Constitutional Convention Platform.</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8 sm:py-7 space-y-5">
          <p className="text-sm leading-relaxed text-ccd-text">{DATA_PRIVACY_CONSENT_TEXT}</p>

          <div className="rounded-xl border border-ccd-accent/20 bg-ccd-surface/20 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-ccd-accent/40 text-ccd-active focus:ring-ccd-active"
              />
              <span className="text-sm text-ccd-text">
                I agree to the Data Privacy Consent and certify that I am using my official UMak email address for CCP access.
              </span>
            </label>
          </div>

          {error && (
            <p className="rounded-xl border border-ccd-danger/30 bg-ccd-danger/10 px-4 py-3 text-sm text-ccd-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={isPending}
            className="w-full rounded-xl bg-ccd-text py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-ccd-active disabled:opacity-60"
          >
            {isPending ? 'Saving Consent...' : 'Agree and Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-ccd-bg flex items-center justify-center">
        <p className="text-ccd-text-sec text-sm">Loading...</p>
      </div>
    }>
      <ConsentContent />
    </Suspense>
  );
}
