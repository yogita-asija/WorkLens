import { useState, useEffect } from "react";
import { MessageSquare, Clock, Users, BarChart, FileText } from "lucide-react";

export default function WorkflowReview() {
  const [view, setView] = useState("faculty");
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  const options = [
    { label: "Approval Delays",                    icon: Clock },
    { label: "Resource Availability Issues",        icon: Users },
    { label: "Communication Gaps",                  icon: MessageSquare },
    { label: "Workload Distribution Issues",         icon: BarChart },
    { label: "Policy or Procedure Clarity Issues",  icon: FileText },
  ];

  // Auto reset after submit
  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        setSubmitted(false);
        setSelected("");
        setMessage("");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [submitted]);

  const handleSubmit = async () => {
    // POST to backend
    try {
      await fetch("http://localhost:5000/api/workflow/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: selected, message }),
      });
    } catch (err) {
      // If backend is down, still show success to user
      console.log("Backend not reachable, saving locally skipped");
    }
    setSubmitted(true);
  };

  return (
    <div className="text-white space-y-6">

      {/* Heading */}
      <div>
        <h1 className="text-2xl font-semibold">Department Workflow Review</h1>
        <p className="text-neutral-400 mt-1">
          Help improve department processes through structured and anonymous feedback
        </p>
      </div>

      {/* Main Card */}
      {submitted ? (
        // SUCCESS SCREEN
        <div className="bg-[#1c1c1c] p-6 rounded-xl border border-[#333333] flex flex-col items-center justify-center h-[300px] text-center transition-all duration-500">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-3 text-green-400 text-xl">
            ✔
          </div>
          <h2 className="text-lg font-semibold">Thank You</h2>
          <p className="text-neutral-400 text-sm mt-2 max-w-md">
            Your feedback has been recorded to help improve departmental workflows.
            The information will be reviewed in aggregate to identify process improvement opportunities.
          </p>
        </div>
      ) : (
        // FORM UI
        <div className="bg-[#1c1c1c] p-6 rounded-xl border border-[#333333] transition-all duration-500">
          <h2 className="text-lg font-medium mb-4">Submit Workflow Feedback</h2>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {options.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  onClick={() => setSelected(item.label)}
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition ${
                    selected === item.label
                      ? "bg-[#262626] border-[#333333]"
                      : "bg-[#1c1c1c] border-[#333333] hover:bg-[#262626]"
                  }`}
                >
                  <Icon size={18} className="text-white" />
                  <span className="text-sm">{item.label}</span>
                </div>
              );
            })}
          </div>

          {/* Textarea */}
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Briefly describe the workflow issue you've observed..."
            className="w-full p-3 rounded-lg bg-[#262626] border border-[#333333] text-white placeholder-neutral-500 mb-4 focus:outline-none focus:border-neutral-500"
            rows={3}
          />

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            className="w-full py-3 rounded-xl bg-[#262626] hover:bg-[#2f2f2f] border border-[#333333] transition"
          >
            Submit Feedback
          </button>

          {/* Info */}
          <p className="text-xs text-neutral-400 mt-4">
            All submissions are completely anonymous and reviewed only in aggregated form.
          </p>
        </div>
      )}
    </div>
  );
}
