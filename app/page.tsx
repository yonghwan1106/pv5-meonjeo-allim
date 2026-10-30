import Link from "next/link";
import { FlowDiagram } from "@/components/Diagrams";

const EVIDENCE = [
  {
    big: "운전 중 연락 = 위법 소지",
    body: "도로교통법 제49조 제1항 제10호 「운전 중에는 휴대용 전화를 사용하지 아니할 것」, 제11의2호 「운전 중에는 영상표시장치를 조작하지 아니할 것」.",
    src: "law.go.kr 도로교통법 제49조",
  },
  {
    big: "61% · 51%",
    body: "해외 설문: 기사 도착 1시간 전 문자 알림을 원함 61%, 방문 대기 동안 집에 갇힌 느낌 51%. (국내 지연·노쇼 통계는 아직 확인하지 못함)",
    src: "cablefax 「a tale of two cost of waiting surveys」 — 해외 업계지 재인용, 원 조사 미확인",
  },
  {
    big: "1,905mm vs 2.1m",
    body: "PV5 카고 전고 1,905mm → 높이 제한 2.1m 지하주차장에 들어갈 수 있다. 일반 택배 탑차는 2.5~2.6m, 지하주차장 제한은 2.1~2.3m.",
    src: "기아 PV5 카고 카탈로그 · 경기일보 2024-08-13",
  },
  {
    big: "지금 바로 쓰는 SDK",
    body: "핵심 기능은 Pleos 문서상 「신청 없이 바로 사용 가능」한 Vehicle State + NaviHelper(ETA·남은 시간·도착 이벤트)로 성립. 음성 명령은 Gleo actionCalls 최대 3개, 7초 제한.",
    src: "document.pleos.ai create-my-project · NaviHelper · Gleo Interface 가이드",
  },
];

const FEATURES = [
  { n: "1", t: "지연 예측 → 「그래」 한마디 → 서버가 대신 발송", d: "내비 TripInfo.eta가 약속보다 10분 넘게 밀리면 음성으로 한 번 묻고, 승인하면 고객에게 「약 20분 늦어요(11:20~11:30)」." },
  { n: "2", t: "고객 답에 맞춰 오늘 순서 다시 짜기", d: "「1시간 뒤로」를 누르면 서버가 남은 일정을 다시 짜고, 내비 목적지를 다음 고객으로 교체 + 앞당겨진 고객에게 자동 문의. 내비 경유지는 최대 2개라 다음 1곳만 넘긴다." },
  { n: "3", t: "도착·작업 시작·출발 자동 기록", d: "도착 이벤트 + 기어 P = 도착, 카고 뒷문 열림 = 작업 시작 [가정 매핑], 기어 D로 이탈 = 완료·출발. 작업이 길어지면 출발 전에 다음 고객 지연을 미리 묻는다." },
  { n: "4", t: "도착 10분 전 「집에 계세요?」 + 주차장 입구", d: "남은 10분(또는 3km)이면 먼저 확인. 고객이 방문 차량 등록·지하주차장 입구를 알려 주면 음성 한마디로 목적지를 입구로 바꾼다. 공동현관 번호는 받지 않는다." },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-5 py-8">
      <section>
        <p className="text-sm font-bold text-accent">유틸리티 · 수리·설치·인테리어 등 출장 기반 서비스 · PV5 카고</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight md:text-[40px]">
          운전 중 손 안 대도,
          <br />
          고객에게 「늦어요」가 먼저 갑니다.
        </h1>
        <p className="mt-4 max-w-[860px] text-[17px] text-[#d6dade]">
          <b>먼저 알림</b>[가칭]은 출장 기사의 PV5 차량 화면에서 도는 앱입니다. PV5 내비의 도착 예정 시각으로 고객에게 「늦어요」·「곧 도착」을 먼저 보내고,
          고객의 답에 맞춰 오늘 방문 순서를 다시 짭니다. 기사는 운전 중 휴대폰을 집지 않고, 「그래」 한마디만 합니다.
        </p>
        <p className="mt-3 max-w-[860px] text-sm text-muted" data-testid="sync-note">
          ※ 고객 링크(<code>/c/…</code>)와 <code>/car</code>는 같은 브라우저의 다른 탭에서 열어야 시연과 동기화됩니다(실서비스는 서버 푸시).
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/demo" className="btn btn-primary !px-5 !py-3 !text-base no-underline">
            시연 열기 (3분할)
          </Link>
          <Link href="/sdk" className="btn !px-5 !py-3 !text-base no-underline">
            SDK 이식 구조
          </Link>
          <Link href="/architecture" className="btn !px-5 !py-3 !text-base no-underline">
            아키텍처·개인정보
          </Link>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-extrabold">문제 한 줄</h2>
        <p className="mt-1 text-[#d6dade]">
          앞 현장이 길어져 다음 약속에 늦는데, 기사는 운전 중이라 전화도 문자도 못 한다(위법). 고객은 기다리다 외출하고, 오후 일정이 줄줄이 밀린다.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {EVIDENCE.map((e) => (
            <div key={e.big} className="card p-4">
              <div className="text-2xl font-extrabold text-accent">{e.big}</div>
              <p className="mt-1 text-[15px] text-[#e1e4e8]">{e.body}</p>
              <p className="mt-2 text-xs text-muted">출처: {e.src}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-extrabold">어떻게 닫히나 — 차량 ↔ 서버 ↔ 고객</h2>
        <div className="card mt-3 p-3">
          <FlowDiagram />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.n} className="card p-4">
              <div className="text-sm font-bold text-accent">기능 {f.n}</div>
              <div className="mt-0.5 text-lg font-extrabold">{f.t}</div>
              <p className="mt-1 text-[15px] text-[#d6dade]">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-extrabold">데모 보는 법 (혼자 눌러 봐도 돼요)</h2>
        <ol className="mt-3 grid gap-3 md:grid-cols-4">
          {[
            { t: "시나리오 고르기", d: "/demo 왼쪽 시뮬레이터에서 ①지연 ②재배치 ③도착·작업 ④10분 전 확인 중 하나를 고릅니다." },
            { t: "▶ 재생 또는 다음 단계", d: "자동 재생(×1·×10·×60)하거나 「다음 단계 ▶」로 한 칸씩. 아래 자막이 무엇이 일어났는지 4칸으로 설명합니다." },
            { t: "세 화면 보기", d: "가운데 PV5 차량 화면, 오른쪽 고객 휴대폰(또는 업체 관제), 맨 아래 「API 호출 기록」에 SDK 이름 그대로 찍힙니다." },
            { t: "직접 눌러 보기", d: "운전자 「그래/아니」, 정체 +20분, 고객 버튼을 직접 누르세요. 주행 중 차량 화면을 누르면 막힙니다." },
          ].map((x, i) => (
            <li key={x.t} className="card p-4">
              <div className="text-sm font-bold text-accent">{i + 1}</div>
              <div className="font-extrabold">{x.t}</div>
              <p className="mt-1 text-sm text-[#d6dade]">{x.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { href: "/demo", t: "시연 3분할", d: "시뮬레이터 · 차량 · 동반" },
            { href: "/car", t: "차량 화면 단독", d: "전시·녹화용" },
            { href: "/companion", t: "동반 화면 단독", d: "고객 휴대폰 · 업체 관제" },
            { href: "/sim", t: "시뮬레이터 단독", d: "발표자 조작용" },
            { href: "/ops", t: "업체 관제", d: "타임라인 · 발송 기록" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="card block p-3 no-underline hover:border-accent">
              <div className="font-extrabold text-ink">{l.t}</div>
              <div className="text-xs text-muted">{l.d}</div>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          두 탭 시연: 같은 브라우저에서 <code>/car</code>와 <code>/companion</code>(또는 <code>/sim</code>)을 나란히 열면 BroadcastChannel로 실시간 동기화됩니다. 서버 저장은 없습니다 — 실서비스는 서버 푸시.
        </p>
      </section>

      <section className="mt-10 border-t border-line pt-5 text-xs leading-relaxed text-muted">
        <p>
          제5회 기아 PBV 아이디어 공모전 솔루션(S/W) 부문 응모용 웹 시제품 · 팀 크리에이티브 넥서스. 인물·업체·단지·주소·전화번호는 모두 가상입니다(김○○ 등 별칭).
          기아·PV5·Pleos·Gleo는 각 권리자의 상표이며, 이 시제품은 공식 제품이 아니고 로고·상표 이미지를 쓰지 않습니다. Pleos SDK는 웹 모의 어댑터로 흉내 냈고,
          「준비 중」 SDK(TTS·STT·FusedLocation·Vehicle Control)는 화면에 「SDK 공개 시 연동」으로 표시했습니다.
        </p>
      </section>
    </main>
  );
}
