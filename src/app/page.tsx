// ── src/app/page.tsx -> redirect root to /signin ────────────
import { redirect } from "next/navigation";
export default function Home() { redirect("/signin"); }