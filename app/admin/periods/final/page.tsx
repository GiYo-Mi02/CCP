import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AdminFinalVotationClient } from './AdminFinalVotationClient';

export default async function AdminFinalVotationPage() {
  const supabase = await createClient();

  const { data: activeSession } = await supabase
    .from('sessions')
    .select('id, name')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .maybeSingle();

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Final Votation — Admin</h1>
        <p className="text-zinc-400 mt-4">No active session found. Start a session from the admin panel.</p>
        <Link href="/admin" className="inline-block mt-6 px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-900">
          Back to Admin
        </Link>
      </div>
    );
  }

  const { data: period } = await supabase
    .from('periods')
    .select('id, period_type, state')
    .eq('session_id', activeSession.id)
    .eq('period_type', 'final_votation')
    .maybeSingle();

  if (!period) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Final Votation — Admin</h1>
        <p className="text-zinc-400 mt-4">Final votation period is not configured for the current session.</p>
        <Link href="/admin" className="inline-block mt-6 px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-900">
          Back to Admin
        </Link>
      </div>
    );
  }

  const { data: paper } = await supabase
    .from('final_votation_papers')
    .select(`
      id,
      file_name,
      mime_type,
      pdf_base64,
      uploaded_at,
      uploader:profiles!uploaded_by (full_name)
    `)
    .eq('period_id', period.id)
    .maybeSingle();

  let paperData: {
    id: string;
    fileName: string;
    mimeType: string;
    pdfBase64: string;
    uploadedAt: string;
    uploaderName: string | null;
  } | null = null;

  if (paper) {
    const uploader = Array.isArray(paper.uploader)
      ? (paper.uploader[0] as { full_name?: string | null } | undefined)
      : (paper.uploader as { full_name?: string | null } | null);

    paperData = {
      id: String(paper.id),
      fileName: String(paper.file_name),
      mimeType: String(paper.mime_type),
      pdfBase64: String(paper.pdf_base64),
      uploadedAt: String(paper.uploaded_at),
      uploaderName: uploader?.full_name ?? null,
    };
  }

  // Fetch vote aggregate
  const { data: motion } = await supabase
    .from('motions')
    .select(`
      id,
      votes (
        voter_id,
        vote_value
      )
    `)
    .eq('period_id', period.id)
    .eq('article_ref', 'FINAL PAPER')
    .eq('section_ref', 'OVERALL CONCON')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  type VoteRow = { voter_id: string; vote_value: string };
  const votes = ((motion as { votes?: VoteRow[] } | null)?.votes ?? []) as VoteRow[];
  let approve = 0;
  let reject = 0;
  let abstain = 0;
  for (const vote of votes) {
    if (vote.vote_value === 'adapt') approve += 1;
    if (vote.vote_value === 'quash') reject += 1;
    if (vote.vote_value === 'abstain') abstain += 1;
  }

  return (
    <AdminFinalVotationClient
      periodId={period.id}
      periodState={period.state}
      sessionName={activeSession.name}
      paper={paperData}
      aggregate={{ approve, reject, abstain, total: votes.length }}
    />
  );
}
