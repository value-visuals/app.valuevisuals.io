import Link from "next/link";

const WalletsTable = ({
  wallets,
  unitFmt,
  unitLabel,
}: {
  wallets: WalletStat[];
  unitFmt: (n: Integerish) => string;
  unitLabel: string;
}) => {
  return wallets.length === 0 ? (
    <div className="rounded-2xl border p-6 bg-white">
      <p className="font-medium text-black">
        No wallets for account, add wallets
      </p>
      <p className="text-sm text-black mt-1">
        Connect at least one wallet address to see portfolio stats.
      </p>
      <div className="mt-4">
        <Link
          href="/dashboard/wallets"
          className="inline-flex items-center rounded-xl border border-black px-4 py-2 text-sm font-medium text-black hover:bg-gray-100"
        >
          Go to Wallets
        </Link>
      </div>
    </div>
  ) : (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Wallets</h2>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">
                Address
              </th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">
                Balance ({unitLabel})
              </th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">
                Received ({unitLabel})
              </th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">
                Sent ({unitLabel})
              </th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">
                Pending Δ
              </th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">
                Tx Count
              </th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((w) => (
              <tr key={w.address} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{w.address}</td>
                <td className="px-4 py-2 text-right">{unitFmt(w.balance)}</td>
                <td className="px-4 py-2 text-right">
                  {unitFmt(w.totalReceived)}
                </td>
                <td className="px-4 py-2 text-right">{unitFmt(w.totalSent)}</td>
                <td className="px-4 py-2 text-right">
                  {unitFmt(w.pendingDelta)}
                </td>
                <td className="px-4 py-2 text-right">
                  {w.txCount.toLocaleString()}
                </td>
              </tr>
            ))}
            {wallets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No wallets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default WalletsTable;
