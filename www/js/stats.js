/**
 * stats.js
 * ---------------------------------------------------------
 * Aggregates data produced by timer.js and tasks.js into
 * the Statistics dashboard: totals, averages, and a 7-day
 * activity chart.
 * ---------------------------------------------------------
 */
window.FocusFlow = window.FocusFlow || {};

(function (FocusFlow) {
    'use strict';

    var DateUtil = FocusFlow.DateUtil;

    function els() {
        return {
            totalSessions: document.getElementById('totalSessions'),
            totalFocusTime: document.getElementById('totalFocusTime'),
            tasksCompletedToday: document.getElementById('tasksCompletedToday'),
            avgSession: document.getElementById('avgSession'),
            weekChart: document.getElementById('weekChart'),
            weekLabels: document.getElementById('weekLabels')
        };
    }

    function formatHoursMinutes(totalMinutes) {
        var hours = Math.floor(totalMinutes / 60);
        var minutes = totalMinutes % 60;
        return hours + 'h ' + minutes + 'm';
    }

    function renderTotals() {
        var e = els();
        if (!e.totalSessions || !FocusFlow.Timer) return;

        var sessions = FocusFlow.Timer.getSessions();
        var totalMinutes = sessions.reduce(function (sum, s) { return sum + s.minutes; }, 0);
        var avg = sessions.length ? Math.round(totalMinutes / sessions.length) : 0;

        e.totalSessions.textContent = sessions.length;
        e.totalFocusTime.textContent = formatHoursMinutes(totalMinutes);
        e.avgSession.textContent = avg + 'm';
        e.tasksCompletedToday.textContent = FocusFlow.Tasks ? FocusFlow.Tasks.tasksCompletedToday() : 0;
    }

    /** Builds a 7-day (oldest -> today) bar chart of minutes focused per day. */
    function renderWeekChart() {
        var e = els();
        if (!e.weekChart || !FocusFlow.Timer) return;

        var sessions = FocusFlow.Timer.getSessions();
        var minutesByDay = {};
        sessions.forEach(function (s) {
            minutesByDay[s.dateKey] = (minutesByDay[s.dateKey] || 0) + s.minutes;
        });

        var days = [];
        for (var offset = -6; offset <= 0; offset++) {
            var key = DateUtil.keyForOffset(offset);
            days.push({
                key: key,
                minutes: minutesByDay[key] || 0,
                label: DateUtil.shortDayLabel(offset)
            });
        }

        var maxMinutes = Math.max.apply(null, days.map(function (d) { return d.minutes; }).concat([25]));

        e.weekChart.innerHTML = days.map(function (d) {
            var heightPct = Math.max(4, Math.round((d.minutes / maxMinutes) * 100));
            var activeClass = d.minutes > 0 ? 'has-activity' : '';
            return (
                '<div class="week-bar-wrap" title="' + d.minutes + ' min">' +
                    '<div class="week-bar ' + activeClass + '" style="height:' + heightPct + '%"></div>' +
                '</div>'
            );
        }).join('');

        e.weekLabels.innerHTML = days.map(function (d) {
            return '<span>' + d.label + '</span>';
        }).join('');
    }

    function render() {
        renderTotals();
        renderWeekChart();
    }

    /* ----------------- Wiring -----------------
       Refresh whenever a session completes, a task changes,
       data is reset, or the user navigates to the Stats tab
       (cheap to recompute, and guarantees freshness). */
    document.addEventListener('focusflow:sessionsaved', render);
    document.addEventListener('focusflow:taskschanged', render);
    document.addEventListener('focusflow:datareset', render);
    document.addEventListener('focusflow:ready', render);
    document.addEventListener('focusflow:viewchange', function (e) {
        if (e.detail && e.detail.view === 'stats') render();
    });

    FocusFlow.Stats = { render: render };

})(window.FocusFlow);
