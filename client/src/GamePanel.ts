import {
  BOARD,
  BUILDING_NAMES,
  SPACE_TRAVEL_INDEX,
  buildCost,
  saleValue,
  type BuildingLevel,
  type GameAction,
  type GameState,
} from '@bluemarble/shared';

const $ = (id: string) => document.getElementById(id)!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function dot(color: string) {
  const d = el('span', { className: 'dot' });
  d.style.background = color;
  return d;
}

export interface PanelOptions {
  busy: boolean;
  /** 이 화면의 플레이어. 한 화면 모드에서는 null이고, 모두가 조작할 수 있다. */
  myId: string | null;
  /** 접속이 끊긴 플레이어 */
  offline: Set<string>;
  /** 지금 차례가 자동으로 넘어가는 시각 (이 브라우저 시계 기준) */
  deadline: number | null;
}

/** 오른쪽 패널: 차례, 행동 버튼, 플레이어 현황, 기록 */
export class GamePanel {
  private deadline: number | null = null;

  constructor(private act: (action: GameAction) => void) {
    setInterval(() => this.renderTimer(), 250);
  }

  render(state: GameState, opts: PanelOptions) {
    this.deadline = state.phase.type === 'gameOver' ? null : opts.deadline;
    this.renderTurn(state);
    this.renderTimer();
    const p = state.players[state.current];
    if (opts.myId && p.id !== opts.myId && state.phase.type !== 'gameOver') {
      $('actions').replaceChildren(el('p', { className: 'hint', textContent: `${p.name}님이 고르는 중이에요…` }));
    } else {
      this.renderActions(state, opts.busy);
    }
    this.renderScores(state, opts);
  }

  private renderTimer() {
    const left = this.deadline ? Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000)) : null;
    $('timer').textContent = left === null ? '' : `⏱ ${left}초`;
  }

  addLog(lines: string[]) {
    const log = $('log');
    for (const line of lines) log.prepend(el('li', { textContent: line }));
    while (log.children.length > 60) log.lastElementChild!.remove();
  }

  private renderTurn(state: GameState) {
    const info = $('turn-info');
    if (state.phase.type === 'gameOver') {
      const { winner } = state.phase;
      const w = state.players.find((p) => p.id === winner)!;
      info.replaceChildren(dot(w.color), `🏆 ${w.name}님 우승!`);
      return;
    }
    const p = state.players[state.current];
    info.replaceChildren(dot(p.color), `${p.name}님 차례`);
  }

  private renderActions(state: GameState, busy: boolean) {
    const box = $('actions');
    const p = state.players[state.current];
    const button = (label: string, action: GameAction, secondary = false) => {
      const b = el('button', { textContent: label, disabled: busy });
      if (secondary) b.className = 'secondary';
      b.onclick = () => this.act(action);
      return b;
    };
    const hint = (text: string) => el('p', { className: 'hint', textContent: text });
    const phase = state.phase;

    switch (phase.type) {
      case 'roll': {
        const items: Node[] = [];
        if (p.islandTurns > 0) items.push(hint(`무인도에 갇혀 있어요. 더블이 나오면 탈출해요. (${p.islandTurns}턴 남음)`));
        items.push(button('🎲 주사위 굴리기', { type: 'roll' }));
        if (p.islandTurns > 0 && p.islandEscape > 0) items.push(button('무인도 탈출권 쓰기', { type: 'useEscape' }, true));
        box.replaceChildren(...items);
        return;
      }
      case 'buy': {
        const tile = BOARD[phase.tile];
        box.replaceChildren(
          hint(`${tile.name}에 도착했어요. 주인이 없는 땅이에요.`),
          button(`${tile.name} 사기 (${tile.price}만)`, { type: 'buy' }),
          button('안 사기', { type: 'skip' }, true),
        );
        return;
      }
      case 'build': {
        const tile = BOARD[phase.tile];
        const next = (state.properties[phase.tile]!.level + 1) as BuildingLevel;
        box.replaceChildren(
          hint(`내 땅 ${tile.name}에 도착했어요.`),
          button(`${BUILDING_NAMES[next]} 짓기 (${buildCost(tile, next)}만)`, { type: 'build' }),
          button('넘기기', { type: 'skip' }, true),
        );
        return;
      }
      case 'spaceTravel': {
        const select = document.createElement('select');
        BOARD.forEach((t) => {
          if (t.index !== SPACE_TRAVEL_INDEX) select.append(new Option(`${t.index}. ${t.name}`, String(t.index)));
        });
        const go = el('button', { textContent: '🚀 이동', disabled: busy });
        go.onclick = () => this.act({ type: 'travel', to: Number(select.value) });
        box.replaceChildren(hint('우주여행! 보드에서 갈 칸을 누르거나 아래에서 골라 주세요.'), select, go);
        return;
      }
      case 'debt': {
        const list = el('div', { className: 'sell-list' });
        state.properties.forEach((prop, tile) => {
          if (prop?.owner !== p.id) return;
          list.append(button(`${BOARD[tile].name} 팔기 (+${saleValue(tile, prop.level)}만)`, { type: 'sell', tile }, true));
        });
        box.replaceChildren(hint(`${phase.amount}만 원을 내야 하는데 ${p.money}만 원밖에 없어요. 땅을 팔아 주세요.`), list);
        return;
      }
      case 'gameOver': {
        const again = el('button', { textContent: '새 게임' });
        again.onclick = () => location.reload();
        box.replaceChildren(again);
        return;
      }
    }
  }

  private renderScores(state: GameState, opts: PanelOptions) {
    $('scoreboard').replaceChildren(
      ...state.players.map((p, i) => {
        const owned = state.properties.filter((prop) => prop?.owner === p.id).length;
        const badges = [
          p.islandTurns > 0 ? '🏝' : '',
          p.spaceTravel ? '🚀' : '',
          p.rentFree > 0 ? `🎫${p.rentFree}` : '',
          p.islandEscape > 0 ? `🔓${p.islandEscape}` : '',
          p.doubleRent ? '📈' : '',
        ].join('');
        const li = el(
          'li',
          {},
          el(
            'span',
            { className: 'who' },
            dot(p.color),
            `${p.name}${p.id === opts.myId ? ' (나)' : ''}${opts.offline.has(p.id) ? ' 📴' : ''} ${badges}`,
          ),
          el('span', { className: 'money' }, `${p.money}만 · 땅 ${owned}`),
        );
        if (i === state.current && state.phase.type !== 'gameOver') li.classList.add('current');
        if (p.bankrupt) li.classList.add('bankrupt');
        return li;
      }),
    );
  }
}
