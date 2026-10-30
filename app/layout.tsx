import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "먼저 알림 [가칭] — PV5 출장 기사용 차량 앱 시제품",
  description:
    "출장 기사가 운전 중 손 안 대도, PV5 내비 도착 예정 시각으로 고객에게 「늦어요」·「곧 도착」이 먼저 가고, 고객 답에 맞춰 오늘 방문 순서를 다시 짜는 차량용 앱 시제품 (제5회 기아 PBV 아이디어 공모전 솔루션 부문 응모작, 팀 크리에이티브 넥서스).",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d0f12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
