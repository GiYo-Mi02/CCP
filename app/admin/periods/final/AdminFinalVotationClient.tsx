'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowLeft, FileText, Upload, Loader2 } from 'lucide-react';
import { uploadFinalVotationPaper } from '@/lib/actions/final-votation';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import type { PeriodState } from '@/lib/types/database';

interface AdminFinalVotationClientProps {
  periodId: string;
  periodState: PeriodState;
  sessionName: string;
  paper: {
    id: string;
    fileName: string;
    mimeType: string;
    pdfBase64: string;
    uploadedAt: string;
    uploaderName: string | null;
  } | null;
  aggregate: {
    approve: number;
    reject: number;
    abstain: number;
    total: number;
  };
}

export function AdminFinalVotationClient({
  periodId,
  periodState,
  sessionName,
  paper,
  aggregate,
}: AdminFinalVotationClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useRealtimeRefresh({
    channelName: `admin-final-votation-${periodId}`,
    tables: [
      { table: 'final_votation_papers', filter: `period_id=eq.${periodId}` },
      { table: 'motions', filter: `period_id=eq.${periodId}` },
      { table: 'votes' },
      { table: 'periods', filter: `id=eq.${periodId}` },
    ],
  });

  const chartData = [
    { name: 'APPROVE', value: aggregate.approve, color: '#16A34A' },
    { name: 'REJECT', value: aggregate.reject, color: '#DC2626' },
    { name: 'ABSTAIN', value: aggregate.abstain, color: '#6B7280' },
  ];

  const pdfDataUri = paper ? `data:${paper.mimeType};base64,${paper.pdfBase64}` : null;

  const handleUpload = () => {
    if (!selectedFile) {
      setFeedback('Select a PDF file before uploading.');
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set('period_id', periodId);
      formData.set('paper', selectedFile);

      const result = await uploadFinalVotationPaper(formData);

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setSelectedFile(null);
      setFeedback('Final votation paper uploaded successfully.');
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 lg:px-12 py-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Admin Panel</p>
            <h1 className="font-serif text-4xl mt-2">Final Votation</h1>
            <p className="text-zinc-400 mt-2">Session: {sessionName}</p>
            <p className="text-zinc-500 text-sm mt-1">
              Period State: <span className="uppercase tracking-wider">{periodState}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-900 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Admin
            </Link>
            <Link
              href="/periods/final"
              className="px-4 py-2 rounded-lg border border-cyan-600/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 text-sm"
            >
              Open Delegate View
            </Link>
          </div>
        </div>

        {feedback && (
          <p className="mb-6 text-sm text-zinc-200 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3">
            {feedback}
          </p>
        )}

        {/* PDF Upload Section */}
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-7 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Upload className="w-6 h-6 text-cyan-400" />
            <div>
              <h2 className="font-serif text-2xl text-white">Upload Constitutional Paper</h2>
              <p className="text-zinc-400 text-sm mt-1">
                Upload the finalized PDF of the overall ConCon committees paper. Max 8MB.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 w-full sm:w-auto">
              <label
                htmlFor="pdf-upload"
                className="block text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2"
              >
                PDF File
              </label>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-2.5 text-zinc-100 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border file:border-zinc-600 file:bg-zinc-800 file:text-zinc-200 file:text-sm file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isPending || !selectedFile}
              className="px-6 py-2.5 rounded-xl border border-emerald-400/40 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 font-semibold disabled:opacity-60 flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Upload Paper
                </>
              )}
            </button>
          </div>
        </section>

        {/* Uploaded Paper Viewer */}
        {paper ? (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-7 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-cyan-400" />
              <div>
                <h2 className="font-serif text-2xl text-white">Uploaded Paper</h2>
                <p className="text-zinc-400 text-sm mt-1">
                  {paper.fileName} • Uploaded{' '}
                  {new Date(paper.uploadedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {paper.uploaderName ? ` by ${paper.uploaderName}` : ''}
                </p>
              </div>
            </div>

            {pdfDataUri && (
              <div className="rounded-2xl border border-zinc-700 overflow-hidden bg-zinc-950">
                <iframe
                  src={pdfDataUri}
                  title="Final Votation Paper Preview"
                  className="w-full h-[600px] sm:h-[700px]"
                  style={{ border: 'none' }}
                />
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8 mb-6 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
            <p className="font-serif text-xl text-zinc-300">No Paper Uploaded Yet</p>
            <p className="text-sm text-zinc-500 mt-2">
              Use the upload form above to add the final constitutional paper.
            </p>
          </section>
        )}

        {/* Vote Aggregate Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-7">
            <h2 className="font-serif text-2xl text-white mb-2">Vote Distribution</h2>
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Live Results</p>

            <div className="h-[280px] w-full relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-serif text-4xl font-bold text-white">{aggregate.total}</span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                  Total Votes
                </span>
              </div>
            </div>
          </section>

          <section className="lg:col-span-5 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-7 space-y-4">
            <h2 className="font-serif text-2xl text-white">Vote Summary</h2>
            <p className="text-xs uppercase tracking-widest text-zinc-500">
              Overall ConCon Committees Paper
            </p>

            <div className="space-y-3 mt-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="font-bold text-zinc-100 uppercase tracking-widest text-sm">
                    Approve
                  </span>
                </div>
                <span className="font-serif text-2xl font-bold text-white">
                  {aggregate.approve}
                </span>
              </div>

              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="font-bold text-zinc-100 uppercase tracking-widest text-sm">
                    Reject
                  </span>
                </div>
                <span className="font-serif text-2xl font-bold text-white">
                  {aggregate.reject}
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-500/30 bg-zinc-500/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-zinc-500" />
                  <span className="font-bold text-zinc-100 uppercase tracking-widest text-sm">
                    Abstain
                  </span>
                </div>
                <span className="font-serif text-2xl font-bold text-white">
                  {aggregate.abstain}
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-700 bg-zinc-800/50 p-4 flex items-center justify-between">
                <span className="font-bold text-zinc-400 uppercase tracking-widest text-sm">
                  Total Votes
                </span>
                <span className="font-serif text-2xl font-bold text-white">
                  {aggregate.total}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
