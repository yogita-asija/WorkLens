import DashboardHeader from "../components/DashboardHeader";
import RecentActivity  from "../components/RecentActivity";
import UpcomingTasks   from "../components/UpcomingTasks";

export default function Dashboard() {
  return (
    <div className="space-y-6 text-white font-sans">
      <DashboardHeader />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <RecentActivity />
        <UpcomingTasks />
      </div>
    </div>
  );
}
