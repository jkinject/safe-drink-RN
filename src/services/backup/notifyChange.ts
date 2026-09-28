import { BACKUP_SUPPORTED } from '../../config/backup';

/**
 * 데이터 스토어(session/presets/profile/locale/settings)가 저장 성공 직후 부르는 자동 백업 신호.
 *
 * scheduler 는 snapshot 을 거쳐 이 스토어들을 다시 import 하므로, 스토어가 scheduler 를
 * 직접 import 하면 로드 시점 순환이 생긴다. 그래서 호출 시점에 require 한다.
 * 백업이 꺼진 빌드에서는 모듈을 불러오지도 않는다. 백업 쪽 문제로 저장 흐름이 깨지면
 * 안 되므로 예외는 삼킨다.
 */
export function notifyBackupChange(): void {
  if (!BACKUP_SUPPORTED) return;
  try {
    (require('./scheduler') as typeof import('./scheduler')).markDirty();
  } catch (e) {
    console.warn('[Backup] markDirty 실패:', e);
  }
}
