import type { GameAction, GameEvent, GameState } from '@bluemarble/shared';
import { BoardScene } from './BoardScene';
import { GamePanel } from './GamePanel';

/** 보드 애니메이션과 패널을 묶어서, 새 상태가 오면 차례대로 보여준다. */
export class GameView {
  state: GameState | null = null;
  offline = new Set<string>();
  private busy = false;
  private deadline: number | null = null;
  private queue = Promise.resolve();
  /** 아직 보여주지 못한 상태 개수 */
  private pending = 0;
  private panel: GamePanel;

  constructor(
    send: (action: GameAction) => void,
    private myId: string | null,
  ) {
    this.panel = new GamePanel((action) => {
      if (!this.busy) send(action);
    });
    BoardScene.ready.then((scene) => {
      scene.onTileClick = (tile) => {
        if (!this.busy && this.state?.phase.type === 'spaceTravel' && this.canAct()) send({ type: 'travel', to: tile });
      };
    });
  }

  private canAct() {
    return !this.myId || this.state?.players[this.state.current].id === this.myId;
  }

  /** 새 상태와 그 사이에 일어난 사건. 애니메이션이 끝나면 다음 것을 보여준다. */
  update(state: GameState, events: GameEvent[], timeLeftMs: number | null = null) {
    const receivedAt = Date.now();
    this.pending++;
    this.queue = this.queue.then(async () => {
      this.pending--;
      const scene = await BoardScene.ready;
      if (!this.state) {
        this.state = state;
        scene.sync(state);
      }
      this.busy = true;
      this.render();
      // 다른 탭에 가 있었거나 밀린 상태가 있으면 애니메이션 없이 바로 따라잡는다.
      if (document.hidden || this.pending > 0) scene.sync(state);
      else await scene.play(events, state);
      this.state = state;
      this.deadline = timeLeftMs === null ? null : receivedAt + timeLeftMs;
      this.panel.addLog(events.flatMap((e) => (e.type === 'log' ? [e.text] : [])));
      this.busy = false;
      this.render();
      scene.markCurrent(state);
    });
  }

  log(text: string) {
    this.panel.addLog([text]);
  }

  render() {
    if (!this.state) return;
    this.panel.render(this.state, { busy: this.busy, myId: this.myId, offline: this.offline, deadline: this.deadline });
  }
}
