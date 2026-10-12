import Delta from "./Delta";

const Tile = ({
  label,
  value,
  isDelta = false,
}: {
  label: string;
  value: string | number;
  isDelta?: boolean;
}) => {
  return (
    <div className="rounded-lg bg-gray-800 border border-gray-900 p-3">
      <div className="text-sm text-gray-500 dark:text-gray-300 tracking-normal">
        {label}
      </div>

      {isDelta ? (
        <Delta changeFraction={Number(value)} />
      ) : (
        <div className="text-lg font-semibold">{value}</div>
      )}
    </div>
  );
};

export default Tile;
