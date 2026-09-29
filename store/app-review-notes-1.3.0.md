# App Review Information → Notes (1.3.0, build 5)

동일 내용을 Resolution Center 회신에도 붙인다(영상은 회신에 첨부).

---

**1. Screen recording**

A screen recording captured on a physical iPad (iPad mini 6th gen, iPadOS 18.6.2) running this exact build (1.3.0, build 5) is attached to our reply in App Review's message thread for this app. It starts from launching the app and shows the typical flow: profile setup, adding a drink, marking it finished, the Home timer and BAC chart, the Lock Screen countdown notification, then Settings → Backup: Sign in with Apple, first backup, deleting the app, reinstalling, and restoring the data from the backup during onboarding, and finally "Delete backup and unlink" (account deletion). There is no user-generated content or paid content in the app.


**2. Purpose of the app and target audience**

Safedrink is an offline reference timer that estimates how long it takes for a
user's blood alcohol concentration (BAC) to return to zero after drinking.

The problem it solves: after drinking, people have no reliable way to judge when
alcohol has actually left their body. They rely on guesses such as "I slept, so
I must be fine," which is the most common cause of next-morning drunk driving.

The value it provides: the user records what and when they drank, and the app
shows the estimated current BAC, the time remaining until it reaches zero, and a
chart of how it declines. A local notification and an iOS Live Activity keep a
live countdown on the Lock Screen, so the user does not have to keep the app open.

Target audience: adults of legal drinking age who drink socially and want a
reference point for when it is no longer unsafe or unlawful to drive. The app is
rated 18+ (19+ in South Korea). It does not sell, promote, or encourage the
consumption of alcohol; it only helps the user wait long enough afterwards.

Important: the app is explicitly a reference tool, not a medical or legal
instrument, and not a breathalyzer. A disclaimer stating this is permanently
displayed on the main screen and repeated in the in-app information screen. The
app never tells the user that it is safe to drive.


**3. How to set up and access the app's main features**

No account or login is required to use any core feature of the app. Every feature described
above (profile setup, Home, adding drinks, Plan, History, Settings, notifications and Live
Activity) is reachable immediately after launch, with no sign-in of any kind.

Starting with this version, Settings → Backup offers an **entirely optional** sign-in
(Google or Sign in with Apple) whose only purpose is to back up and restore the user's local
data (drink records, presets, profile, language and notification settings) if they reinstall
the app or switch devices. Declining to sign in has no effect on any other feature. We provide
**Sign in with Apple** alongside Google, in line with Guideline 4.8, since Google Sign-In is
offered as a third-party login option.

To test the backup feature: complete onboarding, add a drink, then go to Settings → Backup and
tap either "Sign in with Google" or "Sign in with Apple." No demo account is needed — any
Google or Apple ID works. After signing in, the screen shows "Last backed up: just now."
Signing out ("Delete backup and unlink") removes the server-side backup only; on-device data is
unaffected.


**4. External services, tools, or platforms used for core functionality**

All core BAC calculation, timers, and notifications still run entirely on the device with no
network connection required, exactly as in the previous submission. The only new network
service in this version is:

- **Backup server (ours, hosted on Cloudflare Workers + D1)** — used **only** if the user
  opts in via Settings → Backup. It stores the account identifier (Google `sub`, or an Apple
  user identifier), the account's email address (or, for Apple's "Hide My Email," the relay
  address Apple issues), and a single JSON snapshot of the user's local data. A user who signs
  in with Apple also receives a session token (valid 180 days) stored on the device, used to
  authenticate later backup requests without repeatedly prompting for sign-in. If the user
  never opens Settings → Backup or never signs in, this service is never contacted.
- **Sign in with Apple** and **Google Sign-In** — standard OAuth sign-in flows, used solely to
  authenticate the user for the backup feature above. No other data is requested or read from
  either provider.

All other points from the previous submission are unchanged: no analytics, no crash reporting,
no advertising identifier collection on iOS, no AI service.


**5. Regional differences in features or content**

The app's features are identical in every region. There is no geo-gating, no
region-specific content, and no server that could vary by region. Two differences
exist, and both follow the display language rather than the user's location:

- **Language.** The app ships in English and Korean, selected from the device
  language and changeable in Settings.
- **Default drink presets.** The starter list of drinks differs by language:
  the Korean list includes drinks common in Korea (soju, makgeolli), and the
  English list uses an international set (beer, wine, whisky, etc.). Users can
  edit, delete, and add their own presets in either language.

One point worth stating explicitly: the legal-threshold badges and the legal
reference section describe **South Korean road traffic law** (0.03% — license
suspension, 0.08% — license revocation), because South Korea is the app's primary
market. This content is identical in both languages and in all regions; it is
presented as reference information about Korean law, not as a legal standard
applicable to the user's own jurisdiction, and the permanent disclaimer states
that the app is not a legal or medical standard.


**6. Regulated industry or protected third-party material**

Unchanged from the previous submission, with one addition: account deletion. A user who signed
in for backup can permanently delete their server-side backup and account identifiers at any
time from Settings → Backup → "Delete backup and unlink," which takes effect immediately. A
user who has uninstalled the app can request the same deletion by email, per the in-app privacy
policy and the web deletion request page linked from it. No account or backup data is retained
beyond what the user explicitly enabled.
