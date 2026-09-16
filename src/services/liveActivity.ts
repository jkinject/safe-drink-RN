/**
 * iOS Live Activity 래핑 — 잠금화면·다이내믹 아일랜드 카운트다운 (iOS 16.2+)
 *
 * Android 의 크로노미터 알림(notifications.showTimerNotification)과 같은 역할이다.
 * 남은 시간을 문자열로 굽지 않고 목표 시각만 넘긴다 — 위젯이
 * ProgressView(timerInterval:) 로 그리므로 앱 프로세스가 죽어도 시스템이
 * 1초씩 직접 깎는다. 제목·부제 문구는 호출자가 i18n 으로 만들어 넘긴다(Android 와 동일 리소스).
 *
 * 한계: iOS 는 Live Activity 를 시작 후 8시간에 강제 종료한다. 완료 알림
 * (scheduleSoberNotification)은 별도 로컬 알림이라 영향이 없고, 앱을 다시 열면
 * rescheduleNotification 이 남은 시간으로 다시 시작한다.
 *
 * 활성 ID 는 AsyncStorage 에 보관한다 — 앱 재시작 후 이전 활동을 찾아 끝내야
 * 잠금화면에 카운트다운이 두 개 뜨지 않는다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LiveActivity from 'expo-live-activity';
import { Platform } from 'react-native';

const ACTIVITY_ID_KEY = 'live_activity_id';

export interface CountdownText {
  title: string;
  subtitle: string;
  /** 잠금화면 카드에 그릴 캐릭터 — 프로필 성별. 없으면 남성 캐릭터 */
  character?: 'male' | 'female';
}

/**
 * 잠금화면 카드 색 — AppColors 와 같은 값 (services 는 UI 상수를 끌어오지 않는다).
 * background #EEEDF8 / textPrimary #2D2B52 / textSecondary #9E9AC8 / accent #6C63E0
 */
const CONFIG: LiveActivity.LiveActivityConfig = {
  backgroundColor: '#EEEDF8',
  titleColor: '#2D2B52',
  // 부제("19:06 예정")는 액센트 캡슐 안에 들어가므로 액센트색으로
  subtitleColor: '#6C63E0',
  progressViewTint: '#6C63E0',
  progressViewLabelColor: '#2D2B52',
  // 다이내믹 아일랜드 축소 상태에서도 숫자 카운트다운으로 (원형 게이지 대신)
  timerType: 'digital',
  padding: { horizontal: 20, vertical: 16 },
  // 탭하면 앱 홈으로 — scheme 은 app.json 의 값을 플러그인이 붙인다
  deepLinkUrl: '/',
};

export function isSupported(): boolean {
  if (Platform.OS !== 'ios') return false;
  const major = parseInt(String(Platform.Version).split('.')[0] ?? '0', 10);
  return major >= 16;
}

/**
 * 카운트다운 Live Activity 시작 — 이미 떠 있으면 먼저 끝내고 새로 띄운다.
 * (같은 목표 시각이라도 갱신 대신 재시작한다: 8시간 제한이 시작 시각 기준이라
 * 앱을 다시 열 때마다 8시간을 새로 얻는 편이 낫다.)
 */
export async function startCountdown(
  soberAtMs: number,
  { title, subtitle, character }: CountdownText,
): Promise<void> {
  if (!isSupported()) return;
  await endCountdown();
  try {
    const id = LiveActivity.startActivity(
      {
        title,
        subtitle,
        progressBar: { date: soberAtMs },
        // assets/liveActivity/ 의 파일명(확장자 제외) — 플러그인이 위젯 에셋 카탈로그로 복사한다
        imageName: character === 'female' ? 'la_female_dizzy' : 'la_male_dizzy',
        dynamicIslandImageName: 'la_icon',
      },
      CONFIG,
    );
    if (id) await AsyncStorage.setItem(ACTIVITY_ID_KEY, id);
  } catch (e) {
    // 설정에서 Live Activity 를 꺼 둔 경우(LiveActivitiesNotEnabled) 등 — 완료 알림은 그대로 간다
    console.warn('[LiveActivity] 시작 실패:', e);
  }
}

/** 떠 있는 카운트다운을 내린다 — 없거나 이미 시스템이 끝냈으면 조용히 무시 */
export async function endCountdown(): Promise<void> {
  if (!isSupported()) return;
  let id: string | null = null;
  try {
    id = await AsyncStorage.getItem(ACTIVITY_ID_KEY);
  } catch {
    return;
  }
  if (!id) return;
  try {
    // 종료 상태 문구는 위젯이 잠깐 보여줄 수 있어 제목만 유지한다
    LiveActivity.stopActivity(id, { title: '' });
  } catch {
    // ActivityNotFound — 8시간 제한으로 이미 끝났거나 사용자가 지운 경우
  }
  try {
    await AsyncStorage.removeItem(ACTIVITY_ID_KEY);
  } catch {
    // 무시
  }
}
