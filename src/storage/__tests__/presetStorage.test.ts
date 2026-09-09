/**
 * presetStorage 로케일별 기본 프리셋 테스트
 *
 * 목(mock) 전략: AsyncStorage 를 메모리 Map 으로 대체
 * (state/__tests__/sessionStore.test.ts 의 패턴 참고).
 */

const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach(k => mockStore.delete(k));
  }),
}));

import {
  DEFAULT_PRESETS_KO,
  DEFAULT_PRESETS_EN,
  defaultPresets,
  seedIfNeeded,
  restoreDefaults,
  loadPresets,
  savePresets,
  swapDefaultsForLocale,
} from '../presetStorage';

beforeEach(() => {
  mockStore.clear();
});

// ── defaultPresets ───────────────────────────────────────────────────────

describe('defaultPresets', () => {
  test('en 은 소주/막걸리/양주 라벨이 없고 8종, 라벨이 지정한 대로다', () => {
    const en = defaultPresets('en');
    expect(en).toHaveLength(8);
    const labels = en.map(p => p.label);
    expect(labels).not.toContain('소주 1잔');
    expect(labels).not.toContain('소주 1병');
    expect(labels).not.toContain('막걸리 1사발');
    expect(labels).not.toContain('양주 1잔');
    expect(labels).toEqual([
      'Beer 500ml',
      'Beer can 355ml',
      'Wine glass',
      'Whisky shot',
      'Vodka shot',
      'Cocktail',
      'Highball',
      'Champagne glass',
    ]);
    expect(en.every(p => p.isCustom === false)).toBe(true);
  });

  test('ko 는 기존 8종과 동일하다', () => {
    const ko = defaultPresets('ko');
    expect(ko).toEqual(DEFAULT_PRESETS_KO);
    expect(ko[0].label).toBe('맥주 500cc');
  });

  test('en 은 DEFAULT_PRESETS_EN 과 동일하다', () => {
    expect(defaultPresets('en')).toEqual(DEFAULT_PRESETS_EN);
  });
});

// ── seedIfNeeded ──────────────────────────────────────────────────────────

describe('seedIfNeeded', () => {
  test('첫 실행은 en 로케일이면 영어 8종을 심는다', async () => {
    const seeded = await seedIfNeeded('en');
    expect(seeded).toEqual(DEFAULT_PRESETS_EN);
  });

  test('두 번째 호출은 재시드하지 않는다 (이미 en 으로 심어진 상태 유지)', async () => {
    await seedIfNeeded('en');
    // 로케일이 ko 로 바뀌어도 이미 시드됐으면 그대로 반환
    const second = await seedIfNeeded('ko');
    expect(second).toEqual(DEFAULT_PRESETS_EN);
  });
});

// ── restoreDefaults ───────────────────────────────────────────────────────

describe('restoreDefaults', () => {
  test('icon+abv+volume 기준으로 중복을 막는다 — ko 로 시드 후 en 으로 복원', async () => {
    await seedIfNeeded('ko');
    const restored = await restoreDefaults('en');

    // Beer 500ml(beerMug/4.5/500) 은 '맥주 500cc' 와 같은 술 → 추가되지 않음
    const beerMatches = restored.filter(
      p => p.icon === 'beerMug' && p.abvPercent === 4.5 && p.volumeMl === 500,
    );
    expect(beerMatches).toHaveLength(1);
    expect(beerMatches[0].label).toBe('맥주 500cc');

    // Whisky shot(whiskyGlass/40/44) 은 기존 '양주 1잔'(30ml)과 volume 이 달라 새로 추가됨
    const whiskyShot = restored.find(
      p => p.icon === 'whiskyGlass' && p.abvPercent === 40.0 && p.volumeMl === 44,
    );
    expect(whiskyShot).toBeDefined();
    expect(whiskyShot?.label).toBe('Whisky shot');
  });
});

// ── withDefaultIcons (loadPresets 로 확인) ──────────────────────────────────

describe('withDefaultIcons', () => {
  test('영어 기본 라벨의 icon 을 복원한다', async () => {
    // 아이콘 도입 전 저장 형태를 흉내: icon 없이 라벨만 저장
    await savePresets([
      { label: 'Wine glass', abvPercent: 12.0, volumeMl: 150, isCustom: false } as any,
    ]);

    const loaded = await loadPresets();
    expect(loaded[0].icon).toBe('wineGlass');
  });
});

// ── swapDefaultsForLocale ────────────────────────────────────────────────

describe('swapDefaultsForLocale', () => {
  it('한국어 기본 8종 그대로면 영어 8종으로 통째로 바뀐다', async () => {
    await seedIfNeeded('ko');
    const swapped = await swapDefaultsForLocale('ko', 'en');
    expect(swapped?.map(p => p.label)).toEqual(DEFAULT_PRESETS_EN.map(p => p.label));
    expect((await loadPresets()).map(p => p.label)).toEqual(DEFAULT_PRESETS_EN.map(p => p.label));
  });

  it('커스텀 프리셋이 하나라도 있으면 건드리지 않는다', async () => {
    await seedIfNeeded('ko');
    const custom = { label: '내 술', icon: 'cup', abvPercent: 20, volumeMl: 100, isCustom: true };
    await savePresets([...DEFAULT_PRESETS_KO, custom]);
    expect(await swapDefaultsForLocale('ko', 'en')).toBeNull();
    expect((await loadPresets()).length).toBe(9);
  });

  it('기본 프리셋의 라벨을 고쳤어도 건드리지 않는다', async () => {
    await seedIfNeeded('ko');
    const edited = DEFAULT_PRESETS_KO.map((p, i) => (i === 0 ? { ...p, label: '생맥' } : p));
    await savePresets(edited);
    expect(await swapDefaultsForLocale('ko', 'en')).toBeNull();
    expect((await loadPresets())[0].label).toBe('생맥');
  });

  it('같은 로케일이면 아무것도 하지 않는다', async () => {
    await seedIfNeeded('en');
    expect(await swapDefaultsForLocale('en', 'en')).toBeNull();
  });
});
