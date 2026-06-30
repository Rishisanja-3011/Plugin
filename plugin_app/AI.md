# Plugin Mobile App AI Guide

This file is for AI assistants and developers working on the `plugin_app` React Native/Expo mobile app.

## Project Summary

`plugin_app` is the Plugin EV charging mobile app. It is built with Expo SDK 54, React Native 0.81, and React 19.

The app package/name is:

- App name: `Plugin`
- Android package: `com.plugin.mobile`
- Main entry: `index.js`
- App shell/navigation: `App.js`
- API client: `src/api/client.js`
- Theme: `src/theme/theme.js`

The app connects to the Spring backend in `../plugin-backend`, normally on port `8091`.

## Important Commands

Start Expo for JS testing:

```powershell
cd C:\Users\sarth\OneDrive\Desktop\antiplugin\plugin_app
npm start
```

Update the installed Android APK through USB:

```powershell
cd C:\Users\sarth\OneDrive\Desktop\antiplugin\plugin_app
npm run android:update
```

Build release APK only:

```powershell
cd C:\Users\sarth\OneDrive\Desktop\antiplugin\plugin_app
npm run android:release
```

Manually install the release APK:

```powershell
adb install -r android\app\build\outputs\apk\release\app-release.apk
adb reverse tcp:8091 tcp:8091
adb shell am force-stop com.plugin.mobile
adb shell monkey -p com.plugin.mobile 1
```

## Testing Rules

- JS-only UI changes can be tested in Expo Go with reload.
- Native changes require rebuilding/installing the APK.
- Google Sign-In uses `@react-native-google-signin/google-signin`, so it does not work inside Expo Go. Test Google login only in the installed Plugin APK.
- App icon, package name, Android manifest, splash config, native plugins, and native modules require rebuild.

## Backend/API Notes

The backend should run on port `8091`.

The mobile app reads:

- `EXPO_PUBLIC_API_PORT`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_API_TIMEOUT_MS`
- `EXPO_PUBLIC_OTP_TIMEOUT_MS`
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

Default app API behavior is in `src/api/client.js`.

Offline charging behavior:

- `src/api/client.js` tags network failures with `NETWORK_ERROR_CODE`.
- Active charging sessions are cached in AsyncStorage under `plugin_active_session_snapshot`.
- `ChargingScreen.js` calls `api.sessions.active({ allowCached: true })`.
- If the phone loses signal during charging, the app should show the cached active session with an "Offline mode" banner instead of the generic server unreachable error.
- Clearing auth/logout also clears the cached charging session.

For a real phone:

- With USB, use `adb reverse tcp:8091 tcp:8091`.
- Without USB, set `EXPO_PUBLIC_API_BASE_URL=http://YOUR_PC_LAN_IP:8091/api`.
- Keep phone and PC on the same Wi-Fi.
- Do not use `0.0.0.0` as the mobile app API URL. It is a bind address, not a phone-accessible server address.

## Port/Process Safety

When testing with temporary ports:

- Do not stop the user's current backend server unless explicitly asked.
- If a temporary server/process is started for testing, stop that same process after testing.
- Prefer port `8091` for backend assumptions.
- Prefer Expo default `8081` unless already occupied.

## App Structure

Screens live in `src/screens`:

- `AuthScreen.js`: login, signup, OTP, forgot/reset password, Google login entry
- `HomeScreen.js`: home/dashboard
- `StationsScreen.js`: station search/list
- `StationDetailsScreen.js`: station details
- `BookingFlowScreen.js`: reserve charger flow
- `ChargingScreen.js`: charging session UI
- `BookingsScreen.js`, `BookingDetailsScreen.js`: booking list/details
- `PaymentScreen.js`: bills/payment/invoice
- `ProfileScreen.js`, `EditProfileScreen.js`, `VehiclesScreen.js`
- `ChangePasswordScreen.js`, `DeleteAccountScreen.js`
- `NotificationsScreen.js`, `HistoryScreen.js`, `SettingsScreen.js`

Reusable components live in `src/components`.

Important components:

- `Screen.js`: standard screen wrapper
- `BottomTabs.js`: app tab bar
- `Button.js`, `Input.js`, `Card.js`, `ListRow.js`
- `LaunchLoader.js`: custom in-app startup loader
- `AppNotice.js`: modal/notice system

## Design Direction

Use the existing Plugin style:

- Charcoal primary background from `colors.primary`
- White cards/surfaces
- Rounded but not overly decorative controls
- Bold black/charcoal text
- Clean EV charging feel
- Avoid blue/purple gradients and unrelated decorative shapes

The startup loader should stay simple:

- Plugin logo
- Charcoal background
- Moving charging bar
- Smooth fade into login/home
- No extra text unless specifically requested

## Current Native Branding

Brand assets:

- `assets/brand-logo.png`
- `assets/app-icon.png`

`app.json` controls native app branding:

- App name is `Plugin`
- Android package is `com.plugin.mobile`
- Native splash uses `assets/brand-logo.png`
- Android adaptive icon uses `assets/app-icon.png`

Changing these requires an APK rebuild.

## Verification

For quick JS syntax checks:

```powershell
cd C:\Users\sarth\OneDrive\Desktop\antiplugin\plugin_app
node -e "const babel=require('@babel/core'); for (const file of ['App.js','src/components/LaunchLoader.js']) { babel.transformFileSync(file,{presets:['babel-preset-expo']}); console.log(file + ' OK'); }"
```

For broader screen checks, transform all JS files:

```powershell
cd C:\Users\sarth\OneDrive\Desktop\antiplugin\plugin_app
node -e "const fs=require('fs'), path=require('path'), babel=require('@babel/core'); function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f); if(fs.statSync(p).isDirectory()) walk(p); else if(p.endsWith('.js')){babel.transformFileSync(p,{presets:['babel-preset-expo']}); console.log(p+' OK')}}} walk('src'); babel.transformFileSync('App.js',{presets:['babel-preset-expo']}); console.log('App.js OK')"
```

## Common Problems

If mobile shows `Cannot reach Plugin server`:

1. Make sure backend is running on `8091`.
2. If using USB, run `adb reverse tcp:8091 tcp:8091`.
3. If not using USB, set `.env` to the PC LAN IP, not `127.0.0.1`.
4. Restart Expo after changing `.env`.

If Expo Go shows `RNGoogleSignin could not be found`:

- This is expected in Expo Go because Google Sign-In is a native module.
- Use the installed Plugin APK for Google login testing.

If launcher icon/splash/native config does not update:

- Rebuild and install with `npm run android:update`.
