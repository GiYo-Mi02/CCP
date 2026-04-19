import { AdminPeriodDetailsPage } from '../_components/AdminPeriodDetailsPage';
import { getAdminPeriodDetails } from '../_lib/getAdminPeriodDetails';

export default async function AdminAmendmentReviewPage() {
  const details = await getAdminPeriodDetails('amendment');

  if (!details.session) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Amendment Review</h1>
        <p className="text-zinc-400 mt-4">No active session found. Initialize the convention flow first.</p>
      </div>
    );
  }

  if (!details.period) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Amendment Review</h1>
        <p className="text-zinc-400 mt-4">Amendment period is not configured for the active session.</p>
      </div>
    );
  }

  return (
    <AdminPeriodDetailsPage
      heading="Amendment Period Review"
      summary="Inspect amendment proposals with original text, proposed replacement text, proposer rationale, and complete voter identity breakdown."
      sessionName={details.session.name}
      state={details.period.state}
      deadline={details.period.deadline}
      motionDetails={details.motionDetails}
    />
  );
}
