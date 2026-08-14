import { Image } from 'expo-image';

/**
 * 술 종류 아이콘.
 *
 * 이모지는 플랫폼마다 그림이 달라 디자인을 통제할 수 없어서, 12종을 같은
 * 프롬프트 규칙으로 생성해 배경을 지운 PNG 로 쓴다.
 * (생성: Replicate openai/gpt-image-2 → 851-labs/background-remover,
 *  스크립트는 docs/DRINK-ICONS.md 참고)
 *
 * 규칙: 굵은 네이비(#2D2B52) 외곽선 + 플랫한 원색 채움 + 정사각 투명 배경.
 */
const SOURCES = {
  beerMug: require('../../assets/images/drink/beerMug.png'),
  beerCan: require('../../assets/images/drink/beerCan.png'),
  sojuGlass: require('../../assets/images/drink/sojuGlass.png'),
  sojuBottle: require('../../assets/images/drink/sojuBottle.png'),
  wineGlass: require('../../assets/images/drink/wineGlass.png'),
  wineBottle: require('../../assets/images/drink/wineBottle.png'),
  whiskyGlass: require('../../assets/images/drink/whiskyGlass.png'),
  makgeolliBowl: require('../../assets/images/drink/makgeolliBowl.png'),
  highball: require('../../assets/images/drink/highball.png'),
  cocktail: require('../../assets/images/drink/cocktail.png'),
  champagne: require('../../assets/images/drink/champagne.png'),
  cup: require('../../assets/images/drink/cup.png'),
} as const;

export type DrinkIconName = keyof typeof SOURCES;

/** 커스텀 프리셋 아이콘 선택지 — 그리드 순서 그대로 */
export const DRINK_ICON_NAMES = Object.keys(SOURCES) as DrinkIconName[];

export function isDrinkIconName(v: string): v is DrinkIconName {
  return v in SOURCES;
}

/** 구버전 저장 데이터(이모지)를 아이콘으로 옮기기 위한 대응표 */
const LEGACY_EMOJI: Record<string, DrinkIconName> = {
  '🍺': 'beerMug',
  '🍻': 'beerMug',
  '🥃': 'whiskyGlass',
  '🍷': 'wineGlass',
  '🍶': 'makgeolliBowl',
  '🥂': 'champagne',
  '🍸': 'cocktail',
  '🍹': 'highball',
  '🍾': 'champagne',
  '🫗': 'cup',
  '🧉': 'cup',
  '🍇': 'wineGlass',
};

/**
 * 프리셋이 어떤 아이콘을 쓸지 정한다.
 * icon 이 있으면 그대로, 없으면 구버전 emoji 를 매핑하고, 둘 다 없으면 기본값.
 */
export function resolveDrinkIcon(preset: {
  icon?: string;
  emoji?: string;
}): DrinkIconName {
  if (preset.icon && isDrinkIconName(preset.icon)) return preset.icon;
  if (preset.emoji && LEGACY_EMOJI[preset.emoji]) return LEGACY_EMOJI[preset.emoji];
  return 'cup';
}

interface DrinkIconProps {
  name: DrinkIconName;
  size?: number;
}

export function DrinkIcon({ name, size = 28 }: DrinkIconProps) {
  return (
    <Image
      source={SOURCES[name]}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={0}
    />
  );
}
