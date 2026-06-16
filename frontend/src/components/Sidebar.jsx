import { useState } from "react"
import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  CheckSquare, BookMarked, BarChart2, BookOpen, FileUp, Video, Target,
  FileQuestion, ClipboardList, Star, TrendingUp,
  Users, PieChart, AlertTriangle, MessageSquare,
  CalendarDays, Table2, Gauge, Activity,
  Settings, LogOut,
} from "lucide-react"

const menuGroups = [
  {
    group: null,
    items: [
      { name: "Dashboard", icon: LayoutDashboard, path: "/" },
    ],
  },
  {
    group: "Teaching",
    items: [
      { name: "Attendance",       icon: CheckSquare,  path: "/attendance"      },
      { name: "Courses",          icon: BookOpen,     path: "/courses"         },
      { name: "Assignments",      icon: FileQuestion, path: "/assignments"     },
      { name: "Study Materials",  icon: FileUp,       path: "/materials"       },
      { name: "Lesson Plans",     icon: BookMarked,   path: "/lesson-plans"    },
      // { name: "Syllabus Progress",icon: BarChart2,    path: "/syllabus"        },
      { name: "Online Classes",   icon: Video,        path: "/online-classes"  },
      // { name: "OBE Mapping",      icon: Target,       path: "/obe-mapping"     },
    ],
  },
  {
    group: "Assessment",
    items: [
      { name: "Internal Marks",   icon: ClipboardList, path: "/internal-marks" },
      { name: "Question Papers",  icon: FileQuestion,  path: "/question-papers"},
      // { name: "Grades & Rubrics", icon: Star,          path: "/grades"         },
      // { name: "Performance",      icon: TrendingUp,    path: "/performance"    },
    ],
  },
  {
    group: "Students",
    items: [
      // { name: "Attendance Reports",icon: PieChart,       path: "/student-attendance" },
      // { name: "Performance Reports",icon: Users,         path: "/student-performance"},
      // { name: "At-Risk Students",  icon: AlertTriangle,  path: "/at-risk"            },
      { name: "Student Messages",  icon: MessageSquare,  path: "/student-messages"   },
    ],
  },
  {
    group: "Self-Service",
    items: [
      { name: "Leave Management", icon: CalendarDays, path: "/leave-management" },
      { name: "My Timetable",     icon: Table2,       path: "/timetable"        },
      // { name: "Workload",         icon: Gauge,        path: "/workload"         },
      // { name: "KPI Dashboard",    icon: Activity,     path: "/kpi"              },
      { name: "Extra Duties",     icon: Users,        path: "/extra-duties"     },
      { name: "Workflow Review",  icon: Activity,     path: "/workflow"         },
      { name: "Activity Logs",    icon: Activity,     path: "/activity-logs"    },
    ],
  },
  {
    group: null,
    items: [
      { name: "Settings", icon: Settings, path: "/settings" },
    ],
  },
]

export default function Sidebar({ onLogout }) {
  const [showLogout, setShowLogout] = useState(false)

  return (
    <>
      <aside className="w-64 h-screen bg-black border-r border-neutral-800 flex flex-col flex-shrink-0">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-neutral-800">
          <h1 className="text-xl font-bold tracking-tight">WorkLens Edu</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Faculty Portal</p>
        </div>

        {/* Nav */}
        <nav className="px-3 flex-1 overflow-y-auto py-3">
          {menuGroups.map(({ group, items }, gi) => (
            <div key={group ?? `__top_${gi}`} className="mb-1">

              {group && (
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
                  {group}
                </p>
              )}

              <ul className="space-y-0.5">
                {items.map(({ name, icon: Icon, path }) => (
                  <li key={name}>
                    <NavLink
                      to={path}
                      end={path === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm cursor-pointer
                        ${isActive
                          ? "bg-white text-black font-semibold"
                          : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                        }`
                      }
                    >
                      <Icon size={16} />
                      <span>{name}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-neutral-800">
          <button
            onClick={() => setShowLogout(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-neutral-400 hover:bg-neutral-900 hover:text-white transition text-sm"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Logout modal */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/60">
          <div className="bg-[#1c1c1c] border border-neutral-800 rounded-2xl px-10 py-8 flex flex-col items-center gap-6 shadow-2xl">
            <p className="text-white text-center text-base font-medium leading-relaxed">
              Are you sure you<br />want to logout?
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowLogout(false)}
                className="px-6 py-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowLogout(false); onLogout?.() }}
                className="px-6 py-2 rounded-full bg-green-500 hover:bg-green-600 text-black text-sm font-semibold transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
