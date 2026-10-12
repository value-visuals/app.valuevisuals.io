import { formatPercent } from "@/lib/utils/num";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

const Delta = ({
  changeFraction,
}: {
  changeFraction: number | null | undefined;
}) => {
  const positive = !!changeFraction && changeFraction >= 0;
  return (
    <div className="mt-1 text-xl font-semibold">
      {!changeFraction ? (
        <span className="text-muted-foreground">-</span>
      ) : (
        <span
          className={`flex items-center gap-1 ${positive ? "text-green-600" : "text-red-600"}`}
        >
          {positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {formatPercent(changeFraction)}
        </span>
      )}
    </div>
  );
};

export default Delta;
