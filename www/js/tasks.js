/**
 * tasks.js
 * ---------------------------------------------------------
 * Task management: create, complete, delete, and persist
 * tasks to localStorage. Also renders the "Up next" preview
 * shown on the Home view.
 * ---------------------------------------------------------
 */
window.FocusFlow = window.FocusFlow || {};

(function (FocusFlow) {
    'use strict';

    var Storage = FocusFlow.Storage;
    var DateUtil = FocusFlow.DateUtil;
    var TASKS_KEY = 'tasks';

    /**
     * Sample data so the app has something to show on first
     * launch / for demos. Only seeded if no tasks exist yet.
     */
    var SAMPLE_TASKS = [
        { id: 'seed-1', title: 'Plan tomorrow\'s priorities', completed: false, createdAt: new Date().toISOString() },
        { id: 'seed-2', title: 'Reply to outstanding emails', completed: false, createdAt: new Date().toISOString() },
        { id: 'seed-3', title: 'Review project roadmap', completed: true, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() }
    ];

    function getTasks() {
        var tasks = Storage.get(TASKS_KEY, null);
        if (tasks === null) {
            Storage.set(TASKS_KEY, SAMPLE_TASKS);
            return SAMPLE_TASKS.slice();
        }
        return tasks;
    }

    function saveTasks(tasks) {
        Storage.set(TASKS_KEY, tasks);
    }

    function generateId() {
        return 't-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }

    function addTask(title) {
        var trimmed = (title || '').trim();
        if (!trimmed) {
            FocusFlow.showToast('Type a task before adding it');
            return false;
        }
        var tasks = getTasks();
        tasks.unshift({
            id: generateId(),
            title: trimmed,
            completed: false,
            createdAt: new Date().toISOString()
        });
        saveTasks(tasks);
        render();
        return true;
    }

    function toggleTask(id) {
        var tasks = getTasks();
        var task = tasks.find(function (t) { return t.id === id; });
        if (!task) return;
        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date().toISOString() : null;
        saveTasks(tasks);
        render();
        document.dispatchEvent(new CustomEvent('focusflow:taskschanged'));
    }

    function deleteTask(id) {
        var tasks = getTasks().filter(function (t) { return t.id !== id; });
        saveTasks(tasks);
        render();
        document.dispatchEvent(new CustomEvent('focusflow:taskschanged'));
    }

    function tasksCompletedToday() {
        var todayKey = DateUtil.todayKey();
        return getTasks().filter(function (t) {
            return t.completed && t.completedAt && DateUtil.todayKey(new Date(t.completedAt)) === todayKey;
        }).length;
    }

    /* ----------------- Rendering ----------------- */
    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function renderTaskList() {
        var listEl = document.getElementById('taskList');
        var emptyHint = document.getElementById('taskEmptyHint');
        var countEl = document.getElementById('taskCount');
        if (!listEl) return;

        var tasks = getTasks();
        countEl.textContent = tasks.length + (tasks.length === 1 ? ' task' : ' tasks');

        if (tasks.length === 0) {
            listEl.innerHTML = '';
            emptyHint.hidden = false;
            return;
        }
        emptyHint.hidden = true;

        listEl.innerHTML = tasks.map(function (t) {
            return (
                '<li class="task-item ' + (t.completed ? 'completed' : '') + '" data-id="' + t.id + '">' +
                    '<button class="task-checkbox" data-action="toggle" aria-label="Toggle task complete">' + (t.completed ? '✓' : '') + '</button>' +
                    '<span class="task-title">' + escapeHtml(t.title) + '</span>' +
                    '<button class="task-delete" data-action="delete" aria-label="Delete task">✕</button>' +
                '</li>'
            );
        }).join('');
    }

    function renderUpNext() {
        var container = document.getElementById('upNextList');
        if (!container) return;

        var pending = getTasks().filter(function (t) { return !t.completed; }).slice(0, 3);
        if (pending.length === 0) {
            container.innerHTML = '<p class="empty-hint">All caught up! Add a new task from the Tasks tab.</p>';
            return;
        }
        container.innerHTML = pending.map(function (t) {
            return (
                '<div class="task-preview-row">' +
                    '<span class="task-preview-dot"></span>' +
                    '<span>' + escapeHtml(t.title) + '</span>' +
                '</div>'
            );
        }).join('');
    }

    function render() {
        renderTaskList();
        renderUpNext();
    }

    /* ----------------- Wiring ----------------- */
    function bindControls() {
        var input = document.getElementById('newTaskInput');
        var addBtn = document.getElementById('btnAddTask');
        var list = document.getElementById('taskList');

        if (addBtn) {
            addBtn.addEventListener('click', function () {
                if (addTask(input.value)) {
                    input.value = '';
                    input.focus();
                }
            });
        }
        if (input) {
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') addBtn.click();
            });
        }
        if (list) {
            // Event delegation keeps this working even as items are re-rendered.
            list.addEventListener('click', function (e) {
                var actionEl = e.target.closest('[data-action]');
                if (!actionEl) return;
                var itemEl = e.target.closest('.task-item');
                var id = itemEl && itemEl.getAttribute('data-id');
                if (!id) return;

                if (actionEl.getAttribute('data-action') === 'toggle') {
                    toggleTask(id);
                } else if (actionEl.getAttribute('data-action') === 'delete') {
                    deleteTask(id);
                }
            });
        }
    }

    function init() {
        bindControls();
        render();
    }

    document.addEventListener('focusflow:datareset', render);
    document.addEventListener('focusflow:ready', init);

    FocusFlow.Tasks = {
        getTasks: getTasks,
        addTask: addTask,
        toggleTask: toggleTask,
        deleteTask: deleteTask,
        tasksCompletedToday: tasksCompletedToday
    };

})(window.FocusFlow);