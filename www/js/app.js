window.FocusFlow = window.FocusFlow || {};

(function (FocusFlow) {
    'use strict';

    var STORAGE_PREFIX = 'focusflow.';
    var Storage = {
        get: function (k, fb) {
            try { var r = localStorage.getItem(STORAGE_PREFIX + k); return r == null ? fb : JSON.parse(r); }
            catch (e) { return fb; }
        },
        set: function (k, v) { try { localStorage.setItem(STORAGE_PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
        remove: function (k) { try { localStorage.removeItem(STORAGE_PREFIX + k); } catch (e) {} },
        clearAll: function () {
            try { Object.keys(localStorage).filter(function (k) { return k.indexOf(STORAGE_PREFIX) === 0; })
                .forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
        }
    };

    var DateUtil = {
        todayKey: function (d) {
            d = d || new Date();
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        },
        keyForOffset: function (n) { var d = new Date(); d.setDate(d.getDate() + n); return DateUtil.todayKey(d); },
        shortDayLabel: function (n) { var d = new Date(); d.setDate(d.getDate() + n); return ['S','M','T','W','T','F','S'][d.getDay()]; }
    };

    /* --- Toast --- */
    var toastTimer = null;
    function showToast(msg, dur) {
        var el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('show'); }, dur || 2400);
    }

    /* --- Motivation quotes --- */
    var QUOTES = [
        'One focused hour beats three distracted ones.',
        'Progress, not perfection.',
        'Small steps every day.',
        'Your future self will thank you.',
        'Stay in flow. Stay on fire.',
        'Discipline is choosing what you want most over what you want now.',
        'The secret is to start.'
    ];
    function renderQuote() {
        var el = document.getElementById('motivationQuote');
        if (el) el.textContent = '"' + QUOTES[Math.floor(Math.random() * QUOTES.length)] + '"';
    }

    /* --- Navigation --- */
    var VIEW_META = {
        home:    { eyebrow: 'Focus session',  title: 'FocusFlow' },
        tasks:   { eyebrow: 'Stay on track',  title: 'Tasks'     },
        stats:   { eyebrow: 'Your progress',  title: 'Statistics'},
        profile: { eyebrow: 'You',            title: 'Profile'   }
    };

    function goToView(name) {
        document.querySelectorAll('.view').forEach(function (v) {
            v.classList.toggle('active', v.getAttribute('data-view') === name);
        });
        document.querySelectorAll('.nav-item').forEach(function (n) {
            n.classList.toggle('active', n.getAttribute('data-nav') === name);
        });
        var meta = VIEW_META[name] || VIEW_META.home;
        var eb = document.getElementById('topbarEyebrow');
        var ti = document.getElementById('topbarTitle');
        if (eb) eb.textContent = meta.eyebrow;
        if (ti) ti.textContent = meta.title;
        document.dispatchEvent(new CustomEvent('focusflow:viewchange', { detail: { view: name } }));
    }

    function initNavigation() {
        document.querySelectorAll('[data-nav]').forEach(function (el) {
            el.addEventListener('click', function () { goToView(el.getAttribute('data-nav')); });
        });
    }

    /* --- Profile name editing --- */
    function initProfile() {
        var nameEl   = document.getElementById('profileName');
        var inputEl  = document.getElementById('profileNameInput');
        var editBtn  = document.getElementById('btnEditName');

        // Load saved name
        var saved = Storage.get('profileName', '');
        if (saved && nameEl) nameEl.textContent = saved;
        updateAvatarInitial(saved);

        if (editBtn && nameEl && inputEl) {
            editBtn.addEventListener('click', function () {
                var editing = !inputEl.hidden;
                if (editing) {
                    // Save
                    var val = inputEl.value.trim() || 'Focuser';
                    nameEl.textContent = val;
                    Storage.set('profileName', val);
                    updateAvatarInitial(val);
                    inputEl.hidden = true;
                    nameEl.hidden  = false;
                    editBtn.textContent = '✎';
                } else {
                    inputEl.value  = nameEl.textContent;
                    inputEl.hidden = false;
                    nameEl.hidden  = true;
                    inputEl.focus();
                    editBtn.textContent = '✔';
                }
            });
            inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') editBtn.click(); });
        }
    }

    function updateAvatarInitial(name) {
        var initial = (name || 'F').charAt(0).toUpperCase();
        var els = [document.getElementById('topbarAvatarInitial'), document.getElementById('profilePhotoInitial')];
        els.forEach(function (el) { if (el) el.textContent = initial; });
    }

    /* --- Preferences (focus duration, auto-break) --- */
    function initPreferences() {
        var focusMinus = document.getElementById('focusMinus');
        var focusPlus  = document.getElementById('focusPlus');
        var focusVal   = document.getElementById('focusDurValue');
        var autoBreak  = document.getElementById('toggleAutoBreak');

        function updateFocusDisplay() {
            var v = Storage.get('focusDuration', 25);
            if (focusVal) focusVal.textContent = v;
        }
        updateFocusDisplay();
        if (autoBreak) autoBreak.checked = Storage.get('autoBreak', false);

        if (focusMinus) focusMinus.addEventListener('click', function () {
            var v = Math.max(5, Storage.get('focusDuration', 25) - 5);
            Storage.set('focusDuration', v); updateFocusDisplay();
            document.dispatchEvent(new CustomEvent('focusflow:prefchanged'));
        });
        if (focusPlus) focusPlus.addEventListener('click', function () {
            var v = Math.min(60, Storage.get('focusDuration', 25) + 5);
            Storage.set('focusDuration', v); updateFocusDisplay();
            document.dispatchEvent(new CustomEvent('focusflow:prefchanged'));
        });
        if (autoBreak) autoBreak.addEventListener('change', function () {
            Storage.set('autoBreak', autoBreak.checked);
        });
    }

    /* --- Reset --- */
    function initDangerZone() {
        var btn = document.getElementById('btnResetData');
        if (!btn) return;
        btn.addEventListener('click', function () {
            if (window.confirm('Erase all tasks, sessions and stats?')) {
                Storage.clearAll();
                showToast('All data has been reset');
                document.dispatchEvent(new CustomEvent('focusflow:datareset'));
                updateAvatarInitial('F');
                var nameEl = document.getElementById('profileName');
                if (nameEl) nameEl.textContent = 'Focuser';
            }
        });
    }

    /* --- Cordova bootstrap --- */
    function onDeviceReady() {
        if (window.StatusBar) {
            StatusBar.styleLightContent();
            StatusBar.backgroundColorByHexString('#101217');
        }
        if (navigator.splashscreen) navigator.splashscreen.hide();
        document.dispatchEvent(new CustomEvent('focusflow:ready'));
    }

    function initApp() {
        initNavigation();
        initDangerZone();
        initProfile();
        initPreferences();
        renderQuote();
        if (window.cordova) {
            document.addEventListener('deviceready', onDeviceReady, false);
        } else {
            console.warn('[FocusFlow] Browser preview mode.');
            setTimeout(onDeviceReady, 50);
        }
    }

    FocusFlow.Storage  = Storage;
    FocusFlow.DateUtil = DateUtil;
    FocusFlow.showToast = showToast;
    FocusFlow.goToView  = goToView;

    document.addEventListener('DOMContentLoaded', initApp);

})(window.FocusFlow);