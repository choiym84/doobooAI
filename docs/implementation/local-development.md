# 로컬 개발 환경

## 필요 도구

- Node.js 22 이상
- Docker Desktop 또는 Docker Engine
- Discord 봇 토큰
- Gemini API 키(초기 공급자를 Gemini로 쓸 때)

현재 MVP는 Discord 자연어 메시지와 첨부 이미지를 읽어야 하므로 `Message Content Intent`가 필요하다. 개인 테스트 서버에서는 Developer Portal의 Bot 설정에서 활성화하면 된다. 대규모 배포 시에는 Discord의 특수 Intent 검토·승인 정책을 확인한다.

봇은 `DISCORD_INPUT_CHANNEL_ID`로 지정한 서버 텍스트 채널의 사람 메시지만 처리한다. 이 채널은 사용자와 봇만 볼 수 있도록 설정하고, 봇에 채널 보기·메시지 보내기·메시지 기록 보기 권한을 부여한다. 사용자가 이미지를 올릴 계획이면 사용자에게 파일 첨부 권한도 필요하다. `.env`에 채널 ID를 입력한다.

## 시작 절차

```bash
cp .env.example .env
npm install
npm run db:up
npm run dev
```

`.env`에 Discord 토큰, 입력 채널 ID, Gemini API 키를 넣기 전에는 앱을 실행하지 않는다. `.env`는 Git에 저장하지 않는다.

## 로컬 DB

`npm run db:up`은 PostgreSQL 16을 기본 `localhost:5433`에서 시작한다. 다른 포트가 필요하면 실행 전에 `POSTGRES_PORT` 환경 변수를 설정한다. 데이터는 프로젝트의 `data/postgres`에 보존되며 Git에서 제외된다.

중단은 `npm run db:down`으로 한다. 이 명령은 컨테이너만 중지하며 데이터 디렉터리를 삭제하지 않는다.

## 서버 이관 원칙

서버에 올릴 때도 동일한 앱 이미지와 마이그레이션을 사용한다. 운영용 DB URL·Discord 토큰·AI 키는 배포 서비스의 비밀 환경 변수에 등록한다. `.env` 파일이나 로컬 DB 파일을 복사하는 방식으로 이관하지 않는다.
