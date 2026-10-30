import type { Metadata } from "next";
import { SimStandalone } from "@/components/StandaloneViews";

export const metadata: Metadata = { title: "시뮬레이터 — 먼저 알림" };

export default function SimPage() {
  return <SimStandalone />;
}
