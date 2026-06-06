import DashboardHeader from "../components/DashboardHeader";
<<<<<<< HEAD
=======
import WeeklyBarChart from "../components/WeeklyBarChart";
import HoursLineChart from "../components/HoursLineChart";
>>>>>>> 09f24e068a6d5e720349f39069d3dab7860edc3b
import RecentActivity from "../components/RecentActivity";
import ActiveCourses from "../components/ActiveCourses";

export default function Dashboard() {
  return (
    <div className="space-y-6 text-white font-sans">
      <DashboardHeader />
<<<<<<< HEAD
=======
      <WeeklyBarChart />
      <HoursLineChart />
>>>>>>> 09f24e068a6d5e720349f39069d3dab7860edc3b
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RecentActivity />
        <ActiveCourses />
      </div>
    </div>
  );
}
