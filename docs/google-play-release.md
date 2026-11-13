# Publishing Amico Segreto on Google Play

The Android app lives in `android/` (Capacitor 8). It bundles the built web
app, so every release contains the code it was built from; it does not load
the website.

- **Package name:** `fun.amicosegreto.app` (permanent once uploaded)
- **Target SDK:** 36
- **Build:** GitHub Actions → *Android build (Google Play)* → produces an `.aab`

## 1. Create the upload key (once)

On your computer (needs a JDK; Android Studio ships one):

```bash
keytool -genkeypair -v -keystore amicosegreto-upload.jks -keyalg RSA -keysize 4096 -validity 10000 -alias upload
```

Keep the `.jks` file and its passwords somewhere safe (password manager plus a
backup). Never commit it. Then add four **repository secrets** in GitHub
(Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 amicosegreto-upload.jks` (macOS: `base64 -i amicosegreto-upload.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | key password |

## 2. Build the bundle

GitHub → Actions → **Android build (Google Play)** → *Run workflow* (set the
version name, e.g. `1.0.0`). Download the `amico-segreto-…-aab` artifact. The
`versionCode` is the workflow run number, so each build can be uploaded.

## 3. Play Console

1. **Create app** → name *Amico Segreto*, default language Italian, App, Free.
2. **Play App Signing**: accept (Google keeps the app signing key; you keep the upload key).
3. **App Links:** in *Setup → App signing*, copy the **SHA-256** of the *app signing key*
   (and of the upload key). Both must be in `public/.well-known/assetlinks.json`,
   otherwise invite and sign-in links open the browser instead of the app.
4. **Testing → Internal testing:** create a release, upload the `.aab`, add yourself as tester.
5. **Closed testing:** new personal developer accounts must run a closed test with at
   least 12 testers for 14 consecutive days before they can publish to production.

### App content answers

- **Privacy policy:** `https://amicosegreto.fun/privacy`
- **Account deletion URL:** `https://amicosegreto.fun/privacy#eliminazione-account`
  (in-app: Profile → "Elimina il mio account")
- **Ads:** No (AdSense is disabled inside the app)
- **Data safety (collected, not sold, encrypted in transit, users can request deletion):**
  - Personal info: name, email address, (optional) address/phone for shipping
  - Photos: profile/event images the user uploads
  - Messages: in-app chat between event members
  - Other user-generated content: wish lists, nicknames
  - App activity: in-app interactions (Plausible analytics, no personal identifiers)
- **Content rating:** complete the questionnaire. Users can chat with each other.

### Store listing assets

- App icon 512×512: `public/android-chrome-512x512.png`
- Feature graphic 1024×500 and at least 2 phone screenshots: to be prepared

## 4. Known gaps before production

- **Reporting/blocking in chat:** Google Play's user-generated-content policy expects
  a way to report objectionable messages/users and block them. Not implemented yet.
- **Push notifications:** off in the app (`VITE_PUSH_ENABLED`). To enable: create a
  Firebase project, add `android/app/google-services.json`, move the server sender
  (`chat-send`, `send-push`) from the retired legacy FCM API to FCM HTTP v1, then
  build with `VITE_PUSH_ENABLED=true`.
- **iOS:** not set up (`npx cap add ios` on a Mac).
