import Phaser from 'phaser';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, RoomInfo, ServerToClientEvents } from '@bluemarble/shared';
import { BOARD_PX, BoardScene } from './BoardScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: BOARD_PX,
  height: BOARD_PX,
  scene: [BoardScene],
});

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const nameInput = $<HTMLInputElement>('name');
const codeInput = $<HTMLInputElement>('code');
const errorText = $('error');

// 초대 링크(?room=ABCD)로 들어오면 방 코드를 미리 채운다.
const invited = new URLSearchParams(location.search).get('room');
if (invited) codeInput.value = invited;

function showRoom(room: RoomInfo) {
  $('join-form').hidden = true;
  $('room').hidden = false;
  $('room-code').textContent = room.code;
  const list = $('players');
  list.replaceChildren(
    ...room.players.map((p) => {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = p.color;
      li.append(dot, `${p.name}${p.isHost ? ' (방장)' : ''}${p.id === socket.id ? ' · 나' : ''}`);
      return li;
    }),
  );
}

$('create').onclick = () => {
  socket.emit('createRoom', nameInput.value, (res) => {
    if (res.ok) showRoom(res.data);
    else errorText.textContent = res.error;
  });
};

$('join').onclick = () => {
  socket.emit('joinRoom', codeInput.value, nameInput.value, (res) => {
    if (res.ok) showRoom(res.data);
    else errorText.textContent = res.error;
  });
};

$('copy-link').onclick = async () => {
  const link = `${location.origin}/?room=${$('room-code').textContent}`;
  await navigator.clipboard.writeText(link);
  $('copy-link').textContent = '복사했어요!';
};

socket.on('roomUpdated', showRoom);
