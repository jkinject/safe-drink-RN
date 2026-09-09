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
