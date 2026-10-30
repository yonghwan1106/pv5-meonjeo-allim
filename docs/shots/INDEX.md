# 화면 캡처 목록 — 먼저 알림 [가칭] 웹 시제품

배포본 https://pv5-meonjeo-allim.vercel.app 에서 Python Playwright(headless, 1600×900, deviceScaleFactor 2 → 3200×1800 PNG)로 캡처. 재현: `python scripts/capture.py <주소> <폴더>`.
`/demo?s=시나리오&step=단계` 주소로 같은 장면을 다시 열 수 있다.

| 파일 | 주소 | 무엇을 보여 주나 |
|---|---|---|
| 00_home.png | `/` | 소개 — 문제 한 줄, 숫자 근거(도로교통법 제49조·해외 설문 61%·51%·PV5 전고 1,905mm·Pleos 「바로 사용 가능」), 데이터 흐름 그림, 기능 4개, 데모 보는 법 (전체 페이지) |
| 01_architecture.png | `/architecture` | 3단 데이터 흐름 SVG, 어댑터 요약표, 개인정보 처리(보이는 것·저장/미저장·보관 기간), 주행 중 제한 3단 표, 기준값, 이동 시간표 (전체 페이지) |
| 02_sdk.png | `/sdk` | SDK 이식 구조 — 웹 Mock ↔ Pleos 원문 API ↔ 권한 ↔ 상태(사용 가능·준비 중·AAOS·가정) 대응표 상단 |
| s1_1_delay_gleo_ask.png | `/demo?s=S1&step=1` | ① 지연: 정체로 TripInfo.eta 11:22(+22분) → 차량 화면 C2, Gleo 「김○○ 고객님께 약 20분 늦는다고 알릴까요?」 7초 카운트다운 |
| s1_2_delay_notice_sent.png | `/demo?s=S1&step=2` | 「그래」 → NOTIFY_DELAY success, 고객 휴대폰에 「약 20분 늦어요 · 11:20~11:30」 + 버튼 3개 (지도·위치 없음) |
| s1_3_touch_blocked.png | `/demo?s=S1&step=4` | 주행 중 화면 터치 → 「주행 중에는 음성으로 · 정차(P) 후 사용」, 도로교통법 제49조 ①11의2호 안내, 아래 API 호출 기록 |
| s2_1_postpone_replan.png | `/demo?s=S2&step=1` | ② 김○○ 「1시간 뒤로」 → 서버 replan, 차량 C4 「박○○ 고객님 먼저」 + requestRoute로 목적지 교체, 박○○에게 앞당김 문의 |
| s2_2_earlier_ok_ops.png | `/demo?s=S2&step=2` | 박○○ 「좋아요」 후 업체 관제 탭 — 바뀐 순서(취소선 약속 시각), 타임라인, 발송 문구·승인 방식 기록 |
| s2_3_read_next_job.png | `/demo?s=S2&step=4` | 「다음 어디야?」 → READ_NEXT_JOB Callback, 「다음은 박○○ 고객님, 그다음은 김○○ 고객님 12시」 자막 |
| s3_1_arrived_parked.png | `/demo?s=S3&step=2` | ③ onDestinationArrived + 기어 P → C6 주차 화면(터치 가능), 고객 「기사님이 도착했어요」 |
| s3_2_overrun_ask.png | `/demo?s=S3&step=4` | 카고 뒷문(REAR [가정]) 열림으로 작업 시작 기록 후 작업 초과 → C7 「다음 김○○ 고객님 지연 — 미리 알릴까요?」 [미리 알리기]·[괜찮아요] + Gleo |
| s3_3_departed_ops.png | `/demo?s=S3&step=6` | 뒷문 닫고 기어 D·차속 → 작업 완료·출발 자동 기록, 다음 목적지 김○○, 업체 관제 타임라인 |
| s4_1_prearrival_parking_card.png | `/demo?s=S4&step=1` | ④ 남은 3km(약 7분) → 서버가 「집에 계세요?」 발송, 차량 C5, 고객 질문 카드 |
| s4_2_change_to_parking_ask.png | `/demo?s=S4&step=3` | 고객이 방문 차량 등록 + B동 지하 2층 입구 선택 → 1,905mm+100 ≤ 2,100mm 판정, Gleo CHANGE_TO_PARKING 질문, 노선도에 입구 표시 |
| s4_3_arrived_underground.png | `/demo?s=S4&step=6` | 입구로 목적지 교체 후 도착 + 기어 P → 「기사님이 B동 지하 입구에 도착했어요」 |

모든 인물·업체·단지는 가상(김○○ 등). 로고·상표 이미지 없음.
