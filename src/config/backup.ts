/**
 * Google 계정 연동 백업 설정.
 *
 * 두 값 모두 빌드 시 `EXPO_PUBLIC_*` 환경변수로 번들에 들어간다(`.env.example` 참고).
 * 웹 클라이언트 ID 는 공개값이라 번들에 있어도 되지만, 계정별로 다르고 아직 발급 전이라
 * 코드에 박지 않고 환경변수로 받는다. 서버 비밀값은 여기에 두지 않는다(Worker 쪽 secret).
 *
 * 발급 절차는 `docs/BACKUP.md` "Google Cloud OAuth 설정".
 */
import { Platform } from 'react-native';

/** 백업 Worker 주소(`https://….workers.dev`, 끝 슬래시 없이). */
export const BACKUP_API_URL = process.env.EXPO_PUBLIC_BACKUP_API_URL ?? '';

/**
 * Google Cloud 의 **웹 애플리케이션** OAuth 클라이언트 ID(`….apps.googleusercontent.com`).
 * Android 클라이언트 ID 가 아니다 — 이 값이 ID 토큰의 `aud` 가 되고, Worker 는 같은 값으로 검증한다.
 */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

/**
 * 두 값이 모두 있고 Android 일 때만 백업 UI·SDK 초기화를 켠다. 아니면 앱은 1.2.x 와 동일하게 동작.
 *
 * iOS 는 아직 끈다 — app.json 에 google-signin 플러그인의 iosUrlScheme 도, iosClientId 도 없어서
 * configure 가 reject 되고, App Store 심사 4.8(Google 로그인을 넣으면 Sign in with Apple 동등
 * 옵션 필요)과 2.1 회신("계정 기능 없음")과도 어긋난다. iOS 에 붙일 때 세 가지를 같이 푼다.
 */
export const BACKUP_SUPPORTED =
  Platform.OS === 'android' && BACKUP_API_URL !== '' && GOOGLE_WEB_CLIENT_ID !== '';
