import { useState } from "react";
import { CheckSquare, Square, Clock, Flag } from "lucide-react";

const defaultTasks = [
  { id: 1, label: "Grade CS401 midterm papers",   due: "Today",       priority: "high",   done: false },
  { id: 2, label: "Prepare lab session material",  due: "Tomorrow",    priority: "medium", done: false },
  { id: 3, label: "Submit monthly activity report",due: "In 3 days",   priority: "high",   done: false },
  { id: 4, label: "Update syllabus for CS301",     due: "This week",   priority: "low",    done: true  },
  { id: 5, label: "Review leave application",      due: "Today",       priority: "medium", done: false },
];

const priorityConfig = {
  high:   { color: "#f87171", label: "High" },
  medium: { color: "#f59e0b", label: "Med"  },
  low:    { color: "#4ade80", label: "Low"  },
};

function TaskItem({ task, onToggle }) {
  const p = priorityConfig[task.priority];
  return (
    <div
      className={`flex items-start gap-3 py-3 border-b border-[#242424] last:border-b-0 group transition-opacity ${task.done ? "opacity-40" : ""}`}
    >
      <button onClick={() => onToggle(task.id)} className="mt-0.5 flex-shrink-0 text-neutral-500 hover:text-green-400 transition-colors">
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
  const [tasks, setTasks] = useState(defaultTasks);

  const toggle = (id) => setTasks(t => t.map(x => x.id === id ? { ...x, done: !x.done } : x));
  const done   = tasks.filter(t => t.done).length;

  return (
    <div className="bg-[#1c1c1c] text-white p-5 rounded-2xl border border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Flag size={15} className="text-neutral-500" />
          Tasks & To-Do
        </h3>
        <span className="text-xs text-neutral-500">{done}/{tasks.length} done</span>
      </div>
      <p className="text-xs text-neutral-600 mb-3">Your pending action items</p>

      {/* Mini progress */}
      <div className="w-full h-1 rounded-full bg-[#2a2a2a] overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-500"
          style={{ width: `${(done / tasks.length) * 100}%` }}
        />
      </div>

      <div>
        {tasks.map(task => <TaskItem key={task.id} task={task} onToggle={toggle} />)}
      </div>
    </div>
  );
}
