/** 설명용 그림 (SVG) — 데이터 흐름 3단 구조, 방문 상태 머신 */

export function FlowDiagram() {
  const box = (x: number, y: number, w: number, h: number, title: string, lines: string[], color: string) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill="#161a1f" stroke={color} strokeWidth="2" />
      <text x={x + 14} y={y + 26} fontSize="16" fontWeight="800" fill="#eceef1">
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={i} x={x + 14} y={y + 50 + i * 21} fontSize="13" fill="#c9ced4">
          {l}
        </text>
      ))}
    </g>
  );
  // 라벨은 화살표 위(위쪽 화살표) 또는 아래(아래쪽 화살표)에 1~2줄로, 상자와 겹치지 않게 간격 130px 안에 둔다
  const arrow = (x1: number, y1: number, x2: number, y2: number, label: string[], color = "#7cc4d6", below = false) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2.2" markerEnd="url(#ah)" />
      {label.map((l, i) => (
        <text
          key={i}
          x={(x1 + x2) / 2}
          y={below ? y1 + 17 + i * 15 : y1 - 8 - (label.length - 1 - i) * 15}
          fontSize="12"
          textAnchor="middle"
          fill={color}
        >
          {l}
        </text>
      ))}
    </g>
  );
  return (
    <svg viewBox="0 0 1280 470" className="w-full" role="img" aria-label="데이터 흐름: 차량 → 차량 앱 → 서버 → 고객·업체">
      <defs>
        <marker id="ah" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" fill="#9aa3ad" />
        </marker>
      </defs>
      {box(20, 30, 250, 200, "PV5 차량 (AAOS)", ["AAOS Car API: GEAR_SELECTION·", "  PERF_VEHICLE_SPEED", "Vehicle SDK: Door(REAR)·SOC", "NaviHelper: TripInfo·도착 이벤트", "Gleo AI (음성, OS 상위 레이어)", "Vehicle State·NaviHelper = 바로 사용"], "#9fd3ff")}
      {box(400, 30, 260, 200, "먼저 알림 차량 앱", ["판단 = lib/logic 순수 함수", "predictDelayMin·shouldAskDelay", "shouldPreArrivalCheck·predictOverrun", "주행 3단 UX (P에서만 터치)", "SMS·전화 직접 안 씀", "(Pleos: 차량 Telephony·SMS 제한)"], "#7cc4d6")}
      {box(790, 30, 230, 200, "우리 서버", ["발송 대행 (알림톡 — 모의)", "replan(): 오늘 순서 다시 짜기", "사건 기록: 도착·작업·출발", "1회용 고객 링크 발급", "위치 궤적 저장 안 함", "보관 90일 후 삭제 [가정]"], "#f2b75b")}
      {box(1090, 20, 180, 120, "고객 휴대폰", ["/c/[token] 1회용 링크", "도착 예정 범위만", "지도·위치 없음"], "#ff9fb2")}
      {box(1090, 160, 180, 110, "업체 관제", ["/ops 타임라인", "발송 문구·응답 기록"], "#ff9fb2")}
      {box(400, 300, 620, 140, "시제품에서는 (이 웹 데모)", ["모의 SDK(lib/pleos/mock) = Virtual Console 흉내 시뮬레이터가 값을 바꿈", "모의 서버(lib/engine/server) = 같은 브라우저 메모리, 탭 간 BroadcastChannel", "실서비스: Kotlin 앱 + HTTPS API + 서버 푸시 (lib/pleos/*.ts 인터페이스는 그대로)"], "#3a4550")}
      {arrow(270, 90, 400, 90, ["신호·이벤트"])}
      {arrow(400, 160, 270, 160, ["requestRoute", "Gleo 회신"], "#8fe0a8", true)}
      {arrow(660, 90, 790, 90, ["ETA(분)·사건만"])}
      {arrow(790, 160, 660, 160, ["서버 푸시:", "고객 답·새 순서"], "#f2b75b", true)}
      {arrow(1020, 60, 1090, 60, ["알림톡"], "#ff9fb2")}
      {arrow(1090, 115, 1020, 115, ["답 3버튼"], "#ff9fb2", true)}
      {arrow(1020, 215, 1090, 215, ["기록"], "#ff9fb2")}
    </svg>
  );
}

export function JobStateDiagram() {
  const node = (x: number, y: number, label: string, sub: string, color = "#7cc4d6") => (
    <g>
      <rect x={x - 70} y={y - 26} width="140" height="52" rx="10" fill="#161a1f" stroke={color} strokeWidth="2" />
      <text x={x} y={y - 3} fontSize="14" fontWeight="800" textAnchor="middle" fill="#eceef1">
        {label}
      </text>
      <text x={x} y={y + 16} fontSize="11" textAnchor="middle" fill="#a9b1bb">
        {sub}
      </text>
    </g>
  );
  const edge = (x1: number, y1: number, x2: number, y2: number, label: string, dy = -7) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5c6670" strokeWidth="2" markerEnd="url(#ah2)" />
      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + dy} fontSize="11.5" textAnchor="middle" fill="#f2d38a">
        {label}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 1100 300" className="w-full" role="img" aria-label="방문 상태 머신">
      <defs>
        <marker id="ah2" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" fill="#5c6670" />
        </marker>
      </defs>
      {node(90, 70, "SCHEDULED", "예정")}
      {node(300, 70, "EN_ROUTE", "이동 중")}
      {node(520, 70, "DELAY_NOTIFIED", "지연 알림 보냄")}
      {node(740, 70, "ARRIVED", "도착")}
      {node(740, 210, "IN_PROGRESS", "작업 중")}
      {node(960, 210, "DONE", "완료", "#5fd39a")}
      {node(300, 210, "POSTPONED", "시간 변경", "#f2b75b")}
      {node(520, 210, "OTHER_DAY", "다른 날로", "#a9b1bb")}
      {edge(160, 70, 230, 70, "requestRoute")}
      {edge(370, 70, 450, 70, "「그래」 NOTIFY_DELAY")}
      {edge(590, 70, 670, 70, "도착 이벤트 + 기어 P")}
      {edge(740, 96, 740, 184, "", 0)}
      <text x={752} y={145} fontSize="11.5" fill="#f2d38a">
        카고 뒷문 REAR 열림 [가정]
      </text>
      {edge(810, 210, 890, 210, "기어 D + 차속>0")}
      {edge(330, 96, 310, 184, "", 0)}
      <text x={120} y={150} fontSize="11.5" fill="#f2d38a">
        고객 「1시간 뒤로」 → replan()
      </text>
      {edge(370, 210, 450, 210, "「다른 날로」")}
      {edge(300, 184, 300, 96, "", 0)}
      <text x={20} y={285} fontSize="11.5" fill="#a9b1bb">
        도착은 「내비 도착 이벤트」와 「기어 P」가 둘 다 있어야 확정 — 근처 정차를 도착으로 오인하지 않게. 기사는 아무것도 누르지 않는다.
      </text>
    </svg>
  );
}
