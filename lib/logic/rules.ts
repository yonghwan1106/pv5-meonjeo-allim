/** 업체가 바꿀 수 있는 판단 기준값 (기본값). autoSend=false — 기본은 「음성 한마디 승인」(오발송 방지). */
export interface Rules {
  /** 약속보다 이만큼(분) 늦을 것 같으면 묻는다 */
  delayThresholdMin: number;
  /** 이미 알린 뒤 이만큼 더 밀리면 다시 묻는다 */
  renotifyStepMin: number;
  /** 남은 시간이 이 분 이하이면 「집에 계세요?」 확인 */
  preArrivalMin: number;
  /** 또는 남은 거리가 이 미터 이하이면 확인 */
  preArrivalDistM: number;
  /** 다음 고객에게 이만큼 이상 일찍 갈 수 있으면 앞당김을 묻는다 */
  earlierOfferMin: number;
  /** 작업이 예정 시간을 넘기면 최소 이만큼 더 걸린다고 본다 */
  minRemainWorkMin: number;
  autoSend: boolean;
}

export const DEFAULT_RULES: Rules = {
  delayThresholdMin: 10,
  renotifyStepMin: 10,
  preArrivalMin: 10,
  preArrivalDistM: 3000,
  earlierOfferMin: 15,
  minRemainWorkMin: 10,
  autoSend: false,
};
