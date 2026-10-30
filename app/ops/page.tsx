import type { Metadata } from "next";
import { OpsStandalone } from "@/components/StandaloneViews";

export const metadata: Metadata = { title: "업체 관제 — 먼저 알림" };

export default function OpsPage() {
  return <OpsStandalone />;
}
