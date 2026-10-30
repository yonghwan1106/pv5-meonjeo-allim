/** 이 앱의 Gleo App Schema (data/gleo-app-schema.json) — actionCalls 3개 */
import type { AppSchema } from "./gleo";
import raw from "../../data/gleo-app-schema.json";

export const APP_SCHEMA: AppSchema = raw as unknown as AppSchema;
