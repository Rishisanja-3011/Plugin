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

`npm.cmd run wireless` updates `.env` with the PC's current Wi-Fi IP, then starts Expo with `--lan`. No `adb reverse` is needed for backend calls.

If you only want to refresh the saved LAN API URL without starting Expo:

```powershell
npm.cmd run wireless:env
```

The script writes:

```text
EXPO_PUBLIC_API_LAN_BASE_URL=http://YOUR_PC_LAN_IP:8091/api
EXPO_PUBLIC_METRO_HOST=YOUR_PC_LAN_IP:8081
```

Android debug builds read `EXPO_PUBLIC_METRO_HOST` and save it as React Native's debug server host, so the installed debug app loads Metro over Wi-Fi instead of `localhost:8081`. If your PC Wi-Fi IP changes, run `npm.cmd run wireless:env` and reinstall the debug build once.

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
