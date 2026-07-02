/**
 * device.js
 * ---------------------------------------------------------
 * Wraps all Cordova plugin interactions so the rest of the
 * app never touches plugin globals directly:
 *   - cordova-plugin-device            -> device info panel
 *   - cordova-plugin-local-notification -> "session complete" alert
 *   - cordova-plugin-vibration         -> haptic feedback
 *   - cordova-plugin-camera            -> profile photo
 *
 * Every call is guarded so the app degrades gracefully (and
 * keeps working in a plain browser) if a plugin isn't present.
 * ---------------------------------------------------------
 */
window.FocusFlow = window.FocusFlow || {};

(function (FocusFlow) {
    'use strict';

    var Storage = FocusFlow.Storage;
    var PROFILE_PHOTO_KEY = 'profilePhotoDataUrl';
    var PREF_NOTIFICATIONS_KEY = 'prefNotificationsEnabled';
    var PREF_VIBRATION_KEY = 'prefVibrationEnabled';

    /* =====================================================
       Device info panel
       ===================================================== */
    function renderDeviceInfo() {
        var modelEl = document.getElementById('deviceModel');
        var platformEl = document.getElementById('devicePlatform');
        var versionEl = document.getElementById('deviceVersion');
        var manufacturerEl = document.getElementById('deviceManufacturer');
        if (!modelEl) return;

        if (window.device) {
            modelEl.textContent = device.model || 'Unknown';
            platformEl.textContent = device.platform || 'Unknown';
            versionEl.textContent = device.version || 'Unknown';
            manufacturerEl.textContent = device.manufacturer || 'Unknown';
        } else {
            // Browser preview fallback so the UI isn't left blank during development.
            modelEl.textContent = 'Browser preview';
            platformEl.textContent = navigator.platform || 'Web';
            versionEl.textContent = 'n/a';
            manufacturerEl.textContent = 'n/a';
        }
    }

    /* =====================================================
       Preferences (notification / vibration toggles)
       ===================================================== */
    function initPreferenceToggles() {
        var notifToggle = document.getElementById('toggleNotifications');
        var vibrateToggle = document.getElementById('toggleVibration');

        if (notifToggle) {
            notifToggle.checked = Storage.get(PREF_NOTIFICATIONS_KEY, true);
            notifToggle.addEventListener('change', function () {
                Storage.set(PREF_NOTIFICATIONS_KEY, notifToggle.checked);
            });
        }
        if (vibrateToggle) {
            vibrateToggle.checked = Storage.get(PREF_VIBRATION_KEY, true);
            vibrateToggle.addEventListener('change', function () {
                Storage.set(PREF_VIBRATION_KEY, vibrateToggle.checked);
            });
        }
    }

    /* =====================================================
       Local notification — fired when a focus session ends
       ===================================================== */
    function requestNotificationPermission() {
        if (window.cordova && cordova.plugins && cordova.plugins.notification && cordova.plugins.notification.local) {
            cordova.plugins.notification.local.requestPermission(function (granted) {
                if (!granted) {
                    console.warn('[FocusFlow] Local notification permission was not granted.');
                }
            });
        }
    }

    function fireSessionCompleteNotification(minutes) {
        var enabled = Storage.get(PREF_NOTIFICATIONS_KEY, true);
        if (!enabled) return;

        try {
            if (window.cordova && cordova.plugins && cordova.plugins.notification && cordova.plugins.notification.local) {
                cordova.plugins.notification.local.schedule({
                    id: Date.now() % 100000,
                    title: 'Focus session complete',
                    text: 'You focused for ' + minutes + ' minutes. Time for a short break.',
                    foreground: true,
                    smallIcon: 'res://icon'
                });
            } else {
                // Browser fallback — Web Notifications API, purely for local preview/testing.
                if (window.Notification && Notification.permission === 'granted') {
                    new Notification('Focus session complete', {
                        body: 'You focused for ' + minutes + ' minutes.'
                    });
                } else if (window.Notification && Notification.permission !== 'denied') {
                    Notification.requestPermission();
                }
            }
        } catch (err) {
            console.error('[FocusFlow] Failed to schedule local notification:', err);
        }
    }

    /* =====================================================
       Vibration — fired alongside the notification
       ===================================================== */
    function fireCompletionVibration() {
        var enabled = Storage.get(PREF_VIBRATION_KEY, true);
        if (!enabled) return;

        try {
            if (navigator.vibrate) {
                // Cordova's vibration plugin polyfills navigator.vibrate.
                navigator.vibrate([200, 100, 200]);
            }
        } catch (err) {
            console.error('[FocusFlow] Vibration failed:', err);
        }
    }

    function handleTimerComplete(e) {
        var minutes = (e.detail && e.detail.minutes) || 25;
        fireSessionCompleteNotification(minutes);
        fireCompletionVibration();
    }

    /* =====================================================
       Camera — optional profile photo
       ===================================================== */
    function applyStoredProfilePhoto() {
        var dataUrl = Storage.get(PROFILE_PHOTO_KEY, null);
        if (!dataUrl) return;

        [
            { img: document.getElementById('profilePhoto'), fallback: document.getElementById('profilePhotoInitial') },
            { img: document.getElementById('topbarAvatarImg'), fallback: document.getElementById('topbarAvatarInitial') }
        ].forEach(function (pair) {
            if (!pair.img) return;
            pair.img.src = dataUrl;
            pair.img.hidden = false;
            if (pair.fallback) pair.fallback.hidden = true;
        });
    }

    function onPhotoCaptured(imageDataUrl) {
        Storage.set(PROFILE_PHOTO_KEY, imageDataUrl);
        applyStoredProfilePhoto();
        FocusFlow.showToast('Profile photo updated');
    }

    function capturePhoto() {
        if (window.navigator && navigator.camera) {
            navigator.camera.getPicture(
                function onSuccess(imageData) {
                    // DATA_URL destination returns a base64 string directly.
                    onPhotoCaptured('data:image/jpeg;base64,' + imageData);
                },
                function onError(message) {
                    // Includes the user simply cancelling — no need to alarm them.
                    console.warn('[FocusFlow] Camera cancelled or failed:', message);
                },
                {
                    quality: 60,
                    destinationType: Camera.DestinationType.DATA_URL,
                    sourceType: Camera.PictureSourceType.CAMERA,
                    encodingType: Camera.EncodingType.JPEG,
                    targetWidth: 400,
                    targetHeight: 400,
                    correctOrientation: true,
                    saveToPhotoAlbum: false
                }
            );
        } else {
            // Browser fallback: let the user pick a file so the feature is still testable.
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = function () {
                var file = input.files && input.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function () { onPhotoCaptured(reader.result); };
                reader.readAsDataURL(file);
            };
            input.click();
        }
    }

    function initProfilePhoto() {
        var btn = document.getElementById('btnChangePhoto');
        var photoWrap = document.getElementById('profilePhotoWrap');
        applyStoredProfilePhoto();

        if (btn) btn.addEventListener('click', capturePhoto);
        if (photoWrap) photoWrap.addEventListener('click', capturePhoto);
    }

    /* =====================================================
       Wiring
       ===================================================== */
    function init() {
        renderDeviceInfo();
        initPreferenceToggles();
        initProfilePhoto();
        requestNotificationPermission();
    }

    function handleDataReset() {
        Storage.remove(PROFILE_PHOTO_KEY);
        [
            { img: document.getElementById('profilePhoto'), fallback: document.getElementById('profilePhotoInitial') },
            { img: document.getElementById('topbarAvatarImg'), fallback: document.getElementById('topbarAvatarInitial') }
        ].forEach(function (pair) {
            if (!pair.img) return;
            pair.img.hidden = true;
            pair.img.src = '';
            if (pair.fallback) pair.fallback.hidden = false;
        });
        var notifToggle = document.getElementById('toggleNotifications');
        var vibrateToggle = document.getElementById('toggleVibration');
        if (notifToggle) notifToggle.checked = true;
        if (vibrateToggle) vibrateToggle.checked = true;
    }

    document.addEventListener('focusflow:ready', init);
    document.addEventListener('focusflow:timercomplete', handleTimerComplete);
    document.addEventListener('focusflow:datareset', handleDataReset);

    FocusFlow.Device = {
        capturePhoto: capturePhoto,
        fireSessionCompleteNotification: fireSessionCompleteNotification,
        fireCompletionVibration: fireCompletionVibration
    };

})(window.FocusFlow);
