import { useMemo, useState } from "react";
import axios from "axios";
import { AlertTriangle, CheckCircle2, Loader2, Play, XCircle } from "lucide-react";

const AI_AGENT_URL = (
  import.meta.env.VITE_AI_AGENT_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/$/, "");

const initialMessages = [
  "Show me white T-shirts",
  "krishnudi unda?",
  "I want my own image printed on a T-shirt",
  "Do you have oversized hoodies?",
];

const initialExpectedIntents = [
  "product_search",
  "product_search",
  "product_search",
  "product_search",
];

export default function AIAgentEvaluation() {
  const [messages, setMessages] = useState(initialMessages.join("\n"));
  const [expectedIntents, setExpectedIntents] = useState(initialExpectedIntents.join("\n"));
  const [runName, setRunName] = useState("Browser evaluation");
  const [evaluationKey, setEvaluationKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  const cases = useMemo(
    () => messages.split(/\r?\n/).map((message, index) => ({
      id: `browser-${index + 1}`,
      message: message.trim(),
      expected: expectedIntents.split(/\r?\n/)[index]?.trim() ? { intent: expectedIntents.split(/\r?\n/)[index].trim() } : {},
    })).filter((item) => item.message),
    [messages, expectedIntents],
  );

  const runEvaluation = async () => {
    if (!evaluationKey.trim() || !cases.length) return;
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(
        `${AI_AGENT_URL}/ai/evaluate`,
        { name: runName, cases },
        { headers: { "X-Evaluation-Key": evaluationKey.trim() } },
      );
      setReport(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Evaluation could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">AI quality lab</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">AI Agent Evaluation</h1>
          <p className="mt-2 text-slate-600">Run customer messages safely without sending WhatsApp messages or changing carts and orders.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <label className="text-sm font-semibold text-slate-700">Evaluation name</label>
            <input value={runName} onChange={(event) => setRunName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" />
            <label className="mt-5 block text-sm font-semibold text-slate-700">Evaluation key</label>
            <input type="password" value={evaluationKey} onChange={(event) => setEvaluationKey(event.target.value)} placeholder="Enter the key provided by your administrator" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" autoComplete="off" />
            <p className="mt-1 text-xs text-slate-500">This key is sent only in the request header and is not stored in the frontend code.</p>
            <label className="mt-5 block text-sm font-semibold text-slate-700">Customer messages (one per line)</label>
            <textarea value={messages} onChange={(event) => setMessages(event.target.value)} rows={12} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm" />
            <label className="mt-5 block text-sm font-semibold text-slate-700">Expected intent (one per message, optional)</label>
            <textarea value={expectedIntents} onChange={(event) => setExpectedIntents(event.target.value)} rows={4} placeholder="product_search\nproduct_search\ncustomization" className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm" />
            <p className="mt-1 text-xs text-slate-500">Keep the lines aligned with the customer messages. Leave a line blank to measure routing without asserting intent.</p>
            <button onClick={runEvaluation} disabled={loading || !cases.length || !evaluationKey.trim()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {loading ? "Running..." : `Run ${cases.length} test${cases.length === 1 ? "" : "s"}`}
            </button>
            {error && <p className="mt-4 flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="h-4 w-4" />{error}</p>}
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            {!report ? (
              <div className="flex h-full min-h-80 items-center justify-center text-center text-slate-500">Run an evaluation to see intent, route, confidence, products, and pass/fail results.</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Metric label="Pass rate" value={`${Math.round((report.pass_rate || 0) * 100)}%`} />
                  <Metric label="Passed" value={report.passed_cases} />
                  <Metric label="Avg latency" value={`${report.average_latency_ms} ms`} />
                </div>
                <div className="mt-6 space-y-3">
                  {report.results?.map((result) => (
                    <div key={result.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-medium text-slate-900">{result.message}</p><p className="mt-1 text-xs text-slate-500">{result.id} · {result.latency_ms} ms</p></div>
                        {result.passed ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="h-5 w-5 shrink-0 text-red-600" />}
                      </div>
                      <div className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                        <span>Intent: <b>{result.actual?.intent || "-"}</b></span>
                        <span>Route: <b>{result.actual?.route || "-"}</b></span>
                        <span>Confidence: <b>{Math.round((result.actual?.confidence || 0) * 100)}%</b></span>
                        <span>Products: <b>{result.actual?.product_count ?? 0}</b></span>
                      </div>
                      {result.actual?.products?.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">{result.actual.products.map((product) => <li key={product.id}>{product.name}</li>)}</ul>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>;
}
