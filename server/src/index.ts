import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@bluemarble/shared';
import { createRoom, joinRoom, leaveAll, toInfo } from './rooms';

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);

app.get('/health', (_req, res) => {
  res.send('ok');
});

// 배포 시에는 빌드된 화면 파일을 같은 서버에서 내려준다.
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

io.on('connection', (socket) => {
  socket.on('createRoom', (name, ack) => {
    const room = createRoom(socket.id, name);
    socket.join(room.code);
    ack({ ok: true, data: toInfo(room) });
  });

  socket.on('joinRoom', (code, name, ack) => {
    try {
      const room = joinRoom(code, socket.id, name);
      socket.join(room.code);
      ack({ ok: true, data: toInfo(room) });
      io.to(room.code).emit('roomUpdated', toInfo(room));
    } catch (err) {
      ack({ ok: false, error: (err as Error).message });
    }
  });

  socket.on('disconnect', () => {
    for (const room of leaveAll(socket.id)) {
      io.to(room.code).emit('roomUpdated', toInfo(room));
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`부루마블 서버 실행 중: http://localhost:${PORT}`);
});
