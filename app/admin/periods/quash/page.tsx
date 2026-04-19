import { AdminPeriodDetailsPage } from '../_components/AdminPeriodDetailsPage';
import { getAdminPeriodDetails } from '../_lib/getAdminPeriodDetails';

export default async function AdminQuashReviewPage() {
  const details = await getAdminPeriodDetails('quash');

  if (!details.session) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Quashing Review</h1>
        <p className="text-zinc-400 mt-4">No active session found. Initialize the convention flow first.</p>
      </div>
    );
  }

  if (!details.period) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Quashing Review</h1>
        <p className="text-zinc-400 mt-4">Quashing period is not configured for the active session.</p>
      </div>
    );
  }

  return (
    <AdminPeriodDetailsPage
      heading="Quashing Period Review"
      summary="Track each quash proposal, who submitted it, why they want it removed, and exactly who voted for quash/adapt/abstain."
      sessionName={details.session.name}
      state={details.period.state}
      deadline={details.period.deadline}
      motionDetails={details.motionDetails}
    />
  );
}
