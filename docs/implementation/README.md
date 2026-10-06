# 구현 계약

도메인 command 스키마, DB 마이그레이션 규칙, Discord 상호작용 계약, 알림 운영 절차 등 코드가 따라야 하는 구체적 계약을 이 폴더에 둔다.

아직 구현 계약은 확정하지 않았다. 구현을 시작하는 첫 기능부터 관련 계약을 작성하고 테스트와 함께 갱신한다.

AI 해석 기능을 구현할 때는 먼저 [AI 공급자 교체 가능 구조](../decisions/2026-09-20-ai-provider-abstraction.md)를 따른 `ScheduleInterpreter` 계약과 JSON Schema를 이 폴더에 작성한다.

현재 Gemini 구현은 `src/ai/gemini-schedule-interpreter.ts`에 있다. 텍스트 입력은 `models.generateContent`와 JSON Schema를 사용하며, 일정 DB에 반영하기 전 애플리케이션 계층에서 결과를 다시 검증해야 한다.

Discord 시간표 이미지 입력의 포맷, 용량, 미리보기 계약은 [시간표 이미지 입력](discord-timetable-image-input.md)을 따른다.
