window.FocusFlow = window.FocusFlow || {};

(function (FocusFlow) {
    'use strict';

    var Storage  = FocusFlow.Storage;
    var DateUtil = FocusFlow.DateUtil;
    var TASKS_KEY = 'tasks';

    var PRIORITY_ICON = { high: '↑', low: '↓', normal: '' };

    var SAMPLE_TASKS = [
        { id: 'seed-1', title: 'Plan tomorrow\'s priorities', priority: 'high',   completed: false, createdAt: new Date().toISOString() },
        { id: 'seed-2', title: 'Reply to outstanding emails', priority: 'normal', completed: false, createdAt: new Date().toISOString() },
        { id: 'seed-3', title: 'Review project roadmap',      priority: 'normal', completed: true,  createdAt: new Date().toISOString(), completedAt: new Date().toISOString() }
    ];

    function getTasks() {
        var t = Storage.get(TASKS_KEY, null);
        if (t === null) { Storage.set(TASKS_KEY, SAMPLE_TASKS); return SAMPLE_TASKS.slice(); }
        return t;
    }
    function saveTasks(tasks) { Storage.set(TASKS_KEY, tasks); }
    function generateId() { return 't-' + Date.now() + '-' + Math.floor(Math.random() * 1000); }

    function addTask(title, priority) {
        var trimmed = (title || '').trim();
        if (!trimmed) { FocusFlow.showToast('Type a task first'); return false; }
        var tasks = getTasks();
        tasks.unshift({ id: generateId(), title: trimmed, priority: priority || 'normal', completed: false, createdAt: new Date().toISOString() });
        saveTasks(tasks);
        render();
        return true;
    }

    function toggleTask(id) {
        var tasks = getTasks();
        var t = tasks.find(function (x) { return x.id === id; });
        if (!t) return;
        t.completed  = !t.completed;
        t.completedAt = t.completed ? new Date().toISOString() : null;
        saveTasks(tasks);
        render();
        document.dispatchEvent(new CustomEvent('focusflow:taskschanged'));
    }

    function deleteTask(id) {
        saveTasks(getTasks().filter(function (t) { return t.id !== id; }));
        render();
        document.dispatchEvent(new CustomEvent('focusflow:taskschanged'));
    }

    function clearCompleted() {
        saveTasks(getTasks().filter(function (t) { return !t.completed; }));
        render();
        document.dispatchEvent(new CustomEvent('focusflow:taskschanged'));
    }

    function tasksCompletedToday() {
        var today = DateUtil.todayKey();
        return getTasks().filter(function (t) {
            return t.completed && t.completedAt && DateUtil.todayKey(new Date(t.completedAt)) === today;
        }).length;
    }

    function totalTasksDone() {
        return getTasks().filter(function (t) { return t.completed; }).length;
    }

    /* --- DOM helpers --- */
    function esc(str) { var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

    function taskItemHTML(t) {
        var pIcon = PRIORITY_ICON[t.priority] || '';
        var pClass = t.priority !== 'normal' ? ' priority-' + t.priority : '';
        return (
            '<li class="task-item' + (t.completed ? ' completed' : '') + pClass + '" data-id="' + t.id + '">' +
                '<button class="task-checkbox" data-action="toggle" aria-label="Toggle complete">' + (t.completed ? '✓' : '') + '</button>' +
                (pIcon ? '<span class="priority-badge">' + pIcon + '</span>' : '') +
                '<span class="task-title">' + esc(t.title) + '</span>' +
                '<button class="task-delete" data-action="delete" aria-label="Delete">✕</button>' +
            '</li>'
        );
    }

    function renderTaskList() {
        var listEl     = document.getElementById('taskList');
        var doneEl     = document.getElementById('completedList');
        var emptyHint  = document.getElementById('taskEmptyHint');
        var doneHeader = document.getElementById('completedHeader');
        var countEl    = document.getElementById('taskCount');
        if (!listEl) return;

        var all       = getTasks();
        var pending   = all.filter(function (t) { return !t.completed; });
        var completed = all.filter(function (t) { return t.completed; });

        // Sort: high first, then normal, then low
        var order = { high: 0, normal: 1, low: 2 };
        pending.sort(function (a, b) { return (order[a.priority] || 1) - (order[b.priority] || 1); });

        countEl.textContent = pending.length + (pending.length === 1 ? ' task' : ' tasks');
        emptyHint.hidden   = pending.length > 0;
        listEl.innerHTML   = pending.map(taskItemHTML).join('');

        if (doneEl && doneHeader) {
            doneHeader.hidden  = completed.length === 0;
            doneEl.innerHTML   = completed.map(taskItemHTML).join('');
        }
    }

    function renderUpNext() {
        var container = document.getElementById('upNextList');
        if (!container) return;
        var pending = getTasks().filter(function (t) { return !t.completed; }).slice(0, 3);
        if (!pending.length) {
            container.innerHTML = '<p class="empty-hint">All caught up! 🎉</p>';
            return;
        }
        container.innerHTML = pending.map(function (t) {
            var pIcon = PRIORITY_ICON[t.priority] || '';
            return (
                '<div class="task-preview-row">' +
                    '<span class="task-preview-dot' + (t.priority === 'high' ? ' dot-high' : '') + '"></span>' +
                    (pIcon ? '<span class="priority-badge small">' + pIcon + '</span>' : '') +
                    '<span>' + esc(t.title) + '</span>' +
                '</div>'
            );
        }).join('');
    }

    function render() { renderTaskList(); renderUpNext(); }

    /* --- Wiring --- */
    function delegateList(el) {
        el.addEventListener('click', function (e) {
            var actionEl = e.target.closest('[data-action]');
            if (!actionEl) return;
            var itemEl = e.target.closest('.task-item');
            var id = itemEl && itemEl.getAttribute('data-id');
            if (!id) return;
            if (actionEl.getAttribute('data-action') === 'toggle') toggleTask(id);
            else if (actionEl.getAttribute('data-action') === 'delete') deleteTask(id);
        });
    }

    function bindControls() {
        var input    = document.getElementById('newTaskInput');
        var priority = document.getElementById('newTaskPriority');
        var addBtn   = document.getElementById('btnAddTask');
        var listEl   = document.getElementById('taskList');
        var doneEl   = document.getElementById('completedList');
        var clearBtn = document.getElementById('btnClearDone');

        if (addBtn) {
            addBtn.addEventListener('click', function () {
                if (addTask(input.value, priority ? priority.value : 'normal')) {
                    input.value = '';
                    if (priority) priority.value = 'normal';
                    input.focus();
                }
            });
        }
        if (input) { input.addEventListener('keydown', function (e) { if (e.key === 'Enter') addBtn.click(); }); }
        if (listEl) delegateList(listEl);
        if (doneEl)  delegateList(doneEl);
        if (clearBtn) { clearBtn.addEventListener('click', function () { clearCompleted(); FocusFlow.showToast('Completed tasks cleared'); }); }
    }

    function init() { bindControls(); render(); }

    document.addEventListener('focusflow:ready', init);
    document.addEventListener('focusflow:datareset', render);

    FocusFlow.Tasks = { getTasks, tasksCompletedToday, totalTasksDone };

})(window.FocusFlow);