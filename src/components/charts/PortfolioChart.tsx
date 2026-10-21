"use client";

import { useId, useState } from "react";
import useSWR from "swr";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";
import { useAuth } from "@/components/auth/AuthProvider";

type ChartPoint = { t: number | string; flow: string | number; cum: string | number };
type ChartResponse = { range: string; points: ChartPoint[]; note?: string };
const RANGES = [
  { label: "30D", value: "30d" }, { label: "90D", value: "90d" },
  { label: "1Y", value: "1y" }, { label: "3Y", value: "3y" },
  { label: "5Y", value: "5y" }, { label: "10Y", value: "10y" },
] as const;

async function fetchChart(url: string): Promise<ChartResponse> {
  const response = await authenticatedFetch(url);
  if (!response.ok) throw new Error(`Bitcoin history unavailable (${response.status})`);
  return response.json() as Promise<ChartResponse>;
}
function toMs(value: number | string): number {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(`${value}T00:00:00Z`);
  const numeric = Number(value);
  return Number.isFinite(numeric) ? (numeric > 1e12 ? numeric : numeric * 1000) : Date.parse(String(value));
}
function fmtBtc(value: number, compact = false): string {
  if (!Number.isFinite(value)) return "—";
  if (!compact) return `${value.toFixed(8)} BTC`;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 0.01 ? 6 : 4 }).format(value)} BTC`;
}

export default function PortfolioChart({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const [range, setRange] = useState<string>("30d");
  const gradientId = useId().replace(/:/g, "");
  const url = `/api/crypto/portfolio/bitcoin?view=chart&range=${encodeURIComponent(range)}`;
  const { data, error, isLoading } = useSWR(user ? [url, user.uid] : null, ([path]: [string, string]) => fetchChart(path), { refreshInterval: 60_000 });
  const chartData = (data?.points ?? []).map(point => ({ t: toMs(point.t), balance: Number(point.cum) / 1e8 })).filter(point => Number.isFinite(point.t) && Number.isFinite(point.balance));
  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const difference = first && last ? last.balance - first.balance : null;

  return <section className={`min-w-0 overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_1px_3px_rgba(12,20,32,0.03)] ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6"><div><p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.13em] text-muted-foreground"><Activity size={14}/> BITCOIN ACCUMULATION</p><h2 className="mt-2 text-lg font-semibold">Wallet balance over time</h2><p className="mt-1 text-xs text-muted-foreground">Cumulative BTC held across tracked addresses</p></div><div className="text-left sm:text-right"><p className="text-[11px] text-muted-foreground">Net balance change · {RANGES.find(item => item.value === range)?.label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{difference == null ? "—" : `${difference >= 0 ? "+" : ""}${fmtBtc(difference)}`}</p></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6"><div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-border bg-muted/60 p-1" role="group" aria-label="Bitcoin balance history range">{RANGES.map(item => <button type="button" key={item.value} aria-pressed={range === item.value} onClick={() => setRange(item.value)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${range === item.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"}`}>{item.label}</button>)}</div><span className="text-xs text-muted-foreground">Balance · BTC</span></div>
    <div className="relative h-[285px] w-full px-2 pb-4 pt-5 sm:h-[360px] sm:px-4 sm:pb-5">{isLoading ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading wallet history…</div> : error ? <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">Unable to load historical balances.</div> : chartData.length === 0 ? <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">No historical wallet balances for this period.</div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}><defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f7931a" stopOpacity={0.2}/><stop offset="100%" stopColor="#f7931a" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5"/><XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} axisLine={false} tickLine={false} minTickGap={25} tickMargin={10} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={value => new Date(Number(value)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}/><YAxis width={78} orientation="right" domain={[0, "auto"]} axisLine={false} tickLine={false} tickMargin={8} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={value => fmtBtc(Number(value), true)}/><Tooltip contentStyle={{ background: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "var(--muted-foreground)" }} labelFormatter={value => new Date(Number(value)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} formatter={value => [fmtBtc(Number(value)), "Wallet balance"]}/><Area dataKey="balance" name="Wallet balance" type="stepAfter" stroke="#f7931a" strokeWidth={2} fill={`url(#${gradientId})`} activeDot={{ r: 4 }} dot={false} isAnimationActive={false}/></AreaChart></ResponsiveContainer>}</div>
    <div className="flex flex-wrap justify-between gap-2 border-t border-border px-5 py-3 text-[11px] text-muted-foreground sm:px-6"><span>Bitcoin · on-chain wallet balance</span><span>Net transfers are not necessarily purchases</span></div>
  </section>;
}
