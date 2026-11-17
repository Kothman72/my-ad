(() => {
  "use strict";

  const STORAGE_KEY = "habit-tracker:v1";

  const form = document.getElementById("habit-form");
  const input = document.getElementById("habit-input");
  const categorySelect = document.getElementById("habit-category");
  const categoryFilter = document.getElementById("category-filter");
  const list = document.getElementById("habit-list");
  const emptyState = document.getElementById("empty-state");
  const todayLabel = document.getElementById("today-label");
  const progress = document.getElementById("progress");

  // ---------- Dates (local time, "YYYY-MM-DD") ----------
  const pad = (n) => String(n).padStart(2, "0");
  const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = () => toKey(new Date());
  const dayNumber = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
  };

  // ---------- Storage ----------
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Could not read saved habits:", err);
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    } catch (err) {
      console.error("Could not save habits:", err);
    }
  }

  let habits = load();
  let activeCategory = "All";
  const categories = ["Health", "Work", "Learning", "Personal"];

  // ---------- Streak logic ----------
  // Current streak: consecutive days ending today, or yesterday if today
  // is not done yet (so the streak survives until the day is over).
  function currentStreak(dates) {
    const set = new Set(dates);
    const cursor = new Date();
    if (!set.has(toKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (set.has(toKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function bestStreak(dates) {
    const days = [...new Set(dates)].map(dayNumber).sort((a, b) => a - b);
    let best = 0, run = 0;
    days.forEach((day, i) => {
      run = i > 0 && day === days[i - 1] + 1 ? run + 1 : 1;
      best = Math.max(best, run);
    });
    return best;
  }

  // ---------- Actions ----------
  function addHabit(name, category) {
    habits.push({ id: Date.now().toString(36), name, category, completions: [] });
    save();
    render();
  }

  function toggleToday(id) {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    const key = todayKey();
    habit.completions = habit.completions.includes(key)
      ? habit.completions.filter((d) => d !== key)
      : [...habit.completions, key];
    save();
    render();
  }

  function deleteHabit(id) {
    const habit = habits.find((h) => h.id === id);
    if (!habit || !confirm(`Delete “${habit.name}” and its history?`)) return;
    habits = habits.filter((h) => h.id !== id);
    save();
    render();
  }

  // ---------- Rendering ----------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text; // textContent avoids HTML injection
    return node;
  }

  function render() {
    const today = todayKey();
    todayLabel.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric",
    });

    list.replaceChildren();
    emptyState.hidden = habits.length > 0;

    const usedCategories = [...new Set(habits.map((habit) =>
      categories.includes(habit.category) ? habit.category : "Personal"
    ))].sort();

    const filters = ["All", ...usedCategories];
    if (!filters.includes(activeCategory)) activeCategory = "All";
    categoryFilter.replaceChildren();
    filters.forEach((category) => {
      const button = el("button", activeCategory === category ? "active" : "", category);
      button.type = "button";
      button.setAttribute("aria-pressed", String(activeCategory === category));
      button.addEventListener("click", () => {
        activeCategory = category;
        render();
      });
      categoryFilter.appendChild(button);
    });

    const visibleHabits = activeCategory === "All"
      ? habits
      : habits.filter((habit) =>
          (categories.includes(habit.category) ? habit.category : "Personal") === activeCategory
        );

    emptyState.hidden = visibleHabits.length > 0;
    visibleHabits.forEach((habit) => {
      const done = habit.completions.includes(today);
      const streak = currentStreak(habit.completions);

      const li = el("li", done ? "done" : "");

      const check = el("button", "check", done ? "✓" : "");
      check.type = "button";
      check.setAttribute("aria-pressed", String(done));
      check.setAttribute("aria-label", `Mark “${habit.name}” as ${done ? "not done" : "done"} today`);
      check.addEventListener("click", () => toggleToday(habit.id));

      const name = el("div", "name", habit.name);
      name.appendChild(el("span", "meta", `Best streak: ${bestStreak(habit.completions)}`));
      const habitCategory = categories.includes(habit.category) ? habit.category : "Personal";
      name.appendChild(el("span", "category", habitCategory));

      const streakBox = el("div", "streak");
      streakBox.append(el("strong", "", String(streak)), el("span", "", streak === 1 ? "day" : "days"));

      const del = el("button", "delete", "×");
      del.type = "button";
      del.setAttribute("aria-label", `Delete “${habit.name}”`);
      del.addEventListener("click", () => deleteHabit(habit.id));

      li.append(check, name, streakBox, del);
      list.appendChild(li);
    });

    const doneCount = visibleHabits.filter((h) => h.completions.includes(today)).length;
    progress.textContent = visibleHabits.length
      ? `${doneCount} of ${visibleHabits.length} done today`
      : "";
  }

  // ---------- Events ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    addHabit(name, categorySelect.value);
    input.value = "";
    input.focus();
  });

  // Refresh when returning to the tab, so "today" rolls over after midnight.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });

  render();
})();
