import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, CheckSquare, BookOpen, Star, PlusCircle,
  FileText, Clock, ChevronRight, Loader, UserCheck, AlertCircle
} from "lucide-react";
import * as api from "../services/api";

const typeConfig = {
  upload:       { Icon: Upload,      color: "#3b82f6", bg: "#1e3a5f" },
  attendance:   { Icon: CheckSquare, color: "#22c55e", bg: "#14291a" },
  course:       { Icon: BookOpen,    color: "#a855f7", bg: "#2d1b45" },
  grade:        { Icon: Star,        color: "#f59e0b", bg: "#2d2200" },
  create:       { Icon: PlusCircle,  color: "#22c55e", bg: "#14291a" },
  assignment:   { Icon: FileText,    color: "#3b82f6", bg: "#1e3a5f" },
  leave:        { Icon: CalendarOff, color: "#f87171", bg: "#2d1515" },
  workflow:     { Icon: AlertCircle, color: "#f59e0b", bg: "#2d2200" },
  system:       { Icon: UserCheck,   color: "#9ca3af", bg: "#262626" },
  default:      { Icon: FileText,    color: "#9ca3af", bg: "#262626" },
};

// CalendarOff isn't in lucide-react 0.383 — use a fallback
function CalendarOff(props) { return <AlertCircle {...props} />; }

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
        {sub && <p className="text-xs text-neutral-500 mt-0.5 truncate">{sub}</p>}
      </div>
      <div className="flex items-center gap-1 text-xs text-neutral-600 flex-shrink-0">
        <Clock size={11} />
        <span>{time}</span>
      </div>
    </div>
  );
}

export default function RecentActivity() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getRecentActivity()
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-[#1c1c1c] text-white p-5 rounded-2xl border border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold">Recent Activity</h3>
        <button
          onClick={() => navigate("/activity-logs")}
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-white transition-colors cursor-pointer"
        >
          View all <ChevronRight size={12} />
        </button>
      </div>
      <p className="text-xs text-neutral-600 mb-4">Your latest actions across all courses</p>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-neutral-600">
          <Loader size={16} className="animate-spin" />
          <span className="text-sm">Loading activity…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center">
          <FileText size={28} className="text-neutral-700 mx-auto mb-2" />
          <p className="text-sm text-neutral-500">No recent activity</p>
        </div>
      ) : (
        <div>
          {items.map((it, idx) => (
            <ActivityItem key={idx} {...it} isLast={idx === items.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}
