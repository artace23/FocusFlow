/**
 * app.js
 * ---------------------------------------------------------
 * The application shell. Loaded first, before the feature
 * modules (timer.js, tasks.js, stats.js, device.js), so it
 * defines the shared `FocusFlow` namespace those modules
 * attach themselves to.
 *
 * Responsibilities:
 *   - A small localStorage wrapper (FocusFlow.Storage)
 *   - Bottom-nav / view switching
 *   - A lightweight toast helper for in-app feedback
 *   - Cordova `deviceready` bootstrapping
 * ---------------------------------------------------------
 */
window.FocusFlow = window.FocusFlow || {};

(function (FocusFlow) {
    'use strict';

    /* =====================================================
       Storage — thin wrapper around localStorage with
       JSON handling and namespaced keys so every module
       reads/writes consistently and errors don't crash the UI.
       ===================================================== */
    var STORAGE_PREFIX = 'focusflow.';

    var Storage = {
        get: function (key, fallback) {
            try {
                var raw = window.localStorage.getItem(STORAGE_PREFIX + key);
                if (raw === null || raw === undefined) return fallback;
                return JSON.parse(raw);
            } catch (err) {
                console.error('[FocusFlow.Storage] Failed to read "' + key + '":', err);
                return fallback;
            }
        },
        set: function (key, value) {
            try {
                window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
                return true;
            } catch (err) {
                console.error('[FocusFlow.Storage] Failed to write "' + key + '":', err);
                return false;
            }
        },
        remove: function (key) {
            try {
                window.localStorage.removeItem(STORAGE_PREFIX + key);
            } catch (err) {
                console.error('[FocusFlow.Storage] Failed to remove "' + key + '":', err);
            }
        },
        clearAll: function () {
            try {
                Object.keys(window.localStorage)
                    .filter(function (k) { return k.indexOf(STORAGE_PREFIX) === 0; })
                    .forEach(function (k) { window.localStorage.removeItem(k); });
            } catch (err) {
                console.error('[FocusFlow.Storage] Failed to clear storage:', err);
            }
        }
    };

    /* =====================================================
       Date helpers shared across modules (stats/tasks/timer
       all need a consistent "YYYY-MM-DD" key for "today").
       ===================================================== */
    var DateUtil = {
        todayKey: function (date) {
            var d = date || new Date();
            var y = d.getFullYear();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            return y + '-' + m + '-' + day;
        },
        keyForOffset: function (offsetDays) {
            var d = new Date();
            d.setDate(d.getDate() + offsetDays);
            return DateUtil.todayKey(d);
        },
        shortDayLabel: function (offsetDays) {
            var d = new Date();
            d.setDate(d.getDate() + offsetDays);
            return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
        }
    };

    /* =====================================================
       Toast — small non-blocking feedback message.
       ===================================================== */
    var toastTimer = null;
    function showToast(message, duration) {
        var el = document.getElementById('toast');
        if (!el) return;
        el.textContent = message;
        el.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            el.classList.remove('show');
        }, duration || 2200);
    }

    /* =====================================================
       Navigation — swaps the visible `.view` section and
       updates bottom nav + top bar to match.
       ===================================================== */
    var VIEW_META = {
        home: { eyebrow: 'Focus session', title: 'FocusFlow' },
        tasks: { eyebrow: 'Stay on track', title: 'Tasks' },
        stats: { eyebrow: 'Your progress', title: 'Statistics' },
        profile: { eyebrow: 'You', title: 'Profile' }
    };

    function goToView(viewName) {
        var views = document.querySelectorAll('.view');
        var navItems = document.querySelectorAll('.nav-item');

        views.forEach(function (v) {
            v.classList.toggle('active', v.getAttribute('data-view') === viewName);
        });
        navItems.forEach(function (n) {
            n.classList.toggle('active', n.getAttribute('data-nav') === viewName);
        });

        var meta = VIEW_META[viewName] || VIEW_META.home;
        var eyebrowEl = document.getElementById('topbarEyebrow');
        var titleEl = document.getElementById('topbarTitle');
        if (eyebrowEl) eyebrowEl.textContent = meta.eyebrow;
        if (titleEl) titleEl.textContent = meta.title;

        // Let interested modules know a view became active
        // (e.g. stats.js re-renders the chart only when visible).
        document.dispatchEvent(new CustomEvent('focusflow:viewchange', { detail: { view: viewName } }));
    }

    function initNavigation() {
        document.querySelectorAll('[data-nav]').forEach(function (el) {
            el.addEventListener('click', function () {
                goToView(el.getAttribute('data-nav'));
            });
        });
    }

    /* =====================================================
       Reset all app data — used by the Profile view.
       ===================================================== */
    function resetAllData() {
        Storage.clearAll();
        showToast('All app data has been reset');
        document.dispatchEvent(new CustomEvent('focusflow:datareset'));
    }

    function initDangerZone() {
        var btn = document.getElementById('btnResetData');
        if (!btn) return;
        btn.addEventListener('click', function () {
            // A simple native-feeling confirm; avoids pulling in extra UI for a rare action.
            var confirmed = window.confirm('This will erase all tasks, sessions, and stats. Continue?');
            if (confirmed) resetAllData();
        });
    }

    /* =====================================================
       Cordova bootstrap
       ===================================================== */
    function onDeviceReady() {
        console.log('[FocusFlow] deviceready fired. Cordova version: ' + (window.device ? device.cordova : 'n/a'));

        // Cosmetic native plugins — safe no-ops if not installed.
        if (window.StatusBar) {
            StatusBar.styleLightContent();
            StatusBar.backgroundColorByHexString('#14161f');
        }
        if (navigator.splashscreen) {
            navigator.splashscreen.hide();
        }

        // Let feature modules run their own device-dependent setup.
        document.dispatchEvent(new CustomEvent('focusflow:ready'));
    }

    function initApp() {
        initNavigation();
        initDangerZone();

        if (window.cordova) {
            document.addEventListener('deviceready', onDeviceReady, false);
        } else {
            // Running in a plain browser during development —
            // simulate deviceready so the rest of the app still boots.
            console.warn('[FocusFlow] Cordova not detected — running in browser preview mode.');
            setTimeout(onDeviceReady, 50);
        }
    }

    // Public surface used by the other modules.
    FocusFlow.Storage = Storage;
    FocusFlow.DateUtil = DateUtil;
    FocusFlow.showToast = showToast;
    FocusFlow.goToView = goToView;

    document.addEventListener('DOMContentLoaded', initApp);

})(window.FocusFlow);
