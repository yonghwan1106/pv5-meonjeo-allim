# Pleos Connect SDK 이식 안내 — 웹 모의 어댑터 → 실차 앱

이 문서는 웹 시제품의 어느 부분을 무엇으로 바꾸면 PV5(AAOS·Pleos Connect)에서 같은 흐름이 도는지 정리한다.
근거: document.pleos.ai 열람 사본(2026-10-30) — Vehicle SDK v2.3.2, NaviHelper v3.0.5, Gleo Interface 가이드, Vehicle App FAQ, create-my-project.

## 1. 교체 지점

```
┌──────────────────────────┐   인터페이스만 사용    ┌─────────────────────────────┐
│ lib/engine/carApp.ts     │ ─────────────────────▶ │ lib/pleos/*.ts (원문 이름)   │
│ (차량 앱 흐름)            │                        └──────────────┬──────────────┘
│ lib/logic/*.ts (순수 함수)│                                       │ 구현
└──────────────────────────┘          웹:  lib/pleos/mock/*  ◀──────┤
                                      실차: Pleos SDK + AAOS Car API ◀┘  ← 여기만 바꾼다
```

1. `lib/pleos/mock/*` → Pleos SDK(Kotlin) 호출로 교체.
2. `lib/logic/*.ts`(delay·replan·preArrival·overrun·driveMode·jobState) → 같은 이름의 Kotlin 객체로 옮김. vitest 경계값 테스트를 JUnit으로 그대로 옮긴다.
3. `lib/engine/server.ts`(모의 서버) → 실제 백엔드 API(발송 대행·재배치·기록) + 서버 푸시.
4. 브라우저 TTS·음성 인식 → Pleos TextToSpeech(「준비 중」) / Gleo Interface.

## 2. 대응표 (웹 Mock ↔ Pleos SDK ↔ 권한)

| 기능 | 웹 시제품 (모의) | Pleos SDK 원문 API | 권한 | 상태 |
|---|---|---|---|---|
| 기어 P/R/N/D | `MockCarPropertyManager` · GEAR_SELECTION | `CarPropertyManager.registerCallback(GEAR_SELECTION)` | AAOS 표준 (이식 시 확인) | AAOS 표준 |
| 차속 | `MockCarPropertyManager` · PERF_VEHICLE_SPEED | `CarPropertyManager.registerCallback(PERF_VEHICLE_SPEED)` (Pleos FAQ 원문) | AAOS 표준 | AAOS 표준 |
| 카고 뒷문 = 작업 시작 | `door.registerDoorPosition(REAR)` | `Vehicle.getDoor().checkDoorPositionCapabilities / getCurrentDoorPosition / registerDoorPosition` | `pleos.car.permission.CAR_DOORS` | 사용 가능 · **REAR 매핑 [가정]** |
| 문 잠금 | `door.registerDoorLockState` | `Door.getDoorLockState / registerDoorLockState` | `CAR_DOORS` | 사용 가능 |
| 배터리 SOC | `evBattery.registerEvBatteryStateOfCharge` | `EvBattery.getEvBatteryStateOfCharge / registerEvBatteryStateOfCharge` | `CAR_ENERGY` | 사용 가능 |
| 운전석 점유 | `seat.registerSeatOccupancy(ROW_1_LEFT)` | `Seat.getCurrentSeatOccupancy / registerSeatOccupancy` | `CAR_SEATS` | 사용 가능 |
| 이동 거리 | `getOdometer().getCurrentDistanceDriven` | `Odometer.getCurrentDistanceDriven` | `CAR_DRIVE` | 사용 가능 |
| 차종(전고) 판별 | `getCarInfo().getVINInfo` | `CarInfo.getVINInfo` | `CAR_INFO` | 사용 가능 · 매칭 방식 [가정] |
| 목적지 설정 | `MockNaviHelper.requestRoute(RouteInfo)` | `NaviHelper.requestRoute(RouteInfo(latitude, longitude, displayLongitude, displayLatitude, poiName, poiId, poiSubId, address))` | NaviHelper 권한 문서 | 사용 가능 |
| 탐색 완료 | `onRouteStarted / onRoutingCompleted` | `NaviHelperEventListener.onRouteStarted / onRoutingCompleted / onError` | 〃 | 사용 가능 |
| 도착 예정 | `onTripInfo` | `onTripInfo(TripInfo.eta · distance · energyConsumption · estimatedSocAtDest)` | 〃 | 사용 가능 |
| 남은 시간·거리 | `onDestinationInfo` | `getDestinationInfo() → onDestinationInfo(remainDistance · remainTime · tollFare)` | 〃 | 사용 가능 |
| 도착 | `onDestinationArrived` | `onDestinationArrived()` | 〃 | 사용 가능 |
| 경유지 ≤ 2 | `addWaypoint`·`requestRouteWithWaypoints` — 3개 이상 거부 | `addWaypoint(WaypointIndex.FIRST/SECOND)` / `requestRouteWithWaypoints` | 〃 | 사용 가능 |
| 음성 명령 3개 | `MockGleo` + `data/gleo-app-schema.json` | Gleo Interface App Schema(actionCalls ≤ 3) → Intent(action=함수명, `ACTION_PARAM`) → `APP_ACTION_RESPONSE` 브로드캐스트 | App Market 등록 | 사용 가능 |
| 앱이 먼저 묻기 | `MockGleo.requestProactiveSuggestion` | proactive suggestion — 서드파티 공개 여부 문서 미확인 | — | **[가정]** (대체: 알림 카드 + 비프 + 호출어) |
| 주행 중 터치 제한 | `deriveDriveMode` + 오버레이 | `CarUxRestrictionsManager.registerListener` + Distraction Optimization 선언 | AAOS | AAOS 표준 |
| 안내 음성 | 브라우저 `speechSynthesis`(ko-KR) + 자막 | TextToSpeech SDK v3.3.1 | Playground 앱 등록 | **준비 중** |
| 반경 진입 | (remainTime으로 대신) | `FusedLocation.addProximityAlert` | `pleos.car.permission.FUSED_LOCATION` | **준비 중** |
| 문·공조 제어 | 쓰지 않음 | Vehicle Control SDK(`setDoorPosition` …) | `CONTROL_CAR_*` | **준비 중** |

Manifest 최소 권한(조회만): `CAR_DOORS`, `CAR_ENERGY`, `CAR_SEATS`, `CAR_DRIVE`, `CAR_INFO` (+ NaviHelper 권한, AAOS 기어·속도 권한). 제어 권한(`CONTROL_CAR_*`)은 선언하지 않는다.
카메라·V2L처럼 Connect 앱 SDK 문서에 없는 API는 쓰지 않는다.

## 3. Gleo App Schema

`data/gleo-app-schema.json` — `NOTIFY_DELAY`(다음 고객에게 지연 알림), `READ_NEXT_JOB`(다음·그다음 방문 읽기), `CHANGE_TO_PARKING`(고객이 알려 준 주차장 입구로 목적지 교체).
규칙(app-capability 원문): actionCalls 최대 3개, 이름은 대문자_밑줄, description은 영어, parameter type은 string·number·boolean·array. `validateAppSchema()`와 테스트로 검사한다.
Callback: `functionName / status(success|asking|fail) / message(영어 문장) / mode(voice|beep|silent) / data`, 7초 안에 회신(「Gleo는 timeout을 위해 7초 후 Action을 취소」).

## 4. Kotlin 예시 (API 이름 = 원문, 일부 인자 순서 [가정])

### 4-1. NaviHelper — 목적지·ETA·10분 전 확인

```kotlin
class VisitNavigator(private val naviHelper: NaviHelper, private val api: MeonjeoApi) {
    private val listener = object : NaviHelperEventListener {
        override fun onTripInfo(tripInfo: TripInfo) {
            val etaMin = tripInfo.eta.toMinuteOfDay()                 // [가정] epoch ms
            val job = plan.job(currentJobId) ?: return
            val delay = DelayRules.predictDelayMin(etaMin, job.promisedMin)
            if (DelayRules.shouldAskDelay(delay, notified[job.id], declined[job.id], rules)) gleo.askNotifyDelay(job, delay)
            api.reportEta(job.id, etaMin)                               // 위치 X, ETA(분)만
        }
        override fun onDestinationInfo(info: DestinationInfo) {
            if (PreArrival.shouldCheck(info.remainTime, info.remainDistance, sent[currentJobId] == true, rules)) {
                sent[currentJobId] = true
                api.requestPreArrivalCheck(currentJobId, info.remainTime / 60)
            }
        }
        override fun onDestinationArrived() { arrivedPending = currentJobId }   // 기어 P까지 기다림
    }
    fun start() { naviHelper.initialize(); naviHelper.addListener(listener) }
    /** 경유지 최대 2개 → 하루 일정은 앱·서버가 들고, 내비엔 다음 1곳만 */
    fun routeTo(job: Job) = naviHelper.requestRoute(
        RouteInfo(latitude = job.lat, longitude = job.lng, displayLongitude = null, displayLatitude = null,
                  poiName = job.placeName, poiId = job.poiId, poiSubId = "0", address = job.address))
}
```

### 4-2. 기어·차속(AAOS) + 카고 뒷문(Vehicle SDK) — 자동 기록

```kotlin
private val motion = object : CarPropertyManager.CarPropertyEventCallback {
    override fun onChangeEvent(v: CarPropertyValue<*>) {
        when (v.propertyId) {
            VehiclePropertyIds.GEAR_SELECTION     -> gear = v.value as Int
            VehiclePropertyIds.PERF_VEHICLE_SPEED -> speedMs = v.value as Float
        }
        if (arrivedPending != null && gear == VehicleGear.GEAR_PARK) api.reportArrival(arrivedPending!!)
        if (DriveMode.derive(gear, speedMs * 3.6f) == DriveMode.DRIVING && onSite != null) api.reportDeparture(onSite!!)
    }
    override fun onErrorEvent(propertyId: Int, areaId: Int) {}
}
props.registerCallback(motion, VehiclePropertyIds.GEAR_SELECTION, 0f)
props.registerCallback(motion, VehiclePropertyIds.PERF_VEHICLE_SPEED, 1f)

val door = vehicle.getDoor()
door.checkDoorPositionCapabilities(
    onComplete = { cap -> if (DoorValue.REAR in cap.areas) door.registerDoorPosition(DoorValue.REAR) { _, v -> if (v == 1) api.reportWorkStarted(onSite!!) } },
    onFailed = { err -> showManualStartButton() }   // [가정] REAR 미지원 → 기사 확인 버튼
)
```

### 4-3. Gleo Interface — 함수 받기·회신

```kotlin
class GleoActionReceiver : BroadcastReceiver() {                // component = "service"
    override fun onReceive(context: Context, intent: Intent) {
        val param = JSONObject(intent.getStringExtra("ACTION_PARAM") ?: "{}")
        when (intent.action) {
            "NOTIFY_DELAY" -> respond(context, "NOTIFY_DELAY",
                if (api.sendDelayNotice(pendingAsk.jobId, param.optInt("delayMinutes"))) "success" else "fail",
                "Sent a delay notice to the next customer.")
            "READ_NEXT_JOB" -> respond(context, "READ_NEXT_JOB", "success", "Next visit is ${plan.next().alias} around ${plan.nextEta()}.")
            "CHANGE_TO_PARKING" -> parkingOffer?.let { navigator.routeTo(it); respond(context, "CHANGE_TO_PARKING", "success", "Changed the destination to ${it.name}.") }
                ?: respond(context, "CHANGE_TO_PARKING", "fail", "No parking entrance has been shared by the customer.")
        }
    }
    private fun respond(c: Context, fn: String, status: String, message: String) =
        c.sendBroadcast(Intent("ai.pleos.playground.intent.action.APP_ACTION_RESPONSE").apply {
            putExtra("packageName", c.packageName)
            putExtra("response", JSONObject().put("functionName", fn).put("status", status).put("message", message).put("mode", "voice").toString())
        })
}
```

### 4-4. 주행 중 제한

```kotlin
uxManager.registerListener { r ->
    val driving = r.isRequiresDistractionOptimization
    appScreen.setTouchEnabled(!driving && gear == VehicleGear.GEAR_PARK)   // 국내법 제49조 ①11의2호 → P에서만 터치
    appScreen.setDensity(if (driving) Density.TWO_BIG_LINES else Density.FULL)
}
```

## 5. 실차 확인 목록 (1차 통과 시 42dot 개발 Q&A·실물 IVI로)

1. PV5 카고 뒷문·슬라이딩 도어가 `DoorValue.REAR`·`ROW_2_RIGHT`로 오는지 (`checkDoorPositionCapabilities`).
2. `onTripInfo` 갱신 주기, 경로 안내 중이 아닐 때 이벤트 전달 여부 (「Navigation 앱의 구현에 따라 달라질 수 있음」).
3. Gleo proactive suggestion의 서드파티 허용 여부 — 안 되면 알림 카드 + 비프 + 호출어 「먼저 알림」.
4. TripInfo.eta·remainTime·remainDistance의 단위·형식.
5. PV5 앱 마켓 배포 가능 시점 (단정하지 않음).
