// 보드 데이터와 금액 규칙. 숫자를 바꾸려면 이 파일만 고치면 된다.
// 금액 단위는 "만 원"이다.

export const START_MONEY = 300;
export const SALARY = 20;
export const WELFARE_PAYMENT = 15;
export const SPACE_TRAVEL_FEE = 20;
export const ISLAND_TURNS = 3;

export type TileKind =
  | 'start'
  | 'city'
  | 'special'
  | 'goldenKey'
  | 'island'
  | 'welfareReceive'
  | 'welfarePay'
  | 'spaceTravel';

export interface Tile {
  index: number;
  name: string;
  kind: TileKind;
  /** 땅값. city와 special만 가진다. */
  price?: number;
}

type TileDef = [name: string, kind: TileKind, price?: number];

const TILE_DEFS: TileDef[] = [
  ['출발', 'start'],
  ['타이베이', 'city', 5],
  ['황금열쇠', 'goldenKey'],
  ['베이징', 'city', 8],
  ['마닐라', 'city', 8],
  ['제주도', 'special', 20],
  ['싱가포르', 'city', 10],
  ['황금열쇠', 'goldenKey'],
  ['카이로', 'city', 10],
  ['이스탄불', 'city', 12],
  ['무인도', 'island'],
  ['아테네', 'city', 14],
  ['황금열쇠', 'goldenKey'],
  ['코펜하겐', 'city', 16],
  ['스톡홀름', 'city', 16],
  ['콩코드 여객기', 'special', 20],
  ['베른', 'city', 18],
  ['황금열쇠', 'goldenKey'],
  ['베를린', 'city', 18],
  ['오타와', 'city', 20],
  ['사회복지기금', 'welfareReceive'],
  ['부에노스아이레스', 'city', 22],
  ['황금열쇠', 'goldenKey'],
  ['상파울루', 'city', 24],
  ['시드니', 'city', 24],
  ['부산', 'special', 50],
  ['하와이', 'city', 26],
  ['리스본', 'city', 26],
  ['퀸 엘리자베스호', 'special', 30],
  ['마드리드', 'city', 28],
  ['우주여행', 'spaceTravel'],
  ['도쿄', 'city', 30],
  ['컬럼비아호', 'special', 45],
  ['파리', 'city', 32],
  ['로마', 'city', 32],
  ['황금열쇠', 'goldenKey'],
  ['런던', 'city', 35],
  ['뉴욕', 'city', 35],
  ['사회복지기금', 'welfarePay'],
  ['서울', 'special', 100],
];

export const BOARD: readonly Tile[] = TILE_DEFS.map(([name, kind, price], index) => ({
  index,
  name,
  kind,
  price,
}));

export const BOARD_SIZE = BOARD.length;
export const ISLAND_INDEX = BOARD.findIndex((t) => t.kind === 'island');
export const SPACE_TRAVEL_INDEX = BOARD.findIndex((t) => t.kind === 'spaceTravel');
export const COLUMBIA_INDEX = BOARD.findIndex((t) => t.name === '컬럼비아호');

/** 0: 땅만, 1~2: 별장 수, 3: 빌딩, 4: 호텔 */
export type BuildingLevel = 0 | 1 | 2 | 3 | 4;
export const MAX_BUILDING_LEVEL: BuildingLevel = 4;
export const BUILDING_NAMES = ['땅', '별장 1채', '별장 2채', '빌딩', '호텔'] as const;

const BUILD_COST_RATE = [0, 0.5, 0.5, 1, 1.5];
const RENT_RATE = [0.1, 0.5, 1.5, 3, 5];
const SPECIAL_RENT_RATE = 0.5;
const SEOUL_RENT = 200;

const roundMan = (n: number) => Math.max(1, Math.round(n));

/** level 단계로 올리는 데 드는 건설비 */
export function buildCost(tile: Tile, level: BuildingLevel): number {
  return roundMan((tile.price ?? 0) * BUILD_COST_RATE[level]);
}

export function rent(tile: Tile, level: BuildingLevel): number {
  const price = tile.price ?? 0;
  if (tile.kind === 'special') {
    return tile.name === '서울' ? SEOUL_RENT : roundMan(price * SPECIAL_RENT_RATE);
  }
  return roundMan(price * RENT_RATE[level]);
}

export function isOwnable(tile: Tile): boolean {
  return tile.kind === 'city' || tile.kind === 'special';
}
