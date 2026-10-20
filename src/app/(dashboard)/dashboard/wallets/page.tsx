"use client";

import ClientWallets from "./ClientWallets";

// Load wallet data only after Firebase Auth initializes in the browser.
// ClientWallets already refreshes crypto and metals wallets using the existing API paths.
export default function WalletPage() {
  return <ClientWallets initialWallets={[]} initialMetals={{ gold: [], silver: [] }} />;
}
