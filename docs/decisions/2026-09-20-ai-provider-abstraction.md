# AI 공급자 교체 가능 구조

- 상태: 승인
- 날짜: 2026-09-20

## 맥락

MVP는 시간표 이미지와 자연어를 구조화된 일정 command로 해석해야 한다. Gemini Flash를 초기 공급자로 고려하지만, 무료 할당량, 비용, 개인정보, 모델 성능 또는 배포 환경에 따라 OpenAI·Ollama 등으로 바꿀 수 있어야 한다.

## 결정

AI 공급자 SDK를 Discord 처리기나 도메인 서비스에서 직접 호출하지 않는다. 아래와 같은 공급자 중립 계약을 둔다.

```text
ScheduleInterpreter
├─ interpretText(input, context) -> ProposedCommand
└─ interpretTimetableImage(image, context) -> ProposedTimetable
```

`ProposedCommand`, `ProposedTimetable`은 공급자와 무관한 JSON Schema로 검증한다. Gemini, Ollama 등은 이 계약을 구현하는 인프라 어댑터다.

초기 기본값은 환경 설정의 `AI_PROVIDER=gemini`, `AI_MODEL=gemini-3.5-flash-lite`로 둔다. 키도 공급자별 환경 변수에서만 읽는다. 모델 ID를 도메인 코드나 DB 일정 레코드에 하드코딩하지 않는다. 품질이 부족한 입력에 한해 다른 Flash-Lite 모델을 fallback으로 선택할 수 있다.

## 이유와 대안

- Gemini Flash는 이미지 이해와 구조화 출력을 하나의 API에서 제공해 MVP 시작점으로 적합하다.
- 직접 Gemini SDK를 각 기능에서 호출하면 공급자 교체 시 Discord·도메인 코드까지 수정해야 한다.
- 모든 공급자에 완전히 동일한 성능을 요구하지 않는다. 계약의 JSON Schema 유효성, 불확실성 처리, 확인 전 저장 금지는 동일하게 보장한다.

## 영향

- 구현 시 `ai/` 또는 동등한 인프라 계층에 `GeminiScheduleInterpreter`를 둔다.
- 테스트는 공급자 어댑터를 모의 구현으로 교체하여 도메인 흐름을 검증한다.
- 실제 Gemini 연결 테스트는 별도로 유지한다.
- 공급자를 새로 추가할 때는 해당 어댑터, 설정 검증, 계약 테스트, 비용·개인정보 문서만 추가한다.
