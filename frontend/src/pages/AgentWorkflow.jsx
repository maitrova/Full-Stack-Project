import { ArrowDown, Bot, Brain, CheckCircle2, Database, Filter, GitBranch, Image as ImageIcon, MessageSquare, Search, UserRound } from "lucide-react";

const steps = [
  ["customer", "User message", "Text, Telugu/Hinglish, image, or WhatsApp message", UserRound],
  ["input", "Input normalization", "Language, spelling, image, and conversation context", MessageSquare],
  ["route", "Route classification", "Search, recommendation, details, customization, support, or general question", GitBranch],
  ["entities", "Entity extraction", "Category, size, color, budget, catalog type, and design intent", Brain],
  ["filter", "Hard product filters", "Remove products that do not match exact user requirements", Filter],
  ["search", "Catalogue search and ranking", "Database filters first, then embeddings or image similarity", Search],
  ["action", "Action execution", "Cart, checkout, order status, design library, or human handoff", Database],
  ["response", "Verified response", "AI writes the answer using only validated results", Bot],
];

export default function AgentWorkflow() {
  return <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-8"><div className="mx-auto max-w-4xl"><p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Read-only system map</p><h1 className="mt-3 text-3xl font-bold sm:text-5xl">AI agent workflow</h1><p className="mt-3 max-w-2xl text-slate-300">This is the complete path a message follows. Nothing on this page sends a message or changes data.</p><div className="mt-10 rounded-3xl border border-slate-700 bg-slate-900/80 p-4 shadow-2xl sm:p-8">{steps.map(([id, title, detail, Icon], index) => <div key={id} className="flex flex-col items-center"><div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-800 p-4 sm:p-5"><div className="flex items-start gap-4"><div className="rounded-xl bg-cyan-400/15 p-3 text-cyan-300"><Icon className="h-6 w-6" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase tracking-wider text-cyan-300">{String(index + 1).padStart(2, "0")}</span><h2 className="text-lg font-bold text-white">{title}</h2></div><p className="mt-1 text-sm leading-6 text-slate-300">{detail}</p></div></div></div>{index < steps.length - 1 && <div className="flex h-12 flex-col items-center justify-center"><div className="h-7 w-px bg-cyan-400/70" /><ArrowDown className="h-5 w-5 text-cyan-300" /></div>}</div>)}</div><div className="mt-6 grid gap-4 sm:grid-cols-3"><Legend icon={CheckCircle2} title="Deterministic" text="Routes and hard filters" /><Legend icon={Brain} title="AI assisted" text="Language and semantic understanding" /><Legend icon={Database} title="Verified data" text="Catalogue and commerce tools" /></div></div></main>;
}

function Legend({ icon: Icon, title, text }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><Icon className="h-5 w-5 text-emerald-300" /><p className="mt-2 font-semibold">{title}</p><p className="mt-1 text-xs text-slate-400">{text}</p></div>; }
