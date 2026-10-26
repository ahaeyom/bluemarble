import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, RoomInfo, ServerToClientEvents } from '@bluemarble/shared';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** 온라인 방 화면. 게임 진행은 3단계에서 붙인다. */
export function setupOnline() {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
  const nameInput = $<HTMLInputElement>('name');
  const codeInput = $<HTMLInputElement>('code');
  const errorText = $('error');

  const invited = new URLSearchParams(location.search).get('room');
  if (invited) codeInput.value = invited;

  function showRoom(room: RoomInfo) {
    $('join-form').hidden = true;
    $('room').hidden = false;
    $('room-code').textContent = room.code;
    $('players').replaceChildren(
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
    await navigator.clipboard.writeText(`${location.origin}/?room=${$('room-code').textContent}`);
    $('copy-link').textContent = '복사했어요!';
  };

  socket.on('roomUpdated', showRoom);
}
