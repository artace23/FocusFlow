/**
 * timer.js
 * ---------------------------------------------------------
 * The Pomodoro focus timer. Handles counting down, updating
 * the Flow Ring UI, and persisting completed sessions to
 * storage. Fires a `focusflow:timercomplete` event so
 * device.js can trigger a local notification + vibration
 * without timer.js needing to know about plugins directly.
 * ---------------------------------------------------------
 */
window.FocusFlow = window.FocusFlow || {};

(function (FocusFlow) {
    'use strict';

    var Storage = FocusFlow.Storage;
    var DateUtil = FocusFlow.DateUtil;

    var FOCUS_SECONDS = 25 * 60;   // 25-minute Pomodoro session
    var SESSIONS_KEY = 'sessions'; // array of { dateKey, minutes, completedAt }

    var state = {
        remaining: FOCUS_SECONDS,
        totalForRun: FOCUS_SECONDS,
        running: false,
        intervalId: null
    };

    var RING_CIRCUMFERENCE = 2 * Math.PI * 98; // matches the SVG circle r=98

    /* ----------------- DOM refs (queried lazily) ----------------- */
    function els() {
        return {
            display: document.getElementById('timerDisplay'),
            mode: document.getElementById('timerMode'),
            ring: document.getElementById('ringProgress'),
            ringWrap: document.querySelector('.flow-ring-wrap'),
            btnStart: document.getElementById('btnStart'),
            btnPause: document.getElementById('btnPause'),
            btnReset: document.getElementById('btnReset'),
            statSessionsToday: document.getElementById('statSessionsToday'),
            statMinutesToday: document.getElementById('statMinutesToday'),
            statStreak: document.getElementById('statStreak')
        };
    }

    function formatTime(totalSeconds) {
        var m = Math.floor(totalSeconds / 60);
        var s = totalSeconds % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function render() {
        var e = els();
        if (!e.display) return; // Home view not present (shouldn't happen, but stay defensive)

        e.display.textContent = formatTime(state.remaining);

        var progressFraction = 1 - (state.remaining / state.totalForRun);
        var offset = RING_CIRCUMFERENCE - (progressFraction * RING_CIRCUMFERENCE);
        e.ring.style.strokeDasharray = RING_CIRCUMFERENCE;
        e.ring.style.strokeDashoffset = offset;

        if (e.ringWrap) e.ringWrap.classList.toggle('is-running', state.running);

        e.btnStart.hidden = state.running;
        e.btnPause.hidden = !state.running;
        e.btnStart.textContent = state.remaining === state.totalForRun ? 'Start Focus' : 'Resume';

        renderQuickStats();
    }

    /* ----------------- Session persistence ----------------- */
    function getSessions() {
        return Storage.get(SESSIONS_KEY, []);
    }

    function saveSession(minutes) {
        var sessions = getSessions();
        sessions.push({
            dateKey: DateUtil.todayKey(),
            minutes: minutes,
            completedAt: new Date().toISOString()
        });
        Storage.set(SESSIONS_KEY, sessions);
    }

    function sessionsForToday() {
        var todayKey = DateUtil.todayKey();
        return getSessions().filter(function (s) { return s.dateKey === todayKey; });
    }

    /** Consecutive days (including today, if it has a session) with at least one completed session. */
    function computeStreak() {
        var sessions = getSessions();
        var daysWithSessions = {};
        sessions.forEach(function (s) { daysWithSessions[s.dateKey] = true; });

        var streak = 0;
        var offset = 0;
        // If today has no sessions yet, streak still counts backwards from yesterday.
        if (!daysWithSessions[DateUtil.todayKey()]) {
            offset = -1;
        }
        while (daysWithSessions[DateUtil.keyForOffset(offset)]) {
            streak++;
            offset--;
        }
        return streak;
    }

    function renderQuickStats() {
        var e = els();
        if (!e.statSessionsToday) return;
        var todays = sessionsForToday();
        var minutes = todays.reduce(function (sum, s) { return sum + s.minutes; }, 0);

        e.statSessionsToday.textContent = todays.length;
        e.statMinutesToday.textContent = minutes;
        e.statStreak.textContent = computeStreak();
    }

    /* ----------------- Timer control ----------------- */
    function tick() {
        state.remaining--;
        if (state.remaining <= 0) {
            completeSession();
            return;
        }
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
        state.remaining = FOCUS_SECONDS;
        state.totalForRun = FOCUS_SECONDS;
        render();
    }

    function completeSession() {
        pause();
        var minutesCompleted = Math.round(state.totalForRun / 60);
        saveSession(minutesCompleted);
        state.remaining = state.totalForRun; // reset ring for the next round

        FocusFlow.showToast('Focus session complete — nice work!');
        render();

        // Notify other modules (device.js) so they can fire a
        // local notification + vibration without timer.js coupling
        // directly to Cordova plugin APIs.
        document.dispatchEvent(new CustomEvent('focusflow:timercomplete', {
            detail: { minutes: minutesCompleted }
        }));

        // Statistics view listens for this to refresh if it's on screen.
        document.dispatchEvent(new CustomEvent('focusflow:sessionsaved'));
    }

    /* ----------------- Wiring ----------------- */
    function bindControls() {
        var e = els();
        if (!e.btnStart) return;

        e.btnStart.addEventListener('click', start);
        e.btnPause.addEventListener('click', pause);
        e.btnReset.addEventListener('click', function () {
            reset();
            FocusFlow.showToast('Timer reset');
        });
    }

    function init() {
        bindControls();
        render();
    }

    // Reset in-memory timer state whenever the user wipes app data.
    document.addEventListener('focusflow:datareset', reset);
    document.addEventListener('focusflow:ready', init);

    // Expose a small public API in case other modules need timer data.
    FocusFlow.Timer = {
        getSessions: getSessions,
        sessionsForToday: sessionsForToday,
        computeStreak: computeStreak,
        FOCUS_SECONDS: FOCUS_SECONDS
    };

})(window.FocusFlow);