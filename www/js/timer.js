window.FocusFlow = window.FocusFlow || {};

(function (FocusFlow) {
    'use strict';

    var Storage  = FocusFlow.Storage;
    var DateUtil = FocusFlow.DateUtil;

    var SESSIONS_KEY = 'sessions';
    var RING_CIRCUMFERENCE = 2 * Math.PI * 98;

    /* ---------- Mode config ---------- */
    var MODES = {
        focus: { label: 'Focus',       defaultMin: 25 },
        short: { label: 'Short Break', defaultMin: 5  },
        long:  { label: 'Long Break',  defaultMin: 15 }
    };

    var state = {
        mode: 'focus',
        remaining: 0,
        totalForRun: 0,
        running: false,
        intervalId: null
    };

    function getFocusDuration() {
        return (Storage.get('focusDuration', 25)) * 60;
    }
    function durationForMode(mode) {
        if (mode === 'focus') return getFocusDuration();
        return MODES[mode].defaultMin * 60;
    }
    function resetToMode(mode) {
        pause();
        state.mode = mode;
        state.remaining = durationForMode(mode);
        state.totalForRun = state.remaining;
        render();
    }

    /* ---------- DOM refs ---------- */
    function els() {
        return {
            display:     document.getElementById('timerDisplay'),
            mode:        document.getElementById('timerMode'),
            ring:        document.getElementById('ringProgress'),
            ringWrap:    document.querySelector('.flow-ring-wrap'),
            btnStart:    document.getElementById('btnStart'),
            btnPause:    document.getElementById('btnPause'),
            btnReset:    document.getElementById('btnReset'),
            statSessions: document.getElementById('statSessionsToday'),
            statMinutes:  document.getElementById('statMinutesToday'),
            statStreak:   document.getElementById('statStreak')
        };
    }

    function formatTime(s) {
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    function render() {
        var e = els();
        if (!e.display) return;
        e.display.textContent = formatTime(state.remaining);
        var progress = 1 - state.remaining / state.totalForRun;
        var offset = RING_CIRCUMFERENCE * (1 - progress);
        e.ring.style.strokeDasharray  = RING_CIRCUMFERENCE;
        e.ring.style.strokeDashoffset = offset;
        if (e.ringWrap) e.ringWrap.classList.toggle('is-running', state.running);
        e.mode.textContent = MODES[state.mode].label;
        e.btnStart.hidden  = state.running;
        e.btnPause.hidden  = !state.running;
        e.btnStart.textContent = state.remaining === state.totalForRun ? 'Start ' + MODES[state.mode].label : 'Resume';
        renderQuickStats();
    }

    /* ---------- Sessions ---------- */
    function getSessions()    { return Storage.get(SESSIONS_KEY, []); }
    function sessionsForToday() {
        var today = DateUtil.todayKey();
        return getSessions().filter(function (s) { return s.dateKey === today; });
    }
    function saveSession(minutes) {
        var arr = getSessions();
        arr.push({ dateKey: DateUtil.todayKey(), minutes: minutes, completedAt: new Date().toISOString() });
        Storage.set(SESSIONS_KEY, arr);
    }
    function computeStreak() {
        var map = {};
        getSessions().forEach(function (s) { map[s.dateKey] = true; });
        var streak = 0, offset = map[DateUtil.todayKey()] ? 0 : -1;
        while (map[DateUtil.keyForOffset(offset)]) { streak++; offset--; }
        return streak;
    }
    function computeBestStreak() {
        var map = {};
        getSessions().forEach(function (s) { map[s.dateKey] = true; });
        var days = Object.keys(map).sort();
        var best = 0, cur = 0, prev = null;
        days.forEach(function (d) {
            if (prev) {
                var diff = (new Date(d) - new Date(prev)) / 86400000;
                cur = diff === 1 ? cur + 1 : 1;
            } else { cur = 1; }
            if (cur > best) best = cur;
            prev = d;
        });
        return best;
    }

    function renderQuickStats() {
        var e = els();
        if (!e.statSessions) return;
        var todays  = sessionsForToday();
        var minutes = todays.reduce(function (sum, s) { return sum + s.minutes; }, 0);
        e.statSessions.textContent = todays.length;
        e.statMinutes.textContent  = minutes;
        e.statStreak.textContent   = computeStreak();
    }

    /* ---------- Timer control ---------- */
    function tick() {
        state.remaining--;
        if (state.remaining <= 0) { completeSession(); return; }
        render();
    }
    function start() {
        if (state.running) return;
        state.running = true;
        state.intervalId = setInterval(tick, 1000);
        render();
    }
    function pause() {
        if (!state.running) return;
        state.running = false;
        clearInterval(state.intervalId);
        state.intervalId = null;
        render();
    }
    function reset() {
        pause();
        state.remaining = durationForMode(state.mode);
        state.totalForRun = state.remaining;
        render();
    }
    function completeSession() {
        pause();
        var mins = Math.round(state.totalForRun / 60);
        if (state.mode === 'focus') {
            saveSession(mins);
            FocusFlow.showToast('Focus session complete — nice work! 🎉');
            document.dispatchEvent(new CustomEvent('focusflow:timercomplete', { detail: { minutes: mins } }));
            document.dispatchEvent(new CustomEvent('focusflow:sessionsaved'));
            // Auto-start short break if pref set
            if (Storage.get('autoBreak', false)) {
                setTimeout(function () { setActiveMode('short'); start(); }, 800);
                return;
            }
        } else {
            FocusFlow.showToast('Break over. Ready to focus?');
        }
        state.remaining = state.totalForRun;
        render();
    }

    /* ---------- Mode pills ---------- */
    function setActiveMode(mode) {
        document.querySelectorAll('.mode-pill').forEach(function (p) {
            p.classList.toggle('active', p.getAttribute('data-mode') === mode);
        });
        resetToMode(mode);
    }

    /* ---------- Wiring ---------- */
    function bindControls() {
        var e = els();
        if (!e.btnStart) return;
        e.btnStart.addEventListener('click', start);
        e.btnPause.addEventListener('click', pause);
        e.btnReset.addEventListener('click', function () { reset(); FocusFlow.showToast('Timer reset'); });
        document.querySelectorAll('.mode-pill').forEach(function (pill) {
            pill.addEventListener('click', function () { setActiveMode(pill.getAttribute('data-mode')); });
        });
    }

    function init() {
        resetToMode('focus');
        bindControls();
    }

    document.addEventListener('focusflow:datareset', function () { resetToMode('focus'); });
    document.addEventListener('focusflow:ready', init);
    // Refresh duration when preference changes
    document.addEventListener('focusflow:prefchanged', function () {
        if (!state.running) reset();
    });

    FocusFlow.Timer = { getSessions, sessionsForToday, computeStreak, computeBestStreak, durationForMode };

})(window.FocusFlow);