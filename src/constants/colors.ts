export const AppColors = {
  bg: '#EEEDF8',
  accent: '#6C63E0',
  navy: '#2D2B52',
  sub: '#9E9AC8',
  border: '#E8E6FF',
  cardBg: '#FFFFFF',
  /** 도수/용량 등 작은 칩 배경 — 연보라 */
  chipBg: '#F0EEFF',
} as const;

export const cardShadow = {
  shadowColor: '#6C63E0',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.10,
  shadowRadius: 16,
  elevation: 4,
} as const;

export const cardShadowSm = {
  shadowColor: '#6C63E0',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
} as const;

/**
 * 다이얼로그처럼 어두운 오버레이 위에 뜨는 것.
 * 카드용 그림자는 어두운 배경에 묻혀 떠 있는 느낌이 사라지므로 훨씬 세게 준다.
 */
export const dialogShadow = {
  shadowColor: '#1A1836',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.45,
  shadowRadius: 28,
  elevation: 24,
} as const;
