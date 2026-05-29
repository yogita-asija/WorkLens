import { useEffect, useState } from "react";
import { BookOpen, FileText, TrendingUp, Clock, CheckSquare, Bell } from "lucide-react";

function StatCard({ title, value, trend, trendClass, Icon }) {
  return (
    <div className="bg-[#262626] text-white rounded-2xl border border-[#333333] p-5 flex justify-between items-start">
      <div>
        <p className="text-sm text-neutral-400">{title}</p>
        <p className="text-3xl font-semibold mt-2">{value}</p>
        <p className={`text-xs mt-2 ${trendClass}`}>{trend}</p>
      </div>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#2f2f2f]">
        <Icon size={20} className="text-white" />
      </div>
    </div>
  );
}

function GlanceCard({ title, count, Icon, children }) {
  return (
    <div className="bg-[#2f2f2f] text-white rounded-2xl border border-[#333333] p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#262626]">
          <Icon size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-neutral-400">{title}</p>
          <p className="text-xl font-semibold mt-1">{count}</p>
        </div>
      </div>
      <div className="mt-4 text-sm text-neutral-300 leading-6">{children}</div>
    </div>
  );
}

export default function DashboardHeader() {
  const [stats, setStats] = useState(null);
  const [glance, setGlance] = useState(null);

  useEffect(() => {
    // Fetch dashboard stats from backend
    fetch("http://localhost:9000/api/dashboard/stats")
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(() => {
        // Fallback data if backend is not running
        setStats({
          classesTaught: 6,
          assignments: 24,
          activityScore: "94%",
          weeklyHours: 37,
        });
      });

    fetch("http://localhost:9000/api/dashboard/today")
      .then(res => res.json())
      .then(data => setGlance(data))
      .catch(() => {
        setGlance({
          todayDate: "Saturday, February 21, 2026",
          classesToday: [
            { name: "CS401 - Advanced Algorithms", time: "10:00 AM - 11:30 AM" },
            { name: "CS301 - Data Structures", time: "2:00 PM - 3:30 PM" },
          ],
          pendingApprovals: 2,
          deadlines: [{ title: "Assignment review due", note: "Due today" }],
          notices: ["Faculty meeting scheduled for 4:00 PM in Conference Room A"],
        });
      });
  }, []);

  if (!stats || !glance) {
    return (
      <div className="text-neutral-500 text-sm">Loading dashboard...</div>
    );
  }

  return (
    <div className="space-y-6 text-white">

      {/* Heading */}
      <div>
        <h1 className="text-2xl font-semibold">Dashboard Overview</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Welcome back! Here's what's happening with your courses.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard title="Classes Taught"  value={stats.classesTaught}  trend="↑ 2 this semester"    trendClass="text-green-500" Icon={BookOpen} />
        <StatCard title="Assignments"     value={stats.assignments}     trend="↑ 12% vs last week"  trendClass="text-green-500" Icon={FileText} />
        <StatCard title="Activity Score"  value={stats.activityScore}   trend="↓ 3% vs last week"   trendClass="text-red-500"   Icon={TrendingUp} />
        <StatCard title="Weekly Hours"    value={stats.weeklyHours}     trend="↑ 5 hrs vs last week" trendClass="text-green-500" Icon={Clock} />
      </div>

      {/* Today at a Glance */}
      <div className="bg-[#1c1c1c] rounded-2xl border border-[#333333] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Today at a Glance</h2>
          <p className="text-xs text-neutral-400">{glance.todayDate}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <GlanceCard title="Classes Today" count={glance.classesToday.length} Icon={BookOpen}>
            {glance.classesToday.map((c, i) => (
              <div key={i} className={i > 0 ? "mt-3" : ""}>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-neutral-400">{c.time}</div>
              </div>
            ))}
          </GlanceCard>

          <GlanceCard title="Pending Approvals" count={glance.pendingApprovals} Icon={CheckSquare}>
            <div className="font-medium">{glance.pendingApprovals} items pending review</div>
            <div className="text-xs text-neutral-400">Click to review</div>
          </GlanceCard>

          <GlanceCard title="Deadlines" count={glance.deadlines.length} Icon={Clock}>
            {glance.deadlines.map((d, i) => (
              <div key={i}>
                <div className="font-medium text-red-500">{d.title}</div>
                <div className="text-xs text-neutral-400">{d.note}</div>
              </div>
            ))}
          </GlanceCard>

          <GlanceCard title="Important Notices" count={glance.notices.length} Icon={Bell}>
            {glance.notices[0]}
          </GlanceCard>
        </div>
      </div>
    </div>
  );
}
