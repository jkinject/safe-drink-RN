export const AppColors = {
  bg: '#EEEDF8',
  accent: '#6C63E0',
  navy: '#2D2B52',
  sub: '#9E9AC8',
  border: '#E8E6FF',
  cardBg: '#FFFFFF',
  /** 도수/용량 등 작은 칩 배경 — 연보라 */
  chipBg: '#F0EEFF',
  /** 흰 카드 안에 다시 얹는 패널(비교 패널·수식 박스·시뮬레이션 카드) */
  panel: '#F4F3FC',
  /** 선택된 카드·옵션 배경 (accent 테두리와 함께) */
  selectedBg: '#EAE8FF',
  /** 강조 알약 배경 (완전히 깨는 시각) */
  accentTint: '#F1EFFF',
  /** border 보다 한 톤 진한 연보라 선 — 안내 알약·팁 배너·법령 회색 박스 테두리 */
  borderStrong: '#C9C4F0',
  /** 다이얼로그·시트 뒤 어두운 오버레이 — 검정이 아니라 네이비 톤 */
  overlay: 'rgba(45,43,82,0.45)',
  white: '#FFFFFF',
} as const;

/**
 * 상태 색. 의미별로 배경·테두리·글자를 한 벌로 쓴다 — 노랑은 "진행 중/주의 환기",
 * 주황은 면허 정지(0.03%), 빨강은 면허 취소(0.08%)·삭제, 파랑은 안내.
 * 그래프 기준선 색도 같은 값(caution/danger)에서 나온다.
 */
export const StatusColors = {
  warningBg: '#FFF8E1',
  warningBorder: '#FFD97D',
  warningText: '#7A6000',
  warningTextStrong: '#B07B00',
  caution: '#FF9500',
  cautionBg: '#FFF8F0',
  cautionText: '#7A4800',
  danger: '#FF3B30',
  dangerBg: '#FFF0EF',
  dangerBorder: '#FFBCB8',
  dangerText: '#8B1A1A',
  infoBg: '#E3F2FD',
  infoText: '#1565C0',
  infoBorder: '#B3C7F7',
  infoCardBg: '#EFF6FF',
  infoCardText: '#1A4E8C',
} as const;

/** BAC 뱃지 색 — core 는 UI 색을 모르므로 level 만 돌려주고 여기서 색을 붙인다 */
export function bacBadgeColors(level: 'caution' | 'danger') {
  return level === 'danger'
    ? { color: StatusColors.danger, bg: StatusColors.dangerBg }
    : { color: StatusColors.caution, bg: StatusColors.cautionBg };
}

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

/** 떠 있는 동작 버튼(FAB). 카드보다 짙고 짧은 그림자 — 떠 있는 컨트롤은 이것 하나뿐 */
export const fabShadow = {
  shadowColor: '#6C63E0',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
  elevation: 6,
} as const;

/** 하단 탭바 — 위쪽으로 지는 그림자. cardShadow 의 offset 부호만 다르다 */
export const tabBarShadow = {
  shadowColor: '#6C63E0',
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.10,
  shadowRadius: 16,
  elevation: 8,
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
