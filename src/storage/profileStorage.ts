import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../core/types';

const PROFILE_KEY = 'user_profile';

/** UserProfile 저장 */
export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/** UserProfile 로드. 저장된 값 없으면 null. */
export async function loadProfile(): Promise<UserProfile | null> {
  try {
    const json = await AsyncStorage.getItem(PROFILE_KEY);
    if (!json) return null;
    return JSON.parse(json) as UserProfile;
  } catch {
    return null;
  }
}

/**
 * 백업 복원용 — 이 값을 저장했을 때의 [키, 저장 문자열]. null 이면 키를 지운다는 뜻.
 * 복원은 여러 키를 multiSet/multiRemove 로 묶어 쓰므로 키·직렬화 형식을 여기서 한 번만 정한다.
 */
export function profileEntry(profile: UserProfile | null): [string, string | null] {
  return [PROFILE_KEY, profile ? JSON.stringify(profile) : null];
}

/** 저장된 프로필 삭제 */
export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}
