import {
  DISCONNECTED_TURN_SECONDS,
  GameError,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TURN_SECONDS,
  applyAction,
  createGame,
  saleValue,
  type GameAction,
  type GameEvent,
  type GameState,
  type GameUpdate,
  type LobbyPlayer,
  type RoomInfo,
} from '@bluemarble/shared';

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
// 헷갈리는 글자(0, O, 1, I)는 뺐다.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** 모두 나간 방을 지우기까지 기다리는 시간 */
const EMPTY_ROOM_MS = 10 * 60 * 1000;

export interface RoomListener {
  roomUpdated(room: Room): void;
  gameUpdated(room: Room, update: GameUpdate): void;
}

export class Room {
  players: LobbyPlayer[] = [];
  game: GameState | null = null;
  deadline: number | null = null;
  private timer: NodeJS.Timeout | null = null;
  private cleanup: NodeJS.Timeout | null = null;

  constructor(
    public code: string,
    private listener: RoomListener,
  ) {}

  info(): RoomInfo {
    return { code: this.code, players: this.players, started: this.game !== null };
  }

  has(playerId: string) {
    return this.players.some((p) => p.id === playerId);
  }

  join(id: string, name: string) {
    if (this.has(id)) return this.setConnected(id, true);
    if (this.game) throw new Error('이미 게임이 시작된 방이에요.');
    if (this.players.length >= MAX_PLAYERS) throw new Error(`방이 가득 찼어요. (최대 ${MAX_PLAYERS}명)`);
    const used = new Set(this.players.map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c))!;
    this.players.push({ id, name: name.trim().slice(0, 12) || '플레이어', color, isHost: this.players.length === 0, connected: true });
    this.touch();
    this.listener.roomUpdated(this);
  }

  /** 게임 시작 전에는 방에서 빠지고, 게임 중에는 접속 끊김으로만 표시한다. */
  leave(id: string) {
    if (this.game) return this.setConnected(id, false);
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const [left] = this.players.splice(idx, 1);
    if (left.isHost && this.players[0]) this.players[0].isHost = true;
    this.touch();
    this.listener.roomUpdated(this);
  }

  setConnected(id: string, connected: boolean) {
    const p = this.players.find((x) => x.id === id);
    if (!p || p.connected === connected) return;
    p.connected = connected;
    this.touch();
    this.listener.roomUpdated(this);
    // 지금 차례인 사람이 나갔거나 돌아왔으면 시간 제한을 다시 잡는다.
    if (this.game) this.schedule();
  }

  isEmpty() {
    return this.players.every((p) => !p.connected);
  }

  start(by: string) {
    if (this.game) throw new Error('이미 시작했어요.');
    if (!this.players.find((p) => p.id === by)?.isHost) throw new Error('방장만 시작할 수 있어요.');
    if (this.players.length < MIN_PLAYERS) throw new Error(`${MIN_PLAYERS}명 이상 모여야 시작할 수 있어요.`);
    this.game = createGame(this.players);
    this.listener.roomUpdated(this);
    this.publish([{ type: 'log', text: `게임 시작! 순서: ${this.game.players.map((p) => p.name).join(' → ')}` }]);
  }

  act(by: string, action: GameAction) {
    if (!this.game) throw new GameError('아직 게임이 시작되지 않았어요.');
    const { state, events } = applyAction(this.game, by, action);
    this.game = state;
    this.publish(events);
  }

  /** 상태를 모두에게 보내고 다음 차례 시간 제한을 건다. */
  private publish(events: GameEvent[]) {
    this.schedule();
    this.listener.gameUpdated(this, this.snapshot(events));
  }

  snapshot(events: GameEvent[] = []): GameUpdate {
    return { state: this.game!, events, timeLeftMs: this.deadline && Math.max(0, this.deadline - Date.now()) };
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
    const game = this.game;
    if (!game || game.phase.type === 'gameOver') return;
    const current = this.players.find((p) => p.id === game.players[game.current].id);
    const seconds = current?.connected ? TURN_SECONDS : DISCONNECTED_TURN_SECONDS;
    this.deadline = Date.now() + seconds * 1000;
    this.timer = setTimeout(() => this.autoAct(), seconds * 1000);
  }

  /** 시간이 지나면 대신 고른다: 주사위는 굴리고, 사거나 짓지는 않는다. */
  private autoAct() {
    const game = this.game;
    if (!game) return;
    const p = game.players[game.current];
    try {
      this.act(p.id, defaultAction(game));
    } catch (err) {
      console.error('자동 진행 실패', err);
    }
  }

  /** 방에 아무도 없으면 일정 시간 뒤 지운다. */
  private touch() {
    if (this.cleanup) clearTimeout(this.cleanup);
    this.cleanup = null;
    if (this.players.length === 0 || this.isEmpty()) {
      this.cleanup = setTimeout(() => this.dispose(), this.players.length === 0 ? 0 : EMPTY_ROOM_MS);
    }
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    if (this.cleanup) clearTimeout(this.cleanup);
    rooms.delete(this.code);
  }
}

export function defaultAction(game: GameState): GameAction {
  const p = game.players[game.current];
  switch (game.phase.type) {
    case 'buy':
    case 'build':
      return { type: 'skip' };
    case 'spaceTravel':
      // 출발지로 가서 월급을 받는다.
      return { type: 'travel', to: 0 };
    case 'debt': {
      // 가장 싸게 팔리는 땅부터 판다.
      const owned = game.properties
        .flatMap((prop, tile) => (prop?.owner === p.id ? [{ tile, value: saleValue(tile, prop.level) }] : []))
        .sort((a, b) => a.value - b.value);
      return { type: 'sell', tile: owned[0].tile };
    }
    default:
      return { type: 'roll' };
  }
}

const rooms = new Map<string, Room>();

function newCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

export function createRoom(listener: RoomListener): Room {
  const room = new Room(newCode(), listener);
  rooms.set(room.code, room);
  return room;
}

export function findRoom(code: string): Room | undefined {
  return rooms.get(code.trim().toUpperCase());
}

export function roomOf(playerId: string): Room | undefined {
  for (const room of rooms.values()) if (room.has(playerId)) return room;
}
