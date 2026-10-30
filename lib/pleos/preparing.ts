/**
 * Pleos 「준비 중(Coming Soon)」 SDK — 지금은 쓰지 않고 자리만 둔다.
 *
 * 원문(create-my-project): 「FusedLocation, TextToSpeech, SpeechToText, Vehicle Control SDK가 이 상태(준비 중, Coming Soon)」
 * 화면에서는 「SDK 공개 시 연동」 배지로 표시하고, 웹 시제품은 브라우저 Web Speech API로만 흉내 낸다.
 * 메서드 이름 중 문서에 없는 것은 [가정] 표시.
 */

/**
 * @status preparing — TextToSpeech SDK v3.3.1. 모드 HYBRID(기본)/SERVER/ON_DEVICE 는 원문.
 * speak() 이름은 [가정]. 웹 시제품 = window.speechSynthesis (ko-KR) + 자막.
 */
export interface TextToSpeech {
  initialize(mode: "HYBRID" | "SERVER" | "ON_DEVICE"): void;
  speak(text: string): void;
  release(): void;
}

/**
 * @status preparing — SpeechToText SDK v3.3.1. 원문 「음성 명령 기능을 제공하지 않습니다」(텍스트만 반환).
 * 그래서 명령은 Gleo Interface(actionCalls)로 받는다. 웹 시제품 = 선택적 webkitSpeechRecognition.
 */
export interface SpeechToText {
  initialize(mode: "HYBRID" | "SERVER" | "ON_DEVICE"): void;
  startListening(onText: (text: string) => void): void;
  stopListening(): void;
}

/**
 * @status preparing — FusedLocation SDK v1.1.3. 원문 API: getLastKnownLocation, registerFusedLocationCallback,
 * addProximityAlert / removeProximityAlert, isSupported. 권한 pleos.car.permission.FUSED_LOCATION.
 * 이 앱의 향후 용도: 고객 집 반경 진입 시 10분 전 확인을 보조(지금은 NaviHelper remainTime으로 대신).
 */
export interface FusedLocation {
  isSupported(): boolean;
  addProximityAlert(latitude: number, longitude: number, radiusM: number, onEnter: () => void): void;
  removeProximityAlert(latitude: number, longitude: number): void;
}

/**
 * @status preparing — Vehicle Control SDK (setDoorPosition·setDoorLock·setHvac* 등).
 * 이 앱은 차량을 제어하지 않는다 — 조회(Vehicle State)만 쓴다.
 */
export interface VehicleControl {
  readonly status: "preparing";
}

export const PREPARING_FEATURES = [
  { sdk: "TextToSpeech", use: "운전자 안내 음성", now: "브라우저 TTS(ko-KR) + 자막으로 모의" },
  { sdk: "SpeechToText", use: "(쓰지 않음 — 명령은 Gleo actionCalls)", now: "선택적 브라우저 음성 인식" },
  { sdk: "FusedLocation", use: "고객 집 반경 진입 알림(향후)", now: "NaviHelper remainTime·remainDistance로 대신" },
  { sdk: "Vehicle Control", use: "(쓰지 않음 — 조회만)", now: "없음" },
] as const;
