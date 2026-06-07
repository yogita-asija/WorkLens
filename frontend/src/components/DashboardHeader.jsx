import { useEffect, useState } from "react";
import {
  BookOpen, FileText, Clock, CheckSquare, Bell,
  AlertCircle, CalendarDays, ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";
import useAppStore from "../store/useAppStore";

function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(t);
  }, [target, duration]);
  return val;
}

function StatCard({ title, rawValue, suffix = "", trend, trendDir, Icon, delay, accent }) {
  const num = typeof rawValue === "number" ? rawValue : 0;
  const animated = useCountUp(num);
  const display = typeof rawValue === "number" ? animated : rawValue;
  const TrendIcon = trendDir === "up" ? ArrowUpRight : trendDir === "down" ? ArrowDownRight : Minus;
  const trendColor = trendDir === "up" ? "#4ade80" : trendDir === "down" ? "#f87171" : "#9ca3af";

  return (
    <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5 flex flex-col gap-4 transition-all hover:border-[#3a3a3a] hover:bg-[#222222]" style={{ animationDelay: delay }}>
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: accent + "18", color: accent }}>
          <Icon size={18} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-medium" style={{ color: trendColor }}>
            <TrendIcon size={13} />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-white tracking-tight">{display}</span>
          {suffix && <span className="text-lg font-semibold mb-0.5 text-neutral-400">{suffix}</span>}
        </div>
        <p className="text-sm text-neutral-500 mt-1">{title}</p>
      </div>
    </div>
  );
}

function ClassPill({ name, time, idx }) {
  const colors = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b"];
  const c = colors[idx % colors.length];
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#2a2a2a] last:border-b-0">
      <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: c }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{name}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{time}</p>
      </div>
      <span className="text-[10px] px-2 py-1 rounded-full font-medium" style={{ background: c + "18", color: c }}>Today</span>
    </div>
  );
}

function DeadlineItem({ title, note, urgent }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#2a2a2a] last:border-b-0">
      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${urgent ? "bg-red-500" : "bg-yellow-500"}`} />
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{note}</p>
      </div>
    </div>
  );
}

function NoticeItem({ text }) {
  return (
    <div className="flex items-start gap-3 bg-[#1a2a1a] border border-green-900/40 rounded-xl p-3">
      <Bell size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-neutral-300 leading-relaxed">{text}</p>
    </div>
  );
}

function QuickAction({ label, Icon, accent }) {
  return (
    <button className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] hover:bg-[#252525] hover:border-[#3a3a3a] transition-all group">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: accent + "18", color: accent }}>
        <Icon size={18} />
      </div>
      <span className="text-xs text-neutral-400 group-hover:text-white transition-colors font-medium text-center leading-tight">{label}</span>
    </button>
  );
}

export default function DashboardHeader() {
  const [stats, setStats]   = useState(null);
  const [glance, setGlance] = useState(null);
  const { user } = useAppStore();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Extract first name from user object (tries name, firstName, username fields)
  const firstName = user?.name?.split(" ")[0]
    || user?.firstName
    || user?.username
    || "Faculty";

  useEffect(() => {
    fetch("http://localhost:8000/api/dashboard/stats")
      .then(r => r.json()).then(setStats)
      .catch(() => setStats({ classesTaught: 6, assignments: 24, activityScore: "94", weeklyHours: 37 }));

    fetch("http://localhost:8000/api/dashboard/today")
      .then(r => r.json()).then(setGlance)
      .catch(() => setGlance({
        todayDate: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
        classesToday: [
          { name: "CS401 — Advanced Algorithms", time: "10:00 AM – 11:30 AM" },
          { name: "CS301 — Data Structures",     time: "2:00 PM – 3:30 PM" },
        ],
        pendingApprovals: 2,
        deadlines: [
          { title: "Assignment review due", note: "Due today",    urgent: true  },
          { title: "Grade submissions",     note: "Due in 2 days", urgent: false },
        ],
        notices: ["Faculty meeting scheduled for 4:00 PM in Conference Room A"],
      }));
  }, []);

  if (!stats || !glance) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, <span className="text-green-400">{firstName}</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">{glance.todayDate}</p>
        </div>
        <div className="flex items-center gap-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-neutral-400">Active session</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Classes Taught"  rawValue={stats.classesTaught}           trend="+2 this sem"   trendDir="up"   Icon={BookOpen}    delay="0ms"   accent="#22c55e" />
        <StatCard title="Assignments"     rawValue={stats.assignments}             trend="+12% vs last"  trendDir="up"   Icon={FileText}    delay="60ms"  accent="#3b82f6" />
        <StatCard title="Activity Score"  rawValue={parseInt(stats.activityScore)} suffix="%" trend="–3% vs last" trendDir="down" Icon={CheckSquare} delay="120ms" accent="#a855f7" />
        <StatCard title="Weekly Hours"    rawValue={stats.weeklyHours}             trend="+5 hrs"        trendDir="up"   Icon={Clock}       delay="180ms" accent="#f59e0b" />
      </div>

      {/* Today at a Glance */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Today's Classes */}
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Today's Classes</h2>
            <span className="text-xs text-neutral-500 bg-[#2a2a2a] px-2 py-1 rounded-full">{glance.classesToday.length} scheduled</span>
          </div>
          {glance.classesToday.length === 0
            ? <p className="text-sm text-neutral-500 py-4 text-center">No classes scheduled</p>
            : glance.classesToday.map((c, i) => <ClassPill key={i} {...c} idx={i} />)
          }
        </div>

        {/* Deadlines */}
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Deadlines</h2>
            {glance.pendingApprovals > 0 && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full font-medium">{glance.pendingApprovals} pending</span>
            )}
          </div>
          {glance.deadlines.map((d, i) => <DeadlineItem key={i} {...d} />)}
          {glance.pendingApprovals > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-[#2a1a1a] border border-red-900/40 rounded-xl p-3">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300">{glance.pendingApprovals} items need your approval</p>
            </div>
          )}
        </div>

        {/* Notices + Quick Actions */}
        <div className="flex flex-col gap-4">
          <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5 flex-1">
            <h2 className="text-base font-semibold mb-4">Notices</h2>
            <div className="space-y-2">
              {glance.notices.map((n, i) => <NoticeItem key={i} text={n} />)}
            </div>
          </div>
          <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5">
            <h2 className="text-base font-semibold mb-3">Quick Actions</h2>
            <div className="grid grid-cols-3 gap-2">
              <QuickAction label="Mark Attendance" Icon={CheckSquare}  accent="#22c55e" />
              <QuickAction label="Apply Leave"     Icon={CalendarDays} accent="#3b82f6" />
              <QuickAction label="Upload Material" Icon={FileText}     accent="#a855f7" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
