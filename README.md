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
```
