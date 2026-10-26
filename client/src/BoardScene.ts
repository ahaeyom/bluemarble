import Phaser from 'phaser';
import { BOARD, cardById, type GameEvent, type GameState, type Tile } from '@bluemarble/shared';

export const BOARD_PX = 880;
const CORNER = 120;
const SIDE = (BOARD_PX - CORNER * 2) / 9;
const STEP_MS = 160;

const KIND_COLORS: Record<Tile['kind'], number> = {
  start: 0xe8a33d,
  city: 0xf4f1e8,
  special: 0xd6ecff,
  goldenKey: 0xffe08a,
  island: 0xa7d7a0,
  welfareReceive: 0xf7c6d9,
  welfarePay: 0xf7c6d9,
  spaceTravel: 0xc9b8ff,
};

// 대륙별 띠 색 (원작처럼 구역마다 색이 다르다)
const GROUP_COLORS = [0x8e44ad, 0x2980b9, 0x16a085, 0xc0392b];
const LEVEL_MARKS = ['', '▲', '▲▲', '▲▲■', '▲▲■★'];

const toColor = (css: string) => Phaser.Display.Color.HexStringToColor(css).color;

/** 칸 번호 → 화면 위치. 출발은 오른쪽 아래, 시계 방향으로 돈다. */
export function tileRect(index: number) {
  const side = Math.floor(index / 10);
  const offset = index % 10;
  const far = BOARD_PX - CORNER;
  if (offset === 0) {
    const corners = [
      { x: far, y: far },
      { x: 0, y: far },
      { x: 0, y: 0 },
      { x: far, y: 0 },
    ];
    return { ...corners[side], w: CORNER, h: CORNER, side };
  }
  const back = far - offset * SIDE;
  const along = CORNER + (offset - 1) * SIDE;
  switch (side) {
    case 0:
      return { x: back, y: far, w: SIDE, h: CORNER, side };
    case 1:
      return { x: 0, y: back, w: CORNER, h: SIDE, side };
    case 2:
      return { x: along, y: 0, w: SIDE, h: CORNER, side };
    default:
      return { x: far, y: along, w: CORNER, h: SIDE, side };
  }
}

/** 한 칸에 여러 말이 있을 때 겹치지 않게 놓을 위치 */
function tokenSpot(tile: number, slot: number) {
  const r = tileRect(tile);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dx = ((slot % 3) - 1) * 18;
  const dy = (Math.floor(slot / 3) - 0.5) * 18 + 14;
  return { x: cx + dx, y: cy + dy };
}

let resolveScene: (scene: BoardScene) => void;

export class BoardScene extends Phaser.Scene {
  /** 장면이 다 그려지면 풀리는 약속 */
  static ready = new Promise<BoardScene>((resolve) => (resolveScene = resolve));

  /** 우주여행 목적지를 고를 때 칸을 누르면 불린다. */
  onTileClick: ((tile: number) => void) | null = null;

  private ownerLayer!: Phaser.GameObjects.Graphics;
  private levelTexts: Phaser.GameObjects.Text[] = [];
  private tokens = new Map<string, Phaser.GameObjects.Container>();
  private dice: Phaser.GameObjects.Text[] = [];
  private cardPopup!: Phaser.GameObjects.Container;
  private highlight!: Phaser.GameObjects.Graphics;

  constructor() {
    super('board');
  }

  create() {
    this.cameras.main.setBackgroundColor('#2c6e49');
    const g = this.add.graphics();

    for (const tile of BOARD) {
      const r = tileRect(tile.index);
      g.fillStyle(KIND_COLORS[tile.kind]);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.lineStyle(2, 0x1d2733);
      g.strokeRect(r.x, r.y, r.w, r.h);

      if (tile.kind === 'city') {
        // 보드 안쪽 가장자리에 색 띠를 그린다.
        g.fillStyle(GROUP_COLORS[r.side]);
        const band = 22;
        if (r.side === 0) g.fillRect(r.x, r.y, r.w, band);
        else if (r.side === 1) g.fillRect(r.x + r.w - band, r.y, band, r.h);
        else if (r.side === 2) g.fillRect(r.x, r.y + r.h - band, r.w, band);
        else g.fillRect(r.x, r.y, band, r.h);
      }

      const isCorner = tile.index % 10 === 0;
      const name = tile.kind.startsWith('welfare') ? '사회복지\n기금' : tile.name;
      const label = tile.price ? `${name}\n${tile.price}만` : name;
      this.add
        .text(r.x + r.w / 2, r.y + r.h / 2 - (isCorner ? 0 : 10), label, {
          fontFamily: 'sans-serif',
          fontSize: isCorner ? '20px' : '14px',
          fontStyle: 'bold',
          color: '#1d2733',
          align: 'center',
          wordWrap: { width: r.w - 8, useAdvancedWrap: true },
        })
        .setOrigin(0.5);

      this.levelTexts[tile.index] = this.add
        .text(r.x + r.w / 2, r.y + r.h - 12, '', { fontFamily: 'sans-serif', fontSize: '12px', color: '#1d2733' })
        .setOrigin(0.5);

      this.add
        .zone(r.x, r.y, r.w, r.h)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.onTileClick?.(tile.index));
    }

    this.ownerLayer = this.add.graphics();
    this.highlight = this.add.graphics();

    this.add
      .text(BOARD_PX / 2, BOARD_PX / 2 - 130, '부루마블', {
        fontFamily: 'sans-serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#f4f1e8',
      })
      .setOrigin(0.5)
      .setAngle(-8);

    for (const dx of [-55, 55]) {
      this.dice.push(
        this.add
          .text(BOARD_PX / 2 + dx, BOARD_PX / 2 + 20, '⚀', { fontFamily: 'sans-serif', fontSize: '96px', color: '#f4f1e8' })
          .setOrigin(0.5),
      );
    }

    const card = this.add.graphics();
    card.fillStyle(0xffe08a).fillRoundedRect(-170, -100, 340, 200, 16);
    card.lineStyle(4, 0xb7791f).strokeRoundedRect(-170, -100, 340, 200, 16);
    const cardTitle = this.add
      .text(0, -45, '', { fontFamily: 'sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#1d2733' })
      .setOrigin(0.5);
    const cardBody = this.add
      .text(0, 25, '', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#1d2733',
        align: 'center',
        wordWrap: { width: 300, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.cardPopup = this.add.container(BOARD_PX / 2, BOARD_PX / 2 + 20, [card, cardTitle, cardBody]).setVisible(false);

    resolveScene(this);
  }

  /** 상태에 맞춰 땅 주인, 건물, 말 위치를 다시 그린다. */
  sync(state: GameState) {
    const g = this.ownerLayer.clear();
    state.properties.forEach((prop, tile) => {
      this.levelTexts[tile]?.setText(prop ? LEVEL_MARKS[prop.level] : '');
      const owner = state.players.find((p) => p.id === prop?.owner);
      if (!owner) return;
      const r = tileRect(tile);
      g.lineStyle(6, toColor(owner.color));
      g.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
    });

    const slots = new Map<number, number>();
    state.players.forEach((p) => {
      let token = this.tokens.get(p.id);
      if (!token) {
        const circle = this.add.circle(0, 0, 11, toColor(p.color)).setStrokeStyle(3, 0xffffff);
        const initial = this.add
          .text(0, 0, p.name.slice(0, 1), { fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#fff' })
          .setOrigin(0.5);
        token = this.add.container(0, 0, [circle, initial]).setDepth(10);
        this.tokens.set(p.id, token);
      }
      token.setVisible(!p.bankrupt);
      const slot = slots.get(p.position) ?? 0;
      slots.set(p.position, slot + 1);
      const spot = tokenSpot(p.position, slot);
      token.setPosition(spot.x, spot.y);
    });

    if (state.lastDice) this.showDice(state.lastDice);
  }

  /** 지금 차례인 플레이어의 칸을 표시하거나, 우주여행 중이면 모든 칸을 눌러볼 수 있게 표시한다. */
  markCurrent(state: GameState) {
    const g = this.highlight.clear();
    const p = state.players[state.current];
    if (!p || state.phase.type === 'gameOver') return;
    const r = tileRect(p.position);
    g.lineStyle(4, 0xffffff, 0.9).strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  }

  /** 사건을 순서대로 애니메이션으로 보여준다. */
  async play(events: GameEvent[], state: GameState) {
    for (const e of events) {
      if (e.type === 'dice') await this.rollDice(e.dice);
      else if (e.type === 'move') await this.moveToken(e.player, e.path);
      else if (e.type === 'jump') await this.moveToken(e.player, [e.to]);
      else if (e.type === 'card') await this.showCard(e.cardId);
    }
    this.sync(state);
  }

  private showDice(dice: [number, number]) {
    dice.forEach((v, i) => this.dice[i].setText(String.fromCodePoint(0x2680 + v - 1)));
  }

  private rollDice(dice: [number, number]) {
    return new Promise<void>((resolve) => {
      let ticks = 0;
      this.time.addEvent({
        delay: 60,
        repeat: 9,
        callback: () => {
          ticks++;
          if (ticks < 10) {
            this.showDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
            this.dice.forEach((d) => d.setAngle(Phaser.Math.Between(-25, 25)));
          } else {
            this.dice.forEach((d) => d.setAngle(0));
            this.showDice(dice);
            this.time.delayedCall(250, resolve);
          }
        },
      });
    });
  }

  private async moveToken(playerId: string, path: number[]) {
    const token = this.tokens.get(playerId);
    if (!token) return;
    const stepMs = path.length > 15 ? 50 : STEP_MS;
    for (const tile of path) {
      const spot = tokenSpot(tile, 0);
      await new Promise<void>((resolve) =>
        this.tweens.add({
          targets: token,
          x: spot.x,
          y: spot.y - 10,
          duration: stepMs,
          ease: 'Quad.easeOut',
          yoyo: false,
          onComplete: () => resolve(),
        }),
      );
    }
  }

  private showCard(cardId: string) {
    const card = cardById(cardId);
    const [, title, body] = this.cardPopup.list as Phaser.GameObjects.Text[];
    title.setText(`🔑 ${card.title}`);
    body.setText(card.description);
    this.cardPopup.setVisible(true).setScale(0.3).setAlpha(0);
    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: this.cardPopup,
        scale: 1,
        alpha: 1,
        duration: 250,
        ease: 'Back.easeOut',
        onComplete: () =>
          this.time.delayedCall(1300, () => {
            this.cardPopup.setVisible(false);
            resolve();
          }),
      });
    });
  }
}
