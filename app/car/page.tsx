import type { Metadata } from "next";
import { CarStandalone } from "@/components/StandaloneViews";

export const metadata: Metadata = { title: "차량 화면 — 먼저 알림" };

export default function CarPage() {
  return <CarStandalone />;
}
