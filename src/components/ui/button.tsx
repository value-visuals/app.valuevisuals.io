// ── src/components/ui/button.tsx (simple Tailwind button) ────
import * as React from "react";
import { cn } from "@/lib/utils";


type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "secondary" };
export function Button({ className, variant = "primary", ...props }: Props) {
    const base = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition shadow-sm";
    const styles =
        variant === "primary"
            ? "bg-black text-white hover:bg-black/80"
            : variant === "secondary"
                ? "bg-gray-100 hover:bg-gray-200 text-gray-900"
                : "bg-transparent hover:bg-gray-100 text-gray-900";
    return <button className={cn(base, styles, className)} {...props} />;
}