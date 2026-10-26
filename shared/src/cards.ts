// 황금열쇠 카드. 효과 처리는 게임 로직(2단계)에서 effect 종류별로 구현한다.

export type CardEffect =
  | { type: 'gain'; amount: number }
  | { type: 'pay'; amount: number }
  | { type: 'collectFromEach'; amount: number }
  | { type: 'payPerBuilding'; amount: number }
  | { type: 'repair'; villa: number; building: number; hotel: number }
  | { type: 'keepRentFree' }
  | { type: 'keepIslandEscape' }
  | { type: 'goToIsland' }
  | { type: 'moveTo'; index: number; collectSalary: boolean }
  | { type: 'moveBy'; steps: number }
  | { type: 'worldTour' }
  | { type: 'halfPriceSale' }
  | { type: 'collectWelfare' }
  | { type: 'doubleNextRent' };

export interface GoldenKeyCard {
  id: string;
  title: string;
  description: string;
  count: number;
  effect: CardEffect;
}

export const GOLDEN_KEY_CARDS: readonly GoldenKeyCard[] = [
  { id: 'lottery', title: '복권 당첨', description: '20만 원을 받습니다.', count: 2, effect: { type: 'gain', amount: 20 } },
  { id: 'nobel', title: '노벨평화상 수상', description: '30만 원을 받습니다.', count: 1, effect: { type: 'gain', amount: 30 } },
  { id: 'scholarship', title: '장학금 혜택', description: '10만 원을 받습니다.', count: 1, effect: { type: 'gain', amount: 10 } },
  { id: 'birthday', title: '생일 축하', description: '모든 플레이어에게 1만 원씩 받습니다.', count: 1, effect: { type: 'collectFromEach', amount: 1 } },
  { id: 'pension', title: '연금 혜택', description: '5만 원을 받습니다.', count: 1, effect: { type: 'gain', amount: 5 } },
  { id: 'hospital', title: '병원비 지불', description: '5만 원을 냅니다.', count: 1, effect: { type: 'pay', amount: 5 } },
  { id: 'speeding', title: '과속 운전 벌금', description: '5만 원을 냅니다.', count: 1, effect: { type: 'pay', amount: 5 } },
  { id: 'study', title: '해외 유학', description: '10만 원을 냅니다.', count: 1, effect: { type: 'pay', amount: 10 } },
  { id: 'tax', title: '정기 종합 소득세', description: '건물 1채당 3만 원을 냅니다.', count: 1, effect: { type: 'payPerBuilding', amount: 3 } },
  { id: 'repair', title: '건물 수리비', description: '별장 1만, 빌딩 4만, 호텔 10만 원씩 냅니다.', count: 2, effect: { type: 'repair', villa: 1, building: 4, hotel: 10 } },
  { id: 'security', title: '방범비', description: '건물 1채당 1만 원을 냅니다.', count: 1, effect: { type: 'payPerBuilding', amount: 1 } },
  { id: 'rentFree', title: '우대권', description: '다음 통행료를 1번 면제받습니다.', count: 2, effect: { type: 'keepRentFree' } },
  { id: 'islandEscape', title: '무인도 탈출권', description: '무인도에서 바로 나올 수 있습니다.', count: 2, effect: { type: 'keepIslandEscape' } },
  { id: 'goIsland', title: '무인도로 가기', description: '무인도로 바로 갑니다.', count: 1, effect: { type: 'goToIsland' } },
  { id: 'highway', title: '고속도로', description: '출발지로 가서 월급을 받습니다.', count: 1, effect: { type: 'moveTo', index: 0, collectSalary: true } },
  { id: 'jejuTour', title: '관광 여행', description: '제주도로 갑니다.', count: 2, effect: { type: 'moveTo', index: 5, collectSalary: true } },
  { id: 'worldTour', title: '세계 일주 초대권', description: '한 바퀴 돌고 월급을 받습니다.', count: 1, effect: { type: 'worldTour' } },
  { id: 'olympic', title: '서울 올림픽 초대', description: '서울로 갑니다.', count: 1, effect: { type: 'moveTo', index: 39, collectSalary: true } },
  { id: 'spaceInvite', title: '우주여행 초청장', description: '우주여행 칸으로 갑니다.', count: 1, effect: { type: 'moveTo', index: 30, collectSalary: true } },
  { id: 'back2', title: '뒤로 두 칸', description: '뒤로 두 칸 갑니다.', count: 1, effect: { type: 'moveBy', steps: -2 } },
  { id: 'back3', title: '뒤로 세 칸', description: '뒤로 세 칸 갑니다.', count: 1, effect: { type: 'moveBy', steps: -3 } },
  { id: 'moving', title: '이사', description: '앞으로 한 칸 갑니다.', count: 1, effect: { type: 'moveBy', steps: 1 } },
  { id: 'halfSale', title: '반액 대매출', description: '가장 비싼 내 땅 하나를 은행에 반값에 팝니다.', count: 1, effect: { type: 'halfPriceSale' } },
  { id: 'welfare', title: '사회복지기금 배당', description: '기금 칸으로 가서 기금을 받습니다.', count: 1, effect: { type: 'collectWelfare' } },
  { id: 'boom', title: '부동산 폭등', description: '다음에 받는 통행료가 2배가 됩니다.', count: 1, effect: { type: 'doubleNextRent' } },
];

/** 장수만큼 펼친 카드 묶음 (섞기 전) */
export function buildDeck(): GoldenKeyCard[] {
  return GOLDEN_KEY_CARDS.flatMap((card) => Array.from({ length: card.count }, () => card));
}
