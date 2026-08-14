import { create } from 'zustand';
import { UserProfile } from '../core/types';
import * as profileStorage from '../storage/profileStorage';

interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  /** DB 에서 프로필 로드 */
  load: () => Promise<void>;
  /** 프로필 저장 및 상태 갱신 */
  save: (profile: UserProfile) => Promise<void>;
  /** 저장된 프로필 삭제 */
  clear: () => Promise<void>;
}

export const profileStore = create<ProfileState>((set) => ({
  profile: null,
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const profile = await profileStorage.loadProfile();
      set({ profile, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  save: async (profile: UserProfile) => {
    await profileStorage.saveProfile(profile);
    set({ profile });
  },

  clear: async () => {
    await profileStorage.clearProfile();
    set({ profile: null });
  },
}));
