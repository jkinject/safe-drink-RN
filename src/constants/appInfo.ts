/**
 * 앱 빌드 식별 정보 — 설정 화면 하단 표시용.
 *
 * 이 앱은 OTA 로 JS 만 갈아끼우는 구조라, 같은 앱 버전(1.1.1)이라도
 * 기기마다 다른 번들이 돌 수 있다. 그래서 앱 버전만으로는 "어떤 빌드에서
 * 난 문제인지" 특정할 수 없어 업데이트 ID 를 함께 보여준다.
 */
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/** 예: "Safedrink 1.1.1" */
export const appVersionLabel = `${
  Constants.expoConfig?.name ?? 'Safedrink'
} ${Constants.expoConfig?.version ?? '-'}`;

/**
 * 예: "업데이트 01a03cf9 · 2026-08-27"
 *
 * 개발 모드이거나 아직 OTA 를 한 번도 받지 않았으면 updateId 가 없다 —
 * 그 경우 빈 문자열이라 설정 화면에서 줄 자체가 그려지지 않는다.
 */
export const updateLabel = (() => {
  if (!Updates.updateId) return '';
  const short = Updates.updateId.replace(/-/g, '').slice(0, 8);
  const created = Updates.createdAt;
  if (!created) return `Update ${short}`;
  const yyyy = created.getFullYear();
  const mm = String(created.getMonth() + 1).padStart(2, '0');
  const dd = String(created.getDate()).padStart(2, '0');
  return `Update ${short} · ${yyyy}-${mm}-${dd}`;
})();
