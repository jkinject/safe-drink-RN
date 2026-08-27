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
| 개인정보처리방침 | https://jkinject.github.io/safe-drink-RN/privacy-policy.html (배포 완료·앱 내 링크 동작 확인) |
| 소스 | `docs/privacy-policy.html` |

---

## 앱 서명 (결정 사항)

**EAS 관리 방식을 쓴다.** 최초 `eas build --non-interactive` 실행 시 키스토어가
없어서 EAS 가 자동 생성했고, Expo 서버에 보관된다. 직접 만든 적이 없다.

| 항목 | 값 |
|---|---|
| 방식 | EAS(Expo 서버) 관리 |
| 생성 시각 | 2026-08-27 00:01 KST (첫 production 빌드) |
| 인증서 만료 | 2054-01-12 |
| 알고리즘 | SHA384withRSA / RSA 2048 |
| SHA-256 지문 | `8A:EA:66:FC:EA:DD:B6:5B:FC:F0:64:21:41:2F:2D:C5:F9:3D:16:3F:06:45:E4:51:46:A5:D3:06:14:35:01:BF` |

이 키는 **업로드 키**다. 실사용자에게 배포되는 APK 는 Google 이 Play App Signing
키로 다시 서명하므로, 업로드 키를 잃어도 앱이 죽지는 않는다(재설정 신청 가능, 며칠 소요).

- [ ] **키스토어 백업받기** — `npx eas-cli credentials --platform android`
      → production → Keystore → Download Keystore.
      `.jks` 파일과 **keystore password / key alias / key password** 를 함께 보관할 것.
      넷을 다 보관해야 의미가 있다. **git 에 커밋 금지.**

> 서명 방식을 바꾸려면 **Play 에 첫 업로드를 하기 전**이어야 한다. 한 번 올리면 그 키에 묶인다.

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

## 계정

**법인(organization) 계정을 쓴다. D-U-N-S 번호 발급 완료.**

→ 개인 계정에 걸리는 **"테스터 12명 × 14일 비공개 테스트" 요건이 적용되지 않는다.**
   준비가 끝나면 바로 프로덕션 트랙으로 제출할 수 있다.

다만 첫 출시라면 **내부 테스트(Internal testing) 트랙에 한 번 올려 릴리스 빌드를
실제로 설치해 보는 것**을 권한다. 릴리스 서명·난독화 상태에서만 드러나는 문제가 있고,
인앱결제를 나중에 붙일 때도 어차피 이 트랙이 필요하다.

---

## 첫 제출 전 남은 일

- [x] 스크린샷 04(히스토리) 재촬영 — 하이볼+와인 2잔 세션으로 교체 완료
- [x] 권한 제거 후 실기기 확인 — Android 16, `SCHEDULE_EXACT_ALARM` 미허용 상태에서
      카운트다운은 목표 시각에 시스템이 취소하고, "이제 안전해요" 는 약 81초 지연 후 도착.
      두 알림 모두 정상, 예외로 죽는 경로 없음.
- [x] AAB 검증 3종 — 알림 네이티브 패치 반영 / 금지 권한 0건 / OTA 채널 production
- [ ] **제출용 AAB 재빌드** — 검증한 빌드는 `708d603` 시점이라 이후 UI 변경
      (이메일·설정 재구성·프로필 분리·정보 섹션)이 빠져 있다. 제출 직전에 다시 뽑을 것.
- [ ] 키스토어 백업 (위 서명 섹션)
- [ ] 계정 유형 확인 → 비공개 테스트 필요 여부 결정

---

## 다음 버전 계획 (1.2.0 — 광고·인앱결제)

1.1.1 을 먼저 출시하고, 그 다음 버전에서 AdMob + "광고 제거" 인앱결제를 붙인다.
둘 다 네이티브 모듈이라 OTA 로 못 보낸다 — `version` 을 올리고 새 AAB 를 배포해야 한다.

착수 전에 반드시 처리할 것:
- **개인정보처리방침 전면 수정.** 현재 문서는 "광고 SDK 없음 / 데이터 수집 없음" 이라고
  명시하고 있어 AdMob 을 넣는 순간 허위 고지가 된다 (앱 삭제 사유).
- **데이터 안전 양식 교체** — 기기 ID·광고 ID 수집, 제3자 공유로.
- **스토어 등록정보** — 광고 포함 "예", 인앱 구매 "예".
- `AD_ID` 권한 선언 (현재 `blockedPermissions` 설정과 함께 검토).
- AdMob 콘솔에서 **알코올 광고 카테고리 차단** — 음주 안전 앱에 술 광고가 붙으면 안 된다.
- EEA/UK 노출 시 **UMP 동의 배너** 필요.
- 인앱결제는 **Play 에 업로드된 빌드에서만 테스트 가능** (내부 테스트 트랙 + 라이선스 테스터).
  로컬 설치로는 검증이 안 되므로 지금까지의 개발 흐름과 다르다.

## 출시 후 운영

- OTA 채널이 **production** 으로 분리된다. 지금까지 쓰던 `--channel preview` 는
  내부 테스트용이며, 실사용자 대상 배포는 `--channel production` 을 쓴다.
- 네이티브를 건드리면 `app.json` 의 `version` 을 올리고 **새 AAB 를 올려야** 한다.
  OTA 는 JS/에셋만 전달하며, runtimeVersion 이 다르면 아예 전달되지 않는다.
