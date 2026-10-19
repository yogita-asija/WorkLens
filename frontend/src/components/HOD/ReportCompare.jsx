import { useState } from "react";
import { AlertTriangle } from "lucide-react"; // yeh HodReports me already chal raha hai
import * as hod from "../../services/HOD/hodApi";
import { btnPrimary, inputCls } from "./HodModal";

const idOf = (s) => s._id || s.id;
const when = (d) => (d ? new Date(d).toLocaleDateString() : "");

export default function ReportCompare({ saved = [] }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);
  const [onlyFlagged, setOnlyFlagged] = useState(true);

  if (saved.length < 2) {
    return (
      <div className="rp-noprint text-sm opacity-70">
        Atleast 2 reporst are required to compare. Please save more reports first.
      </div>
    );
  }

  const run = async () => {
    setErr(""); setRes(null); setBusy(true);
    try {
      setRes(await hod.compareReportSnapshots(a, b));
    } catch (e) {
      setErr(e.message || "Compare failed");
    } finally {
      setBusy(false);
    }
  };

  const rows = res ? res.changes.filter((c) => !onlyFlagged || c.flagged) : [];

  return (
    <section className="rp-noprint space-y-3">
      <h3 className="font-semibold">Compare two reports</h3>

      <div className="flex flex-wrap gap-2 items-center">
        <select className={inputCls} value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">Report 1…</option>
          {saved.map((s) => (
            <option key={idOf(s)} value={idOf(s)}>{s.title} ({when(s.createdAt)})</option>
          ))}
        </select>
        <span className="opacity-60 text-sm">vs</span>
        <select className={inputCls} value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">Report 2…</option>
          {saved.map((s) => (
            <option key={idOf(s)} value={idOf(s)}>{s.title} ({when(s.createdAt)})</option>
          ))}
        </select>
        <button className={btnPrimary} disabled={!a || !b || a === b || busy} onClick={run}>
          {busy ? "Comparing…" : "Compare"}
        </button>
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      {res && (
        <div className="space-y-3">
          <p className="text-sm opacity-80">
            <b>{res.from.title}</b> ({when(res.from.createdAt)}) → <b>{res.to.title}</b> ({when(res.to.createdAt)})
          </p>

          {res.warnings.map((w, i) => (
            <div key={i} className="flex gap-2 text-sm rounded-lg p-3 bg-amber-500/10 text-amber-500">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {w}
            </div>
          ))}

          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-red-500">{res.summary.worse} worse</span>
            <span className="text-emerald-500">{res.summary.better} better</span>
            <span className="opacity-70">{res.summary.changed} changed / {res.summary.compared} metrics</span>
            <label className="ml-auto flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
              Only significant changes
            </label>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm opacity-70">Koi significant badlav nahi mila.</p>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((c) => {
                const bad = c.verdict === "worse", good = c.verdict === "better";
                
                return (
                  <li
                    key={c.path}
                    className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                      bad ? "bg-red-500/10 text-red-500"
                      : good ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-slate-500/10"
                    }`}
                  >
                    <span className="shrink-0 w-4 text-center">{c.delta < 0 ? "▼" : "▲"}</span>
                    <span>{c.message}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}