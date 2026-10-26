import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // 개발 중에는 실시간 통신을 게임 서버(3000)로 넘긴다.
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } },
  },
});
