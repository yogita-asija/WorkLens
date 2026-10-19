import { useEffect, useState } from "react";
import { Users, ChevronRight, BookOpen } from "lucide-react";

const fallback = [
  { code: "CS401", name: "Advanced Algorithms", students: 45, progress: 78,  sessions: 22, total: 28 },
  { code: "CS301", name: "Data Structures",     students: 62, progress: 85,  sessions: 24, total: 28 },
  { code: "CS201", name: "Programming II",      students: 54, progress: 92,  sessions: 26, total: 28 },
];

const ACCENTS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b"];

function ProgressBar({ value, color }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

function CourseCard({ code, name, students, progress, sessions, total, idx }) {
  const accent = ACCENTS[idx % ACCENTS.length];
  const statusLabel = progress >= 90 ? "Near Complete" : progress >= 70 ? "On Track" : "In Progress";
  const statusColor = progress >= 90 ? "#22c55e" : progress >= 70 ? "#3b82f6" : "#f59e0b";

  return (
    <div className="flex items-center gap-4 py-4 border-b border-[#242424] last:border-b-0 group">
      {/* Color indicator */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs"
        style={{ background: accent + "18", color: accent }}
      >
        {code.slice(0, 2)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-sm font-semibold text-white">{code}</p>
            <p className="text-xs text-neutral-500 truncate">{name}</p>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: statusColor + "18", color: statusColor }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
            <span className="flex items-center gap-1">
              <Users size={11} /> {students} students
            </span>
            <span>{sessions}/{total} sessions</span>
            <span className="font-semibold" style={{ color: accent }}>{progress}%</span>
          </div>
          <ProgressBar value={progress} color={accent} />
        </div>
      </div>
    </div>
  );
}

export default function ActiveCourses() {
  const [courses, setCourses] = useState(fallback);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/dashboard/courses`)
      .then(r => r.json())
      .then(d => { if (d?.length) setCourses(d); })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-[#1c1c1c] text-white p-5 rounded-2xl border border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold">Active Courses</h3>
        <button className="flex items-center gap-1 text-xs text-neutral-500 hover:text-white transition-colors">
          View all <ChevronRight size={12} />
        </button>
      </div>
      <p className="text-xs text-neutral-600 mb-4">Current semester progress overview</p>
      <div>
        {courses.map((c, i) => <CourseCard key={i} {...c} idx={i} />)}
      </div>
    </div>
  );
}
