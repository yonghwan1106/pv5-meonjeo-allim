/** 시나리오 = 시간축 이벤트 JSON (data/scenarios/*.json) */
import s1 from "../../data/scenarios/s1-delay.json";
import s2 from "../../data/scenarios/s2-reschedule.json";
import s3 from "../../data/scenarios/s3-arrival.json";
import s4 from "../../data/scenarios/s4-prearrival.json";
import free from "../../data/scenarios/free.json";
import type { Scenario } from "./types";

export const SCENARIOS: Scenario[] = [s1, s2, s3, s4, free] as unknown as Scenario[];

export function getScenario(id: string): Scenario {
  const sc = SCENARIOS.find((s) => s.id === id);
  if (!sc) throw new Error(`시나리오 없음: ${id}`);
  return sc;
}
