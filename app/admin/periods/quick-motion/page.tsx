import { AdminPeriodDetailsPage } from '../_components/AdminPeriodDetailsPage';
import { getAdminPeriodDetails } from '../_lib/getAdminPeriodDetails';

export default async function AdminQuickMotionReviewPage() {
  const details = await getAdminPeriodDetails('quick_motion');

  if (!details.session) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Quick Motion Review</h1>
        <p className="text-zinc-400 mt-4">No active session found. Initialize the convention flow first.</p>
      </div>
    );
  }

  if (!details.period) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Quick Motion Review</h1>
        <p className="text-zinc-400 mt-4">Quick motion period is not configured for the active session.</p>
      </div>
    );
  }

  return (
    <AdminPeriodDetailsPage
      heading="Quick Motion Review"
      summary="Inspect quick motion proposals, proposer intent, and complete voter-by-voter outcome details."
      sessionName={details.session.name}
      periodId={details.period.id}
      state={details.period.state}
      deadline={details.period.deadline}
      motionDetails={details.motionDetails}
    />
  );
}
