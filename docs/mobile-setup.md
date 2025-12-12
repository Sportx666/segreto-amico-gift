# Mobile App Setup Guide

This guide explains how to build and run the Amico Segreto mobile app for iOS and Android using Capacitor.

## Prerequisites

### For iOS Development
- macOS (required)
- Xcode 14+ (from Mac App Store)
- Xcode Command Line Tools: `xcode-select --install`
- CocoaPods: `sudo gem install cocoapods`

### For Android Development
- Android Studio (any OS)
- Android SDK (installed via Android Studio)
- JDK 17+ (Android Studio bundles this)

## Initial Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd amico-segreto
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add native platforms**
   ```bash
   npx cap add ios
   npx cap add android
   ```

4. **Build the web app**
   ```bash
   npm run build
   ```

5. **Sync with native projects**
   ```bash
   npx cap sync
   ```

## Development Workflow

### Hot Reload Development

The `capacitor.config.ts` is configured to use the Lovable preview URL for hot reload during development. This means:

- Changes you make in Lovable will instantly appear on your device/emulator
- No need to rebuild the app for code changes
- Perfect for rapid development and testing

### Running on iOS

```bash
# Open in Xcode
npx cap open ios

# Or run directly (requires simulator or device)
npx cap run ios
```

In Xcode:
1. Select your target device/simulator
2. Click the Play button to build and run

### Running on Android

```bash
# Open in Android Studio
npx cap open android

# Or run directly (requires emulator or device)
npx cap run android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. Select your target device/emulator
3. Click the Run button

## Production Build

For production builds, you need to disable the dev server URL:

1. **Edit `capacitor.config.ts`**
   ```typescript
   const config: CapacitorConfig = {
     // ... other config
     // Comment out or remove the server block for production:
     // server: {
     //   url: '...',
     //   cleartext: true,
     // },
   };
   ```

2. **Build the production web app**
   ```bash
   npm run build
   ```

3. **Sync and build**
   ```bash
   npx cap sync
   npx cap open ios  # or android
   ```

4. **Archive and distribute** through Xcode or Android Studio

## App Store / Play Store Submission

### iOS (App Store)

1. In Xcode, select "Any iOS Device" as target
2. Product → Archive
3. Window → Organizer → Distribute App
4. Follow the prompts for App Store Connect

Requirements:
- Apple Developer account ($99/year)
- App icons in all required sizes
- Privacy policy URL
- App screenshots

### Android (Play Store)

1. In Android Studio: Build → Generate Signed Bundle/APK
2. Choose Android App Bundle (.aab)
3. Create or use existing keystore
4. Upload to Google Play Console

Requirements:
- Google Play Developer account ($25 one-time)
- App icons and feature graphic
- Privacy policy URL
- App screenshots

## Troubleshooting

### iOS Build Errors

```bash
# Clean and reinstall pods
cd ios/App
rm -rf Pods Podfile.lock
pod install
```

### Android Build Errors

```bash
# Clean Gradle cache
cd android
./gradlew clean
```

### Capacitor Sync Issues

```bash
# Full clean sync
rm -rf ios android
npx cap add ios
npx cap add android
npx cap sync
```

## Environment Variables

The app uses the same Supabase configuration as the web app. No additional environment setup is required for mobile.

## Deep Links (Optional)

To enable deep links for OAuth redirects or share links, configure:

### iOS
Add to `ios/App/App/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>amicosegreto</string>
    </array>
  </dict>
</array>
```

### Android
Add to `android/app/src/main/AndroidManifest.xml` inside `<activity>`:
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="amicosegreto" />
</intent-filter>
```
