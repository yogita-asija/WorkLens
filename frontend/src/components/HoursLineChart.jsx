import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const fallback = [
  { day: "Mon", hours: 6 },
  { day: "Tue", hours: 8 },
  { day: "Wed", hours: 5 },
  { day: "Thu", hours: 7 },
  { day: "Fri", hours: 6 },
  { day: "Sat", hours: 3 },
  { day: "Sun", hours: 2 },
];

export default function HoursLineChart() {
  const [data, setData] = useState(fallback);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/dashboard/hours`)
      .then(res => res.json())
      .then(d => { if (d?.length) setData(d) })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-[#1c1c1c] text-white p-6 rounded-2xl border border-[#333333]">
      <h3 className="text-lg font-semibold mb-4">Hours Spent</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid stroke="#3a3a3a" strokeDasharray="3 3" />
          <XAxis dataKey="day" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{ backgroundColor: "#2f2f2f", border: "1px solid #333333", color: "#ffffff", borderRadius: "10px" }}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Line type="monotone" dataKey="hours" stroke="#22c55e" strokeWidth={3} dot={{ r: 4, fill: "#22c55e" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
