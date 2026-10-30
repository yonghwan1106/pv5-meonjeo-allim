# 먼저 알림 [가칭] — PV5 출장 기사용 차량 앱 웹 시제품

> 출장 기사가 운전 중 손 안 대도, PV5 내비 도착 예정 시각으로 고객에게 「늦어요」·「곧 도착」이 먼저 가고,
> 고객 답에 맞춰 오늘 방문 순서를 다시 짜는 차량용 앱.

- 공모: 제5회 기아 PBV 아이디어 공모전 · 솔루션(S/W) 부문 「산업별 특화 PV5 차량용 App 서비스」 (Pleos Connect SDK 활용)
- 사업 영역: 유틸리티 — 수리·설치·인테리어 등 출장 기반 서비스 (PV5 카고 롱)
- 응모: 팀 크리에이티브 넥서스
- 배포: https://pv5-meonjeo-allim.vercel.app

## 무엇

| 기능 | 차량 신호 → 앱 판단 → 누구에게 무엇을 |
|---|---|
| 1. 지연 예측 → 음성 한마디 → 서버가 대신 발송 | NaviHelper `onTripInfo`(TripInfo.eta)가 약속보다 10분 넘게 밀림 → Gleo 「김○○ 고객님께 약 20분 늦는다고 알릴까요?」 → 「그래」 → 서버가 고객에게 「11:20~11:30 사이 도착」 |
| 2. 고객 응답 → 오늘 순서 다시 짜기 | 고객이 「1시간 뒤로」 → 서버 `replan()` → 차량 `requestRoute(다음 고객)`로 목적지 교체 + 앞당겨진 고객에게 자동 문의. 내비 경유지는 최대 2개라 다음 1곳만 넘긴다 |
| 3. 도착·작업 시작·출발 자동 기록 | `onDestinationArrived` + 기어 P = 도착, 카고 뒷문(`DoorValue.REAR` [가정 매핑]) 열림 = 작업 시작, 기어 D + 차속 > 0 = 완료·출발. 작업이 길어지면 출발 전에 다음 고객 지연을 미리 묻는다(C7) |
| 4. 도착 10분 전 「집에 계세요?」 + 주차장 입구 | `onDestinationInfo` remainTime ≤ 10분(또는 3km) → 서버가 먼저 확인. 고객이 방문 차량 등록·지하주차장 입구를 알려 주면 Gleo `CHANGE_TO_PARKING` → `requestRoute(입구)`. PV5 전고 1,905mm라 2.1m 지하주차장 진입 가능 안내. **공동현관 번호는 받지 않는다** |

## 왜

- 도로교통법 제49조 제1항 제10호(운전 중 휴대용 전화 사용 금지)·제11의2호(운전 중 영상표시장치 조작 금지) → 운전 중 고객 연락 자체가 위법 소지.
- 해외 설문: 기사 도착 1시간 전 문자를 원함 61%, 방문 대기 동안 집에 갇힌 느낌 51% (cablefax, 해외 업계지 재인용·원 조사 미확인). 국내 지연·노쇼 통계는 미확인.
- 기존 예약·알림 서비스는 기사가 손으로 「출발/지연」을 눌러야 한다 — 차량 내비 ETA와 연결돼 있지 않다.
- 핵심 기능은 Pleos 문서상 「신청 없이 바로 사용 가능」한 Vehicle State + NaviHelper로 성립한다.

## 데모 보는 법

1. `/demo` — 한 화면 3분할: 왼쪽 시뮬레이터(Pleos Virtual Console 카드 이름 그대로) · 가운데 PV5 차량 화면(12.9인치 16:9 비율) · 오른쪽 동반 화면(고객 휴대폰 / 업체 관제 탭) · 아래 안내 자막과 「API 호출 기록」.
2. 시나리오 ①지연 발생 ②1시간 뒤로→재배치 ③도착·작업·출발 ④10분 전 확인·주차장 중 하나를 고르고 **▶ 재생**(배속 ×1·×10·×60) 또는 **다음 단계 ▶**.
3. 단계마다 자막이 「① 차량 신호 변화 → ② 앱 판단 → ③ 운전자 음성·화면 → ④ 동반 화면 알림」 4칸으로 설명한다. 음성은 브라우저 TTS(ko-KR) + 자막이라 소리 없이도 이해된다.
4. 직접 눌러 보기: 운전자 「그래/아니」, 정체 +20분, 고객 버튼. 주행 중 차량 화면을 누르면 「주행 중에는 음성으로 · 정차(P) 후 사용」으로 막힌다.
5. 두 탭 시연: 같은 브라우저에서 `/car` + `/companion`(또는 `/sim`, `/c/k4m9`)을 나란히 열면 BroadcastChannel로 실시간 동기화된다.
6. 주소로 바로 가기: `/demo?s=S3&step=4` (시나리오·단계 지정), `?mute=1` (음성 끔).

| 경로 | 화면 |
|---|---|
| `/` | 소개 — 문제·숫자 근거·데모 보는 법 |
| `/demo` | 3분할 시연 판 |
| `/car` | 차량 화면 단독 (전시·녹화용) |
| `/companion` | 동반 화면 단독 (고객 휴대폰 · 업체 관제) |
| `/c/[token]` | 고객 1회용 링크 (예 `/c/k4m9` = 김○○) — 지도·위치 없음, 도착 예정 범위만 |
| `/ops` | 업체 관제 — 타임라인·발송 문구 기록·응답 |
| `/sim` | 시뮬레이터 단독 (발표자 조작용) |
| `/sdk` | SDK 이식 구조 — 대응표·권한·Gleo App Schema·상태 머신·Kotlin 예시 |
| `/architecture` | 데이터 흐름·개인정보 처리·주행 중 제한 설계·이동 시간표 |

## 구조

```
lib/pleos/          Pleos SDK 모양 인터페이스 (문서 원문 이름)
  vehicle.ts          Vehicle·Door·EvBattery·Seat·Odometer·CarInfo (+ @status preparing set*)
  carProperty.ts      AAOS CarPropertyManager · GEAR_SELECTION · PERF_VEHICLE_SPEED · CarUxRestrictions
  naviHelper.ts       NaviHelper · RouteInfo · TripInfo · DestinationInfo · NaviHelperEventListener · MAX_WAYPOINTS=2
  gleo.ts             App Schema · GleoAction · Callback(success/asking/fail) · 7초 · APP_ACTION_RESPONSE
  preparing.ts        TextToSpeech·SpeechToText·FusedLocation·Vehicle Control (@status preparing)
  mock/               모의 구현 ← 실차에서 이 폴더만 SDK로 교체
lib/logic/          판단 순수 함수 (Kotlin으로 그대로 옮길 부분) — delay·replan·preArrival·overrun·driveMode·jobState·voice·travel·customerView
lib/engine/         carApp.ts (차량 앱 — 인터페이스만 사용) · server.ts (모의 서버) · engine.ts (시나리오·시간) · types.ts
lib/sync/           EngineProvider — 탭 간 BroadcastChannel 동기화
data/               day.json (가상 기사 1·고객 6·이동 시간표·정체 계수) · scenarios/*.json (시간축 이벤트) · gleo-app-schema.json
components/         CarScreen · Simulator · CustomerView · OpsView · ApiLog · CaptionBar · RouteMap(자체 SVG 노선도)
tests/              vitest — 판단 함수 경계값 + 시나리오 끝까지 재생
scripts/            check_console.py (콘솔 오류·시나리오 재생 검사) · capture.py (화면 캡처)
docs/               PLEOS_PORTING.md · shots/
```

- 스택: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4. 서버 비밀값·외부 유료 API·지도 API 키 없음(전부 클라이언트 시뮬레이션).
- 실행: `npm install` → `npm run dev` / `npm test` / `npm run build`.

## Pleos 이식

차량 앱 로직(`lib/engine/carApp.ts`)은 `lib/pleos/*.ts` 인터페이스만 쓴다. 실차 이식은 `lib/pleos/mock/*`를 Pleos SDK 호출로 바꾸고, `lib/logic/*`를 Kotlin으로 옮기는 일이다. 자세한 대응표·권한·Kotlin 예시는 [docs/PLEOS_PORTING.md](docs/PLEOS_PORTING.md)와 `/sdk`.

- 지금 바로 사용 가능: Vehicle State(Door·EvBattery·Seat·Odometer·CarInfo 조회), NaviHelper
- AAOS 표준: 기어·차속(CarPropertyManager), CarUxRestrictions
- 「준비 중」 → 화면에 「SDK 공개 시 연동」 배지: TextToSpeech·SpeechToText·FusedLocation·Vehicle Control
- 문서에 없는 API(카메라·V2L 등)는 만들지 않았다.

## 동기화와 실서비스의 차이

시제품은 **서버 저장이 없다.** 한 화면 안에서는 공유 상태, 같은 브라우저의 탭끼리는 BroadcastChannel로 맞춘다(한 탭이 엔진을 돌리고, 닫히면 다른 탭이 이어받음).
**실서비스는 서버 푸시**다: 차량 앱(Kotlin) → HTTPS API(발송 대행·재배치·사건 기록) → 알림톡 → 고객 링크, 서버 → 차량은 푸시. 그래서 서로 다른 기기(심사위원 휴대폰) 간 실시간 시연은 이 시제품만으로는 안 된다.

## 한계 · 가정

- **[가정] PV5 카고 뒷문 = `DoorValue.REAR` 매핑** — 실차에서 `checkDoorPositionCapabilities`로 확인 필요. 미지원이면 「작업 시작」 버튼으로 대체.
- **[가정] Gleo proactive suggestion(앱이 먼저 묻기)** — 서드파티 공개 여부 문서 미확인. 대체안 = 앱 알림 카드 + 비프 + 호출어. 운전자 답 대기 7초는 Gleo 7초 제한을 준용한 설계값.
- TripInfo·DestinationInfo 필드 단위(epoch ms·m·초), 일부 람다·인자 순서는 문서 미확인 [가정]. 「Navigation 앱 구현에 따라 이벤트가 달라질 수 있음」(원문).
- PV5 앱 마켓에서 지금 바로 배포 가능한지는 단정하지 않는다(2026-09 보도의 이용 차종 = 그랜저·아반떼 「등」).
- 이동 시간·정체 계수·ETA는 모의 시간표 계산값. 실제 지도·교통 데이터 아님. 시나리오의 「남은 3km」·「목적지 도착」 버튼은 시간을 건너뛴다.
- 개인정보 보관 기간 90일·처리위탁 구조·위치기반서비스 신고 여부는 [가정/확인 필요].
- 인물·업체·단지·주소·전화번호는 모두 가상. 기아·PV5·Pleos·Gleo는 각 권리자의 상표이며 로고·상표 이미지를 쓰지 않았다. 공식 제품이 아니다.
