import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrinkPreset } from '../core/types';

const PRESETS_KEY = 'custom_presets';
const SEED_KEY = 'presets_seeded_v1';

/** 기본 프리셋 8종 — Flutter constants/drink_presets.dart 와 동일 */
export const DEFAULT_PRESETS: DrinkPreset[] = [
  { label: '맥주 500cc',   emoji: '🍺', abvPercent: 4.5,  volumeMl: 500, isCustom: false },
  { label: '맥주 355ml',   emoji: '🍺', abvPercent: 4.5,  volumeMl: 355, isCustom: false },
  { label: '소주 1잔',     emoji: '🥃', abvPercent: 16.5, volumeMl: 50,  isCustom: false },
  { label: '소주 1병',     emoji: '🥃', abvPercent: 16.5, volumeMl: 360, isCustom: false },
  { label: '와인 1잔',     emoji: '🍷', abvPercent: 12.0, volumeMl: 150, isCustom: false },
  { label: '양주 1잔',     emoji: '🥃', abvPercent: 40.0, volumeMl: 30,  isCustom: false },
  { label: '막걸리 1사발', emoji: '🍶', abvPercent: 6.0,  volumeMl: 300, isCustom: false },
  { label: '하이볼 1잔',   emoji: '🥂', abvPercent: 8.0,  volumeMl: 300, isCustom: false },
];

/** 프리셋 목록 로드 (없으면 빈 배열) */
export async function loadPresets(): Promise<DrinkPreset[]> {
  try {
    const json = await AsyncStorage.getItem(PRESETS_KEY);
    if (!json) return [];
    const list = JSON.parse(json) as DrinkPreset[];
    return list;
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
 * 첫 실행 시 기본 프리셋 시드.
 * 이미 시드됐으면 현재 목록을 그대로 반환.
 *
 * 마이그레이션 정책:
 * - 기존 커스텀 프리셋이 있으면 [기본 8종 + 기존 커스텀] 순으로 병합.
 * - 기존 데이터가 없으면 기본 8종으로 초기화.
 * - 시드 여부는 presets_seeded_v1 플래그로 관리.
 */
export async function seedIfNeeded(): Promise<DrinkPreset[]> {
  const alreadySeeded = await AsyncStorage.getItem(SEED_KEY);
  if (alreadySeeded === 'true') return loadPresets();

  const existing = await loadPresets();
  const merged = [...DEFAULT_PRESETS, ...existing];
  await savePresets(merged);
  await AsyncStorage.setItem(SEED_KEY, 'true');
  return merged;
}

/**
 * 기본 프리셋 복원: 라벨이 같은 항목이 이미 있으면 중복 추가하지 않는다.
 * 누락된 기본 프리셋만 목록 앞에 삽입하고, 사용자 프리셋은 유지한다.
 */
export async function restoreDefaults(): Promise<DrinkPreset[]> {
  const current = await loadPresets();
  const existingLabels = new Set(current.map(p => p.label));
  const missing = DEFAULT_PRESETS.filter(p => !existingLabels.has(p.label));
  if (missing.length === 0) return current;
  const restored = [...missing, ...current];
  await savePresets(restored);
  return restored;
}

/** 저장된 목록 초기화 */
export async function clearPresets(): Promise<void> {
  await AsyncStorage.multiRemove([PRESETS_KEY, SEED_KEY]);
}
