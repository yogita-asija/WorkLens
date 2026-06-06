import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar } from "react-chartjs-2";
import DatePicker from "react-datepicker";

import {
  Calendar,
  RefreshCw,
} from "lucide-react";

import "react-datepicker/dist/react-datepicker.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

const API = "http://localhost:8000/api/leaves";
const FACULTY_ID = "faculty_001";

function statusBadge(status) {
  const base =
    "px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md border";

  if (status === "Approved")
    return `${base} bg-green-500/20 text-green-400 border-green-500/30`;

  if (status === "Pending")
    return `${base} bg-yellow-500/20 text-yellow-400 border-yellow-500/30`;

  return `${base} bg-red-500/20 text-red-400 border-red-500/30`;
}

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const LeaveManagement = () => {
  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    type: "",
    from: null,
    to: null,
    reason: "",
  });

  const [leaves, setLeaves] = useState([]);

  const [balance, setBalance] = useState({
    totalLeaves: 12,
    taken: 0,
    remaining: 12,
    holidaysAvailed: 8,
  });

  const [monthly, setMonthly] = useState(
    new Array(12).fill(0)
  );

  // DYNAMIC HOLIDAYS
  const [holidays, setHolidays] = useState([]);

  // FETCH EVERYTHING
  const fetchAll = async () => {
    setLoading(true);
    setError(null);

    try {
      const [lR, bR, mR, hR] = await Promise.all([
        fetch(`${API}?facultyId=${FACULTY_ID}`),
        fetch(`${API}/balance?facultyId=${FACULTY_ID}`),
        fetch(`${API}/monthly?facultyId=${FACULTY_ID}`),
        fetch(`${API}/holidays`),
      ]);

      const [lD, bD, mD, hD] = await Promise.all([
        lR.json(),
        bR.json(),
        mR.json(),
        hR.json(),
      ]);

      if (lD.success) {
        setLeaves(lD.data);
      }

      if (bD.success) {
        const totalLeaves =
          bD.data.totalLeaves || 12;

        // NEVER EXCEED TOTAL LEAVES
        const takenLeaves = Math.min(
          bD.data.taken || 0,
          totalLeaves
        );

        setBalance({
          ...bD.data,
          taken: takenLeaves,
          remaining: Math.max(
            totalLeaves - takenLeaves,
            0
          ),
        });
      }

      if (mD.success) {
        setMonthly(
          mD.data.map((d) => d.days)
        );
      }

      // DYNAMIC HOLIDAYS FROM DATABASE
      if (hD.success) {
        setHolidays(hD.data);
      }

    } catch {
      setError(
        "Could not reach the server. Make sure the backend is running on port 5000."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // APPLY LEAVE
  const handleSubmit = async () => {
    if (
      !form.type ||
      !form.from ||
      !form.reason.trim()
    ) {
      alert("Please fill all fields");
      return;
    }

    if (form.to && form.to < form.from) {
      alert(
        "End date cannot be before start date"
      );
      return;
    }

    // CALCULATE DAYS
    const start = new Date(form.from);

    const end = form.to
      ? new Date(form.to)
      : new Date(form.from);

    const leaveDays =
      Math.floor(
        (end - start) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    // BLOCK EXCEEDING LEAVES
    if (
      balance.taken + leaveDays >
      balance.totalLeaves
    ) {
      alert(
        "You have reached your maximum leave limit. Please contact the administration team for approval of additional leave requests."
      );

      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(API, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          facultyId: FACULTY_ID,
          type: form.type,
          fromDate: form.from.toISOString(),
          toDate: (
            form.to || form.from
          ).toISOString(),
          reason: form.reason,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message);
        return;
      }

      setForm({
        type: "",
        from: null,
        to: null,
        reason: "",
      });

      setOpen(false);

      await fetchAll();

    } catch {
      alert("Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="p-6 text-white flex items-center gap-3">
        <RefreshCw
          className="animate-spin"
          size={20}
        />
        Loading leave data…
      </div>
    );

  // PROGRESS %
  const progressPercent = Math.min(
    (balance.taken /
      balance.totalLeaves) *
      100,
    100
  );

  return (
    <div className="px-6 pt-1 pb-6 text-white">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">

        <div>
          <h1
            className="text-2xl font-semibold"
            style={{
              fontSize: "24px",
              margin: 0,
            }}
          >
            Leave & Holiday Management
          </h1>

          <p className="text-gray-400" style={{
              fontSize: "14px",
              margin: 0,
            }}>
            Track paid leaves, balances,
            and holiday utilization.
          </p>
        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={fetchAll}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>

          <button
            onClick={() => setOpen(true)}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg"
          >
            + Apply Leave
          </button>

        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

        {[
          {
            title: "Total Paid Leaves",
            value: balance.totalLeaves,
          },

          {
            title: "Leaves Taken",
            value: balance.taken,
          },

          {
            title: "Remaining Balance",
            value: balance.remaining,
          },

          {
            title: "Holidays Availed",
            value: holidays.length,
          },

        ].map((card, i) => (
          <div
            key={i}
            className="bg-[#1c1c1c] p-4 rounded-xl"
          >
            <h2 className="text-gray-400 text-sm">
              {card.title}
            </h2>

            <p className="text-2xl font-bold mt-2">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* PROGRESS + CHART */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

        {/* PROGRESS */}
        <div className="bg-[#1c1c1c] p-4 rounded-xl">

          <h2 className="mb-3 font-medium">
            Leave Usage Progress
          </h2>

          <div className="w-full bg-gray-700 rounded-full h-3 mb-2 overflow-hidden">

            {/* GREEN BAR STARTS FROM LEFT */}
            <div
              className="bg-green-500 h-3 rounded-full transition-all"
              style={{
                width: `${progressPercent}%`,
                marginLeft: 0,
              }}
            />
          </div>

          <p className="text-sm text-gray-400">
            {balance.taken} of{" "}
            {balance.totalLeaves} leaves used
          </p>

          <div className="mt-4 space-y-1 text-sm">

            {[
              "Sick",
              "Casual",
              "Earned",
            ].map((t) => {

              const count = leaves
                .filter(
                  (l) =>
                    l.type === t &&
                    l.status === "Approved"
                )
                .reduce(
                  (s, l) =>
                    s + l.duration,
                  0
                );

              return (
                <div
                  key={t}
                  className="flex justify-between text-gray-400"
                >
                  <span>{t} Leave</span>

                  <span>
                    {count} day
                    {count !== 1
                      ? "s"
                      : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CHART */}
        <div className="bg-[#1c1c1c] p-4 rounded-xl">

          <h2 className="mb-3 font-medium">
            Monthly Leave Taken
          </h2>

          <Bar
            data={{
              labels: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ],

              datasets: [
                {
                  label: "Days",
                  data: monthly,
                  backgroundColor:
                    "#22c55e",
                },
              ],
            }}

            options={{
              plugins: {
                legend: {
                  align: "start", // LEFT CORNER
                  labels: {
                    color: "white",
                  },
                },
              },

              scales: {
                x: {
                  ticks: {
                    color: "white",
                  },

                  grid: {
                    color: "#333",
                  },
                },

                y: {
                  ticks: {
                    color: "white",
                  },

                  grid: {
                    color: "#333",
                  },

                  beginAtZero: true,
                },
              },
            }}
          />
        </div>
      </div>

      {/* LEAVE HISTORY */}
      <div className="bg-[#1c1c1c] p-4 rounded-xl mb-6">

        <h2 className="mb-4 font-medium">
          Leave History
        </h2>

        {leaves.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No leave applications yet.
          </p>
        ) : (
          <table className="w-full text-sm">

            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="text-left py-2">
                  From
                </th>

                <th className="text-left py-2">
                  To
                </th>

                <th className="text-left py-2">
                  Type
                </th>

                <th className="text-left py-2">
                  Reason
                </th>

                <th className="text-left py-2">
                  Days
                </th>

                <th className="text-left py-2">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {leaves.map((row) => (
                <tr
                  key={row._id}
                  className="border-b border-gray-800"
                >
                  <td className="py-2">
                    {fmt(row.fromDate)}
                  </td>

                  <td>
                    {fmt(row.toDate)}
                  </td>

                  <td>{row.type}</td>

                  <td className="max-w-[160px] truncate">
                    {row.reason}
                  </td>

                  <td>{row.duration}</td>

                  <td>
                    <span
                      className={statusBadge(
                        row.status
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* HOLIDAYS */}
      {holidays.length > 0 && (
        <div className="bg-[#1c1c1c] p-4 rounded-xl">

          <h2 className="mb-4 font-medium">
            Public Holidays 2026
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

            {holidays.map((h) => (
              <div
                key={h._id}
                className="flex items-start gap-3 p-3 bg-[#2a2a2a] rounded-lg"
              >

                <div className="w-2 h-2 mt-1.5 rounded-full bg-green-400 flex-shrink-0" />

                <div>
                  <p className="text-sm font-medium">
                    {h.name}
                  </p>

                  <p className="text-xs text-gray-400">
                    {fmt(h.date)}
                  </p>

                  <span className="text-xs text-gray-500">
                    {h.type}
                  </span>
                </div>

              </div>
            ))}

          </div>
        </div>
      )}

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

          <div className="bg-[#1c1c1c] w-full max-w-2xl p-6 rounded-xl relative">

            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-lg font-semibold mb-4">
              Apply Leave
            </h2>

            <div className="grid grid-cols-2 gap-4">

              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                  })
                }
                className="col-span-2 p-2 bg-[#2a2a2a] rounded text-white"
              >
                <option value="">
                  Select Leave Type
                </option>

                <option value="Sick">
                  Sick Leave
                </option>

                <option value="Casual">
                  Casual Leave
                </option>

                <option value="Earned">
                  Earned Leave
                </option>
              </select>

              <div className="relative">

                <label className="text-xs text-gray-400 mb-1 block">
                  From Date
                </label>

                <DatePicker
                  selected={form.from}
                  onChange={(date) =>
                    setForm({
                      ...form,
                      from: date,
                    })
                  }
                  className="p-2 bg-[#2a2a2a] text-white rounded w-full pr-10"
                  placeholderText="Start date"
                />

                <Calendar
                  className="absolute right-3 top-8 text-gray-400 pointer-events-none"
                  size={16}
                />
              </div>

              <div className="relative">

                <label className="text-xs text-gray-400 mb-1 block">
                  To Date (optional for single day)
                </label>

                <DatePicker
                  selected={form.to}
                  onChange={(date) =>
                    setForm({
                      ...form,
                      to: date,
                    })
                  }
                  minDate={form.from}
                  className="p-2 bg-[#2a2a2a] text-white rounded w-full pr-10"
                  placeholderText="End date"
                />

                <Calendar
                  className="absolute right-3 top-8 text-gray-400 pointer-events-none"
                  size={16}
                />
              </div>

              <textarea
                value={form.reason}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reason: e.target.value,
                  })
                }
                placeholder="Reason for leave…"
                rows={3}
                className="col-span-2 p-2 bg-[#2a2a2a] rounded text-white resize-none"
              />

              <div className="col-span-2 text-xs text-gray-400">

                Remaining balance:

                <span className="text-white font-medium">
                  {" "}
                  {balance.remaining} day(s)
                </span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 py-2 rounded font-medium"
            >
              {submitting
                ? "Submitting…"
                : "Submit Application"}
            </button>
          </div>
        </div>
      )}

      {/* DATEPICKER STYLES */}
      <style>{`
        .react-datepicker {
          background-color: #1c1c1c !important;
          border: none !important;
        }

        .react-datepicker__header {
          background-color: #1c1c1c !important;
          border-bottom: 1px solid #333 !important;
        }

        .react-datepicker__day,
        .react-datepicker__day-name {
          color: white !important;
        }

        .react-datepicker__day:hover {
          background-color: #22c55e !important;
          color: black !important;
        }

        .react-datepicker__day--selected {
          background-color: #22c55e !important;
          color: black !important;
        }

        .react-datepicker__current-month {
          color: white !important;
        }

        .react-datepicker__navigation-icon::before {
          border-color: white !important;
        }
      `}</style>
    </div>
  );
};

export default LeaveManagement;