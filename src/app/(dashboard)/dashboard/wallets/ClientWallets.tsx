"use client";
import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";
// app/wallets/ClientWallets.tsx

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Wallet, ChevronRight, Pencil, Trash2, Save, X, ArrowRight, RefreshCw, Search, AlertCircle } from "lucide-react";
import AssetMark from "@/components/market/AssetMark";
import { readMetalWallets, toTroyOunces } from "@/lib/portfolio/metals";

/* ----------------------------- Types ----------------------------- */
type Chain = "btc" | "eth";
type WalletItem = { id: string; chain: Chain; address: string; createdAt: number };

type Metal = "gold" | "silver";
type MetalUnit = "g" | "oz" | "lb";
type MetalWallet = { id: string; name: string; amount: number; unit: MetalUnit };
type InitialMetals = { gold: MetalWallet[]; silver: MetalWallet[] };
type WalletFilter = "all" | Chain | Metal;
type ListedWallet = (WalletItem & { kind: "crypto" }) | (MetalWallet & { kind: "metal"; chain: Metal });
const METAL_ICON = { gold: "🥇", silver: "🥈" } as const;
const fieldClass = "min-w-0 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground/20";
const outlineAction = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/60 disabled:opacity-50";
const solidAction = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background transition hover:opacity-85 disabled:opacity-50";

/* --------------------------- API: Crypto -------------------------- */
async function apiGetWallets(chain?: Chain) {
  const url = `/api/crypto/wallets${chain ? `?chain=${chain}` : ""}`;
  const res = await authenticatedFetch(url, {  cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { bitcoin?: [], ethereum?: [] }
}

async function apiSaveWallet(chain: Chain, address: string) {
  const res = await authenticatedFetch(`/api/crypto/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    
    body: JSON.stringify({ chain, address }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiDeleteWallet(chain: Chain, address: string) {
  const res = await authenticatedFetch(
    `/api/crypto/wallets?chain=${chain}&address=${encodeURIComponent(address)}`,
    { method: "DELETE",  }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiUpdateWallet(chain: Chain, oldAddress: string, newAddress: string) {
  const res = await authenticatedFetch(`/api/crypto/wallets`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    
    body: JSON.stringify({ chain, oldAddress, newAddress }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* --------------------------- API: Metals -------------------------- */
async function apiGetMetals(metal: Metal) {
  const res = await authenticatedFetch(`/api/metals/wallets?metal=${metal}`, {
    method: "GET",
    
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ gold?: MetalWallet[]; silver?: MetalWallet[] }>;
}

async function apiSaveMetal(metal: Metal, name: string, amount: number, unit: MetalUnit) {
  const res = await authenticatedFetch(`/api/metals/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    
    body: JSON.stringify({ metal, name, amount, unit }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiUpdateMetal(
  metal: Metal,
  payload: Partial<MetalWallet> & { id: string }
) {
  const res = await authenticatedFetch(`/api/metals/wallets`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    
    body: JSON.stringify({ metal, ...payload }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiDeleteMetal(metal: Metal, id: string) {
  const res = await authenticatedFetch(
    `/api/metals/wallets?metal=${metal}&id=${encodeURIComponent(id)}`,
    { method: "DELETE",  }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------------------------- Component --------------------------- */
export default function ClientWallets({
  initialWallets,
  initialMetals,
}: {
  initialWallets: WalletItem[];
  initialMetals?: InitialMetals;
}) {
  /* ----------------------- State: Crypto ----------------------- */
  const [open, setOpen] = React.useState(false);
  const [createChain, setCreateChain] = React.useState<Chain | null>(null);
  const [address, setAddress] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<WalletFilter>("all");
  const [search, setSearch] = React.useState("");
  const [cryptoLoading, setCryptoLoading] = React.useState(true);
  const [metalsLoading, setMetalsLoading] = React.useState(true);
  const [cryptoError, setCryptoError] = React.useState<string | null>(null);
  const [metalsError, setMetalsError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [wallets, setWallets] = React.useState<WalletItem[]>(initialWallets);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editAddress, setEditAddress] = React.useState("");
  const [editBusy, setEditBusy] = React.useState(false);

  /* ----------------------- State: Metals ----------------------- */
  const [gold, setGold] = React.useState<MetalWallet[]>(initialMetals?.gold ?? []);
  const [silver, setSilver] = React.useState<MetalWallet[]>(initialMetals?.silver ?? []);

  // inline create for metals
  const [createMetal, setCreateMetal] = React.useState<Metal | null>(null);
  const [metalName, setMetalName] = React.useState("");
  const [metalAmount, setMetalAmount] = React.useState<string>("");
  const [metalUnit, setMetalUnit] = React.useState<MetalUnit>("g");
  const [metalSaving, setMetalSaving] = React.useState(false);
  const [metalMsg, setMetalMsg] = React.useState<string | null>(null);

  // inline edit for metals
  const [metalEditingId, setMetalEditingId] = React.useState<string | null>(null);
  const [metalEditBusy, setMetalEditBusy] = React.useState(false);
  const [metalEditName, setMetalEditName] = React.useState("");
  const [metalEditAmount, setMetalEditAmount] = React.useState<string>("");
  const [metalEditUnit, setMetalEditUnit] = React.useState<MetalUnit>("g");
  const [metalEditingType, setMetalEditingType] = React.useState<Metal | null>(null); // "gold" | "silver"

  /* ----------------------- Refresh helpers --------------------- */
  const refreshFromApi = React.useCallback(async () => {
    try {
      const data = await apiGetWallets();
      const btc = Array.isArray((data as { bitcoin?: unknown }).bitcoin) ? (data as { bitcoin: { address: string; createdAtMs?: number }[] }).bitcoin : [];
      const eth = Array.isArray((data as { ethereum?: unknown }).ethereum) ? (data as { ethereum: { address: string; createdAtMs?: number }[] }).ethereum : [];
      const normalized: WalletItem[] = [
        ...btc.map(w => ({ id: `btc-${w.createdAtMs ?? ""}-${w.address}`, chain: "btc" as const, address: w.address, createdAt: Number(w.createdAtMs ?? 0) })),
        ...eth.map(w => ({ id: `eth-${w.createdAtMs ?? ""}-${w.address}`, chain: "eth" as const, address: w.address, createdAt: Number(w.createdAtMs ?? 0) })),
      ].sort((a, b) => b.createdAt - a.createdAt);
      setWallets(normalized);
      setCryptoError(null);
    } catch (error) {
      setCryptoError(error instanceof Error ? error.message : "Unable to load crypto wallets.");
      throw error;
    } finally {
      setCryptoLoading(false);
    }
  }, []);

  const refreshMetals = React.useCallback(async () => {
    try {
      const [g, s] = await Promise.all([apiGetMetals("gold"), apiGetMetals("silver")]);
      setGold(readMetalWallets(g, "gold") as MetalWallet[]);
      setSilver(readMetalWallets(s, "silver") as MetalWallet[]);
      setMetalsError(null);
    } catch (error) {
      setMetalsError(error instanceof Error ? error.message : "Unable to load metal wallets.");
      throw error;
    } finally {
      setMetalsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshFromApi().catch(() => {});
    void refreshMetals().catch(() => {});
  }, [refreshFromApi, refreshMetals]);

  async function refreshAll() {
    setRefreshing(true);
    await Promise.allSettled([refreshFromApi(), refreshMetals()]);
    setRefreshing(false);
  }

  /* ------------------------- Modal choices --------------------- */
  function handleSelect(chain: Chain) {
    setCreateChain(chain);
    setOpen(false);
    setAddress("");
    setSavedMsg(null);
  }

  function handleSelectMetal(metal: Metal) {
    setCreateMetal(metal);
    setOpen(false);
    setMetalName("");
    setMetalAmount("");
    setMetalUnit("g");
    setMetalMsg(null);
  }

  /* -------------------- Save handlers & validators -------------- */
  function validateAddress(chain: Chain, value: string) {
    const v = value.trim();
    if (!v) return "Address is required";
    if (chain === "eth") {
      if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return "Enter a valid Ethereum address (0x...)";
    } else {
      if (v.length < 26) return "Enter a valid Bitcoin address";
    }
    return null;
  }

  async function handleSave() {
    if (!createChain) return;
    const err = validateAddress(createChain, address);
    if (err) {
      setSavedMsg(err);
      return;
    }
    setSaving(true);
    try {
      await apiSaveWallet(createChain, address.trim());
      await refreshFromApi();
      setSavedMsg("Wallet saved.");
      setNotice("Crypto wallet saved successfully.");
      setCreateChain(null);
      setAddress("");
    } catch (e: any) {
      setSavedMsg(e?.message || "Failed to save wallet");
    } finally {
      setSaving(false);
    }
  }

  function validateMetalInput(name: string, amtStr: string, unit: MetalUnit) {
    if (!name.trim()) return "Name is required";
    const amt = Number(amtStr);
    if (!Number.isFinite(amt) || amt <= 0) return "Amount must be a positive number";
    if (!["g", "oz", "lb"].includes(unit)) return "Choose a valid unit";
    return null;
  }

  async function handleSaveMetal() {
    if (!createMetal) return;
    const err = validateMetalInput(metalName, metalAmount, metalUnit);
    if (err) {
      setMetalMsg(err);
      return;
    }
    setMetalSaving(true);
    try {
      await apiSaveMetal(createMetal, metalName.trim(), Number(metalAmount), metalUnit);
      setMetalMsg("Saved.");
      setNotice("Precious-metal wallet saved successfully.");
      setCreateMetal(null);
      setMetalName("");
      setMetalAmount("");
      setMetalUnit("g");
      await refreshMetals();
    } catch (e: any) {
      setMetalMsg(e?.message || "Failed to save");
    } finally {
      setMetalSaving(false);
    }
  }

  /* ---------------------- Crypto edit/delete -------------------- */
  function startEdit(id: string) {
    const w = wallets.find((x) => x.id === id);
    if (!w) return;
    setEditingId(id);
    setEditAddress(w.address);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAddress("");
  }

  async function saveEdit(id: string) {
    const w = wallets.find((x) => x.id === id);
    if (!w) return;
    const err = validateAddress(w.chain, editAddress);
    if (err) {
      alert(err);
      return;
    }
    setEditBusy(true);
    try {
      await apiUpdateWallet(w.chain, w.address, editAddress.trim());
      await refreshFromApi();
      cancelEdit();
      setNotice("Wallet address updated.");
    } catch (e: any) {
      alert(e?.message || "Failed to update wallet");
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteWallet(id: string) {
    const w = wallets.find((x) => x.id === id);
    if (!w) return;
    if (!confirm("Delete this wallet?")) return;
    try {
      await apiDeleteWallet(w.chain, w.address);
      await refreshFromApi();
      setNotice("Wallet deleted.");
    } catch {
      alert("Failed to delete wallet");
    }
  }

  /* ---------------------- Metals edit/delete -------------------- */
  function startEditMetal(metal: Metal, id: string) {
    const arr = metal === "gold" ? gold : silver;
    const w = arr.find((x) => x.id === id);
    if (!w) return;
    setMetalEditingId(id);
    setMetalEditingType(metal);
    setMetalEditName(w.name);
    setMetalEditAmount(String(w.amount));
    setMetalEditUnit(w.unit);
  }

  function cancelEditMetal() {
    setMetalEditingId(null);
    setMetalEditingType(null);
    setMetalEditName("");
    setMetalEditAmount("");
    setMetalEditUnit("g");
  }

  async function saveEditMetal() {
    if (!metalEditingId || !metalEditingType) return;
    const err = validateMetalInput(metalEditName, metalEditAmount, metalEditUnit);
    if (err) {
      alert(err);
      return;
    }
    setMetalEditBusy(true);
    try {
      await apiUpdateMetal(metalEditingType, {
        id: metalEditingId,
        name: metalEditName.trim(),
        amount: Number(metalEditAmount),
        unit: metalEditUnit,
      });
      await refreshMetals();
      cancelEditMetal();
      setNotice("Metal holdings updated.");
    } catch (e: any) {
      alert(e?.message || "Failed to update metals wallet");
    } finally {
      setMetalEditBusy(false);
    }
  }
  
  async function deleteMetal(metal: Metal, id: string) {
    if (!confirm("Delete this metals wallet?")) return;
    try {
      await apiDeleteMetal(metal, id);
      await refreshMetals();
      setNotice("Metal holdings removed.");
    } catch {
      alert("Failed to delete metals wallet");
    }
  }

  const listed: ListedWallet[] = [
    ...wallets.map(wallet => ({ ...wallet, kind: "crypto" as const })),
    ...gold.map(wallet => ({ ...wallet, chain: "gold" as const, kind: "metal" as const })),
    ...silver.map(wallet => ({ ...wallet, chain: "silver" as const, kind: "metal" as const })),
  ];
  const filtered = listed.filter(wallet => {
    if (filter !== "all" && wallet.chain !== filter) return false;
    const text = wallet.kind === "crypto" ? wallet.address : `${wallet.name} ${wallet.amount} ${wallet.unit}`;
    return text.toLowerCase().includes(search.trim().toLowerCase());
  });
  const counts: Record<WalletFilter, number> = {
    all: listed.length, btc: wallets.filter(w => w.chain === "btc").length,
    eth: wallets.filter(w => w.chain === "eth").length, gold: gold.length, silver: silver.length,
  };
  const loading = cryptoLoading || metalsLoading;
  const goldOzt = gold.reduce((sum, wallet) => sum + toTroyOunces(Number(wallet.amount), wallet.unit), 0);
  const silverOzt = silver.reduce((sum, wallet) => sum + toTroyOunces(Number(wallet.amount), wallet.unit), 0);
  const ozt = (value: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(value)} ozt`;
  const choices: { id: WalletFilter; label: string }[] = [
    { id: "all", label: "All" }, { id: "btc", label: "Bitcoin" },
    { id: "gold", label: "Gold" }, { id: "silver", label: "Silver" }, { id: "eth", label: "Ethereum" },
  ];
  const groupMeta = [
    { id: "btc" as const, title: "Bitcoin", description: "On-chain address tracking" },
    { id: "gold" as const, title: "Gold", description: "Physical gold holdings" },
    { id: "silver" as const, title: "Silver", description: "Physical silver holdings" },
    { id: "eth" as const, title: "Ethereum", description: "Saved addresses; portfolio analysis paused" },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1500px] space-y-4 pb-6 sm:space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="enterprise-section-eyebrow">YOUR WORKSPACE / HOLDINGS</span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Wallets<span className="enterprise-accent">.</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage saved Bitcoin addresses and physical precious-metal holdings.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={outlineAction} disabled={refreshing} onClick={() => void refreshAll()} aria-label="Refresh saved wallets" title="Refresh saved wallets"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""}/></button>
          <Link href="/dashboard/portfolio" className={outlineAction}>Portfolio <ArrowRight size={15}/></Link>
          <button type="button" className={solidAction} onClick={() => setOpen(true)}><Plus size={16}/> Add wallet</button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[15px] border border-border bg-card p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Saved wallets</div><div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{cryptoError || metalsError ? "—" : loading ? "…" : counts.all}</div><div className="mt-1 text-xs text-muted-foreground">Across crypto and metals</div></div>
        <div className="rounded-[15px] border border-border bg-card p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bitcoin addresses</div><div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{cryptoError ? "—" : cryptoLoading ? "…" : counts.btc}</div><div className="mt-1 text-xs text-muted-foreground">Tracked on-chain</div></div>
        <div className="rounded-[15px] border border-border bg-card p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gold holdings</div><div className="mt-2 text-xl font-semibold tracking-tight tabular-nums">{metalsError ? "—" : metalsLoading ? "…" : ozt(goldOzt)}</div><div className="mt-1 text-xs text-muted-foreground">{metalsError ? "Wallet feed unavailable" : `${counts.gold} saved entries`}</div></div>
        <div className="rounded-[15px] border border-border bg-card p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Silver holdings</div><div className="mt-2 text-xl font-semibold tracking-tight tabular-nums">{metalsError ? "—" : metalsLoading ? "…" : ozt(silverOzt)}</div><div className="mt-1 text-xs text-muted-foreground">{metalsError ? "Wallet feed unavailable" : `${counts.silver} saved entries`}</div></div>
      </div>

      {(cryptoError || metalsError) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"><span className="flex items-center gap-2"><AlertCircle size={16}/>{cryptoError && metalsError ? "Wallet requests failed. Saved holdings may be incomplete." : cryptoError ? "Bitcoin/Ethereum wallets could not be refreshed." : "Gold/Silver wallets could not be refreshed."}</span><button className={outlineAction} onClick={() => void refreshAll()}>Retry</button></div>}
      {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm"><span>{notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={16}/></button></div>}

      {/* Inline create: Crypto */}
      {createChain && (
        <div className="rounded-[18px] border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-6 w-6">
                {createChain === "btc" ? (
                  <Image src="/bitcoin.svg" alt="Bitcoin" fill className="object-contain" />
                ) : (
                  <Image src="/ethereum.png" alt="Ethereum" fill className="object-contain" />
                )}
              </div>
              <div className="font-medium">
                {createChain === "btc" ? "Add Bitcoin wallet" : "Add Ethereum wallet"}
              </div>
            </div>
            <button
              onClick={() => {
                setCreateChain(null);
                setAddress("");
                setSavedMsg(null);
              }}
              className="text-sm text-muted-foreground hover:underline"
            >
              Cancel
            </button>
          </div>

          <label className="mb-1 block text-sm text-muted-foreground">
            {createChain === "btc" ? "Bitcoin address" : "Ethereum address"}
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={createChain === "btc" ? "bc1... or 1.../3..." : "0x..."}
            className={fieldClass}
          />

          {savedMsg && <div className="mb-3 text-sm text-muted-foreground">{savedMsg}</div>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">Save wallet</span>
            </button>
            <button
              onClick={() => {
                setCreateChain(null);
                setAddress("");
                setSavedMsg(null);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Inline create: Metals */}
      {createMetal && (
        <div className="rounded-[18px] border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-6 w-6 place-items-center text-lg">
                {METAL_ICON[createMetal]}
              </div>
              <div className="font-medium">
                {createMetal === "gold" ? "Add Gold wallet" : "Add Silver wallet"}
              </div>
            </div>
            <button
              onClick={() => {
                setCreateMetal(null);
                setMetalName("");
                setMetalAmount("");
                setMetalUnit("g");
                setMetalMsg(null);
              }}
              className="text-sm text-muted-foreground hover:underline"
            >
              Cancel
            </button>
          </div>

          {/* Name */}
          <label className="mb-1 block text-sm text-muted-foreground">Wallet name</label>
          <input
            value={metalName}
            onChange={(e) => setMetalName(e.target.value)}
            placeholder="e.g., Main Bars, Coins #1"
            className={fieldClass}
          />

          {/* Amount + Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-muted-foreground">Amount</label>
              <input
                value={metalAmount}
                onChange={(e) => setMetalAmount(e.target.value)}
                inputMode="decimal"
                placeholder="12.5"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Unit</label>
              <select
                value={metalUnit}
                onChange={(e) => setMetalUnit(e.target.value as MetalUnit)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary"
              >
                <option value="g">grams (g)</option>
                <option value="oz">troy ounces (oz)</option>
                <option value="lb">pounds (lb)</option>
              </select>
            </div>
          </div>

          {metalMsg && <div className="mt-3 text-sm text-muted-foreground">{metalMsg}</div>}

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSaveMetal}
              disabled={metalSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">Save wallet</span>
            </button>
            <button
              onClick={() => {
                setCreateMetal(null);
                setMetalName("");
                setMetalAmount("");
                setMetalUnit("g");
                setMetalMsg(null);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Cancel</span>
            </button>
          </div>
        </div>
      )}

      <section className="min-w-0 overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_1px_3px_rgba(12,20,32,0.03)]" aria-label="Saved wallet directory">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div><h2 className="font-semibold tracking-tight">Your saved holdings</h2><p className="mt-1 text-xs text-muted-foreground">Filter accounts, edit quantities or manage addresses.</p></div>
          <label className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 sm:w-64"><Search size={15} className="shrink-0 text-muted-foreground"/><input className="w-full bg-transparent py-2.5 text-sm outline-none" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a wallet..." aria-label="Find a wallet"/></label>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-6" role="group" aria-label="Filter wallets by asset">
          {choices.map(choice => <button key={choice.id} type="button" onClick={() => setFilter(choice.id)} aria-pressed={filter === choice.id} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${filter === choice.id ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground"}`}>{choice.label} <span className="ml-1 opacity-70">{choice.id === "all" && loading ? "…" : counts[choice.id]}</span></button>)}
        </div>
        {loading && listed.length === 0 ? <div role="status" className="px-6 py-16 text-center text-sm text-muted-foreground">Loading saved wallets...</div> : filtered.length === 0 ? <div className="flex flex-col items-center gap-3 px-5 py-12 text-center"><Wallet size={27} className="text-muted-foreground"/><h3 className="font-semibold">{(cryptoError || metalsError) && !listed.length ? "Wallet data unavailable" : search || filter !== "all" ? "No matching wallets" : "No wallets saved yet"}</h3><p className="max-w-md text-sm text-muted-foreground">{(cryptoError || metalsError) && !listed.length ? "The wallet feed did not load. Retry before making changes." : search || filter !== "all" ? "Try a different search or asset filter." : "Add a Bitcoin address or record gold and silver holdings to see them here and in your portfolio."}</p>{!search && filter === "all" && !cryptoError && !metalsError && <button type="button" onClick={() => setOpen(true)} className={solidAction}><Plus size={15}/> Add your first wallet</button>}</div> :
          <div className="space-y-5 p-4 sm:p-6">
            {groupMeta.map(group => {
              const entries = filtered.filter(wallet => wallet.chain === group.id);
              if (!entries.length) return null;
              return <section key={group.id} aria-label={`${group.title} wallets`}>
                <div className="mb-3 flex items-center gap-3"><AssetMark asset={group.id === "btc" ? "bitcoin" : group.id === "eth" ? "ethereum" : group.id} size={32}/><div><h3 className="text-sm font-semibold">{group.title} <span className="ml-1 text-xs font-normal text-muted-foreground">({entries.length})</span></h3><p className="text-[11px] text-muted-foreground">{group.description}</p></div></div>
                <div className="grid gap-3 xl:grid-cols-2">
                  {entries.map(wallet => <article key={`${wallet.chain}-${wallet.id}`} className="min-w-0 rounded-xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {wallet.kind === "crypto" ? editingId === wallet.id ? <div className="space-y-2"><label className="block text-xs text-muted-foreground" htmlFor={`edit-${wallet.id}`}>Wallet address</label><input id={`edit-${wallet.id}`} value={editAddress} onChange={event => setEditAddress(event.target.value)} className={fieldClass} autoComplete="off"/></div> : <><div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{wallet.chain === "btc" ? "Bitcoin address" : "Ethereum address"}</div><div className="mt-1 break-all font-mono text-xs leading-5 text-foreground" title={wallet.address}>{wallet.address}</div></> : metalEditingId === wallet.id && metalEditingType === wallet.chain ? <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_90px]"><label className="text-xs text-muted-foreground">Name<input value={metalEditName} onChange={event => setMetalEditName(event.target.value)} className={`mt-1 ${fieldClass}`}/></label><label className="text-xs text-muted-foreground">Quantity<input value={metalEditAmount} onChange={event => setMetalEditAmount(event.target.value)} inputMode="decimal" className={`mt-1 ${fieldClass}`}/></label><label className="text-xs text-muted-foreground">Unit<select value={metalEditUnit} onChange={event => setMetalEditUnit(event.target.value as MetalUnit)} className={`mt-1 ${fieldClass}`}><option value="g">g</option><option value="oz">oz (troy)</option><option value="lb">lb</option></select></label></div> : <><div className="text-sm font-semibold">{wallet.name}</div><div className="mt-1 text-sm tabular-nums">{Number(wallet.amount).toLocaleString("en-US", { maximumFractionDigits: 8 })} {wallet.unit}</div><p className="mt-1 text-xs text-muted-foreground">{ozt(toTroyOunces(Number(wallet.amount), wallet.unit))} equivalent</p></>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {wallet.kind === "crypto" ? editingId === wallet.id ? <><button type="button" className={outlineAction} disabled={editBusy} onClick={() => void saveEdit(wallet.id)} aria-label="Save address"><Save size={15}/></button><button type="button" className={outlineAction} onClick={cancelEdit} aria-label="Cancel address edit"><X size={15}/></button></> : <><button type="button" className={outlineAction} onClick={() => startEdit(wallet.id)} aria-label={`Edit ${wallet.chain.toUpperCase()} wallet`}><Pencil size={15}/></button><button type="button" className={outlineAction} onClick={() => void deleteWallet(wallet.id)} aria-label={`Delete ${wallet.chain.toUpperCase()} wallet`}><Trash2 size={15}/></button></> : metalEditingId === wallet.id && metalEditingType === wallet.chain ? <><button type="button" className={outlineAction} disabled={metalEditBusy} onClick={() => void saveEditMetal()} aria-label="Save metal holding"><Save size={15}/></button><button type="button" className={outlineAction} onClick={cancelEditMetal} aria-label="Cancel metal edit"><X size={15}/></button></> : <><button type="button" className={outlineAction} onClick={() => startEditMetal(wallet.chain, wallet.id)} aria-label={`Edit ${wallet.name}`}><Pencil size={15}/></button><button type="button" className={outlineAction} onClick={() => void deleteMetal(wallet.chain, wallet.id)} aria-label={`Delete ${wallet.name}`}><Trash2 size={15}/></button></>}
                      </div>
                    </div>
                  </article>)}
                </div>
              </section>;
            })}
          </div>}
        <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground sm:px-6">Metal quantities are stored in their original units. Portfolio totals convert them into troy ounces without modifying saved holdings. Ethereum portfolio analytics remain paused.</p>
      </section>

      {/* Add-wallet modal (unchanged styles) */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="wallet-add-title">
            <h2 id="wallet-add-title" className="text-lg font-semibold mb-1">Add a wallet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Choose the type of wallet you want to add.
            </p>
            <div className="grid gap-3">
              <button
                onClick={() => handleSelect("btc")}
                className="group flex items-center justify-between rounded-xl border p-3 transition hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-6 w-6">
                    <Image src="/bitcoin.svg" alt="Bitcoin" fill className="object-contain" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Bitcoin</div>
                    <div className="text-xs text-muted-foreground">BTC</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => handleSelect("eth")}
                className="group flex items-center justify-between rounded-xl border p-3 transition hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-6 w-6">
                    <Image src="/ethereum.png" alt="Ethereum" fill className="object-contain" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Ethereum</div>
                    <div className="text-xs text-muted-foreground">ETH</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => handleSelectMetal("gold")}
                className="group flex items-center justify-between rounded-xl border p-3 transition hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 grid place-items-center text-lg">🥇</div>
                  <div className="text-left">
                    <div className="font-medium">Gold</div>
                    <div className="text-xs text-muted-foreground">Precious metal</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => handleSelectMetal("silver")}
                className="group flex items-center justify-between rounded-xl border p-3 transition hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 grid place-items-center text-lg">🥈</div>
                  <div className="text-left">
                    <div className="font-medium">Silver</div>
                    <div className="text-xs text-muted-foreground">Precious metal</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
              </button>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="mt-6 w-full rounded-lg bg-muted py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
