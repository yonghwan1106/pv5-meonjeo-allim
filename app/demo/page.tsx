import type { Metadata } from "next";
import DemoBoard from "@/components/DemoBoard";

export const metadata: Metadata = { title: "시연 (3분할) — 먼저 알림" };

export default function DemoPage() {
  return <DemoBoard />;
}
