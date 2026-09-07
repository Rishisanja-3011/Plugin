# Plugin Mobile App

Fresh React Native/Expo app for the Plugin mobile experience.

## Run

1. Start MongoDB locally, or set `MONGODB_URI` for the backend.
2. Start the backend from `plugin-backend`:

```powershell
mvn.cmd spring-boot:run
```

3. Start Expo Go over Wi-Fi:

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

`npm.cmd start` and `npm.cmd run wireless` detect the real Wi-Fi adapter, avoid a Metro port already occupied by another project, clear Metro's cache, and open the exact LAN URL in Expo Go. No `adb reverse` is needed for backend calls.

If you only want to refresh the saved LAN API URL without starting Expo:

```powershell
npm.cmd run wireless:env
```

The script writes:

```text
EXPO_PUBLIC_API_LAN_BASE_URL=http://YOUR_PC_LAN_IP:8091/api
EXPO_PUBLIC_METRO_HOST=YOUR_PC_LAN_IP:8081
```

If no ADB device is connected, Metro still starts and prints a QR code to scan in Expo Go.

To install the self-contained Android app with the current Wi-Fi API address embedded, connect the phone by USB or wireless ADB once and run:

```powershell
npm.cmd run android:wireless
```

This local APK embeds its JavaScript bundle, so it opens without Metro and cannot show Expo's “failed to download remote update” screen. Rebuild it after app-code changes or when the PC's Wi-Fi IP changes.

For a wired phone, use:

```powershell
npm.cmd run android:wired
```

The wired command installs the same self-contained APK, configures `adb reverse` for backend port `8091`, and uses loopback instead of Wi-Fi. To run Expo Go through USB, use `npm.cmd run expo:wired`.

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
