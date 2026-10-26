// 무작위로 행동하는 플레이어끼리 여러 판을 돌려서 규칙 엔진이 꼬이지 않는지 확인한다.
// 실행: npm run test -w shared
import assert from 'node:assert/strict';
import { BOARD_SIZE, GOLDEN_KEY_CARDS, buildDeck } from '../src';
import { applyAction, createGame, type GameAction, type GameState } from '../src/game';

assert.equal(buildDeck().length, 30, '황금열쇠는 30장이어야 해요');
assert.equal(new Set(GOLDEN_KEY_CARDS.map((c) => c.id)).size, GOLDEN_KEY_CARDS.length);

// 재현 가능한 난수
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

function pickAction(s: GameState, rng: () => number): GameAction {
  const p = s.players[s.current];
  switch (s.phase.type) {
    case 'roll':
      return p.islandTurns > 0 && p.islandEscape > 0 && rng() < 0.5 ? { type: 'useEscape' } : { type: 'roll' };
    case 'buy':
      return rng() < 0.8 ? { type: 'buy' } : { type: 'skip' };
    case 'build':
      return rng() < 0.7 ? { type: 'build' } : { type: 'skip' };
    case 'spaceTravel': {
      let to = Math.floor(rng() * BOARD_SIZE);
      if (to === 30) to = 39;
      return { type: 'travel', to };
    }
    case 'debt': {
      const owned = s.properties.flatMap((prop, i) => (prop?.owner === p.id ? [i] : []));
      return { type: 'sell', tile: owned[Math.floor(rng() * owned.length)] };
    }
    case 'gameOver':
      throw new Error('unreachable');
  }
}

const GAMES = 3000;
const stats = { finished: 0, actions: 0, phases: {} as Record<string, number>, cards: 0 };
for (let g = 0; g < GAMES; g++) {
  const rng = seeded(g + 1);
  const n = 2 + (g % 4);
  let s = createGame(
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#fff' })),
    rng,
  );
  const startTotal = s.players.reduce((a, p) => a + p.money, 0);
  for (let step = 0; step < 5000 && s.phase.type !== 'gameOver'; step++) {
    const action = pickAction(s, rng);
    const res = applyAction(s, s.players[s.current].id, action, rng);
    s = res.state;
    stats.actions++;
    stats.phases[s.phase.type] = (stats.phases[s.phase.type] ?? 0) + 1;
    stats.cards += res.events.filter((e) => e.type === 'card').length;

    for (const p of s.players) {
      assert.ok(p.position >= 0 && p.position < BOARD_SIZE);
      if (s.phase.type !== 'debt' || s.players[s.current] !== p) assert.ok(p.money >= 0, `음수 잔액: ${p.name} ${p.money}`);
      if (p.bankrupt) assert.ok(!s.properties.some((prop) => prop?.owner === p.id));
    }
    assert.ok(!s.players[s.current].bankrupt || s.phase.type === 'gameOver');
    if (s.phase.type === 'debt') assert.ok(s.players[s.current].money < s.phase.amount);
  }
  if (s.phase.type === 'gameOver') stats.finished++;
  assert.ok(startTotal > 0);
}

// 잘못된 차례와 행동은 거절해야 한다.
const s0 = createGame([{ id: 'a', name: 'A', color: '' }, { id: 'b', name: 'B', color: '' }], seeded(9));
const other = s0.players[1].id;
assert.throws(() => applyAction(s0, other, { type: 'roll' }));
assert.throws(() => applyAction(s0, s0.players[0].id, { type: 'buy' }));

console.log(`${GAMES}판 중 ${stats.finished}판 끝까지 진행, 행동 ${stats.actions}번, 황금열쇠 ${stats.cards}장`);
console.log('단계별 횟수', stats.phases);
