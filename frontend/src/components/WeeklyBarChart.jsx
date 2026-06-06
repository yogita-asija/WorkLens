import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const fallback = [
  { day: "Mon", activities: 12 },
  { day: "Tue", activities: 18 },
  { day: "Wed", activities: 10 },
  { day: "Thu", activities: 15 },
  { day: "Fri", activities: 11 },
  { day: "Sat", activities: 5  },
  { day: "Sun", activities: 3  },
];

export default function WeeklyBarChart() {
  const [data, setData] = useState(fallback);

  useEffect(() => {
    fetch("http://localhost:8000/api/dashboard/weekly-activity")
      .then(res => res.json())
      .then(d => { if (d?.length) setData(d) })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-[#1c1c1c] text-white p-6 rounded-2xl border border-[#333333]">
      <h3 className="text-lg font-semibold mb-4">Weekly Activity</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid stroke="#3a3a3a" strokeDasharray="3 3" />
          <XAxis dataKey="day" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            cursor={{ fill: "transparent" }}
            contentStyle={{ backgroundColor: "#2f2f2f", border: "1px solid #333333", color: "#ffffff", borderRadius: "10px" }}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Bar dataKey="activities" fill="#22c55e" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
