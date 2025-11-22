// app/wallets/ClientWallets.tsx
"use client";
import * as React from "react";
import Image from "next/image";
import { Plus, Wallet, ChevronRight, Pencil, Trash2, Save, X } from "lucide-react";

/* ----------------------------- Types ----------------------------- */
type Chain = "btc" | "eth";
type WalletItem = { id: string; chain: Chain; address: string; createdAt: number };

type Metal = "gold" | "silver";
type MetalUnit = "g" | "oz" | "lb";
type MetalWallet = { id: string; name: string; amount: number; unit: MetalUnit };
type InitialMetals = { gold: MetalWallet[]; silver: MetalWallet[] };

/* --------------------------- API: Crypto -------------------------- */
async function apiGetWallets(chain?: Chain) {
  const url = `/api/crypto/wallets${chain ? `?chain=${chain}` : ""}`;
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { bitcoin?: [], ethereum?: [] }
}
async function apiSaveWallet(chain: Chain, address: string) {
  const res = await fetch(`/api/crypto/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ chain, address }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiDeleteWallet(chain: Chain, address: string) {
  const res = await fetch(
    `/api/crypto/wallets?chain=${chain}&address=${encodeURIComponent(address)}`,
    { method: "DELETE", credentials: "include" }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiUpdateWallet(chain: Chain, oldAddress: string, newAddress: string) {
  const res = await fetch(`/api/crypto/wallets`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ chain, oldAddress, newAddress }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* --------------------------- API: Metals -------------------------- */
async function apiGetMetals(metal: Metal) {
  const res = await fetch(`/api/metals/wallets?metal=${metal}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ gold?: MetalWallet[]; silver?: MetalWallet[] }>;
}
async function apiSaveMetal(metal: Metal, name: string, amount: number, unit: MetalUnit) {
  const res = await fetch(`/api/metals/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ metal, name, amount, unit }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiUpdateMetal(
  metal: Metal,
  payload: Partial<MetalWallet> & { id: string }
) {
  const res = await fetch(`/api/metals/wallets`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ metal, ...payload }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiDeleteMetal(metal: Metal, id: string) {
  const res = await fetch(
    `/api/metals/wallets?metal=${metal}&id=${encodeURIComponent(id)}`,
    { method: "DELETE", credentials: "include" }
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
    const data = await apiGetWallets();
    const btc = Array.isArray((data as any).bitcoin) ? (data as any).bitcoin : [];
    const eth = Array.isArray((data as any).ethereum) ? (data as any).ethereum : [];

    const normalized: WalletItem[] = [
      ...btc.map((w: any) => ({
        id: `btc-${w.createdAtMs ?? Date.now()}-${w.address}`,
        chain: "btc" as const,
        address: w.address,
        createdAt: Number(w.createdAtMs ?? Date.now()),
      })),
      ...eth.map((w: any) => ({
        id: `eth-${w.createdAtMs ?? Date.now()}-${w.address}`,
        chain: "eth" as const,
        address: w.address,
        createdAt: Number(w.createdAtMs ?? Date.now()),
      })),
    ].sort((a, b) => b.createdAt - a.createdAt);

    setWallets(normalized);
  }, []);

  const refreshMetals = React.useCallback(async () => {
    const [g, s] = await Promise.all([apiGetMetals("gold"), apiGetMetals("silver")]);
    setGold(Array.isArray(g.gold) ? g.gold : []);
    setSilver(Array.isArray(s.silver) ? s.silver : []);
  }, []);

  React.useEffect(() => {
    // keep crypto & metals fresh on mount
    refreshFromApi().catch(() => {});
    refreshMetals().catch(() => {});
  }, [refreshFromApi, refreshMetals]);

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
      setSavedMsg("Wallet saved ✅");
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
      setMetalMsg("Saved 🪙");
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
    } catch {
      alert("Failed to delete metals wallet");
    }
  }

  /* ----------------------- Badges & Utils ----------------------- */
  function ChainBadge({ chain }: { chain: Chain }) {
    return (
      <div className="flex items-center gap-2 rounded-full border px-2 py-1 text-xs">
        <div className="relative h-4 w-4">
          {chain === "btc" ? (
            <Image src="/bitcoin.svg" alt="BTC" fill className="object-contain" />
          ) : (
            <Image src="/ethereum.png" alt="ETH" fill className="object-contain" />
          )}
        </div>
        <span className="uppercase font-medium">{chain}</span>
      </div>
    );
  }

  const METAL_ICON: Record<Metal, string> = { gold: "🥇", silver: "🥈" };
  function MetalBadge({ metal }: { metal: Metal }) {
    return (
      <div className="flex items-center gap-2 rounded-full border px-2 py-1 text-xs">
        <div className="grid h-4 w-4 place-items-center text-[12px] leading-none">
          {METAL_ICON[metal]}
        </div>
        <span className="uppercase font-medium">{metal}</span>
      </div>
    );
  }

  function truncate(addr: string, n = 6) {
    if (addr.length <= n * 2 + 3) return addr;
    return `${addr.slice(0, n)}…${addr.slice(-n)}`;
  }

  const hasAny = wallets.length > 0 || gold.length > 0 || silver.length > 0;

  /* ----------------------------- Render ----------------------------- */
  return (
    <div className="h-full w-full p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight">Wallets</h1>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-transparent px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--surface-dark)] transition"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add wallet</span>
        </button>
      </div>

      {/* Inline create: Crypto */}
      {createChain && (
        <div className="mb-4 rounded-2xl border p-4">
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
            className="mb-3 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary"
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
        <div className="mb-4 rounded-2xl border p-4">
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
            className="mb-3 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary"
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
                <option value="oz">ounces (oz)</option>
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

      {/* Empty vs Combined List */}
      {!hasAny ? (
        <div className="flex h-[60vh] items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="mb-1 text-lg font-semibold">No wallets yet</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Start by adding a wallet to track balances and performance.
            </p>
          </div>
        </div>
      ) : (
        /* ----------------- ONE MERGED LIST: BTC / ETH / GOLD / SILVER ----------------- */
        <div className="grid grid-cols-1 gap-3">
          {[...wallets,
            ...gold.map((w) => ({ ...w, chain: "gold" as const })),
            ...silver.map((w) => ({ ...w, chain: "silver" as const }))
          ].map((w: any) => (
            <div key={w.id} className="rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                {/* Left side: badge + field(s) */}
                <div className="flex min-w-0 items-center gap-3">
                  {/* Badge */}
                  {(w.chain === "btc" || w.chain === "eth") ? (
                    <div className="flex items-center gap-2 rounded-full border px-2 py-1 text-xs">
                      <div className="relative h-4 w-4">
                        {w.chain === "btc" ? (
                          <Image src="/bitcoin.svg" alt="BTC" fill className="object-contain" />
                        ) : (
                          <Image src="/ethereum.png" alt="ETH" fill className="object-contain" />
                        )}
                      </div>
                      <span className="uppercase font-medium">{w.chain}</span>
                    </div>
                  ) : (
                    <MetalBadge metal={w.chain as Metal} />
                  )}

                  {/* Fields (edit vs view) */}
                  {(w.chain === "btc" || w.chain === "eth") ? (
                    editingId === w.id ? (
                      <input
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-[55vw] sm:w-96 rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary"
                      />
                    ) : (
                      <div className="truncate max-w-[55vw] sm:max-w-none text-sm font-mono text-muted-foreground">
                        {truncate(w.address)}
                      </div>
                    )
                  ) : metalEditingId === w.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <input
                        value={metalEditName}
                        onChange={(e) => setMetalEditName(e.target.value)}
                        placeholder="Wallet name"
                        className="w-[55vw] sm:w-64 rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary"
                      />
                      <input
                        value={metalEditAmount}
                        onChange={(e) => setMetalEditAmount(e.target.value)}
                        inputMode="decimal"
                        placeholder="12.5"
                        className="w-[40vw] sm:w-28 rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary"
                      />
                      <select
                        value={metalEditUnit}
                        onChange={(e) => setMetalEditUnit(e.target.value as MetalUnit)}
                        className="w-[40vw] sm:w-28 rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:border-transparent focus:ring-2 focus:ring-primary"
                      >
                        <option value="g">g</option>
                        <option value="oz">oz</option>
                        <option value="lb">lb</option>
                      </select>
                    </div>
                  ) : (
                    <div className="truncate max-w-[55vw] sm:max-w-none text-sm text-muted-foreground">
                      {`${w.name} — ${w.amount} ${w.unit}`}
                    </div>
                  )}
                </div>

                {/* Right side: actions (same buttons as crypto) */}
                <div className="flex items-center gap-2 shrink-0">
                  {(w.chain === "btc" || w.chain === "eth") ? (
                    editingId === w.id ? (
                      <>
                        <button
                          onClick={() => saveEdit(w.id)}
                          disabled={editBusy}
                          aria-label="Save"
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        >
                          <Save className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Save</span>
                        </button>
                        <button
                          onClick={cancelEdit}
                          aria-label="Cancel"
                          className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/80"
                        >
                          <X className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Cancel</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(w.id)}
                          aria-label="Edit"
                          className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/80"
                        >
                          <Pencil className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => deleteWallet(w.id)}
                          aria-label="Delete"
                          className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                        >
                          <Trash2 className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </>
                    )
                  ) : metalEditingId === w.id ? (
                    <>
                      <button
                        onClick={saveEditMetal}
                        disabled={metalEditBusy}
                        aria-label="Save"
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      >
                        <Save className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Save</span>
                      </button>
                      <button
                        onClick={cancelEditMetal}
                        aria-label="Cancel"
                        className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/80"
                      >
                        <X className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Cancel</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditMetal(w.chain as Metal, w.id)}
                        aria-label="Edit"
                        className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/80"
                      >
                        <Pencil className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => deleteMetal(w.chain as Metal, w.id)}
                        aria-label="Delete"
                        className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                      >
                        <Trash2 className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add-wallet modal (unchanged styles) */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold mb-1">Add a wallet</h2>
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
