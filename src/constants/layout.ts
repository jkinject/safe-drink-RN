import { Font, IconSize, Space } from './tokens';

/** 탭바 콘텐츠(아이콘+라벨) 높이 — (tabs)/_layout 이 탭바 높이를 여기에 맞춘다 */
export const TAB_CONTENT_HEIGHT = IconSize.lg + Space.xxs + Font.micro + 4;

/**
 * 하단 안전영역을 뺀 탭바 높이(65).
 * 탭바가 absolute 라 탭 화면들은 스크롤 끝 여백과 FAB 위치를 이 값으로 계산한다.
 * 실제 여백 = TAB_BAR_HEIGHT + insets.bottom + 광고 배너 높이.
 */
export const TAB_BAR_HEIGHT = TAB_CONTENT_HEIGHT + Space.md * 2;
