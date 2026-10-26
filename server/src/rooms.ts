import { MAX_PLAYERS, type LobbyPlayer, type RoomInfo } from '@bluemarble/shared';

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
// 헷갈리는 글자(0, O, 1, I)는 뺐다.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface Room {
  code: string;
  players: LobbyPlayer[];
}

const rooms = new Map<string, Room>();

function newCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

export function toInfo(room: Room): RoomInfo {
  return { code: room.code, players: room.players };
}

export function createRoom(playerId: string, name: string): Room {
  const room: Room = { code: newCode(), players: [] };
  rooms.set(room.code, room);
  addPlayer(room, playerId, name);
  return room;
}

export function joinRoom(code: string, playerId: string, name: string): Room {
  const room = rooms.get(code.toUpperCase());
  if (!room) throw new Error('방을 찾을 수 없어요.');
  if (room.players.length >= MAX_PLAYERS) throw new Error(`방이 가득 찼어요. (최대 ${MAX_PLAYERS}명)`);
  addPlayer(room, playerId, name);
  return room;
}

function addPlayer(room: Room, id: string, name: string) {
  const used = new Set(room.players.map((p) => p.color));
  const color = PLAYER_COLORS.find((c) => !used.has(c))!;
  room.players.push({ id, name: name.trim().slice(0, 12) || '플레이어', color, isHost: room.players.length === 0, connected: true });
}

/** 플레이어가 나가면 방을 정리하고, 바뀐 방을 돌려준다. 방이 비면 지운다. */
export function leaveAll(playerId: string): Room[] {
  const changed: Room[] = [];
  for (const room of rooms.values()) {
    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx === -1) continue;
    const [left] = room.players.splice(idx, 1);
    if (room.players.length === 0) {
      rooms.delete(room.code);
      continue;
    }
    if (left.isHost) room.players[0].isHost = true;
    changed.push(room);
  }
  return changed;
}
