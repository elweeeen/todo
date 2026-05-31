/* ============================================================
   TODO アプリ ロジック
   - データは localStorage に永続化
   - 依存ライブラリなし（素の JavaScript）
   ============================================================ */
"use strict";

const STORAGE_KEY = "todo-app:tasks:v1";

const QUOTES = [
  "千里の道も一歩から。",
  "継続は力なり。",
  "失敗は成功のもと。",
  "思い立ったが吉日。",
  "七転び八起き。",
  "石の上にも三年。",
  "急がば回れ。",
  "明日は明日の風が吹く。",
  "一期一会。",
  "笑う門には福来たる。",
];
document.getElementById("daily-quote").textContent =
  "～ " + QUOTES[Math.floor(Math.random() * QUOTES.length)] + " ～";

/** 優先度の表示順（高いほど上に並べる） */
const PRIORITY_RANK = { high: 0, mid: 1, low: 2 };
const PRIORITY_LABEL = { high: "高", mid: "中", low: "低" };

/** @type {{id:string,text:string,done:boolean,priority:string,due:string,createdAt:number}[]} */
let tasks = [];
let currentFilter = "all"; // all | active | completed

// ----- DOM 参照 -----
const form          = document.getElementById("new-task-form");
const textInput     = document.getElementById("task-text");
const priorityInput = document.getElementById("task-priority");
const dueInput      = document.getElementById("task-due");
const listEl        = document.getElementById("task-list");
const emptyEl       = document.getElementById("empty-state");
const countEl       = document.getElementById("active-count");
const clearBtn      = document.getElementById("clear-completed");
const filterButtons = document.querySelectorAll(".filter-btn");

// ----- 永続化 -----
function load() {
  try {
    tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    tasks = [];
  }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ----- ユーティリティ -----
function newId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// ----- 操作 -----
function addTask(text, priority, due) {
  tasks.push({
    id: newId(),
    text: text.trim(),
    done: false,
    priority: priority || "mid",
    due: due || "",
    createdAt: Date.now(),
  });
  save();
  render();
}
function toggleTask(id) {
  const t = tasks.find((t) => t.id === id);
  if (t) { t.done = !t.done; save(); render(); }
}
function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  save();
  render();
}
function updateText(id, text) {
  const t = tasks.find((t) => t.id === id);
  const trimmed = text.trim();
  if (!t) return;
  if (trimmed) { t.text = trimmed; } // 空入力なら変更を破棄
  save();
  render();
}
function clearCompleted() {
  tasks = tasks.filter((t) => !t.done);
  save();
  render();
}

// ----- 並び替え（未完了→優先度→期限→作成順） -----
function sortTasks(arr) {
  return [...arr].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority])
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    return a.createdAt - b.createdAt;
  });
}

// ----- 描画 -----
function render() {
  // フィルタ適用
  let visible = tasks;
  if (currentFilter === "active")    visible = tasks.filter((t) => !t.done);
  if (currentFilter === "completed") visible = tasks.filter((t) => t.done);
  visible = sortTasks(visible);

  listEl.innerHTML = "";
  emptyEl.hidden = visible.length > 0;

  const today = todayStr();

  for (const t of visible) {
    const li = document.createElement("li");
    li.className = "task-item" + (t.done ? " done" : "");
    li.dataset.id = t.id;

    // チェックボックス
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "task-checkbox";
    cb.checked = t.done;
    cb.addEventListener("change", () => toggleTask(t.id));

    // 優先度ドット
    const dot = document.createElement("span");
    dot.className = `prio-dot prio-${t.priority}`;
    dot.title = `優先度：${PRIORITY_LABEL[t.priority]}`;

    // 本文（テキスト + メタ情報）
    const body = document.createElement("div");
    body.className = "task-body";

    const label = document.createElement("span");
    label.className = "task-label";
    label.textContent = t.text; // textContent で XSS 防止
    label.title = "ダブルクリックで編集";
    label.addEventListener("dblclick", () => startEdit(li, t));

    body.appendChild(label);

    if (t.due) {
      const meta = document.createElement("span");
      const overdue = !t.done && t.due < today;
      meta.className = "task-meta" + (overdue ? " overdue" : "");
      meta.textContent = `期限：${t.due}` + (overdue ? "（期限切れ）" : "");
      body.appendChild(meta);
    }

    // 編集ボタン
    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn edit";
    editBtn.textContent = "✎";
    editBtn.title = "編集";
    editBtn.addEventListener("click", () => startEdit(li, t));

    // 削除ボタン
    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn delete";
    delBtn.textContent = "✕";
    delBtn.title = "削除";
    delBtn.addEventListener("click", () => deleteTask(t.id));

    li.append(cb, dot, body, editBtn, delBtn);
    listEl.appendChild(li);
  }

  // 残り件数
  const active = tasks.filter((t) => !t.done).length;
  countEl.textContent = `残り ${active} 件`;
}

// ----- インライン編集 -----
function startEdit(li, task) {
  const body = li.querySelector(".task-body");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "edit-input";
  input.value = task.text;
  input.maxLength = 200;

  body.innerHTML = "";
  body.appendChild(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  let finished = false;
  const commit = () => {
    if (finished) return;
    finished = true;
    updateText(task.id, input.value);
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { finished = true; render(); }
  });
}

// ----- イベント登録 -----
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = textInput.value.trim();
  if (!text) return;
  addTask(text, priorityInput.value, dueInput.value);
  textInput.value = "";
  dueInput.value = "";
  priorityInput.value = "mid";
  textInput.focus();
});

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    filterButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
    render();
  });
});

clearBtn.addEventListener("click", clearCompleted);

// ----- 初期化 -----
load();
render();
