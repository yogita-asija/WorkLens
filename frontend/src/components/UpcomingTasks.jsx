import { useState, useEffect } from "react";
import { CheckSquare, Square, Clock, Flag, Loader } from "lucide-react";
import useAppStore from "../store/useAppStore";
import * as api from "../services/api";

const priorityConfig = {
  high:   { color: "#f87171", label: "High" },
  medium: { color: "#f59e0b", label: "Med"  },
  low:    { color: "#4ade80", label: "Low"  },
};

function TaskItem({ task, onToggle }) {
  const p = priorityConfig[task.priority] || priorityConfig.low;
  return (
    <div
      className={`flex items-start gap-3 py-3 border-b border-[#242424] last:border-b-0 group transition-opacity ${task.done ? "opacity-40" : ""}`}
    >
      <button onClick={() => onToggle(task.id)} className="mt-0.5 flex-shrink-0 text-neutral-500 hover:text-green-400 transition-colors cursor-pointer">
        {task.done ? <CheckSquare size={16} className="text-green-500" /> : <Square size={16} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.done ? "line-through text-neutral-500" : "text-white"}`}>
          {task.label}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Clock size={11} className="text-neutral-600" />
          <span className="text-xs text-neutral-600">{task.due}</span>
        </div>
      </div>
      <span
        className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
        style={{ background: p.color + "18", color: p.color }}
      >
        {p.label}
      </span>
    </div>
  );
}

export default function UpcomingTasks() {
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAppStore();

  useEffect(() => {
    const params = user?._id ? { userId: user._id } : {};
    api.getUpcomingTasks(params)
      .then(data => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [user?._id]);

  const toggle = (id) => setTasks(t => t.map(x => x.id === id ? { ...x, done: !x.done } : x));
  const done   = tasks.filter(t => t.done).length;

  return (
    <div className="bg-[#1c1c1c] text-white p-5 rounded-2xl border border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Flag size={15} className="text-neutral-500" />
          Tasks & To-Do
        </h3>
        {!loading && tasks.length > 0 && (
          <span className="text-xs text-neutral-500">{done}/{tasks.length} done</span>
        )}
      </div>
      <p className="text-xs text-neutral-600 mb-3">Assignment deadlines from your courses</p>

      {/* Mini progress */}
      {!loading && tasks.length > 0 && (
        <div className="w-full h-1 rounded-full bg-[#2a2a2a] overflow-hidden mb-4">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${tasks.length > 0 ? (done / tasks.length) * 100 : 0}%` }}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-neutral-600">
          <Loader size={16} className="animate-spin" />
          <span className="text-sm">Loading tasks…</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-8 text-center">
          <CheckSquare size={28} className="text-neutral-700 mx-auto mb-2" />
          <p className="text-sm text-neutral-500">No upcoming assignment deadlines</p>
        </div>
      ) : (
        <div>
          {tasks.map(task => <TaskItem key={task.id} task={task} onToggle={toggle} />)}
        </div>
      )}
    </div>
  );
}
