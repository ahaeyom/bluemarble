import Phaser from 'phaser';
import { GameError, applyAction, createGame, type GameAction, type GameState } from '@bluemarble/shared';
import { BOARD_PX, BoardScene } from './BoardScene';
import { GamePanel } from './GamePanel';
import { setupOnline } from './online';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: BOARD_PX,
  height: BOARD_PX,
  scene: [BoardScene],
});

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function show(section: string) {
  for (const id of ['menu', 'local-setup', 'online', 'game-panel']) $(id).hidden = id !== section;
}

// ---------- 한 화면 모드 ----------

const nameBox = $('local-names');
PLAYER_COLORS.forEach((_, i) => {
  const input = document.createElement('input');
  input.maxLength = 12;
  input.placeholder = `플레이어 ${i + 1}`;
  if (i < 3) input.value = `플레이어 ${i + 1}`;
  nameBox.append(input);
});

let state: GameState;
let busy = false;
const panel = new GamePanel(dispatch);

async function dispatch(action: GameAction) {
  if (busy) return;
  let result;
  try {
    result = applyAction(state, state.players[state.current].id, action);
  } catch (err) {
    if (err instanceof GameError) return panel.addLog([`⚠️ ${err.message}`]);
    throw err;
  }
  busy = true;
  panel.render(state, busy);
  const scene = await BoardScene.ready;
  await scene.play(result.events, result.state);
  state = result.state;
  panel.addLog(result.events.flatMap((e) => (e.type === 'log' ? [e.text] : [])));
  busy = false;
  panel.render(state, busy);
  scene.markCurrent(state);
}

$('go-local').onclick = () => show('local-setup');
$('go-online').onclick = () => {
  show('online');
  setupOnline();
};

$('local-start').onclick = async () => {
  const names = [...nameBox.querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean);
  if (names.length < 2) {
    $('local-error').textContent = '2명 이상 필요해요.';
    return;
  }
  state = createGame(names.map((name, i) => ({ id: `p${i}`, name, color: PLAYER_COLORS[i] })));
  show('game-panel');
  panel.addLog([`게임 시작! 순서: ${state.players.map((p) => p.name).join(' → ')}`]);
  panel.render(state, busy);
  const scene = await BoardScene.ready;
  scene.sync(state);
  scene.markCurrent(state);
  scene.onTileClick = (tile) => {
    if (state.phase.type === 'spaceTravel') dispatch({ type: 'travel', to: tile });
  };
};

// 초대 링크로 들어오면 바로 온라인 화면을 연다.
if (new URLSearchParams(location.search).has('room')) {
  show('online');
  setupOnline();
}
