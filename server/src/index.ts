import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { GameError, type ClientToServerEvents, type HandshakeAuth, type ServerToClientEvents } from '@bluemarble/shared';
import { createRoom, findRoom, roomOf, type Room, type RoomListener } from './rooms';

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  // 휴대폰이 잠깐 잠들어도 바로 끊기지 않게 여유를 둔다.
  pingTimeout: 30000,
});

app.get('/health', (_req, res) => {
  res.send('ok');
});

// 배포 시에는 빌드된 화면 파일을 같은 서버에서 내려준다.
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

const listener: RoomListener = {
  roomUpdated: (room) => io.to(room.code).emit('roomUpdated', room.info()),
  gameUpdated: (room, update) => io.to(room.code).emit('gameUpdate', update),
};

const errorMessage = (err: unknown) =>
  err instanceof GameError || err instanceof Error ? err.message : '알 수 없는 오류가 났어요.';

io.on('connection', (socket) => {
  const { playerId } = (socket.handshake.auth ?? {}) as Partial<HandshakeAuth>;
  if (typeof playerId !== 'string' || playerId.length < 8 || playerId.length > 64) {
    socket.disconnect(true);
    return;
  }

  let room: Room | undefined = roomOf(playerId);

  // 새로고침이나 재접속이면 하던 방으로 돌려보낸다.
  if (room) {
    socket.join(room.code);
    room.setConnected(playerId, true);
    socket.emit('roomUpdated', room.info());
    if (room.game) socket.emit('gameUpdate', room.snapshot());
  }

  function enter(target: Room, name: string) {
    if (room && room !== target) {
      room.leave(playerId!);
      socket.leave(room.code);
    }
    target.join(playerId!, name);
    room = target;
    socket.join(target.code);
  }

  socket.on('createRoom', (name, ack) => {
    try {
      enter(createRoom(listener), name);
      ack({ ok: true, data: room!.info() });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on('joinRoom', (code, name, ack) => {
    try {
      const target = findRoom(String(code));
      if (!target) throw new Error('방을 찾을 수 없어요.');
      enter(target, name);
      ack({ ok: true, data: target.info() });
      if (target.game) socket.emit('gameUpdate', target.snapshot());
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on('leaveRoom', () => {
    if (!room) return;
    room.leave(playerId);
    socket.leave(room.code);
    room = undefined;
  });

  socket.on('startGame', (ack) => {
    try {
      if (!room) throw new Error('방에 들어가 있지 않아요.');
      room.start(playerId);
      ack({ ok: true, data: null });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on('action', (action, ack) => {
    try {
      if (!room) throw new Error('방에 들어가 있지 않아요.');
      room.act(playerId, action);
      ack({ ok: true, data: null });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on('disconnect', async () => {
    if (!room) return;
    // 같은 플레이어가 다른 탭으로 아직 접속해 있으면 끊긴 것으로 보지 않는다.
    const sockets = await io.in(room.code).fetchSockets();
    if (sockets.some((s) => (s.handshake.auth as HandshakeAuth).playerId === playerId)) return;
    room.leave(playerId);
  });
});

httpServer.listen(PORT, () => {
  console.log(`부루마블 서버 실행 중: http://localhost:${PORT}`);
});
