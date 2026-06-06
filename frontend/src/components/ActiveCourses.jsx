import { useEffect, useState } from "react";

const fallback = [
  { code: "CS401", name: "Advanced Algorithms", students: 45, progress: 78 },
  { code: "CS301", name: "Data Structures",     students: 62, progress: 85 },
  { code: "CS201", name: "Programming II",      students: 54, progress: 92 },
];

function Course({ code, name, students, progress }) {
  return (
    <div className="bg-[#1c1c1c] border border-[#333333] rounded-2xl p-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-white">{code}</p>
          <p className="text-sm text-neutral-400">{name}</p>
        </div>
        <p className="text-xs text-neutral-400">{students} students</p>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-neutral-400 mb-2">
          <span>Progress</span>
          <span className="text-white font-semibold">{progress}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-neutral-700 overflow-hidden">
          <div className="h-2 bg-green-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function ActiveCourses() {
  const [courses, setCourses] = useState(fallback);

  useEffect(() => {
<<<<<<< HEAD
    fetch("http://localhost:8000/api/dashboard/courses")
=======
    fetch("http://localhost:9000/api/dashboard/courses")
>>>>>>> 09f24e068a6d5e720349f39069d3dab7860edc3b
      .then(res => res.json())
      .then(d => { if (d?.length) setCourses(d) })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-[#1c1c1c] text-white p-6 rounded-2xl border border-[#333333]">
      <h3 className="text-lg font-semibold mb-4">Active Courses</h3>
      <div className="space-y-4">
        {courses.map((c, i) => <Course key={i} {...c} />)}
      </div>
    </div>
  );
}
