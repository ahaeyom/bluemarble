// 서버와 브라우저가 주고받는 메시지 형식.

import type { GameAction, GameEvent, GameState } from './game';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
/** 한 번 고르는 데 주는 시간 */
export const TURN_SECONDS = 60;
/** 접속이 끊긴 플레이어의 차례를 자동으로 넘기기까지 기다리는 시간 */
export const DISCONNECTED_TURN_SECONDS = 3;

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
  started: boolean;
}

export interface GameUpdate {
  state: GameState;
  events: GameEvent[];
  /** 지금 차례가 자동으로 넘어가기까지 남은 시간 (ms) */
  timeLeftMs: number | null;
}

export type Ack<T> = (res: { ok: true; data: T } | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  createRoom: (name: string, ack: Ack<RoomInfo>) => void;
  joinRoom: (code: string, name: string, ack: Ack<RoomInfo>) => void;
  leaveRoom: () => void;
  startGame: (ack: Ack<null>) => void;
  action: (action: GameAction, ack: Ack<null>) => void;
}

export interface ServerToClientEvents {
  roomUpdated: (room: RoomInfo) => void;
  gameUpdate: (update: GameUpdate) => void;
}

/** 브라우저가 접속할 때 보내는 정보. 새로고침해도 같은 플레이어로 인식하는 데 쓴다. */
export interface HandshakeAuth {
  playerId: string;
}
