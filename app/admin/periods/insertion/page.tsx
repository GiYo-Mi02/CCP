import { AdminPeriodDetailsPage } from '../_components/AdminPeriodDetailsPage';
import { getAdminPeriodDetails } from '../_lib/getAdminPeriodDetails';

export default async function AdminInsertionReviewPage() {
  const details = await getAdminPeriodDetails('insertion');

  if (!details.session) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Insertion Review</h1>
        <p className="text-zinc-400 mt-4">No active session found. Initialize the convention flow first.</p>
      </div>
    );
  }

  if (!details.period) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="font-serif text-4xl">Insertion Review</h1>
        <p className="text-zinc-400 mt-4">Insertion period is not configured for the active session.</p>
      </div>
    );
  }

  return (
    <AdminPeriodDetailsPage
      heading="Insertion Period Review"
      summary="Review new section insertions with exact proposed text, the reason for insertion, and named vote monitoring for every motion."
      sessionName={details.session.name}
      state={details.period.state}
      deadline={details.period.deadline}
      motionDetails={details.motionDetails}
    />
  );
}
