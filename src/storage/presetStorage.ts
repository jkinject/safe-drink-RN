import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrinkPreset } from '../core/types';
import type { LocaleCode } from '../state/localeStore';

const PRESETS_KEY = 'custom_presets';
const SEED_KEY = 'presets_seeded_v1';

/** 기본 프리셋 8종 (한국어) — Flutter constants/drink_presets.dart 와 동일 */
export const DEFAULT_PRESETS_KO: DrinkPreset[] = [
  { label: '맥주 500cc',   icon: 'beerMug',       abvPercent: 4.5,  volumeMl: 500, isCustom: false },
  { label: '맥주 355ml',   icon: 'beerCan',       abvPercent: 4.5,  volumeMl: 355, isCustom: false },
  { label: '소주 1잔',     icon: 'sojuGlass',     abvPercent: 16.5, volumeMl: 50,  isCustom: false },
  { label: '소주 1병',     icon: 'sojuBottle',    abvPercent: 16.5, volumeMl: 360, isCustom: false },
  { label: '와인 1잔',     icon: 'wineGlass',     abvPercent: 12.0, volumeMl: 150, isCustom: false },
  { label: '양주 1잔',     icon: 'whiskyGlass',   abvPercent: 40.0, volumeMl: 30,  isCustom: false },
  { label: '막걸리 1사발', icon: 'makgeolliBowl', abvPercent: 6.0,  volumeMl: 300, isCustom: false },
  { label: '하이볼 1잔',   icon: 'highball',      abvPercent: 8.0,  volumeMl: 300, isCustom: false },
];

/** 하위호환 alias — 기존 import(src/index.ts 등) 유지, 항상 한국어 기본값 */
export const DEFAULT_PRESETS = DEFAULT_PRESETS_KO;

/**
 * 기본 프리셋 8종 (영어) — 소주·막걸리·양주 등 한국 고유 술 대신
 * 국제적으로 통용되는 술 종류로 구성. 아이콘은 drink-icon.tsx 의 기존
 * 12종 그림만 재사용한다(보드카 샷은 소주잔 그림을 그대로 씀 — 작은 샷잔 형태가 맞음).
 */
export const DEFAULT_PRESETS_EN: DrinkPreset[] = [
  { label: 'Beer 500ml',       icon: 'beerMug',     abvPercent: 4.5,  volumeMl: 500, isCustom: false },
  { label: 'Beer can 355ml',   icon: 'beerCan',     abvPercent: 4.5,  volumeMl: 355, isCustom: false },
  { label: 'Wine glass',       icon: 'wineGlass',   abvPercent: 12.0, volumeMl: 150, isCustom: false },
  { label: 'Whisky shot',      icon: 'whiskyGlass', abvPercent: 40.0, volumeMl: 44,  isCustom: false },
  { label: 'Vodka shot',       icon: 'sojuGlass',   abvPercent: 40.0, volumeMl: 44,  isCustom: false },
  { label: 'Cocktail',         icon: 'cocktail',    abvPercent: 12.0, volumeMl: 200, isCustom: false },
  { label: 'Highball',         icon: 'highball',    abvPercent: 8.0,  volumeMl: 300, isCustom: false },
  { label: 'Champagne glass',  icon: 'champagne',   abvPercent: 12.0, volumeMl: 150, isCustom: false },
];

/** 로케일에 맞는 기본 프리셋 8종을 돌려준다 */
export function defaultPresets(locale: LocaleCode): DrinkPreset[] {
  return locale === 'en' ? DEFAULT_PRESETS_EN : DEFAULT_PRESETS_KO;
}

/**
 * 저장된 기본 프리셋에 아이콘 키를 채워 넣는다.
 *
 * 아이콘 도입 전에 저장된 목록은 emoji 만 갖고 있는데, 이모지는 소주잔·양주잔이
 * 같은 🥃 라 셋이 한 아이콘으로 뭉친다. 기본 프리셋은 라벨로 원본을 찾아
 * 제대로 된 아이콘을 되살린다. ko/en 양쪽 기본 라벨을 모두 뒤져야
 * 영어 로케일로 시드된 목록도 복원할 수 있다. 커스텀 프리셋은 사용자가
 * 고른 값이므로 건드리지 않는다.
 */
function withDefaultIcons(list: DrinkPreset[]): DrinkPreset[] {
  return list.map(p => {
    if (p.icon) return p;
    const original =
      DEFAULT_PRESETS_KO.find(d => d.label === p.label) ??
      DEFAULT_PRESETS_EN.find(d => d.label === p.label);
    return original ? { ...p, icon: original.icon } : p;
  });
}

/** 프리셋 목록 로드 (없으면 빈 배열) */
export async function loadPresets(): Promise<DrinkPreset[]> {
  try {
    const json = await AsyncStorage.getItem(PRESETS_KEY);
    if (!json) return [];
    const list = JSON.parse(json) as DrinkPreset[];
    return withDefaultIcons(list);
  } catch {
    return [];
  }
}

/** 프리셋 목록 저장 */
export async function savePresets(presets: DrinkPreset[]): Promise<void> {
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

/** 특정 인덱스의 프리셋 수정 */
export async function updatePresetAt(
  index: number,
  preset: DrinkPreset,
): Promise<void> {
  const current = await loadPresets();
  if (index < 0 || index >= current.length) return;
  current[index] = preset;
  await savePresets(current);
}

/**
 * 첫 실행 시 기본 프리셋 시드. locale 에 맞는 8종(한국어/영어)을 심는다.
 * 이미 시드됐으면 현재 목록을 그대로 반환.
 *
 * 마이그레이션 정책:
 * - 기존 커스텀 프리셋이 있으면 [기본 8종 + 기존 커스텀] 순으로 병합.
 * - 기존 데이터가 없으면 기본 8종으로 초기화.
 * - 시드 여부는 presets_seeded_v1 플래그로 관리.
 */
export async function seedIfNeeded(locale: LocaleCode): Promise<DrinkPreset[]> {
  const alreadySeeded = await AsyncStorage.getItem(SEED_KEY);
  if (alreadySeeded === 'true') return loadPresets();

  const existing = await loadPresets();
  const merged = [...defaultPresets(locale), ...existing];
  await savePresets(merged);
  await AsyncStorage.setItem(SEED_KEY, 'true');
  return merged;
}

/** 두 프리셋이 같은 술인지 판단 — icon + abvPercent + volumeMl 기준 */
function isSameDrink(a: DrinkPreset, b: DrinkPreset): boolean {
  return a.icon === b.icon && a.abvPercent === b.abvPercent && a.volumeMl === b.volumeMl;
}

/**
 * 기본 프리셋 복원: locale 기준 8종 중 "같은 술"(icon+abv+volume 일치)이
 * 이미 있으면 중복 추가하지 않는다. 라벨이 아니라 술 자체로 비교하는 이유는
 * 로케일을 바꾼 뒤 복원해도(예: 한국어로 시드 후 영어로 복원) 라벨만 다른
 * 같은 술이 두 번 생기지 않게 하기 위함. 누락된 기본 프리셋만 목록 앞에
 * 삽입하고, 사용자 프리셋은 유지한다.
 */
export async function restoreDefaults(locale: LocaleCode): Promise<DrinkPreset[]> {
  const current = await loadPresets();
  const missing = defaultPresets(locale).filter(
    d => !current.some(p => isSameDrink(p, d)),
  );
  if (missing.length === 0) return current;
  const restored = [...missing, ...current];
  await savePresets(restored);
  return restored;
}

/**
 * 언어를 바꿀 때, 저장된 목록이 이전 로케일의 기본 8종 **그대로**(손대지 않은 상태)면
 * 새 로케일의 기본 8종으로 통째로 바꾼다. 하나라도 고치거나 추가·삭제했으면 사용자의
 * 것이므로 건드리지 않고 null 을 돌려준다.
 *
 * 왜: 한국어 폰에서 앱만 English 로 쓰는 사용자가 소주·막걸리 대신 국제 기본 세트를
 * 받게 하려는 것. 스토어 영어 스크린샷도 이 경로로 찍는다.
 */
export async function swapDefaultsForLocale(
  from: LocaleCode,
  to: LocaleCode,
): Promise<DrinkPreset[] | null> {
  if (from === to) return null;
  const current = await loadPresets();
  const before = defaultPresets(from);
  const untouched =
    current.length === before.length &&
    current.every(
      (p, i) =>
        p.isCustom !== true &&
        p.label === before[i].label &&
        isSameDrink(p, before[i]),
    );
  if (!untouched) return null;
  const next = defaultPresets(to);
  await savePresets(next);
  return next;
}

/** 저장된 목록 초기화 */
export async function clearPresets(): Promise<void> {
  await AsyncStorage.multiRemove([PRESETS_KEY, SEED_KEY]);
}
