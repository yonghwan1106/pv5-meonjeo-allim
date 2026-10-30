/**
 * Kotlin 이식 예시 — 웹 어댑터(lib/engine/carApp.ts)와 같은 흐름을 Pleos SDK로 옮긴 모습.
 * API 이름은 Pleos 문서 원문, 람다·인자 순서 일부는 문서 미확인 [가정].
 */

export const KOTLIN_NAVI = `// 1) 다음 고객으로 목적지 설정 + 도착 예정 시각 구독 (NaviHelper — 신청 없이 사용 가능)
class VisitNavigator(private val naviHelper: NaviHelper, private val api: MeonjeoApi) {

    private val listener = object : NaviHelperEventListener {
        override fun onRoutingCompleted() { api.reportRouteReady(currentJobId) }

        override fun onTripInfo(tripInfo: TripInfo) {
            val etaMin = tripInfo.eta.toMinuteOfDay()               // [가정] epoch ms
            val job = plan.job(currentJobId) ?: return
            val delay = DelayRules.predictDelayMin(etaMin, job.promisedMin)
            if (DelayRules.shouldAskDelay(delay, notified[job.id], declined[job.id], rules)) {
                gleo.askNotifyDelay(job, delay)                       // 음성 한마디 승인
            }
            api.reportEta(job.id, etaMin)                             // 위치 X, ETA(분)만 서버로
        }

        override fun onDestinationInfo(info: DestinationInfo) {
            if (PreArrival.shouldCheck(info.remainTime, info.remainDistance, sent[currentJobId] == true, rules)) {
                sent[currentJobId] = true
                api.requestPreArrivalCheck(currentJobId, info.remainTime / 60)   // 서버가 「집에 계세요?」 발송
            }
        }

        override fun onDestinationArrived() { arrivedPending = currentJobId }  // 기어 P까지 기다림
    }

    fun start() {
        naviHelper.initialize()
        naviHelper.addListener(listener)
    }

    /** 경유지 최대 2개 → 하루 일정은 앱·서버가 들고, 내비엔 다음 1곳만 */
    fun routeTo(job: Job) {
        naviHelper.requestRoute(
            RouteInfo(
                latitude = job.lat, longitude = job.lng,
                displayLongitude = null, displayLatitude = null,
                poiName = job.placeName, poiId = job.poiId, poiSubId = "0",
                address = job.address
            )
        )   // 반환 ≠ 탐색 완료 → onRoutingCompleted 로 확인 (원문)
    }

    fun release() { naviHelper.removeListener(listener); naviHelper.release() }
}`;

export const KOTLIN_VEHICLE = `// 2) 기어·차속(AAOS 표준) + 카고 뒷문(Vehicle SDK)으로 도착·작업 시작·출발 자동 기록
class WorkRecorder(car: Car, private val vehicle: Vehicle, private val api: MeonjeoApi) {

    private val props = car.getCarManager(Car.PROPERTY_SERVICE) as CarPropertyManager

    private val motion = object : CarPropertyManager.CarPropertyEventCallback {
        override fun onChangeEvent(v: CarPropertyValue<*>) {
            when (v.propertyId) {
                VehiclePropertyIds.GEAR_SELECTION     -> gear = v.value as Int
                VehiclePropertyIds.PERF_VEHICLE_SPEED -> speedMs = v.value as Float
            }
            val mode = DriveMode.derive(gear, speedMs * 3.6f)
            if (arrivedPending != null && gear == VehicleGear.GEAR_PARK) api.reportArrival(arrivedPending!!)
            if (mode == DriveMode.DRIVING && onSite != null) api.reportDeparture(onSite!!)   // 작업 완료·출발
        }
        override fun onErrorEvent(propertyId: Int, areaId: Int) {}
    }

    private val rearDoor: (DoorValue, Int) -> Unit = { area, value ->
        // [가정] PV5 카고 뒷문이 DoorValue.REAR 로 오는지 실차 확인 필요 (checkDoorPositionCapabilities)
        if (area == DoorValue.REAR && value == 1 && onSiteArrived != null) api.reportWorkStarted(onSiteArrived!!)
    }

    fun start() {
        props.registerCallback(motion, VehiclePropertyIds.GEAR_SELECTION, 0f)
        props.registerCallback(motion, VehiclePropertyIds.PERF_VEHICLE_SPEED, 1f)
        vehicle.initialize()
        val door = vehicle.getDoor()
        door.checkDoorPositionCapabilities(
            onComplete = { cap -> if (DoorValue.REAR in cap.areas) door.registerDoorPosition(DoorValue.REAR, rearDoor) },
            onFailed = { err -> Log.w(TAG, "REAR 미지원 → 기사 확인 버튼으로 대체: $err") }
        )
    }
}`;

export const KOTLIN_GLEO = `// 3) Gleo Interface — App Schema 함수(NOTIFY_DELAY · READ_NEXT_JOB · CHANGE_TO_PARKING) 받기·회신
class GleoActionReceiver : BroadcastReceiver() {          // component = "service" → sendBroadcast
    override fun onReceive(context: Context, intent: Intent) {
        val param = JSONObject(intent.getStringExtra("ACTION_PARAM") ?: "{}")
        when (intent.action) {
            "NOTIFY_DELAY" -> {
                val ok = api.sendDelayNotice(pendingAsk.jobId, param.optInt("delayMinutes"))  // 발송은 서버가
                respond(context, "NOTIFY_DELAY", if (ok) "success" else "fail",
                    if (ok) "Sent a delay notice to the next customer." else "A timeout occurred while processing the request.")
            }
            "READ_NEXT_JOB" -> respond(context, "READ_NEXT_JOB", "success", "Next visit is \${plan.next().alias} around \${plan.nextEta()}.")
            "CHANGE_TO_PARKING" -> {
                val entrance = parkingOffer ?: return respond(context, "CHANGE_TO_PARKING", "fail", "No parking entrance has been shared by the customer.")
                navigator.routeTo(entrance)                     // NaviHelper.requestRoute
                respond(context, "CHANGE_TO_PARKING", "success", "Changed the destination to \${entrance.name}.")
            }
        }
    }

    // 7초 안에 회신 (원문: 「Gleo는 timeout을 위해 7초 후 Action을 취소」)
    private fun respond(context: Context, fn: String, status: String, message: String) {
        val json = JSONObject().put("functionName", fn).put("status", status).put("message", message).put("mode", "voice")
        context.sendBroadcast(Intent("ai.pleos.playground.intent.action.APP_ACTION_RESPONSE").apply {
            putExtra("packageName", context.packageName)
            putExtra("response", json.toString())
        })
    }
}`;

export const KOTLIN_UX = `// 4) 주행 중 제한 — AAOS CarUxRestrictions + 국내법(제49조 ①11의2호)이 더 엄격 → 기어 P에서만 터치
uxManager.registerListener { restrictions ->
    val driving = restrictions.isRequiresDistractionOptimization
    appScreen.setTouchEnabled(!driving && gear == VehicleGear.GEAR_PARK)
    appScreen.setDensity(if (driving) Density.TWO_BIG_LINES else Density.FULL)   // 1~2초 안에 읽히게
}`;
