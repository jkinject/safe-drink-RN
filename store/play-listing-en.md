# Google Play store listing — English (en-US)

Korean listing: `play-listing.md`. Keep the two in sync when features change.

---

## App name (30 chars max)

```
Safedrink — Sober Up Timer
```

## Short description (80 chars max)

```
Log your drinks and see when you'll be sober. A BAC timer tuned to your body.
```

## Full description (4000 chars max)

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
On Android, the remaining time counts down in your notification shade and a "You're sober now" alert arrives when it reaches zero. You can turn this off in Settings.

■ Look back on past nights
When you sober up, the session is saved automatically: start and end time, total alcohol, peak BAC and the graph.

■ Private by design
No account, no sign-up. Your body data and drink history stay on your device and are never uploaded.

Safedrink is free and shows a small banner ad. A one-time in-app purchase removes ads permanently.

Available in English and Korean.


[ Please read ]

The numbers Safedrink shows are estimates based on published formulas. Real BAC varies widely with metabolism, food, health, medication and how fast you drink.

This app is not a medical device and must not be used to decide whether you can drive. Even when the app says you are sober, alcohol may remain in your body.

If you have been drinking, do not drive.
```

## Console values (English listing)

| Field | Value |
|---|---|
| Language | English (United States) — en-US |
| App name | Safedrink — Sober Up Timer |
| Category | Lifestyle (same as Korean) |
| Screenshots (phone) | `store/screenshots/en/01..06` (1080×1920) |
| Feature graphic | `store/graphics/feature-graphic-en-1024x500.png` |
| App icon | same as Korean (`store/graphics/play-icon-512.png`) |

## Screenshot captions (used in the composites)

| # | Headline | Sub |
|---|---|---|
| 01 timer | Time until you're sober | Calculated for your height, weight and sex |
| 02 graph | Your BAC over time | Watch each drink rise and fade |
| 03 add | Log a drink in one tap | Beer, wine, whisky, cocktails — or your own |
| 04 history | Look back on past nights | Peak BAC, total alcohol and the graph |
| 05 notification | Counts down with the app closed | Right in your notification shade |
| 06 settings | Private by design | No account. Everything stays on your device |

Regenerate the composites with `python3 store/compose_screenshots.py en` after dropping raw captures in `store/raw/en/`.

## Machine translations (2026-09-09)

- Play Console → 사용자 늘리기 → 번역 → "무료 기계 번역" 주문(원본 en-US, 대상 스토어 등록정보만). 지원 언어 27개 전부 적용: nl, no, da, de, ru, ro, vi, sv, es-419, es-ES, sk, ar, uk, it, id, ja, zh-CN, cs, th, tr, pt-BR, pl, fr, fi, hu, iw, hi. (zh-TW·pt-PT·ms·fil 은 기계 번역 미지원.)
- 앱 이름 30자·짧은 설명 80자 한도를 넘긴 21개 언어는 aside 가 짧게 손봤다. 아랍어 앱 이름은 "중독 회복 타이머" 오역이라 수정함. 자세한 설명은 기계 번역 그대로 — 품질 검수는 안 했다.
- **기본 언어를 ko-KR → en-US 로 변경**. 그래픽이 없는 언어는 이제 영어 스크린샷·피처 그래픽으로 폴백한다. 한국어 등록정보·그래픽은 번역 항목으로 그대로 유지. en-US 에 앱 아이콘을 따로 넣어야 했다(기본 언어는 아이콘 필수).
- 번역·기본 언어 변경은 기존 검토(1.2.0 출시)와 합쳐져 다시 검토 중.
