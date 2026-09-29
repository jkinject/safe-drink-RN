# App Store 등록정보 (iOS 첫 출시, 1.2.2)

Play 등록정보(`play-listing.md`, `play-listing-en.md`)를 iOS 사정에 맞춰 옮긴 것.
차이점: **광고·인앱결제 없음**(첫 iOS 출시는 광고 없이 — 문구에 광고 언급 금지), 알림창 카운트다운 대신
**잠금화면·다이내믹 아일랜드 Live Activity**. 기능이 바뀌면 세 파일을 같이 고친다.

App Store Connect 계정: EPSOFT(이피소프트) 법인, 판매자 표시 이름 "이피소프트"(첫 앱 생성 때 확정, 변경 불가). 번들 ID `com.safedrink.app`.

---

## 기본 정보

| 항목 | 값 |
|---|---|
| 기본 언어 | **영어(U.S.)** — 한국어는 현지화로 추가 (사용자 결정 2026-09-17) |
| 카테고리 | 기본: 라이프스타일 / 보조: 없음 (건강·피트니스는 의료 앱 심사 기준이 붙으므로 피한다) |
| 가격 | 무료 |
| 개인정보처리방침 URL | https://jkinject.github.io/safe-drink-RN/privacy-policy.html |
| 지원 URL | https://jkinject.github.io/safe-drink-RN/ |
| 마케팅 URL | (비움) |
| 저작권 | 2026 EPSOFT |
| 연령 등급 | 아래 설문 참조 (주류 언급 → 17+/18+ 급으로 나옴) |
| 앱 개인정보 (App Privacy) | 1.2.2 기준(계정 없음): **데이터를 수집하지 않음** — 광고 SDK 를 초기화하지 않고, 서버·계정·분석 없음. 유일한 외부 통신은 EAS Update(u.expo.dev) 번들 확인이며 사용자 데이터 없음. **1.3.0 부터는 선택적 백업 로그인이 생겨 이 답변이 바뀐다 — 아래 "App Privacy 체크리스트 (1.3.0)" 참고** |
| 수출 규정 | 표준 암호화만 사용 (`ITSAppUsesNonExemptEncryption=false`, app.json 에 넣음) |

---

## 한국어 (ko)

### 이름 (30자)
```
Safedrink — 술 깨는 시간 계산
```
(19자. Play 제목 "Safedrink — 술 깨는 시간·혈중알코올농도 계산"은 30자 초과라 검색어는 부제·키워드로 뺐다)

### 부제 (30자)
```
혈중알코올농도 타이머, 잠금화면 카운트다운
```
(24자)

### 홍보 문구 (170자, 심사 없이 수정 가능)
```
마신 술을 한 잔씩 기록하면 내 몸에 맞춘 혈중알코올농도와 완전히 깨는 시각을 계산해 잠금화면과 다이내믹 아일랜드에서 카운트다운해 드려요. 회원가입 없음, 기록은 기기 안에만.
```

### 키워드 (100자, 쉼표 구분, 이름·부제에 있는 단어는 중복 불필요)
```
음주,숙취,알코올,소주,맥주,회식,대리운전,음주측정,위드마크,분해시간,운전,술자리,주량,취함,알콜
```
(공백 없이 쉼표만. 100자 이내 확인 필요 — 위 문자열은 약 60자)

### 설명 (4000자)
```
술자리가 끝나고 "언제쯤 깰까?" 궁금하셨다면 Safedrink를 써보세요.

마신 술을 기록하면 혈중알코올농도와 완전히 깨는 예상 시각을 계산해 남은 시간을 카운트다운으로 보여주는 음주 타이머입니다. 혈중알코올농도 계산기이자 술 깨는 시간 알림 앱이에요.

■ 내 몸에 맞춘 계산
키·몸무게·성별·출생연도를 바탕으로 Watson 총체수분량 공식을 적용해 개인별 체수분량을 반영합니다. 같은 술을 마셔도 사람마다 결과가 다릅니다. 성별 상수만 쓰는 표준 Widmark 방식 결과도 함께 보여드려 두 값을 비교할 수 있습니다.

■ 잔 단위로 기록
맥주·소주·와인·양주·막걸리·하이볼 등 자주 마시는 술은 한 번의 탭으로 추가됩니다. 도수·용량·아이콘을 지정해 나만의 술로 저장해 두세요. "마시는 중"과 "다 마심"을 구분해 기록하므로 아직 비우지 않은 잔은 계산에서 빠집니다.

■ 마시기 전에 미리 확인
기록을 추가하기 전에 "이 술을 마시면 몇 분이 늘어나는지" 미리 보여드립니다. 용량을 바꿔가며 오늘의 음주 계획을 세워보세요.

■ 시간에 따른 그래프
잔을 비울 때마다 농도가 올라갔다가 서서히 내려가는 곡선을 그려드립니다. 면허 정지(0.03%)·면허 취소(0.08%) 기준선을 함께 표시해 지금 내 상태가 어디쯤인지 한눈에 볼 수 있습니다.

■ 앱을 켜지 않아도
잠금화면과 다이내믹 아일랜드에 남은 시간이 1초씩 줄어드는 카운트다운이 표시됩니다(iOS 16.2 이상). 다 깨는 시각이 되면 "이제 안전해요" 알림이 도착합니다. 설정에서 끌 수 있습니다.

■ 지난 술자리 다시 보기
술이 깨면 그날의 기록이 자동으로 정리되어 보관됩니다. 몇 시부터 몇 시까지 마셨는지, 몇 시에 깼는지, 총 알코올 섭취량과 최고 혈중알코올농도를 그래프와 함께 다시 볼 수 있고, 카드 이미지로 공유할 수 있습니다.

■ 개인정보를 수집하지 않습니다
회원가입이 없습니다. 입력하신 신체 정보와 음주 기록은 기기 안에만 저장되며 서버로 전송되지 않습니다. 원하신다면 설정에서 Google 또는 Apple 계정으로 로그인해 기록을 백업하고 다른 기기에서 복원할 수 있습니다(완전히 선택 사항입니다).

무료이며 광고가 없습니다. 한국어와 영어를 지원합니다.


[ 반드시 읽어주세요 ]

Safedrink가 보여주는 수치는 공개된 계산식에 기반한 참고용 추정치입니다. 실제 혈중알코올농도는 개인의 체질, 음식 섭취 여부, 건강 상태, 복용 중인 약물, 음주 속도 등에 따라 크게 달라집니다.

이 앱은 의료기기가 아니며, 음주운전 가능 여부를 판단하는 근거로 사용할 수 없습니다. 앱이 "깼다"고 표시하더라도 실제로는 알코올이 남아 있을 수 있습니다.

술을 마셨다면 운전하지 마십시오.
```

### 새로운 기능 (첫 버전)
```
첫 출시입니다. 마신 술을 기록하면 내 몸에 맞춘 혈중알코올농도와 술 깨는 시각을 계산하고, 잠금화면·다이내믹 아일랜드에서 카운트다운합니다.
```

---

## English (en-US)

### Name (30)
```
Safedrink — Sober Up Timer
```
(26)

### Subtitle (30)
```
BAC countdown on your Lock Screen
```
(31 — 초과. 대안: `BAC timer on your Lock Screen` = 29)
```
BAC timer on your Lock Screen
```

### Promotional text (170)
```
Log each drink and Safedrink estimates your BAC and counts down to sober — on your Lock Screen and in the Dynamic Island. No account, nothing leaves your phone.
```

### Keywords (100)
```
alcohol,drinks,hangover,drunk,sobriety,widmark,blood alcohol,drink tracker,beer,wine,soju,dui,drive
```

### Description (4000)
```
Wondering when you'll be sober after a night out? Safedrink tells you.

Log what you drink and Safedrink estimates your blood alcohol concentration (BAC) and the time it will reach zero, then counts it down for you.

■ Tuned to your body
Uses your height, weight, sex and birth year with the Watson total-body-water formula, so the same drinks give different results for different people. A standard Widmark estimate is shown side by side for comparison.

■ Log by the glass
Beer, wine, whisky, vodka, cocktails and highballs are one tap away. Save your own drinks with custom strength, volume and icon. Mark a drink as "still drinking" and it stays out of the calculation until you finish it.

■ Check before you drink
Before adding a drink, see how much longer it would keep you from sobering up. Try different sizes and plan your evening.

■ Your BAC over time
A graph shows each drink pushing your BAC up and the slow decline afterwards, with reference lines at 0.03% and 0.08%.

■ Works with the app closed
The remaining time counts down on your Lock Screen and in the Dynamic Island as a Live Activity (iOS 16.2 or later), and a "You're sober now" alert arrives when it reaches zero. You can turn this off in Settings.

■ Look back on past nights
When you sober up, the session is saved automatically: start and end time, total alcohol, peak BAC and the graph — and you can share it as a card image.

■ Private by design
No account, no sign-up. Your body data and drink history stay on your device and are never uploaded. If you'd like, you can sign in with Google or Apple in Settings to back up your data and restore it on another device — this is entirely optional.

Safedrink is free, with no ads. Available in English and Korean.


[ Please read ]

The numbers Safedrink shows are estimates based on published formulas. Real BAC varies widely with metabolism, food, health, medication and how fast you drink.

This app is not a medical device and must not be used to decide whether you can drive. Even when the app says you are sober, alcohol may remain in your body.

If you have been drinking, do not drive.
```

### What's New
```
First release. Log your drinks, get a BAC estimate tuned to your body, and watch the countdown to sober on your Lock Screen and in the Dynamic Island.
```

---

## 심사 노트 (App Review Information → Notes)

계정 없음 → 데모 계정 불필요. 연락처는 개발자 이메일.

```
Safedrink estimates blood alcohol concentration from drinks the user logs and counts down to the time it is expected to reach zero.

Important context for review:
- It is a reference/educational estimate based on published formulas (Widmark with Watson total-body-water). It is NOT a medical device and does NOT tell users whether they may drive. A disclaimer banner ("This app is for reference only and is not a legal or medical standard") is always visible at the top of every main screen, and the onboarding, info screen and store description repeat that users must not drive after drinking.
- The "You're safe now" notification means the estimated BAC has reached zero; the info screen explains this is not a driving authorization.
- The app does not encourage drinking. Its purpose is to help users understand how long alcohol stays in the body and plan a safe way home.
- No account, no server, no analytics, no ads. All data stays on the device.
- Live Activity (iOS 16.2+) shows the countdown on the Lock Screen / Dynamic Island. Notification permission is requested when the first drink is finished.

How to test: complete onboarding (any height/weight/sex), tap + to add a drink (e.g. "Beer 500ml"), tap "Finished" on the record. The timer starts and a Live Activity appears when you lock the screen.
```

## 연령 등급 설문 (Apple, 2025 개정판)

정직하게. 결과는 주류 항목 때문에 성인 등급(17+ 구 체계 / 18+ 신 체계)으로 나올 수 있다 — Play 의 16세 이상과 같은 맥락.

| 문항 | 답 |
|---|---|
| 술·담배·약물 사용 또는 언급 | **빈번/강함** (앱의 핵심이 음주 기록. 캐릭터가 술을 마시는 그림) |
| 의료/치료 정보 | 없음 (참고용 추정치, 진단 아님) |
| 폭력·성적 내용·욕설·공포·도박 | 없음 |
| 무제한 웹 접근 | 없음 |
| 사용자 생성 콘텐츠·소셜 | 없음 |
| 경쟁/도박 시뮬레이션 | 없음 |

## App Privacy 체크리스트 (1.3.0, 백업 로그인 켤 때)

1.2.2 는 "데이터를 수집하지 않음"으로 답했지만, 1.3.0 부터 설정 → 백업에서 선택적 Google/Apple
로그인을 켜면 App Store Connect → 앱 개인정보(App Privacy) 설문을 아래와 같이 갱신해야 한다.
백업을 쓰지 않는 사용자에게는 아무 것도 수집되지 않지만, Apple 설문은 "가능성이 있으면" 기준으로
답해야 하므로 백업 기능이 존재하는 이상 수집함으로 신고한다.

| 데이터 유형 (Apple 카테고리) | 구체적 항목 | 수집 목적 | 사용자에게 연결됨 | 추적(Tracking)에 사용 |
|---|---|---|---|---|
| Contact Info → Email Address | 연동한 Google/Apple 계정 이메일(Apple 은 릴레이 주소일 수 있음) | 앱 기능(백업 계정 식별) | 예 | 아니요 |
| Identifiers → User ID | Google `sub` 또는 `apple:` 접두사가 붙은 Apple 사용자 식별자 | 앱 기능(백업 계정 식별) | 예 | 아니요 |
| Health & Fitness → Health | 프로필(키·몸무게·성별·출생연도) — BAC 계산용 입력값을 백업 스냅샷에 포함 | 앱 기능(백업·복원) | 예 | 아니요 |
| User Content → Other User Content | 음주 기록·술자리 요약, 커스텀 프리셋, 언어·알림 설정 | 앱 기능(백업·복원) | 예 | 아니요 |

- 모든 항목 "Used for Tracking" 은 아니요, "Third-Party Advertising"·"Analytics" 목적 없음.
- 세션 토큰(Apple 로그인, 180일)은 Apple 설문의 별도 데이터 유형이 아니라 위 User ID/인증 흐름의
  일부로 취급한다(토큰 자체는 개인 식별 정보를 담지 않음).
- Android 광고(AdMob)는 iOS 에는 적용되지 않으므로(iOS 는 광고 없음, `docs/ADMOB.md` 참고) 이
  설문에 포함하지 않는다.
- 설문 갱신 후 `docs/privacy-policy.html` 3절과 내용이 일치하는지 다시 확인할 것.

## 제출 순서

1. `eas build --platform ios --profile production` (Apple ID 로그인·2FA 는 사용자가 직접) — 번들 ID 등록·인증서·프로비저닝을 EAS 가 만든다.
2. App Store Connect 에 앱 레코드 생성(이름 Safedrink, 기본 언어 영어(U.S.), 번들 ID, SKU `safedrink-ios`) — aside. — **완료 2026-09-17: Apple ID 6813104713**, https://appstoreconnect.apple.com/apps/6813104713/distribution
3. 등록정보 입력(en 기본 → ko 현지화), 스크린샷 6.9인치 업로드, 앱 개인정보 "수집 안 함", 연령 등급, 심사 노트 — **aside 완료 2026-09-17.**
   - 연령 등급 결과: **18+**(173개국), **대한민국 19+**, iOS 26 이전 OS 17+. 라이프스타일 카테고리 + 주류로 리비아·모로코·몰디브·사우디·UAE 등 일부 국가는 판매 불가(Apple 정책).
   - 6.9인치 스크린샷은 버전 페이지가 아니라 **미디어 관리**에서 올린다(일괄 업로드는 순서가 섞여 한 장씩). 6.5인치 슬롯은 6.9 를 그대로 쓴다.
   - **iPad 13인치(2064×2752) 스크린샷은 1.3.0 부터 필수**(supportsTablet). 원본은 iPad Pro 13-inch 시뮬레이터에서 `xcrun simctl io <udid> screenshot` 으로 `store/raw/ios/ipad13/`(ko 5장: 01·02·03·04·06, Live Activity 는 iPad 에 없어 05 없음) → `python3 store/compose_screenshots_ios.py ko ipad13` → `store/screenshots/ios/ipad13/`. 영어 현지화에는 iPad 스크린샷을 따로 올리지 않는다(없으면 기본 언어 것이 보인다).
   - 06 설정 스크린샷은 1.3.0 백업 섹션(Apple/Google 버튼)이 보이는 것으로 교체했고 캡션도 "회원가입 없이 사용, 백업은 원할 때만" 으로 바꿨다. Apple 버튼 문구는 **시뮬레이터 시스템 언어**를 따르므로 ko 캡처 전에 `simctl spawn <udid> defaults write .GlobalPreferences AppleLanguages -array ko` 후 재부팅.
   - 심사 연락처 전화번호가 필수라 Apple 개발자 계정의 회사 번호(+82 2 6951 5406)를 넣었다 — 바꾸려면 앱 심사 정보에서 수정.
   - 개인정보처리방침 URL 은 앱 정보가 아니라 "앱이 수집하는 개인정보" 섹션에 있다(EN·KO 둘 다 설정).
   - 가격 무료·175개국. Mac(Apple Silicon)·Vision Pro 사용 가능 체크는 해제(iPhone 전용, Live Activity 의존).
4. `eas submit --platform ios --latest` 로 빌드 업로드 → 처리 완료(10~30분) 후 빌드 선택 → 심사 제출 — aside.

## 제출 이력

| 날짜 | 버전 | 내용 |
|---|---|---|
| 2026-09-18 | 1.2.2 (build 2) | **첫 iOS 심사 제출.** EAS 빌드 `745f5fa4`, 제출 `23813ecb`. 규제 대상 의료기기 신고 "아니요", 출시 방식 **자동**(승인 즉시 공개). 상태: 심사 대기 중. 심사 최대 48시간, 결과는 jkinject@gmail.com 으로. |

### 다음 빌드를 올릴 때
- 심사 대기 중에는 **새 빌드를 붙이려면 심사에서 버전을 먼저 제거**해야 한다(ASC 안내문).
- `app.json` version 을 올리면 runtimeVersion(=appVersion)도 바뀌어 OTA 채널이 분리된다. iOS·Android 둘 다 새 바이너리가 필요해지므로, JS 만 고칠 때는 version 을 유지하고 OTA 로 내보낸다.
- eas-cli 는 **24.7.0 이상**을 쓸 것 — 24.0.0 은 Apple 로그인이 "iTunes service key is empty" 로 실패한다.
