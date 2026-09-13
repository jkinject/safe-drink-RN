# Show HN

Title (80): Show HN: Safedrink – open-source BAC timer that tracks your night drink by drink
URL: https://github.com/jkinject/safe-drink-RN

Text:
I built a small Android app that estimates blood alcohol concentration from what you drink and counts down to when it reaches zero. Most calculators online are a static table ("2 beers = 3 hours"); this one keeps a per-drink timeline, personalizes the Widmark r via Watson's total-body-water equation (height, weight, sex, age), and models elimination as a single 0.015 %/h first-order term over the sequence of drinks — the naive "each drink decays independently" version overestimates clearance N-fold, which took me a while to notice.

Stack: Expo / React Native, SQLite on device, no backend. The calculation core is pure TypeScript with tests pinned to a reference implementation, and the same module powers a web calculator page.

Things I'd like feedback on: the elimination model under gaps (BAC hitting zero between drinks), and how to present uncertainty honestly — the app already says "reference only, never drive on this", but I'm not sure that's enough.

Web calculator: https://jkinject.github.io/safe-drink-RN/calc/?lang=en
Play: https://play.google.com/store/apps/details?id=com.safedrink.app&referrer=utm_source%3Dhn%26utm_medium%3Dcommunity
