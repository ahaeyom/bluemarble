import Phaser from 'phaser';
import { GameError, applyAction, createGame, type GameState } from '@bluemarble/shared';
import { BOARD_PX, BoardScene } from './BoardScene';
import { GameView } from './GameView';
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

function startLocal(names: string[]) {
  let state: GameState = createGame(names.map((name, i) => ({ id: `p${i}`, name, color: PLAYER_COLORS[i] })));
  const view = new GameView((action) => {
    try {
      const result = applyAction(state, state.players[state.current].id, action);
      state = result.state;
      view.update(result.state, result.events);
    } catch (err) {
      if (err instanceof GameError) view.log(`⚠️ ${err.message}`);
      else throw err;
    }
  }, null);
  show('game-panel');
  view.update(state, [{ type: 'log', text: `게임 시작! 순서: ${state.players.map((p) => p.name).join(' → ')}` }]);
}

$('go-local').onclick = () => show('local-setup');

$('local-start').onclick = () => {
  const names = [...nameBox.querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean);
  if (names.length < 2) {
    $('local-error').textContent = '2명 이상 필요해요.';
    return;
  }
  startLocal(names);
};

// ---------- 온라인 모드 ----------

let online = false;
function goOnline() {
  show('online');
  if (!online) setupOnline(show);
  online = true;
}

$('go-online').onclick = goOnline;

// 초대 링크로 들어오면 바로 온라인 화면을 연다.
if (new URLSearchParams(location.search).has('room')) goOnline();
