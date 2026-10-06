# 날씨 조회 공급자

- 상태: 승인
- 날짜: 2026-09-20

## 결정

날씨 조회는 AI가 사실을 생성하지 않고, Gemini가 추출한 `QUERY_WEATHER` 의도와 위치를 애플리케이션이 Open-Meteo API에 전달한다. 결과를 받아 Discord에 표시한다.

Open-Meteo는 현재 단계의 비상업적 사용에서 API 키 없이 위치 검색과 현재 날씨 조회를 시작할 수 있다. 상업 운영이나 호출량 증가 시 사용 조건과 요금, 출처 표기를 재검토한다.

## 흐름

```text
Discord 질문
→ Gemini: intent=QUERY_WEATHER, location 추출
→ Open-Meteo Geocoding: 위치명 → 위도·경도
→ Open-Meteo Forecast: 현재 조건 조회
→ Discord 응답
```

날씨 응답에는 Open-Meteo 출처를 표시한다. 위치가 없는 질문은 임의의 지역으로 추정하지 않고 지역을 다시 묻는다.
