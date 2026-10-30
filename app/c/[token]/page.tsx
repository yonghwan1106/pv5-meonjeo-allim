import type { Metadata } from "next";
import { CustomerStandalone } from "@/components/StandaloneViews";

export const metadata: Metadata = { title: "방문 안내 — 먼저 알림" };

export default async function CustomerLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CustomerStandalone token={token} />;
}
