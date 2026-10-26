// 서버와 브라우저가 주고받는 메시지 형식.

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

export interface LobbyPlayer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  connected: boolean;
}

export interface RoomInfo {
  code: string;
  players: LobbyPlayer[];
}

export type Ack<T> = (res: { ok: true; data: T } | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  createRoom: (name: string, ack: Ack<RoomInfo>) => void;
  joinRoom: (code: string, name: string, ack: Ack<RoomInfo>) => void;
}

export interface ServerToClientEvents {
  roomUpdated: (room: RoomInfo) => void;
}
