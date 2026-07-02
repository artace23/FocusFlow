window.FocusFlow = window.FocusFlow || {};

(function (FocusFlow) {
    'use strict';

    var Storage  = FocusFlow.Storage;
    var DateUtil = FocusFlow.DateUtil;
    var GOAL_KEY = 'dailyGoal';

    function els() {
        return {
            totalSessions:       document.getElementById('totalSessions'),
            totalFocusTime:      document.getElementById('totalFocusTime'),
            tasksCompletedToday: document.getElementById('tasksCompletedToday'),
            avgSession:          document.getElementById('avgSession'),
            bestStreak:          document.getElementById('bestStreak'),
            totalTasksDone:      document.getElementById('totalTasksDone'),
            weekChart:           document.getElementById('weekChart'),
            weekLabels:          document.getElementById('weekLabels'),
            weekTotal:           document.getElementById('weekTotalLabel'),
            goalValue:           document.getElementById('goalValue'),
            goalMinus:           document.getElementById('goalMinus'),
            goalPlus:            document.getElementById('goalPlus'),
            goalBar:             document.getElementById('goalProgressBar'),
            goalLabel:           document.getElementById('goalProgressLabel')
        };
    }

    function fmtHM(mins) {
        return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
    }

    function getGoal() { return Storage.get(GOAL_KEY, 4); }
    function saveGoal(v) { Storage.set(GOAL_KEY, v); }

    function renderTotals() {
        var e = els();
        if (!e.totalSessions || !FocusFlow.Timer) return;

        var sessions    = FocusFlow.Timer.getSessions();
        var totalMins   = sessions.reduce(function (s, x) { return s + x.minutes; }, 0);
        var avg         = sessions.length ? Math.round(totalMins / sessions.length) : 0;
        var todaySessions = FocusFlow.Timer.sessionsForToday().length;
        var goal        = getGoal();

        e.totalSessions.textContent  = sessions.length;
        e.totalFocusTime.textContent = fmtHM(totalMins);
        e.avgSession.textContent     = avg + 'm';
        e.bestStreak.textContent     = FocusFlow.Timer.computeBestStreak();
        e.tasksCompletedToday.textContent = FocusFlow.Tasks ? FocusFlow.Tasks.tasksCompletedToday() : 0;
        e.totalTasksDone.textContent      = FocusFlow.Tasks ? FocusFlow.Tasks.totalTasksDone()      : 0;

        // Goal progress
        if (e.goalValue)  e.goalValue.textContent  = goal;
        if (e.goalBar)    e.goalBar.style.width     = Math.min(100, Math.round(todaySessions / goal * 100)) + '%';
        if (e.goalLabel)  e.goalLabel.textContent   = todaySessions + ' / ' + goal + ' sessions today';
    }

    function renderWeekChart() {
        var e = els();
        if (!e.weekChart || !FocusFlow.Timer) return;

        var sessions     = FocusFlow.Timer.getSessions();
        var byDay        = {};
        sessions.forEach(function (s) { byDay[s.dateKey] = (byDay[s.dateKey] || 0) + s.minutes; });

        var days = [];
        for (var offset = -6; offset <= 0; offset++) {
            var key = DateUtil.keyForOffset(offset);
            days.push({ key: key, minutes: byDay[key] || 0, label: DateUtil.shortDayLabel(offset), isToday: offset === 0 });
        }

        var weekTotal = days.reduce(function (s, d) { return s + d.minutes; }, 0);
        if (e.weekTotal) e.weekTotal.textContent = weekTotal ? fmtHM(weekTotal) + ' this week' : '';

        var maxMins = Math.max.apply(null, days.map(function (d) { return d.minutes; }).concat([25]));

        e.weekChart.innerHTML = days.map(function (d) {
            var h = Math.max(4, Math.round(d.minutes / maxMins * 100));
            return (
                '<div class="week-bar-wrap" title="' + d.minutes + ' min">' +
                    '<div class="week-bar' + (d.minutes > 0 ? ' has-activity' : '') + (d.isToday ? ' is-today' : '') +
                        '" style="height:' + h + '%"></div>' +
                '</div>'
            );
        }).join('');

        e.weekLabels.innerHTML = days.map(function (d) {
            return '<span' + (d.isToday ? ' class="today-label"' : '') + '>' + d.label + '</span>';
        }).join('');
    }

    function render() { renderTotals(); renderWeekChart(); }

    function bindGoalStepper() {
        var e = els();
        if (!e.goalMinus || !e.goalPlus) return;
        e.goalMinus.addEventListener('click', function () {
            var v = Math.max(1, getGoal() - 1);
            saveGoal(v); render();
        });
        e.goalPlus.addEventListener('click', function () {
            var v = Math.min(12, getGoal() + 1);
            saveGoal(v); render();
        });
    }

    function init() { bindGoalStepper(); render(); }

    document.addEventListener('focusflow:ready',       init);
    document.addEventListener('focusflow:sessionsaved', render);
    document.addEventListener('focusflow:taskschanged', render);
    document.addEventListener('focusflow:datareset',   render);
    document.addEventListener('focusflow:viewchange',  function (e) {
        if (e.detail && e.detail.view === 'stats') render();
    });

    FocusFlow.Stats = { render };

})(window.FocusFlow);