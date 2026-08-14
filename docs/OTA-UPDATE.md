# OTA 업데이트 (EAS Update) 가이드

Safedrink RN은 **EAS Update**로 한 번 설치된 앱에 JS 번들·에셋을 지속 배포(OTA)합니다.
(참고: Microsoft CodePush/AppCenter는 2025년 서비스 종료 — EAS Update가 현재 표준입니다.)

## 동작 방식

- 네이티브 바이너리(APK/IPA)에는 `runtimeVersion`(현재 정책: `appVersion` = app.json의 `version`)이 새겨집니다.
- `eas update`로 게시한 JS 번들은 **같은 runtimeVersion + 같은 채널**의 설치된 앱에 자동 전달됩니다.
- 앱은 실행 시(`checkAutomatically: ON_LOAD`) 업데이트를 확인하고, 다음 실행부터 적용됩니다.
- 네이티브 모듈 추가/변경 시에는 OTA가 불가하며 `version`을 올리고 새 빌드를 배포해야 합니다.

## 최초 1회 설정 (Expo 계정 필요)

```bash
npm i -g eas-cli          # 또는 npx eas-cli 사용
eas login                 # Expo 계정 로그인
eas init                  # 프로젝트 생성 → app.json에 projectId 주입
eas update:configure      # app.json에 updates.url 주입
```

## 빌드 (채널이 바이너리에 각인됨)

```bash
eas build --profile preview --platform android    # 내부 배포용 APK (channel: preview)
eas build --profile production --platform all     # 스토어용 (channel: production)
```

## OTA 배포 (일상 워크플로우)

```bash
# JS/에셋 변경 후:
eas update --channel preview --message "기록 화면 문구 수정"

# 검증 후 프로덕션으로:
eas update --channel production --message "v1.0.1 핫픽스"
```

## 채널 전략

| 채널 | 용도 |
|------|------|
| development | 개발 클라이언트 |
| preview | 내부 테스트 기기 (APK 직접 설치) |
| production | 스토어 배포 사용자 |

## 롤백

```bash
eas update:republish --channel production   # 이전 게시본 재배포 (대화형 선택)
```
