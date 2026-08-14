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

/** 저장된 프로필 삭제 */
export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}
