import type { Metadata } from "next";
import { CompanionStandalone } from "@/components/StandaloneViews";

export const metadata: Metadata = { title: "동반 화면 — 먼저 알림" };

export default function CompanionPage() {
  return <CompanionStandalone />;
}
