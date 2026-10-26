import Phaser from 'phaser';
import { BOARD, type Tile } from '@bluemarble/shared';

export const BOARD_PX = 880;
const CORNER = 120;
const SIDE = (BOARD_PX - CORNER * 2) / 9;

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

export class BoardScene extends Phaser.Scene {
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
      const label = tile.price ? `${tile.name}\n${tile.price}만` : tile.name;
      this.add
        .text(r.x + r.w / 2, r.y + r.h / 2, label, {
          fontFamily: 'sans-serif',
          fontSize: isCorner ? '20px' : '14px',
          fontStyle: 'bold',
          color: '#1d2733',
          align: 'center',
          wordWrap: { width: r.w - 8, useAdvancedWrap: true },
        })
        .setOrigin(0.5);
    }

    this.add
      .text(BOARD_PX / 2, BOARD_PX / 2, '부루마블', {
        fontFamily: 'sans-serif',
        fontSize: '72px',
        fontStyle: 'bold',
        color: '#f4f1e8',
      })
      .setOrigin(0.5)
      .setAngle(-12);
  }
}
