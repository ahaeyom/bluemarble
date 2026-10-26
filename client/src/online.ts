import { io, type Socket } from 'socket.io-client';
import { MIN_PLAYERS, type ClientToServerEvents, type RoomInfo, type ServerToClientEvents } from '@bluemarble/shared';
import { GameView } from './GameView';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** 이 브라우저의 플레이어 번호. 새로고침해도 같은 플레이어로 돌아오게 저장해 둔다. */
function playerId(): string {
  const key = 'bluemarble.playerId';
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** 온라인 모드: 방 만들기, 참가, 게임 진행 */
export function setupOnline(show: (section: string) => void) {
  const myId = playerId();
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ auth: { playerId: myId } });
  const view = new GameView((action) => {
    socket.emit('action', action, (res) => {
      if (!res.ok) view.log(`⚠️ ${res.error}`);
    });
  }, myId);

  const nameInput = $<HTMLInputElement>('name');
  const codeInput = $<HTMLInputElement>('code');
  const errorText = $('error');

  const invited = new URLSearchParams(location.search).get('room');
  if (invited) codeInput.value = invited;
  try {
    nameInput.value = localStorage.getItem('bluemarble.name') ?? '';
  } catch {}

  function rememberName() {
    try {
      localStorage.setItem('bluemarble.name', nameInput.value);
    } catch {}
  }

  function showRoom(room: RoomInfo) {
    history.replaceState(null, '', `?room=${room.code}`);
    view.offline = new Set(room.players.filter((p) => !p.connected).map((p) => p.id));
    if (room.started) {
      show('game-panel');
      view.render();
      return;
    }
    show('online');
    $('join-form').hidden = true;
    $('room').hidden = false;
    $('room-code').textContent = room.code;
    $('players').replaceChildren(
      ...room.players.map((p) => {
        const li = document.createElement('li');
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = p.color;
        li.append(dot, `${p.name}${p.isHost ? ' (방장)' : ''}${p.id === myId ? ' · 나' : ''}`);
        return li;
      }),
    );
    const isHost = room.players.find((p) => p.id === myId)?.isHost ?? false;
    const enough = room.players.length >= MIN_PLAYERS;
    $<HTMLButtonElement>('start-online').hidden = !isHost;
    $<HTMLButtonElement>('start-online').disabled = !enough;
    $('room-hint').textContent = isHost
      ? enough
        ? '다 모이면 게임 시작을 눌러 주세요.'
        : '초대 링크를 친구들에게 보내 주세요.'
      : '방장이 게임을 시작하기를 기다리고 있어요.';
  }

  $('create').onclick = () => {
    rememberName();
    socket.emit('createRoom', nameInput.value, (res) => {
      if (res.ok) showRoom(res.data);
      else errorText.textContent = res.error;
    });
  };

  $('join').onclick = () => {
    rememberName();
    socket.emit('joinRoom', codeInput.value, nameInput.value, (res) => {
      if (res.ok) showRoom(res.data);
      else errorText.textContent = res.error;
    });
  };

  $('start-online').onclick = () => {
    socket.emit('startGame', (res) => {
      if (!res.ok) $('room-error').textContent = res.error;
    });
  };

  $('copy-link').onclick = async () => {
    await navigator.clipboard.writeText(`${location.origin}/?room=${$('room-code').textContent}`);
    $('copy-link').textContent = '복사했어요!';
  };

  socket.on('roomUpdated', showRoom);
  socket.on('gameUpdate', (update) => {
    show('game-panel');
    view.update(update.state, update.events, update.timeLeftMs);
  });
  socket.on('connect_error', () => {
    errorText.textContent = '서버에 연결하는 중이에요… 처음 접속이면 최대 1분 걸릴 수 있어요.';
  });
  socket.on('connect', () => {
    errorText.textContent = '';
  });
}
