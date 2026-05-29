import DashboardHeader from "../components/DashboardHeader";
import WeeklyBarChart from "../components/WeeklyBarChart";
import HoursLineChart from "../components/HoursLineChart";
import RecentActivity from "../components/RecentActivity";
import ActiveCourses from "../components/ActiveCourses";

export default function Dashboard() {
  return (
    <div className="space-y-6 text-white font-sans">
      <DashboardHeader />
      <WeeklyBarChart />
      <HoursLineChart />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RecentActivity />
        <ActiveCourses />
      </div>
    </div>
  );
}
