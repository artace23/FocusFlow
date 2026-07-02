# FocusFlow

A clean, modern productivity and focus-tracking mobile app built with Apache Cordova. Combines a Pomodoro-style focus timer, task management, a statistics dashboard, and a profile screen with device info and camera support — targeting Android first, with an easy path to iOS.

## Features

- **Focus Timer (Pomodoro)** — 25-minute sessions with start/pause/resume/reset, a circular "Flow Ring" progress indicator, and automatic session logging.
- **Task Management** — add, complete, and delete tasks; persisted to `localStorage`.
- **Statistics Dashboard** — total sessions, total focus time, tasks completed today, average session length, and a 7-day activity chart.
- **Native features via Cordova plugins**:
  - `cordova-plugin-device` — shows model, platform, OS version, manufacturer.
  - `cordova-plugin-local-notification` — notifies when a focus session ends.
  - `cordova-plugin-vibration` — vibrates on session completion.
  - `cordova-plugin-camera` — optional profile photo capture (falls back to a file picker in a plain browser).

## Project structure

```
FocusFlow/
├── config.xml              # Cordova project + plugin manifest
├── package.json
├── www/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js          # shared namespace, storage, navigation, Cordova bootstrap
│   │   ├── timer.js        # Pomodoro timer logic + session persistence
│   │   ├── tasks.js        # task CRUD + rendering
│   │   ├── stats.js        # dashboard aggregation + weekly chart
│   │   └── device.js       # device info, notifications, vibration, camera
│   └── assets/images/
└── res/                     # platform icons (add your own PNGs here)
```

Each JS module attaches itself to a shared `window.FocusFlow` namespace defined in `app.js`, and modules communicate via small `CustomEvent`s (e.g. `focusflow:timercomplete`, `focusflow:taskschanged`) rather than calling each other directly. This keeps the modules loosely coupled and easy to test or replace individually.

## Getting started

### 1. Install Cordova (once, globally)

```bash
npm install -g cordova
```

### 2. Install project dependencies and add the Android platform

```bash
cd FocusFlow
npm install
cordova platform add android
```

Plugins listed in `config.xml` install automatically on `cordova prepare` / `cordova build`. To add them manually instead:

```bash
cordova plugin add cordova-plugin-device
cordova plugin add cordova-plugin-local-notification
cordova plugin add cordova-plugin-camera
cordova plugin add cordova-plugin-vibration
cordova plugin add cordova-plugin-whitelist
cordova plugin add cordova-plugin-statusbar
cordova plugin add cordova-plugin-splashscreen
```

### 3. Run on Android

```bash
cordova build android
cordova run android
```

### 4. Preview in a browser during development

The app detects when `window.cordova` is unavailable and falls back gracefully (mock device info, a Web Notification/file-picker fallback for the camera, etc.), so you can iterate quickly with any static file server:

```bash
npx serve www
```

Note: `www/index.html` references `cordova.js`, which is injected automatically by `cordova prepare`/`cordova build` — it doesn't exist yet in a fresh checkout, and that's expected. Its absence in a browser preview is harmless.

### 5. Add to iOS later

```bash
cordova platform add ios
cordova build ios
```

The plugins and JS code already have iOS-safe fallbacks in `config.xml` (e.g. the camera usage description), so no app code changes should be required — only Xcode signing setup.

## Data & storage

All app data (tasks, sessions, preferences, profile photo) is stored locally via `localStorage`, namespaced under the `focusflow.` prefix, through the `FocusFlow.Storage` helper in `app.js`. Nothing is sent to a server. Sample tasks are seeded on first launch so the UI isn't empty for a fresh install or demo.

Use **Profile → Reset all app data** to clear everything (tasks, sessions, stats, photo, preferences) and start fresh.

## Notes for production

- Replace the placeholder icons referenced in `config.xml` (`res/android/icon-*.png`) with real app icons before shipping.
- The Google Fonts stylesheet link in `index.html` requires network access on first load; for a fully offline-first build, download and bundle the font files locally instead.
- Review notification permission handling (`device.js`) against the latest Android 13+ runtime notification permission requirements for your target SDK.
