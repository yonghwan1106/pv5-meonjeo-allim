import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { FlowDiagram } from "@/components/Diagrams";
import { MAPPING, STATUS_COLOR } from "@/lib/pleos/mapping";
import { DEFAULT_RULES } from "@/lib/logic/rules";
import { getNode, travelTable } from "@/lib/logic/travel";
import day from "@/data/day.json";

export const metadata: Metadata = { title: "아키텍처 — 먼저 알림" };

export default function ArchitecturePage() {
  const ids = ["DEPOT", "J1", "J2", "J3", "J4", "J5", "J6"];
  const table = travelTable(ids);
  return (
    <main className="prose-doc mx-auto w-full max-w-[1180px] px-5 py-6">
      <h1 className="text-2xl font-extrabold">아키텍처 — 데이터 흐름 · 어댑터 · 개인정보 · 주행 중 제한</h1>

      <h2>1. 데이터 흐름 (3단 구조)</h2>
      <p>
        차량 앱은 상태·버튼·음성만 맡고, <b>고객에게 보내는 일은 서버가</b> 합니다. Pleos 문서상 차량에서 Telephony·SMS는 「제공되지 않거나 제한될 수 있음」이라 차량이 직접 문자를 보내지 않습니다.
        차량 앱 → 서버로는 위치가 아니라 <b>도착 예정 시각(분)과 사건(도착·작업 시작·출발)</b>만 갑니다.
      </p>
      <div className="card p-3">
        <FlowDiagram />
      </div>

      <h2>2. 어댑터 (요약)</h2>
      <table>
        <thead>
          <tr>
            <th>기능</th>
            <th>Pleos 원문 API</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {MAPPING.slice(0, 16).map((r) => (
            <tr key={r.feature}>
              <td>{r.feature}</td>
              <td>
                <code>{r.pleos}</code>
              </td>
              <td>
                <span className="badge" style={{ color: STATUS_COLOR[r.status] }}>
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        전체 표·권한·Kotlin 예시는 <Link href="/sdk">SDK 이식 구조</Link>에.
      </p>

      <h2>3. 개인정보 처리</h2>
      <table>
        <thead>
          <tr>
            <th>구분</th>
            <th>내용</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="font-bold">고객에게 보이는 것</td>
            <td>진행 단계(출발 전→이동 중→도착→작업 중→완료), 도착 예정 시각 <b>범위(10분 폭)</b>, 차종·차번 뒤 4자리. <b>지도·실시간 위치는 보여 주지 않음</b>(개인위치정보 제3자 제공 최소화).</td>
          </tr>
          <tr>
            <td className="font-bold">저장하는 것</td>
            <td>일정(고객 별칭·업체가 맡긴 연락처 — 발송에만 사용), 사건 시각(도착·작업 시작·출발)과 지점 이름, 보낸 알림 문구·승인 방식(음성/터치/자동), 고객 응답.</td>
          </tr>
          <tr>
            <td className="font-bold">저장하지 않는 것</td>
            <td>연속 위치 궤적(GPS), 운전자 음성 원문(Gleo가 처리, 앱은 함수 호출 결과만), 고객 집 사진, 공동현관 번호(아예 받지 않음).</td>
          </tr>
          <tr>
            <td className="font-bold">보관 기간</td>
            <td>방문 기록 90일 후 삭제 [가정 — 업체 계약으로 확정]. 고객 링크는 1회용, 방문 완료 시 만료.</td>
          </tr>
          <tr>
            <td className="font-bold">구조</td>
            <td>고객 연락처는 업체(개인정보처리자)가 우리에게 맡기는 처리위탁 구조 [조문 미열람]. 기사 위치를 관제가 볼 경우 기사 본인 동의 + 위치기반서비스사업 신고 검토 [확인 필요].</td>
          </tr>
          <tr>
            <td className="font-bold">이 시제품</td>
            <td>서버 저장 없음. 모든 상태는 브라우저 메모리에만 있고, 같은 브라우저 탭끼리 BroadcastChannel로 맞춥니다. 인물·주소·전화번호는 모두 가상.</td>
          </tr>
        </tbody>
      </table>

      <h2>4. 주행 중 제한 설계</h2>
      <p>
        근거: 도로교통법 제49조 제1항 제10호(운전 중 휴대용 전화 사용 금지)·제11의2호(운전 중 영상표시장치 조작 금지), AAOS CarUxRestrictions(DO 미선언 앱 = 주행 중 사용 불가,
        NO_KEYBOARD·NO_VIDEO·LIMIT_STRING_LENGTH 등). AAOS 「그외 지역」 기준보다 국내법이 엄격하므로 <b>기어 P에서만 터치</b>를 받습니다.
      </p>
      <table>
        <thead>
          <tr>
            <th>상태 (판정 신호)</th>
            <th>운전자 화면</th>
            <th>입력</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>주행 — 차속 &gt; 0 또는 기어 R</td>
            <td>1~2초에 읽히는 큰 글자 2줄 + 상태 칩 1개. 동영상·자동 스크롤·긴 글 없음</td>
            <td>터치 막음 (오버레이 「주행 중에는 음성으로 · 정차(P) 후 사용」), Gleo 음성만</td>
          </tr>
          <tr>
            <td>정지 — 차속 0, 기어 D/N (신호 대기)</td>
            <td>주행 화면 + 받은 답장 1줄</td>
            <td>터치 막음 (법상 정지 중 예외가 있지만 보수적으로)</td>
          </tr>
          <tr>
            <td>주차 — 기어 P</td>
            <td>전체 목록·작업 타이머·고객 메모</td>
            <td>터치 전부</td>
          </tr>
        </tbody>
      </table>

      <h2>5. 판단 기준값 (업체 설정, 기본값)</h2>
      <table>
        <tbody>
          <tr>
            <td>지연 알림을 물어보는 기준</td>
            <td>약속보다 {DEFAULT_RULES.delayThresholdMin}분 이상 늦을 때, 이미 알렸으면 {DEFAULT_RULES.renotifyStepMin}분 더 밀릴 때만 다시</td>
          </tr>
          <tr>
            <td>도착 전 확인</td>
            <td>
              남은 {DEFAULT_RULES.preArrivalMin}분 또는 {DEFAULT_RULES.preArrivalDistM / 1000}km 이하
            </td>
          </tr>
          <tr>
            <td>앞당김 문의</td>
            <td>{DEFAULT_RULES.earlierOfferMin}분 이상 일찍 갈 수 있을 때</td>
          </tr>
          <tr>
            <td>자동 발송</td>
            <td>{DEFAULT_RULES.autoSend ? "켬" : "끔 — 기본은 음성 한마디 승인 (오발송 방지)"}</td>
          </tr>
        </tbody>
      </table>

      <h2>6. 모의 데이터 — 지점 간 이동 시간표 (분, 정체 없음)</h2>
      <p>
        {day.driver.alias} · {day.driver.vehicle} · {day.driver.trade}. 시간대 정체 계수:{" "}
        {day.congestionByHour.map((c) => `${c.from}~${c.to}시 ×${c.factor}`).join(" · ")}.
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>구간</th>
              <th>분</th>
              <th>구간</th>
              <th>분</th>
              <th>구간</th>
              <th>분</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil(table.length / 3) }).map((_, r) => (
              <tr key={r}>
                {table.slice(r * 3, r * 3 + 3).map((t) => (
                  <Fragment key={`${t.from}-${t.to}`}>
                    <td>
                      {getNode(t.from).short} ↔ {getNode(t.to).short}
                    </td>
                    <td className="tabular-nums">{t.min}</td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>7. 시제품 동기화와 실서비스 차이</h2>
      <ul>
        <li>시제품: 한 화면 공유 상태 + 같은 브라우저 탭 간 BroadcastChannel. 서버·DB 없음, 외부 유료 API·지도 API 키 없음.</li>
        <li>실서비스: 차량 앱(Kotlin, AAOS) → HTTPS API(발송·재배치·기록) → 알림톡 발송 대행 → 고객 링크. 서버 → 차량은 서버 푸시. 심사위원 휴대폰처럼 다른 기기 간 시연에는 서버가 필요합니다.</li>
      </ul>
    </main>
  );
}
