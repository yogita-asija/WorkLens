import { useEffect, useState } from "react";

const fallback = [
  { title: "Uploaded assignment",      sub: "CS401 - Advanced Algorithms", time: "2 hours ago" },
  { title: "Marked attendance",        sub: "CS301 - Data Structures",     time: "4 hours ago" },
  { title: "Updated course materials", sub: "CS201 - Programming II",      time: "1 day ago"   },
  { title: "Graded submissions",       sub: "CS401 - Advanced Algorithms", time: "1 day ago"   },
  { title: "Created new assignment",   sub: "CS101 - Intro to CS",         time: "2 days ago"  },
];

export default function RecentActivity() {
  const [items, setItems] = useState(fallback);

  useEffect(() => {
    fetch("http://localhost:8000/api/dashboard/recent-activity")
      .then(res => res.json())
      .then(d => { if (d?.length) setItems(d) })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-[#1c1c1c] text-white p-6 rounded-2xl border border-[#333333]">
      <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {items.map((it, idx) => (
          <div key={idx} className="pb-4 border-b border-[#333333] last:border-b-0 last:pb-0">
            <p className="font-semibold text-white">{it.title}</p>
            <p className="text-sm text-neutral-400">{it.sub}</p>
            <p className="text-xs text-neutral-500 mt-1">{it.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
