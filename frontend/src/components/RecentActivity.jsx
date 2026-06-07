import { useEffect, useState } from "react";
import {
  Upload, CheckSquare, BookOpen, Star, PlusCircle,
  FileText, Clock, ChevronRight
} from "lucide-react";

const fallback = [
  { title: "Uploaded assignment",      sub: "CS401 — Advanced Algorithms", time: "2 hours ago",  type: "upload" },
  { title: "Marked attendance",        sub: "CS301 — Data Structures",     time: "4 hours ago",  type: "attendance" },
  { title: "Updated course materials", sub: "CS201 — Programming II",      time: "1 day ago",    type: "course" },
  { title: "Graded submissions",       sub: "CS401 — Advanced Algorithms", time: "1 day ago",    type: "grade" },
  { title: "Created new assignment",   sub: "CS101 — Intro to CS",         time: "2 days ago",   type: "create" },
];

const typeConfig = {
  upload:     { Icon: Upload,     color: "#3b82f6", bg: "#1e3a5f" },
  attendance: { Icon: CheckSquare,color: "#22c55e", bg: "#14291a" },
  course:     { Icon: BookOpen,   color: "#a855f7", bg: "#2d1b45" },
  grade:      { Icon: Star,       color: "#f59e0b", bg: "#2d2200" },
  create:     { Icon: PlusCircle, color: "#22c55e", bg: "#14291a" },
  default:    { Icon: FileText,   color: "#9ca3af", bg: "#262626" },
};

function ActivityItem({ title, sub, time, type, isLast }) {
  const cfg = typeConfig[type] || typeConfig.default;
  const { Icon } = cfg;

  return (
    <div className={`flex items-start gap-3 py-3 ${!isLast ? "border-b border-[#242424]" : ""}`}>
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{title}</p>
        <p className="text-xs text-neutral-500 mt-0.5 truncate">{sub}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-neutral-600 flex-shrink-0">
        <Clock size={11} />
        <span>{time}</span>
      </div>
    </div>
  );
}

export default function RecentActivity() {
  const [items, setItems] = useState(fallback);

  useEffect(() => {
    fetch("http://localhost:8000/api/dashboard/recent-activity")
      .then(r => r.json())
      .then(d => { if (d?.length) setItems(d); })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-[#1c1c1c] text-white p-5 rounded-2xl border border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold">Recent Activity</h3>
        <button className="flex items-center gap-1 text-xs text-neutral-500 hover:text-white transition-colors">
          View all <ChevronRight size={12} />
        </button>
      </div>
      <p className="text-xs text-neutral-600 mb-4">Your latest actions across all courses</p>
      <div>
        {items.map((it, idx) => (
          <ActivityItem key={idx} {...it} isLast={idx === items.length - 1} />
        ))}
      </div>
    </div>
  );
}
