// 부루마블 규칙 엔진. 화면이나 네트워크와 상관없는 순수 로직이라
// 한 화면 모드와 온라인 서버가 똑같이 쓴다.

import {
  BOARD,
  BOARD_SIZE,
  COLUMBIA_INDEX,
  ISLAND_INDEX,
  ISLAND_TURNS,
  MAX_BUILDING_LEVEL,
  SALARY,
  SPACE_TRAVEL_FEE,
  SPACE_TRAVEL_INDEX,
  START_MONEY,
  WELFARE_PAYMENT,
  buildCost,
  isOwnable,
  rent,
  type BuildingLevel,
} from './board';
import { GOLDEN_KEY_CARDS, buildDeck, type GoldenKeyCard } from './cards';

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  money: number;
  position: number;
  /** 무인도에 남은 턴 수. 0이면 갇혀 있지 않다. */
  islandTurns: number;
  /** 우주여행 칸에 멈춰서 다음 턴에 원하는 곳으로 갈 수 있다. */
  spaceTravel: boolean;
  rentFree: number;
  islandEscape: number;
  doubleRent: boolean;
  bankrupt: boolean;
}

export interface PropertyState {
  owner: string | null;
  level: BuildingLevel;
}

export type Phase =
  | { type: 'roll' }
  | { type: 'spaceTravel' }
  | { type: 'buy'; tile: number }
  | { type: 'build'; tile: number }
  | { type: 'debt'; amount: number; creditor: string | null; toFund: boolean }
  | { type: 'gameOver'; winner: string };

export interface GameState {
  players: PlayerState[];
  /** 칸 번호별 소유 정보. 살 수 없는 칸은 null */
  properties: (PropertyState | null)[];
  current: number;
  phase: Phase;
  welfareFund: number;
  deck: string[];
  doublesInRow: number;
  /** 이번 행동이 끝나면 같은 사람이 한 번 더 굴리는지 (더블) */
  extraRoll: boolean;
  lastDice: [number, number] | null;
  turn: number;
}

export type GameAction =
  | { type: 'roll' }
  | { type: 'useEscape' }
  | { type: 'buy' }
  | { type: 'build' }
  | { type: 'skip' }
  | { type: 'travel'; to: number }
  | { type: 'sell'; tile: number };

export type GameEvent =
  | { type: 'dice'; player: string; dice: [number, number] }
  | { type: 'move'; player: string; path: number[] }
  | { type: 'jump'; player: string; to: number }
  | { type: 'card'; player: string; cardId: string }
  | { type: 'money'; player: string; delta: number }
  | { type: 'buy'; player: string; tile: number }
  | { type: 'build'; player: string; tile: number; level: BuildingLevel }
  | { type: 'bankrupt'; player: string }
  | { type: 'gameOver'; winner: string }
  | { type: 'log'; text: string };

export interface NewPlayer {
  id: string;
  name: string;
  color: string;
}

export type Rng = () => number;

export class GameError extends Error {}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const won = (n: number) => `${n}만 원`;

export function cardById(id: string): GoldenKeyCard {
  return GOLDEN_KEY_CARDS.find((c) => c.id === id)!;
}

/** 은행에 팔 때 받는 돈: 땅값과 건설비를 합친 금액의 절반 */
export function saleValue(tile: number, level: BuildingLevel): number {
  let total = BOARD[tile].price ?? 0;
  for (let l = 1; l <= level; l++) total += buildCost(BOARD[tile], l as BuildingLevel);
  return Math.floor(total / 2);
}

export function currentRent(state: GameState, tile: number): number {
  const prop = state.properties[tile];
  return prop ? rent(BOARD[tile], prop.level) : 0;
}

export function totalAssets(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId)!;
  let total = player.money;
  state.properties.forEach((prop, tile) => {
    if (prop?.owner === playerId) total += saleValue(tile, prop.level) * 2;
  });
  return total;
}

export function createGame(players: NewPlayer[], rng: Rng = Math.random): GameState {
  return {
    players: shuffle(players, rng).map((p) => ({
      ...p,
      money: START_MONEY,
      position: 0,
      islandTurns: 0,
      spaceTravel: false,
      rentFree: 0,
      islandEscape: 0,
      doubleRent: false,
      bankrupt: false,
    })),
    properties: BOARD.map((tile) => (isOwnable(tile) ? { owner: null, level: 0 } : null)),
    current: 0,
    phase: { type: 'roll' },
    welfareFund: 0,
    deck: shuffle(buildDeck().map((c) => c.id), rng),
    doublesInRow: 0,
    extraRoll: false,
    lastDice: null,
    turn: 1,
  };
}

/** playerId가 action을 했을 때의 새 상태와, 화면에 보여줄 사건 목록을 돌려준다. */
export function applyAction(
  state: GameState,
  playerId: string,
  action: GameAction,
  rng: Rng = Math.random,
): { state: GameState; events: GameEvent[] } {
  const turn = new Turn(structuredClone(state), rng);
  if (turn.s.phase.type === 'gameOver') throw new GameError('게임이 끝났어요.');
  if (turn.player.id !== playerId) throw new GameError('내 차례가 아니에요.');
  turn.run(action);
  return { state: turn.s, events: turn.events };
}

class Turn {
  events: GameEvent[] = [];
  /** 플레이어의 선택을 기다리는 상태로 바뀌었는지 */
  private waiting = false;

  constructor(
    public s: GameState,
    private rng: Rng,
  ) {}

  get player(): PlayerState {
    return this.s.players[this.s.current];
  }

  private log(text: string) {
    this.events.push({ type: 'log', text });
  }

  private wait(phase: Phase) {
    this.s.phase = phase;
    this.waiting = true;
  }

  private expect<T extends Phase['type']>(type: T): Extract<Phase, { type: T }> {
    if (this.s.phase.type !== type) throw new GameError('지금은 할 수 없는 행동이에요.');
    return this.s.phase as Extract<Phase, { type: T }>;
  }

  run(action: GameAction) {
    switch (action.type) {
      case 'roll':
        this.expect('roll');
        return this.roll();
      case 'useEscape':
        return this.useEscape();
      case 'buy':
        return this.buy();
      case 'build':
        return this.build();
      case 'skip': {
        const t = this.s.phase.type;
        if (t !== 'buy' && t !== 'build') throw new GameError('지금은 넘길 수 없어요.');
        return this.endAction();
      }
      case 'travel':
        return this.travel(action.to);
      case 'sell':
        return this.sell(action.tile);
      default:
        throw new GameError('알 수 없는 행동이에요.');
    }
  }

  // ---------- 행동 ----------

  private roll() {
    const p = this.player;
    const dice: [number, number] = [1 + Math.floor(this.rng() * 6), 1 + Math.floor(this.rng() * 6)];
    const isDouble = dice[0] === dice[1];
    const sum = dice[0] + dice[1];
    this.s.lastDice = dice;
    this.events.push({ type: 'dice', player: p.id, dice });

    if (p.islandTurns > 0) {
      if (isDouble) {
        p.islandTurns = 0;
        this.s.extraRoll = false;
        this.log(`${p.name}님이 더블로 무인도를 탈출했어요!`);
        this.moveSteps(p, sum);
        this.land(p);
      } else {
        p.islandTurns--;
        this.log(
          p.islandTurns > 0
            ? `${p.name}님은 무인도에 갇혀 있어요. (${p.islandTurns}턴 남음)`
            : `${p.name}님은 다음 턴에 무인도를 떠나요.`,
        );
      }
      return this.finish();
    }

    if (isDouble) {
      this.s.doublesInRow++;
      if (this.s.doublesInRow >= 3) {
        this.log(`${p.name}님이 더블을 세 번 연속으로 던져서 무인도로 가요.`);
        this.sendToIsland(p);
        return this.finish();
      }
      this.s.extraRoll = true;
    } else {
      this.s.extraRoll = false;
    }
    this.moveSteps(p, sum);
    this.land(p);
    this.finish();
  }

  private useEscape() {
    this.expect('roll');
    const p = this.player;
    if (p.islandTurns === 0 || p.islandEscape === 0) throw new GameError('무인도 탈출권을 쓸 수 없어요.');
    p.islandEscape--;
    p.islandTurns = 0;
    this.log(`${p.name}님이 무인도 탈출권을 썼어요.`);
  }

  private buy() {
    const { tile } = this.expect('buy');
    const p = this.player;
    const price = BOARD[tile].price!;
    if (p.money < price) throw new GameError('돈이 모자라요.');
    this.changeMoney(p, -price);
    this.s.properties[tile]!.owner = p.id;
    this.events.push({ type: 'buy', player: p.id, tile });
    this.log(`${p.name}님이 ${BOARD[tile].name}을(를) ${won(price)}에 샀어요.`);
    this.endAction();
  }

  private build() {
    const { tile } = this.expect('build');
    const p = this.player;
    const prop = this.s.properties[tile]!;
    const next = (prop.level + 1) as BuildingLevel;
    const cost = buildCost(BOARD[tile], next);
    if (p.money < cost) throw new GameError('돈이 모자라요.');
    this.changeMoney(p, -cost);
    prop.level = next;
    this.events.push({ type: 'build', player: p.id, tile, level: next });
    this.log(`${p.name}님이 ${BOARD[tile].name}에 건물을 지었어요. (${won(cost)})`);
    this.endAction();
  }

  private travel(to: number) {
    this.expect('spaceTravel');
    const p = this.player;
    if (!Number.isInteger(to) || to < 0 || to >= BOARD_SIZE || to === SPACE_TRAVEL_INDEX) {
      throw new GameError('갈 수 없는 칸이에요.');
    }
    p.spaceTravel = false;
    this.s.extraRoll = false;
    const ownerId = this.s.properties[COLUMBIA_INDEX]?.owner;
    const owner = this.s.players.find((o) => o.id === ownerId);
    if (owner && owner.id !== p.id) {
      const fee = Math.min(p.money, SPACE_TRAVEL_FEE);
      this.transfer(p, owner, fee);
      this.log(`${p.name}님이 컬럼비아호 주인 ${owner.name}님에게 ${won(fee)}을 냈어요.`);
    }
    this.log(`${p.name}님이 우주여행으로 ${BOARD[to].name}에 가요.`);
    this.moveSteps(p, (to - p.position + BOARD_SIZE) % BOARD_SIZE);
    this.land(p);
    this.finish();
  }

  private sell(tile: number) {
    const debt = this.expect('debt');
    const p = this.player;
    const prop = this.s.properties[tile];
    if (!prop || prop.owner !== p.id) throw new GameError('내 땅이 아니에요.');
    this.sellToBank(p, tile);
    if (p.money >= debt.amount) {
      this.settleDebt(p, debt.amount, debt.creditor, debt.toFund);
      this.finish();
    }
  }

  // ---------- 이동과 칸 처리 ----------

  private moveSteps(p: PlayerState, steps: number) {
    if (steps === 0) return;
    const dir = Math.sign(steps);
    const path: number[] = [];
    let pos = p.position;
    for (let i = 0; i < Math.abs(steps); i++) {
      pos = (pos + dir + BOARD_SIZE) % BOARD_SIZE;
      path.push(pos);
      if (dir > 0 && pos === 0) {
        this.changeMoney(p, SALARY);
        this.log(`${p.name}님이 출발지를 지나 월급 ${won(SALARY)}을 받았어요.`);
      }
    }
    p.position = pos;
    this.events.push({ type: 'move', player: p.id, path });
  }

  private sendToIsland(p: PlayerState) {
    p.position = ISLAND_INDEX;
    p.islandTurns = ISLAND_TURNS;
    this.s.extraRoll = false;
    this.events.push({ type: 'jump', player: p.id, to: ISLAND_INDEX });
  }

  private land(p: PlayerState): void {
    const tile = BOARD[p.position];
    switch (tile.kind) {
      case 'city':
      case 'special':
        return this.landOnProperty(p, tile.index);
      case 'goldenKey':
        return this.drawCard(p);
      case 'island':
        p.islandTurns = ISLAND_TURNS;
        this.s.extraRoll = false;
        this.log(`${p.name}님이 무인도에 도착했어요. ${ISLAND_TURNS}턴 동안 쉬어요.`);
        return;
      case 'welfarePay':
        this.log(`${p.name}님이 사회복지기금 ${won(WELFARE_PAYMENT)}을 내요.`);
        return this.pay(p, WELFARE_PAYMENT, null, true);
      case 'welfareReceive': {
        const fund = this.s.welfareFund;
        this.s.welfareFund = 0;
        if (fund > 0) this.changeMoney(p, fund);
        this.log(`${p.name}님이 사회복지기금 ${won(fund)}을 받았어요.`);
        return;
      }
      case 'spaceTravel':
        p.spaceTravel = true;
        this.s.extraRoll = false;
        this.log(`${p.name}님이 우주여행 칸에 도착했어요. 다음 턴에 원하는 곳으로 갈 수 있어요.`);
        return;
      case 'start':
        return;
    }
  }

  private landOnProperty(p: PlayerState, tile: number) {
    const prop = this.s.properties[tile]!;
    const info = BOARD[tile];

    if (prop.owner === null) {
      if (p.money >= info.price!) this.wait({ type: 'buy', tile });
      return;
    }

    if (prop.owner === p.id) {
      if (info.kind === 'city' && prop.level < MAX_BUILDING_LEVEL) {
        const cost = buildCost(info, (prop.level + 1) as BuildingLevel);
        if (p.money >= cost) this.wait({ type: 'build', tile });
      }
      return;
    }

    const owner = this.s.players.find((o) => o.id === prop.owner)!;
    if (p.rentFree > 0) {
      p.rentFree--;
      this.log(`${p.name}님이 우대권을 써서 ${BOARD[tile].name} 통행료를 면제받았어요.`);
      return;
    }
    let amount = rent(info, prop.level);
    if (owner.doubleRent) {
      owner.doubleRent = false;
      amount *= 2;
      this.log(`부동산 폭등! 통행료가 2배가 됐어요.`);
    }
    this.log(`${p.name}님이 ${owner.name}님에게 ${info.name} 통행료 ${won(amount)}을 내요.`);
    this.pay(p, amount, owner.id, false);
  }

  private drawCard(p: PlayerState): void {
    if (this.s.deck.length === 0) this.s.deck = shuffle(buildDeck().map((c) => c.id), this.rng);
    const card = cardById(this.s.deck.shift()!);
    this.events.push({ type: 'card', player: p.id, cardId: card.id });
    this.log(`황금열쇠: ${card.title}. ${card.description}`);
    const e = card.effect;

    switch (e.type) {
      case 'gain':
        return this.changeMoney(p, e.amount);
      case 'pay':
        return this.pay(p, e.amount, null, false);
      case 'collectFromEach':
        for (const o of this.alivePlayers()) {
          if (o.id !== p.id) this.transfer(o, p, Math.min(o.money, e.amount));
        }
        return;
      case 'payPerBuilding': {
        const count = this.ownedProperties(p).reduce((n, [, prop]) => n + prop.level, 0);
        if (count > 0) this.pay(p, count * e.amount, null, false);
        return;
      }
      case 'repair': {
        let total = 0;
        for (const [, prop] of this.ownedProperties(p)) {
          total += Math.min(prop.level, 2) * e.villa;
          if (prop.level >= 3) total += e.building;
          if (prop.level >= 4) total += e.hotel;
        }
        if (total > 0) this.pay(p, total, null, false);
        return;
      }
      case 'keepRentFree':
        p.rentFree++;
        return;
      case 'keepIslandEscape':
        p.islandEscape++;
        return;
      case 'goToIsland':
        return this.sendToIsland(p);
      case 'moveTo':
        this.moveSteps(p, (e.index - p.position + BOARD_SIZE) % BOARD_SIZE);
        return this.land(p);
      case 'moveBy':
        this.moveSteps(p, e.steps);
        return this.land(p);
      case 'worldTour':
        this.events.push({ type: 'move', player: p.id, path: BOARD.map((_, i) => (p.position + i + 1) % BOARD_SIZE) });
        this.changeMoney(p, SALARY);
        return;
      case 'halfPriceSale': {
        const owned = this.ownedProperties(p).sort(([a], [b]) => BOARD[b].price! - BOARD[a].price!);
        if (owned.length > 0) this.sellToBank(p, owned[0][0]);
        else this.log('팔 땅이 없어서 그냥 넘어가요.');
        return;
      }
      case 'collectWelfare': {
        const target = BOARD.findIndex((t) => t.kind === 'welfareReceive');
        this.moveSteps(p, (target - p.position + BOARD_SIZE) % BOARD_SIZE);
        return this.land(p);
      }
      case 'doubleNextRent':
        p.doubleRent = true;
        return;
    }
  }

  // ---------- 돈 ----------

  private changeMoney(p: PlayerState, delta: number) {
    if (delta === 0) return;
    p.money += delta;
    this.events.push({ type: 'money', player: p.id, delta });
  }

  private transfer(from: PlayerState, to: PlayerState, amount: number) {
    this.changeMoney(from, -amount);
    this.changeMoney(to, amount);
  }

  /** 돈을 낸다. 모자라면 땅을 팔 기회를 주고, 팔아도 모자라면 파산한다. */
  private pay(p: PlayerState, amount: number, creditor: string | null, toFund: boolean) {
    if (p.money >= amount) return this.settleDebt(p, amount, creditor, toFund);
    const liquid = this.ownedProperties(p).reduce((n, [tile, prop]) => n + saleValue(tile, prop.level), 0);
    if (p.money + liquid < amount) return this.goBankrupt(p, creditor);
    this.log(`${p.name}님은 돈이 모자라서 땅을 팔아야 해요. (필요: ${won(amount)})`);
    this.wait({ type: 'debt', amount, creditor, toFund });
  }

  private settleDebt(p: PlayerState, amount: number, creditor: string | null, toFund: boolean) {
    this.changeMoney(p, -amount);
    if (toFund) this.s.welfareFund += amount;
    const c = this.s.players.find((o) => o.id === creditor);
    if (c) this.changeMoney(c, amount);
  }

  private sellToBank(p: PlayerState, tile: number) {
    const prop = this.s.properties[tile]!;
    const value = saleValue(tile, prop.level);
    prop.owner = null;
    prop.level = 0;
    this.changeMoney(p, value);
    this.log(`${p.name}님이 ${BOARD[tile].name}을(를) 은행에 ${won(value)}에 팔았어요.`);
  }

  private goBankrupt(p: PlayerState, creditor: string | null) {
    const c = this.s.players.find((o) => o.id === creditor);
    if (c && p.money > 0) this.transfer(p, c, p.money);
    p.money = 0;
    p.bankrupt = true;
    for (const [tile] of this.ownedProperties(p)) this.s.properties[tile] = { owner: null, level: 0 };
    this.events.push({ type: 'bankrupt', player: p.id });
    this.log(`${p.name}님이 파산했어요.`);

    const alive = this.alivePlayers();
    if (alive.length === 1) {
      this.s.phase = { type: 'gameOver', winner: alive[0].id };
      this.events.push({ type: 'gameOver', winner: alive[0].id });
      this.log(`${alive[0].name}님이 우승했어요!`);
    }
  }

  // ---------- 턴 진행 ----------

  /** 행동 하나가 끝났을 때. 선택을 기다리는 중이면 그대로 둔다. */
  private finish() {
    if (!this.waiting) this.endAction();
  }

  private endAction() {
    if (this.s.phase.type === 'gameOver') return;
    const p = this.player;
    if (!p.bankrupt && this.s.extraRoll && p.islandTurns === 0 && !p.spaceTravel) {
      this.s.extraRoll = false;
      this.s.phase = { type: 'roll' };
      this.log(`더블! ${p.name}님이 한 번 더 던져요.`);
      return;
    }
    this.s.doublesInRow = 0;
    this.s.extraRoll = false;
    do {
      this.s.current = (this.s.current + 1) % this.s.players.length;
    } while (this.player.bankrupt);
    this.s.turn++;
    this.s.phase = this.player.spaceTravel ? { type: 'spaceTravel' } : { type: 'roll' };
  }

  private alivePlayers() {
    return this.s.players.filter((o) => !o.bankrupt);
  }

  private ownedProperties(p: PlayerState): [number, PropertyState][] {
    const owned: [number, PropertyState][] = [];
    this.s.properties.forEach((prop, tile) => {
      if (prop?.owner === p.id) owned.push([tile, prop]);
    });
    return owned;
  }
}
