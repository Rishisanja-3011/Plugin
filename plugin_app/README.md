# Plugin Mobile App

Fresh React Native/Expo app for the Plugin mobile experience.

## Run

1. Start MongoDB locally, or set `MONGODB_URI` for the backend.
2. Start the backend from `plugin-backend`:

```powershell
mvn.cmd spring-boot:run
```

3. Start the mobile app:

```powershell
cd plugin_app
npm.cmd start
```

The app defaults to backend port `8091`.

## Wireless Android Testing

Use this when you do not want to connect the phone with USB every time.

Every Android APK, including a debug APK, contains an embedded JavaScript bundle. The installed app therefore opens when Metro is stopped, the Wi-Fi changes, or the laptop receives a different IP address. When Metro is reachable, a debug APK still uses it for live reload; otherwise it automatically falls back to the embedded bundle.

1. Keep the phone and PC on the same Wi-Fi or hotspot.
2. Start the backend from `plugin-backend`:

```powershell
mvn.cmd spring-boot:run
```

3. Start the mobile app in LAN mode:

```powershell
cd plugin_app
npm.cmd run wireless
```

`npm.cmd run wireless` updates `.env` with the PC's current Wi-Fi IP, exports that IP for Expo, updates the connected Android app's Metro address at runtime, then starts Expo with `--lan`. Wi-Fi IP changes no longer require rebuilding or reinstalling the APK. No `adb reverse` is needed for backend calls.

If you only want to refresh the saved LAN API URL without starting Expo:

```powershell
npm.cmd run wireless:env
```

The script writes:

```text
EXPO_PUBLIC_API_LAN_BASE_URL=http://YOUR_PC_LAN_IP:8091/api
EXPO_PUBLIC_METRO_HOST=YOUR_PC_LAN_IP:8081
```

The wireless script sends `EXPO_PUBLIC_METRO_HOST` to connected debug apps, so they can load Metro over Wi-Fi instead of `localhost:8081`. The first run upgrades an older APK once; afterward, IP changes are applied immediately without another build. If no ADB device is connected, Metro still starts and the app continues to open from its embedded bundle.

To reinstall the debug app with the current Wi-Fi IP baked in, connect the phone by USB or wireless ADB once and run:

```powershell
npm.cmd run android:wireless
```

## Screens Included

- Login, signup, and OTP verification
- Home dashboard
- Station search
- Station details
- Reserve charger flow with manual date, time, and duration
- Start charging from confirmed bookings
- My bookings
- Booking details
- Transaction history
- Billing lock, payment, paid-invoice email trigger, and invoice PDF download
- Profile and edit profile
- Vehicle management
- Notifications
