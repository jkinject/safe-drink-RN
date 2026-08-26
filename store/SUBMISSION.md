# Play 제출 절차 메모

제출 당일에 이 파일만 보고 진행할 수 있도록 정리한 것.
정책 세부(테스터 인원·일수, targetSdk 하한 등)는 수시로 바뀌므로 **제출 시점에 Play Console 안내를 한 번 더 확인할 것.**

---

## 준비물 위치

| 자료 | 경로 / 값 |
|---|---|
| AAB | EAS production 빌드 산출물 (`eas build:list`) |
| 스토어 아이콘 512×512 | `store/graphics/play-icon-512.png` |
| 그래픽 이미지 1024×500 | `store/graphics/feature-graphic-1024x500.png` |
| 스크린샷 (6장, 1080×1920) | `store/screenshots/` |
| 등록정보 문구 | `store/play-listing.md` |
| 개인정보처리방침 | https://jkinject.github.io/safe-drink-RN/privacy-policy.html |
| 소스 | `docs/privacy-policy.html` |

---

## 빌드 → 업로드

```bash
# AAB 생성 (자격증명은 EAS 가 관리, 최초 1회 자동 생성됨)
npx eas-cli build --platform android --profile production

# 상태·다운로드 URL 확인
npx eas-cli build:list --platform android --limit 1
```

**업로드 전 반드시 확인할 것 — 로컬에서 한 번 놓친 적 있음:**

```bash
# 1) 알림 카운트다운 네이티브 패치가 클라우드 빌드에도 들어갔는가
unzip -o -q <다운로드한.aab> 'base/dex/*.dex' -d /tmp/aabchk
strings -a /tmp/aabchk/base/dex/*.dex | grep -c 'chronometerAtMs'   # 1 이상이어야 함
strings -a /tmp/aabchk/base/dex/*.dex | grep -c 'setTimeoutAfter'   # 1 이상이어야 함

# 2) 금지 권한이 빠졌는가
# (AAB 는 aapt2 dump 가 안 되므로 base/manifest/AndroidManifest.xml 을 확인)
unzip -o -q <다운로드한.aab> 'base/manifest/AndroidManifest.xml' -d /tmp/aabchk
strings -a /tmp/aabchk/base/manifest/AndroidManifest.xml | grep -E 'SYSTEM_ALERT_WINDOW|USE_EXACT_ALARM'
#   → 아무것도 안 나와야 함

# 3) OTA 채널이 production 인가 (preview 가 나오면 실사용자에게 테스트 번들이 나간다)
strings -a /tmp/aabchk/base/manifest/AndroidManifest.xml | grep -o 'expo-channel-name[^"]*'
```

`eas submit` 으로 바로 올릴 수도 있다:
```bash
npx eas-cli submit --platform android --latest
```
(최초 1회는 Google Play 서비스 계정 키 등록이 필요하다.)

---

## Play Console 입력 순서

1. **앱 만들기** — 이름 `Safedrink — 술 깨는 시간 계산`, 언어 한국어, 앱/무료
2. **스토어 등록정보** — `store/play-listing.md` 의 문구·에셋 그대로
3. **개인정보처리방침 URL** 입력
4. **앱 콘텐츠**
   - 개인정보처리방침 ✔
   - 광고: **없음**
   - 앱 액세스 권한: 로그인 없음 → **모든 기능 제한 없이 사용 가능**
   - 콘텐츠 등급 설문 → `store/play-listing.md` 의 답안 참고 (주류 언급 "예")
   - 타겟층: **성인 (18세 이상)**
   - 데이터 안전: **수집·공유 안 함** (근거는 listing 문서에)
   - 정부 앱 / 금융 / 건강 앱 선언: **해당 없음**
5. **프로덕션 → 새 버전 만들기** → AAB 업로드 → 출시 노트 작성
6. 검토 후 제출

---

## 일정 리스크

Play 개발자 계정이 **개인(individual) 계정이고 2023-11-13 이후 생성**이라면,
프로덕션 출시 전에 **테스터 12명이 14일 연속 비공개 테스트**에 참여해야 한다.
코드와 무관하게 최소 2주가 걸리므로 계정 유형을 먼저 확인할 것.
법인(organization) 계정이면 해당 없음.

---

## 첫 제출 전 남은 일

- [ ] **스크린샷 04(히스토리) 재촬영** — 현재 테스트 기록(1%·1ml)이라 그래프가 평평하고 0.0g 으로 보인다.
      폴드7 히스토리에 하이볼(14:48)+와인(15:49) 2잔 세션이 닫혀 있으니 그걸로 다시 찍을 것.
- [ ] 권한 제거 후 실기기에서 알림 동작 확인 (`SCHEDULE_EXACT_ALARM` 거부 상태에서 두 알림이 다 뜨는지)
- [ ] AAB 검증 3종 (위 명령)
- [ ] 계정 유형 확인 → 비공개 테스트 필요 여부 결정

---

## 출시 후 운영

- OTA 채널이 **production** 으로 분리된다. 지금까지 쓰던 `--channel preview` 는
  내부 테스트용이며, 실사용자 대상 배포는 `--channel production` 을 쓴다.
- 네이티브를 건드리면 `app.json` 의 `version` 을 올리고 **새 AAB 를 올려야** 한다.
  OTA 는 JS/에셋만 전달하며, runtimeVersion 이 다르면 아예 전달되지 않는다.
