import Link from "next/link";
import { MouseEventHandler } from "react";

const ViewSwitcher = ({
  options,
  current,
  setCurrent,
}: {
  options: { text: string; link: string; id: string }[];
  current: string;
  setCurrent: (current: string) => void;
}) => {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border p-1 bg-white">
      {options.map((option) => (
        <Link
          key={option.id}
          href={option.link}
          onClick={() => setCurrent(option.id)}
          className={`px-3 py-1.5 rounded-lg text-sm ${option.id === current ? "bg-black text-white" : "text-black"}`}
        >
          {option.text}
        </Link>
      ))}
    </div>
  );
};

export default ViewSwitcher;
