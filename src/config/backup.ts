/**
 * Google 계정 연동 백업 설정.
 *
 * 값은 모두 빌드 시 `EXPO_PUBLIC_*` 환경변수로 번들에 들어간다(`.env.example` 참고).
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
 * Google Cloud 의 **iOS** OAuth 클라이언트 ID(`….apps.googleusercontent.com`). iOS 에서만 쓴다.
 * 이 값의 역순 스킴(`com.googleusercontent.apps.…`)이 app.json google-signin 플러그인의
 * `iosUrlScheme` 이다 — 둘은 같은 클라이언트에서 나와야 한다.
 * ID 토큰의 `aud` 는 여전히 웹 클라이언트 ID 다(configure 에 webClientId 를 같이 넘기므로).
 */
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

/**
 * 백업 UI·SDK 초기화를 켤지. 꺼지면 앱은 1.2.x 와 동일하게 동작.
 *
 * - Android: API 주소 + 웹 클라이언트 ID.
 * - iOS: 위 둘 + iOS 클라이언트 ID. iOS 는 Google 과 Sign in with Apple 을 함께 제공한다
 *   (App Store 심사 4.8 — 제3자 로그인을 넣으면 동등한 Apple 로그인 옵션 필요).
 *   Apple 로그인만으로 켜지 않는 이유: Google 을 뺀 반쪽 구성은 의도한 적이 없는 상태라
 *   설정 누락을 조용히 넘기지 않도록 세 값이 다 있어야 켠다.
 */
export const BACKUP_SUPPORTED =
  BACKUP_API_URL !== '' &&
  GOOGLE_WEB_CLIENT_ID !== '' &&
  (Platform.OS === 'android' || (Platform.OS === 'ios' && GOOGLE_IOS_CLIENT_ID !== ''));
