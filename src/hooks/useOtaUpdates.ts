import { useEffect } from 'react';
import * as Updates from 'expo-updates';

/**
 * 앱 시작 시 OTA 업데이트를 확인하고, 있으면 받아서 즉시 적용한다.
 * (네이티브 ON_LOAD 체크와 별개로, 받은 업데이트를 다음 실행까지
 * 기다리지 않고 바로 reload 하기 위한 훅)
 *
 * 개발 모드(__DEV__)와 Expo Go에서는 동작하지 않는다.
 */
export function useOtaUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // 네트워크 오류 등은 무시 — 다음 실행 시 재시도
      }
    })();
  }, []);
}
