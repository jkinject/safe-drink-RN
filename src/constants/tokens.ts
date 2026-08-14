/**
 * 디자인 토큰.
 *
 * 화면 스타일에 숫자를 직접 쓰지 말고 여기 값을 쓴다. 토큰 없이 눈대중으로
 * 넣다 보니 폰트 크기 19종·모서리 14종까지 늘어난 적이 있다.
 * 새 값이 필요하면 토큰을 늘리기 전에 기존 것으로 되는지 먼저 확인할 것.
 */

/** 4의 배수 간격 — 여백·gap 은 전부 이 안에서 고른다 */
export const Space = {
  /** 아이콘과 글자처럼 붙어 있는 요소 사이 */
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** 모서리 — 작은 칩부터 큰 카드까지 5단계 + 알약 */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  /** 완전한 알약/원형 */
  pill: 999,
} as const;

/**
 * 글자 크기 — 역할 기준 9단계.
 * 굵기는 Pretendard 가 Regular/SemiBold/Bold 세 종만 있으므로 셋으로 맞춘다.
 */
export const Font = {
  /** 타이머 카운트다운 */
  display: 44,
  /** 큰 숫자, 온보딩 제목 */
  h1: 28,
  /** 화면 타이틀 */
  h2: 22,
  /** 섹션 제목 */
  h3: 18,
  /** 카드 제목 */
  h4: 16,
  /** 본문 */
  body: 14,
  /** 보조 본문 */
  bodySm: 13,
  /** 캡션 */
  caption: 12,
  /** 뱃지·탭 라벨 */
  micro: 11,
} as const;

export const Weight = {
  regular: '400',
  semibold: '600',
  bold: '700',
} as const;

/**
 * 역할별 조합 규칙 — 새 화면을 만들 때 이대로 맞춘다.
 *
 * | 역할                    | 모서리      | 그림자        |
 * |-------------------------|-------------|---------------|
 * | 화면 좌우 여백          | —           | Space.lg      |
 * | 큰 카드 (섹션 컨테이너) | Radius.xl   | cardShadowSm  |
 * | 중첩 타일·패널          | Radius.lg   | 없음          |
 * | 버튼·입력               | Radius.md   | 없음          |
 * | 칩·뱃지                 | Radius.sm   | 없음          |
 * | 떠 있는 것 (모달·말풍선)| Radius.xl   | cardShadow    |
 * | 다이얼로그(오버레이 위) | Radius.xl   | dialogShadow  |
 *
 * 그림자는 `@/constants/colors` 의 세 가지만 쓴다 —
 * cardShadowSm(화면 안 카드) / cardShadow(떠 있는 것) /
 * dialogShadow(어두운 오버레이 위 다이얼로그·모달).
 */

/** 아이콘 크기 — 글자 크기와 짝을 맞춘다 */
export const IconSize = {
  /** 본문 옆 작은 아이콘 */
  sm: 14,
  /** 버튼·리스트 */
  md: 20,
  /** 탭바·섹션 헤더 */
  lg: 24,
  /** 술 아이콘 (프리셋 카드) */
  drink: 30,
} as const;
