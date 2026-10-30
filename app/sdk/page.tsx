import type { Metadata } from "next";
import { MAPPING, STATUS_COLOR } from "@/lib/pleos/mapping";
import { KOTLIN_GLEO, KOTLIN_NAVI, KOTLIN_UX, KOTLIN_VEHICLE } from "@/lib/pleos/kotlinExamples";
import { PREPARING_FEATURES } from "@/lib/pleos/preparing";
import { REQUIRED_VEHICLE_PERMISSIONS } from "@/lib/pleos/vehicle";
import { validateAppSchema } from "@/lib/logic/voice";
import { CAR_CODE_LABEL } from "@/lib/engine/carScreen";
import { JobStateDiagram } from "@/components/Diagrams";
import { APP_SCHEMA as schema } from "@/lib/pleos/appSchema";

export const metadata: Metadata = { title: "SDK 이식 구조 — 먼저 알림" };

const CAR_STATES: { code: keyof typeof CAR_CODE_LABEL; signal: string; screen: string; input: string }[] = [
  { code: "C0", signal: "기어 P, 오늘 첫 일정", screen: "오늘 일정 6건 시간표, 「첫 고객으로 출발」", input: "터치 → requestRoute" },
  { code: "C1", signal: "기어 D·차속 > 0", screen: "「다음 김○○ · 도착 11:22 · 약속 11:00 (+22)」 두 줄 + 칩 1개", input: "터치 막음, 음성만" },
  { code: "C2", signal: "예측 지연 ≥ 10분", screen: "Gleo asking 「김○○ 고객님께 약 20분 늦는다고 알릴까요?」", input: "음성 그래/아니, 7초 → 1회 재질문" },
  { code: "C3", signal: "서버 푸시 (고객 응답)", screen: "주행 = 음성 1문장 + 칩 / 정지 = 답장 1줄", input: "없음" },
  { code: "C4", signal: "고객 「1시간 뒤로」", screen: "「박○○ 고객님 먼저 갑니다」 + 목적지 교체", input: "없음 (자동, 「다음 어디야?」로 확인)" },
  { code: "C5", signal: "remainTime ≤ 10분", screen: "「계심 ✓ · B동 지하 2층 입구로 안내」", input: "음성 (CHANGE_TO_PARKING)" },
  { code: "C6", signal: "onDestinationArrived + 기어 P", screen: "「도착 알림 보냄」, 다음 일정", input: "터치" },
  { code: "C7", signal: "Door REAR Open [가정]", screen: "작업 타이머, 초과 시 「다음 고객 지연 — 미리 알릴까요?」", input: "터치 + 음성" },
  { code: "C8", signal: "마지막 일정 완료 + P", screen: "지연 알림 n건·헛걸음 막음·가장 큰 지연", input: "터치" },
];

export default function SdkPage() {
  const errors = validateAppSchema(schema);
  return (
    <main className="prose-doc mx-auto w-full max-w-[1180px] px-5 py-6">
      <h1 className="text-2xl font-extrabold">SDK 이식 구조 — 웹 모의 어댑터 ↔ Pleos Connect SDK</h1>
      <p>
        차량 앱 로직(<code>lib/engine/carApp.ts</code>)은 <code>lib/pleos/*.ts</code>의 <b>인터페이스만</b> 씁니다. 인터페이스의 메서드·콜백 이름은 Pleos 문서 원문 그대로입니다(
        <code>registerDoorPosition</code>, <code>requestRoute</code>, <code>onTripInfo</code>, <code>onDestinationArrived</code>, App Schema <code>actionCalls</code> …).
        시제품은 <code>lib/pleos/mock/*</code>가 이 인터페이스를 구현하고, 실차에서는 그 자리에 SDK를 꽂습니다. 판단 로직(<code>lib/logic/*.ts</code>)은 순수 함수라 Kotlin으로 그대로 옮깁니다.
      </p>

      <h2>대응표 (웹 Mock ↔ Pleos SDK ↔ 권한)</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>기능</th>
              <th>웹 시제품 (모의)</th>
              <th>Pleos SDK 원문 API</th>
              <th>권한</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {MAPPING.map((r) => (
              <tr key={r.feature}>
                <td className="font-bold">{r.feature}</td>
                <td>
                  <code>{r.web}</code>
                </td>
                <td>
                  <code>{r.pleos}</code>
                </td>
                <td>{r.permission}</td>
                <td>
                  <span className="badge" style={{ color: STATUS_COLOR[r.status] }}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm">
        Manifest 최소 권한(조회만, 제어 권한 없음): {REQUIRED_VEHICLE_PERMISSIONS.map((p) => <code key={p} className="mr-1">{p}</code>)}. 문서에 없는 API(카메라·V2L 등)는 쓰지 않습니다.
      </p>

      <h2>「준비 중」 SDK — 화면에 「SDK 공개 시 연동」 배지</h2>
      <table>
        <thead>
          <tr>
            <th>SDK</th>
            <th>이 앱에서 쓸 곳</th>
            <th>지금 시제품</th>
          </tr>
        </thead>
        <tbody>
          {PREPARING_FEATURES.map((p) => (
            <tr key={p.sdk}>
              <td className="font-bold">{p.sdk}</td>
              <td>{p.use}</td>
              <td>{p.now}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Gleo App Schema (actionCalls 3개)</h2>
      <p>
        규칙 검사(<code>validateAppSchema</code>): {errors.length === 0 ? <b style={{ color: "var(--ok)" }}>통과 — 함수 3개 이하 · 이름 대문자_밑줄 · 설명 영어</b> : errors.join(", ")}.
        Callback은 <code>success / asking / fail</code>, 7초 안에 <code>ai.pleos.playground.intent.action.APP_ACTION_RESPONSE</code> 브로드캐스트로 회신합니다.
        앱이 먼저 묻는 proactive 제안은 서드파티 공개 여부가 문서에 없어 <b style={{ color: "var(--warn)" }}>[가정]</b>입니다(대체: 알림 카드 + 비프 + 호출어 「먼저 알림」).
      </p>
      <pre>
        <code>{JSON.stringify(schema, null, 2)}</code>
      </pre>

      <h2>방문 상태 머신</h2>
      <div className="card p-3">
        <JobStateDiagram />
      </div>

      <h2>차량 화면 상태 C0~C8</h2>
      <table>
        <thead>
          <tr>
            <th>상태</th>
            <th>진입 신호</th>
            <th>화면</th>
            <th>입력</th>
          </tr>
        </thead>
        <tbody>
          {CAR_STATES.map((c) => (
            <tr key={c.code}>
              <td className="font-bold">
                {c.code} {CAR_CODE_LABEL[c.code]}
              </td>
              <td>{c.signal}</td>
              <td>{c.screen}</td>
              <td>{c.input}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Kotlin 이식 예시</h2>
      <p>API 이름은 Pleos 문서 원문, 람다·인자 순서 일부는 문서 미확인 [가정]. 판단 함수(DelayRules·PreArrival·DriveMode)는 <code>lib/logic</code>을 그대로 옮긴 것입니다.</p>
      <h3>1. NaviHelper — 목적지·ETA·10분 전 확인</h3>
      <pre>
        <code>{KOTLIN_NAVI}</code>
      </pre>
      <h3>2. AAOS 기어·차속 + Vehicle SDK 카고 뒷문 — 자동 기록</h3>
      <pre>
        <code>{KOTLIN_VEHICLE}</code>
      </pre>
      <h3>3. Gleo Interface — 함수 받기·7초 안 회신</h3>
      <pre>
        <code>{KOTLIN_GLEO}</code>
      </pre>
      <h3>4. 주행 중 제한</h3>
      <pre>
        <code>{KOTLIN_UX}</code>
      </pre>
      <p className="text-sm">
        자세한 교체 절차: 저장소 <code>docs/PLEOS_PORTING.md</code>
      </p>
    </main>
  );
}
