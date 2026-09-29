# App Review 2.1 회신 — Safedrink (iOS 1.0 / build 1.2.2 (2))

> **⚠️ 주의: 이 회신은 심사 중인 1.2.2(계정·로그인 없음) 기준이다.** 1.3.0 부터는 설정 →
> 백업에서 선택적 Google/Apple 로그인(백업 전용)이 생기므로, **1.3.0 을 제출할 때는 아래
> "3. How to set up and access the app's main features", "4. External services, tools, or
> platforms used for core functionality", "6. Regulated industry or protected third-party
> material" 세 항목의 문구를 갱신해야 한다.** 대체 문단 초안은 이 파일 맨 아래
> "1.3.0 용 대체 문단 초안" 절 참고.

Submission ID: `adecf76d-63a2-428d-b509-4525dcee7171`
Apple 메시지: 2026-09-19 09:12 KST — Guideline 2.1 Information Needed (New App Submission)

Apple 요구: Resolution Center 메시지로 회신하고, **동일 내용을 App Store Connect →
앱 심사 정보(App Review Information) → 메모(Notes) 필드에도** 넣을 것.

아래 영문 블록이 그대로 붙여넣을 본문이다. 1번(실기기 화면 녹화)은 별도 준비.

---

## 붙여넣을 영문 본문

> **1. Screen recording**
>
> _(별도 첨부 — 실기기 녹화 준비되면 여기에 링크/첨부 안내를 추가한다)_
>
> **2. Purpose of the app and target audience**
>
> Safedrink is an offline reference timer that estimates how long it takes for a
> user's blood alcohol concentration (BAC) to return to zero after drinking.
>
> The problem it solves: after drinking, people have no reliable way to judge when
> alcohol has actually left their body. They rely on guesses such as "I slept, so
> I must be fine," which is the most common cause of next-morning drunk driving.
>
> The value it provides: the user records what and when they drank, and the app
> shows the estimated current BAC, the time remaining until it reaches zero, and a
> chart of how it declines. A local notification and an iOS Live Activity keep a
> live countdown on the Lock Screen, so the user does not have to keep the app open.
>
> Target audience: adults of legal drinking age who drink socially and want a
> reference point for when it is no longer unsafe or unlawful to drive. The app is
> rated 18+ (19+ in South Korea). It does not sell, promote, or encourage the
> consumption of alcohol; it only helps the user wait long enough afterwards.
>
> Important: the app is explicitly a reference tool, not a medical or legal
> instrument, and not a breathalyzer. A disclaimer stating this is permanently
> displayed on the main screen and repeated in the in-app information screen. The
> app never tells the user that it is safe to drive.
>
> **3. How to set up and access the app's main features**
>
> No account, no login, and no credentials of any kind are required. There are no
> demo accounts or sample files to provide, because the app has no server and no
> user accounts. Every feature is reachable immediately after launch.
>
> - **First launch — Profile Setup (onboarding).** The app asks for sex, height,
>   weight, and birth year. These are used only as inputs to the BAC formula and
>   are stored locally on the device. Any values can be entered to proceed
>   (for example: male, 175 cm, 70 kg, born 1990).
> - **Home tab.** Shows the current estimated BAC, the time remaining until it
>   reaches zero, a character illustration reflecting the current state, a chart of
>   BAC over time, and a status badge based on the legal thresholds.
> - **Adding a drink.** Tap the "+" button on the Home tab. Choose a drink preset
>   (beer, soju, wine, etc.), or enter volume and ABV manually, then set the time.
>   A drink can be marked as still being consumed ("Drinking") or finished. To see
>   a non-zero BAC state immediately, add one drink and set its finish time to a
>   few minutes ago.
> - **Plan tab.** Before drinking, the user enters a target sober time and a drink's
>   ABV, and the app calculates the maximum volume they can drink and still be at
>   zero BAC by that time.
> - **History.** The Home tab links to a list of past drinking sessions, each with
>   its peak BAC and sober time. A session can be shared as a summary card image.
> - **Settings tab.** Profile editing, language (English / Korean), notification
>   settings, the information screen, open source licenses, and the privacy policy.
> - **Notifications and Live Activity.** When a drink is recorded, the app schedules
>   a local notification for the moment BAC reaches zero and starts a Live Activity
>   showing a countdown on the Lock Screen and Dynamic Island. Both are local to the
>   device; no push server is involved. Permission is requested at first use.
>
> **4. External services, tools, or platforms used for core functionality**
>
> **None.** All of the app's core functionality is computed entirely on the device
> and works with no network connection at all. There is no backend server of ours,
> no user accounts, no analytics, no crash reporting, no advertising identifier
> collection, and no AI service. BAC is calculated locally from the user's profile
> and drink records using published formulas (see item 6). All data is stored only
> on the device, in a local SQLite database and local key-value storage.
>
> For completeness, these are every network-capable component in the binary:
>
> - **Expo Application Services (EAS Update)** — used to deliver JavaScript and asset
>   updates to the app. It transfers no user data; it only downloads an update bundle.
> - **Google Mobile Ads (AdMob) SDK** — the SDK is linked into the binary because the
>   Android version of the app shows a banner, but **it is completely disabled and
>   never initialized on iOS in this version.** No ad unit is configured for iOS, the
>   SDK's initialization call is skipped, and no banner or ad-related UI appears
>   anywhere in the iOS app. We will submit a new version for review before enabling
>   ads on iOS.
> - **StoreKit / In-App Purchase** — the library is linked for the Android build's
>   "remove ads" product. **No in-app purchase is offered or displayed in this iOS
>   version,** and no product is configured for iOS. Since ads are disabled on iOS,
>   the purchase that removes them is also hidden.
> - **Apple StoreKit review prompt (SKStoreReviewController)** and the system share
>   sheet — standard Apple APIs, used only when the user initiates the action.
> - **Privacy policy page** — a static page hosted on GitHub Pages, opened in an
>   in-app browser when the user taps the privacy policy link in Settings:
>   https://jkinject.github.io/safe-drink-RN/privacy-policy.html
>
> **5. Regional differences in features or content**
>
> The app's features are identical in every region. There is no geo-gating, no
> region-specific content, and no server that could vary by region. Two differences
> exist, and both follow the display language rather than the user's location:
>
> - **Language.** The app ships in English and Korean, selected from the device
>   language and changeable in Settings.
> - **Default drink presets.** The starter list of drinks differs by language:
>   the Korean list includes drinks common in Korea (soju, makgeolli), and the
>   English list uses an international set (beer, wine, whisky, etc.). Users can
>   edit, delete, and add their own presets in either language.
>
> One point worth stating explicitly: the legal-threshold badges and the legal
> reference section describe **South Korean road traffic law** (0.03% — license
> suspension, 0.08% — license revocation), because South Korea is the app's primary
> market. This content is identical in both languages and in all regions; it is
> presented as reference information about Korean law, not as a legal standard
> applicable to the user's own jurisdiction, and the permanent disclaimer states
> that the app is not a legal or medical standard.
>
> **6. Regulated industry or protected third-party material**
>
> The app does not operate in a regulated industry and contains no protected
> third-party material, so no authorization or credentials are required.
>
> - **Not a medical device.** The app performs no measurement, diagnosis, or
>   treatment, and connects to no hardware. It is an arithmetic estimate from
>   numbers the user types in, presented for reference only. The disclaimer
>   "This app is for reference only and is not a legal or medical standard" is
>   permanently visible on the main screen, and the in-app information screen
>   repeats that actual BAC varies with individual condition, food, medication and
>   other factors, and advises using public transportation after drinking.
> - **Formulas.** BAC is estimated using the Widmark formula and the Watson total
>   body water equation — long-published, freely available scientific formulas, not
>   licensed or proprietary material.
> - **Legal information.** The penalty figures shown in the information screen are
>   from South Korea's published Road Traffic Act, which is public statutory
>   information.
> - **Assets.** All character illustrations and icons are original assets created
>   for this app. Open source components are credited in Settings → Open source
>   licenses, with their full license texts.
> - **Alcohol content policy.** The app does not sell alcohol, does not link to
>   alcohol sellers, and does not promote drinking. Its purpose is the opposite:
>   to discourage driving before the user's BAC has returned to zero. It is rated
>   18+ (19+ in South Korea).

---

## 한국어 요약 (내부 참고)

| 항목 | 답변 요지 |
|---|---|
| 2. 목적·타깃 | BAC 0 도달까지 남은 시간을 알려주는 오프라인 참고용 타이머. 성인 음주자 대상, 18+/한국 19+. 음주 권장 아님, 의료·법적 기준 아님(면책 상시 노출) |
| 3. 설정·접근 | 계정·로그인·데모 계정 없음. 온보딩(성별·키·몸무게·출생연도) → 홈/플랜/기록/설정 전부 즉시 접근. 상태 재현법(완료 시각을 몇 분 전으로)까지 안내 |
| 4. 외부 서비스 | **핵심 기능은 전부 온디바이스, 네트워크 불필요.** 서버·계정·분석·크래시리포팅·AI 없음. 바이너리에 들어 있는 네트워크 구성요소(EAS Update / AdMob SDK·iOS 비활성 / IAP·iOS 미제공 / StoreKit 리뷰 / 개인정보처리방침 페이지)를 전부 선공개 |
| 5. 지역 차이 | 기능 동일, 지오게이팅 없음. 언어(ko/en)와 기본 술 프리셋만 언어 기준으로 다름. **법령 뱃지가 한국 도로교통법 기준이라는 점을 먼저 명시** |
| 6. 규제 산업 | 의료기기 아님(측정·진단·하드웨어 없음). Widmark·Watson 공개 수식, 한국 도로교통법 공개 법령, 캐릭터는 자체 제작, OSS 라이선스 앱 내 고지. 주류 판매·링크·권장 없음 |

### 판단 근거가 된 코드

- `src/config/ads.ts:14-34` — iOS 광고 단위 `null` → `ADS_SUPPORTED` false
- `src/app/_layout.tsx:46` — `if (ADS_SUPPORTED) adsService.initialize()` (iOS 는 SDK 초기화 자체를 건너뜀)
- `src/app/(tabs)/settings.tsx:223` — 광고 제거 구매 섹션도 `ADS_SUPPORTED` 로 가려짐
- `src/storage/presetStorage.ts:40-42` — `defaultPresets(locale)` 로케일별 기본 세트
- `src/i18n/en.ts:109,223-228,233` — 면책 문구·한국 법령 기준 문구
- `src/constants/appInfo.ts:18` — 개인정보처리방침 URL

---

## 1.3.0 용 대체 문단 초안 (영문)

1.3.0 부터 설정 → 백업에 **선택적** Google/Apple 로그인이 추가된다. 아래는 위 "붙여넣을 영문
본문" 중 3·4·6번 항목을 대체할 초안이다. 제출 시 실제 심사 노트에 옮겨 붙이고, 화면 녹화·"How
to test" 안내도 백업 로그인 흐름을 포함하도록 함께 갱신할 것.

> **3. How to set up and access the app's main features (1.3.0 draft)**
>
> No account or login is required to use any core feature of the app. Every feature described
> above (profile setup, Home, adding drinks, Plan, History, Settings, notifications and Live
> Activity) is reachable immediately after launch, with no sign-in of any kind.
>
> Starting with this version, Settings → Backup offers an **entirely optional** sign-in
> (Google or Sign in with Apple) whose only purpose is to back up and restore the user's local
> data (drink records, presets, profile, language and notification settings) if they reinstall
> the app or switch devices. Declining to sign in has no effect on any other feature. We provide
> **Sign in with Apple** alongside Google, in line with Guideline 4.8, since Google Sign-In is
> offered as a third-party login option.
>
> To test the backup feature: complete onboarding, add a drink, then go to Settings → Backup and
> tap either "Sign in with Google" or "Sign in with Apple." No demo account is needed — any
> Google or Apple ID works. After signing in, the screen shows "Last backed up: just now."
> Signing out ("Delete backup and unlink") removes the server-side backup only; on-device data is
> unaffected.
>
> **4. External services, tools, or platforms used for core functionality (1.3.0 draft)**
>
> All core BAC calculation, timers, and notifications still run entirely on the device with no
> network connection required, exactly as in the previous submission. The only new network
> service in this version is:
>
> - **Backup server (ours, hosted on Cloudflare Workers + D1)** — used **only** if the user
>   opts in via Settings → Backup. It stores the account identifier (Google `sub`, or an Apple
>   user identifier), the account's email address (or, for Apple's "Hide My Email," the relay
>   address Apple issues), and a single JSON snapshot of the user's local data. A user who signs
>   in with Apple also receives a session token (valid 180 days) stored on the device, used to
>   authenticate later backup requests without repeatedly prompting for sign-in. If the user
>   never opens Settings → Backup or never signs in, this service is never contacted.
> - **Sign in with Apple** and **Google Sign-In** — standard OAuth sign-in flows, used solely to
>   authenticate the user for the backup feature above. No other data is requested or read from
>   either provider.
>
> All other points from the previous submission are unchanged: no analytics, no crash reporting,
> no advertising identifier collection on iOS, no AI service.
>
> **6. Regulated industry or protected third-party material (1.3.0 draft)**
>
> Unchanged from the previous submission, with one addition: account deletion. A user who signed
> in for backup can permanently delete their server-side backup and account identifiers at any
> time from Settings → Backup → "Delete backup and unlink," which takes effect immediately. A
> user who has uninstalled the app can request the same deletion by email, per the in-app privacy
> policy and the web deletion request page linked from it. No account or backup data is retained
> beyond what the user explicitly enabled.
