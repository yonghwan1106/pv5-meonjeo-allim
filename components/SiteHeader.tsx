"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "소개" },
  { href: "/demo", label: "시연 (3분할)" },
  { href: "/car", label: "차량 화면" },
  { href: "/companion", label: "동반 화면" },
  { href: "/ops", label: "업체 관제" },
  { href: "/sim", label: "시뮬레이터" },
  { href: "/sdk", label: "SDK 이식 구조" },
  { href: "/architecture", label: "아키텍처" },
];

export default function SiteHeader() {
  const path = usePathname();
  return (
    <header className="border-b border-line bg-[#0f1216]">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2">
        <Link href="/" className="flex items-baseline gap-2 no-underline" style={{ color: "var(--text)" }}>
          <span className="text-lg font-extrabold tracking-tight">먼저 알림</span>
          <span className="text-xs text-muted">[가칭] PV5 출장 기사용 차량 앱 시제품</span>
        </Link>
        <nav aria-label="주 메뉴" className="flex flex-wrap gap-1">
          {NAV.map((n) => {
            const on = n.href === "/" ? path === "/" : path?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-md px-2.5 py-1 text-sm no-underline ${on ? "bg-[#26323a] font-bold text-white" : "text-[#c9ced4] hover:bg-[#1c2228]"}`}
                aria-current={on ? "page" : undefined}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <span className="ml-auto hidden text-xs text-muted xl:inline">팀 크리에이티브 넥서스 · 모든 데이터 가상</span>
      </div>
    </header>
  );
}
