const StatTile = ({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) => {
  return (
    <div
      className={`rounded-2xl border p-4 ${wide ? "sm:col-span-1 lg:col-span-1" : ""}`}
    >
      <div className="text-sm text-gray-500 font-medium">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
};

export default StatTile;
