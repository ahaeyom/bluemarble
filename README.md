# 온라인 부루마블

3~5명이 각자 브라우저로 접속해 실시간으로 하는 부루마블입니다. 규칙은 `/mnt/project-files/plan/rules.md`에 정리되어 있습니다.

## 구조

- `shared/` 보드, 황금열쇠 카드, 서버와 화면이 주고받는 메시지 형식 (금액은 `shared/src/board.ts`에서 수정)
- `server/` 방 만들기와 실시간 통신 (Express, Socket.IO)
- `client/` 게임 화면 (Phaser, Vite)

## 실행

```bash
npm install
npm run dev      # 개발: http://localhost:5173
npm run build && npm start   # 배포와 같은 방식: http://localhost:3000
npm run test -w shared       # 규칙 엔진 자동 대전 3,000판
```

## 배포 (Render 무료 플랜)

1. 이 코드를 GitHub 저장소에 올립니다.
2. [render.com](https://render.com)에 GitHub 계정으로 가입하고 New → Blueprint에서 저장소를 고릅니다.
3. `render.yaml` 설정대로 서버가 만들어지고, `https://bluemarble-xxxx.onrender.com` 같은 주소가 생깁니다.

무료 플랜은 15분 동안 아무도 접속하지 않으면 서버가 잠들고, 다음 접속 때 깨어나는 데 1분 정도 걸립니다. 서버가 다시 시작되면 진행 중인 방은 사라집니다.
