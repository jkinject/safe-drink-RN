# 커뮤니티 글 초안 (무료 마케팅)

올리기 전에 한 번 읽고 말투를 본인 것으로 바꿔 쓰는 게 좋다. 링크는 전부 UTM 을 붙여 두어 Play Console 획득 보고서에서 출처가 나뉜다.

- Play: `https://play.google.com/store/apps/details?id=com.safedrink.app&referrer=utm_source%3D<출처>%26utm_medium%3Dcommunity`
- 웹 계산기: `https://jkinject.github.io/safe-drink-RN/calc/`
- GitHub: `https://github.com/jkinject/safe-drink-RN`

원칙: 광고 문구 대신 **만든 이유·계산 방식·한계**를 적는다. 커뮤니티는 홍보를 싫어하지만 제작기와 계산 근거는 좋아한다. 댓글에 계산 공식 질문이 오면 안내 화면 내용을 그대로 답하면 된다.

---

## 1. 클리앙 팁과강좌 / 뽐뿌 앱포럼 (한국)

제목: 회식 다음 날 "지금 운전해도 되나" 계산하는 앱 만들었습니다 (무료, 광고 제거 옵션 있음)

본문:

회식 다음 날 아침마다 "어젯밤 소주 한 병 반이면 지금 깼나?" 를 검색하다가 직접 만들었습니다.

마신 잔을 기록하면 키·몸무게·성별·나이로 체수분을 계산(Watson 공식)해서 혈중알코올농도를 추정하고, 시간당 0.015% 씩 분해되는 걸로 완전히 깨는 시각을 카운트다운으로 보여줍니다. 앱을 꺼도 알림창에서 남은 시간이 1초씩 줄어들고, 0이 되면 "이제 안전해요" 알림이 옵니다. 면허 정지(0.03%)·취소(0.08%) 기준선도 그래프에 같이 찍힙니다.

솔직히 적자면: 공개된 위드마크 공식 기반 추정치라 음식·컨디션에 따라 실제와 차이가 납니다. 앱도 "참고용"이라고 계속 띄웁니다. 운전 가능 여부를 이걸로 판단하시면 안 되고, 어디까지나 "아직 한참 남았네" 를 미리 알고 대리를 부르는 용도입니다.

회원가입 없고 기록은 폰 안에만 저장됩니다. 무료이고 하단에 배너 광고가 하나 있는데 3,300원 한 번 결제로 영구 제거됩니다. 코드는 GitHub 에 공개돼 있어서 계산식이 궁금하시면 직접 보실 수 있습니다.

앱 설치 없이 웹에서 바로 계산만 해 보실 수도 있습니다: (웹 계산기 링크)
Play 스토어: (링크, utm_source=clien 또는 ppomppu)

피드백 주시면 반영하겠습니다. 특히 기본 프리셋(맥주 500cc, 소주 1잔·1병, 와인, 양주, 막걸리, 하이볼)에 빠진 게 있으면 알려주세요.

---

## 2. 블라인드 (직장인)

제목: 회식 다음날 운전 되는지 계산해주는 앱 하나 만들었음

본문 (짧게):

회식 끝나고 "몇 시에 깨지?" 매번 궁금해서 만든 앱. 마신 잔 넣으면 내 체중·성별 기준으로 완전히 깨는 시각 카운트다운 해줌. 알림창에서 남은 시간 보이고 0 되면 알림 옴. 회원가입 없음, 기록 폰에만 저장. 무료. 참고용이니까 이거 믿고 운전은 하지 말고 대리 부르는 타이밍 잡는 용도. 계산식 궁금하면 앱 안에 다 적어놨음.
(Play 링크, utm_source=blind)

---

## 3. Product Hunt

Name: Safedrink
Tagline: Know exactly when you'll be sober — a BAC timer tuned to your body
Description:

Log each drink as you go and Safedrink estimates your blood alcohol concentration and counts down to the moment it reaches zero. It uses the Watson total-body-water formula so the same drinks give different results for different bodies, shows a Widmark estimate side by side for comparison, and keeps counting in your notification shade after you close the app.

No account, no server: your body data and drink history never leave the device. Free with one banner ad; a one-time purchase removes it. The core calculation is open source.

Made this because every "sober calculator" I found was a static table. This one follows your actual night — drink by drink, with a graph — and tells you the clock time, not just "5 hours".

Not a medical device. It's a reference estimate; never use it to decide whether to drive.

First comment (maker):
Hi PH — I'm the developer. Built it after one too many mornings wondering whether last night's drinks had cleared. Android only for now (iOS is next). Happy to answer anything about the formula — the calculation code is in the repo linked on the page.

Topics: Health & Fitness, Android, Open Source, Productivity
Links: Play (utm_source=producthunt), GitHub, web calculator

---

## 4. Hacker News — Show HN

Title: Show HN: Safedrink – open-source BAC timer that follows your night drink by drink

Text:

I built a small Android app that estimates blood alcohol concentration from what you drink and counts down to when it reaches zero. Most calculators online are a static table ("2 beers = 3 hours"); this one keeps a per-drink timeline, personalizes the Widmark r via Watson's total-body-water equation (height, weight, sex, age), and models elimination as a single 0.015 %/h first-order term over the sequence of drinks — the naive "each drink decays independently" version overestimates clearance N-fold, which took me a while to notice.

Stack: Expo / React Native, SQLite on device, no backend. The calculation core is pure TypeScript with tests pinned to a reference implementation, and the same module powers a web calculator page.

Things I'd like feedback on: the elimination model under gaps (BAC hitting zero between drinks), and how to present uncertainty honestly — the app already says "reference only, never drive on this", but I'm not sure that's enough.

Repo: https://github.com/jkinject/safe-drink-RN
Web calculator: https://jkinject.github.io/safe-drink-RN/calc/?lang=en
Play: (utm_source=hn)

---

## 5. Reddit

### r/androidapps (Dev — "I made this" 플레어)

Title: [DEV] Safedrink – a sober-time countdown that tracks your drinks one by one (free, no account)

Body: 3번 Product Hunt 설명을 짧게 줄여 쓰고, 마지막에 "Android 13+, no permissions except notifications" 와 링크. 서브레딧 규칙상 자기 홍보는 주 1회 이하, 댓글 응답 필수.

### r/reactnative

Title: Shipped an Expo app with a pure-TS calculation core reused for a web page — notes on OTA runtime versions, AdMob + Kotlin version pitfalls

Body: 개발 후기 형식. 배운 것 세 가지 — (1) runtimeVersion=appVersion 정책으로 네이티브 모듈 추가 시 OTA 분리, (2) react-native-google-mobile-ads 16.4+ 가 무는 play-services-ads 25.4 의 Kotlin 2.3 메타데이터가 RN 0.86 과 충돌 → 16.3.0 고정, (3) patch-package 에 xcframework 바이너리 넣으면 clean install 이 깨짐. 레포 링크. (개발자 커뮤니티라 설치 유입보다 GitHub 스타·신뢰 목적.)

---

## 6. 올리는 순서 (권장)

1. 웹 계산기·랜딩 페이지가 검색에 잡히기 시작해야 하므로 Search Console·네이버 서치어드바이저 등록을 먼저 (소유 확인은 사용자 작업).
2. 같은 주에 클리앙 → 뽐뿌 → 블라인드 순으로 하루 간격. 반응 좋은 댓글 질문은 FAQ 로 랜딩에 추가.
3. 영어권은 Product Hunt 화요일~목요일 오전(태평양 시간) 런칭이 관례. Show HN 은 같은 날 하지 말고 며칠 뒤.
4. Reddit 은 각 서브레딧 규칙(자기 홍보 비율) 확인 후.
