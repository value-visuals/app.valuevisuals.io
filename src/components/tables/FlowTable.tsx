import { fmtDate, toMs, toNum } from "@/lib/utils/num";

const FlowTable = ({
  points,
  unitFmt,
  unitLabel,
}: {
  points: ChartPoint[];
  unitFmt: (n: Integerish) => string;
  unitLabel: string;
}) => {
  // Filter out empty or missing data points, then sort newest first
  const filteredPoints = (points ?? [])
    .filter((p) => Number.isFinite(toNum(p?.flow)) && toNum(p.flow) !== 0)
    .sort((a, b) => toMs(b.t) - toMs(a.t));

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Daily Net Flow</h2>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">
                Date (UTC)
              </th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">
                Flow ({unitLabel})
              </th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">
                Cumulative ({unitLabel})
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPoints.map((p, i) => (
              <tr key={`${p.t}-${i}`} className="border-t">
                <td className="px-4 py-2">{fmtDate(p.t)}</td>
                <td className="px-4 py-2 text-right">{unitFmt(p.flow)}</td>
                <td className="px-4 py-2 text-right">{unitFmt(p.cum)}</td>
              </tr>
            ))}
            {filteredPoints.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                  No data for selected range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default FlowTable;
