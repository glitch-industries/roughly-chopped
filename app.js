// ─── Colors ───────────────────────────────────────────────────────────────────
var C = {
  bg:          "#faf5ee",  // warm cream (eggplant flesh)
  surface:     "#fffdf9",  // elevated cream (card surfaces)
  brand:       "#6c4675",  // deep eggplant purple (primary CTA, active tabs)
  accent:      "#d4c5d9",  // muted lavender (borders, secondary outlines)
  accent2:     "#56365e",  // darker eggplant (pressed/hover states)
  purple:      "#6c4675",  // same as brand (kept for backward compat)
  purpleLight: "#f2ecf4",  // pale eggplant tint (pill backgrounds, nudge banners)
  textPrimary: "#2c332e",  // near-black charcoal (headers, body)
  textMuted:   "#7a7a72",  // warm grey (secondary text)
  chipActive:  "#6c4675",  // eggplant purple (active filter chips)
  chipInactive:"#f0eaf2",  // pale purple (inactive chips)
  border:      "#e2dce8",  // soft purple-grey border
  white:       "#ffffff",
  green:       "#8fa87b",  // sage green (success states, veggie habit)
  greenLight:  "#eef3ea",  // pale sage (success backgrounds)
};

// ─── State ────────────────────────────────────────────────────────────────────
var state = {
  view: "feedme",         // feedme | week | plan
  meals: [],              // loaded from meals.json
  modal: null,            // null | {type, data}
  selectedWeekDay: null,  // for week tab day detail
  picker: null,           // null | { type: "no-cook"|"cook", seed: N }
  libraryFilter: null,    // null | "breakfast"|"lunch"|"dinner"|"snack"|"no-cook"|"crockpot"
  addingRepeatBuy: false, // show inline input in repeat buys
  feedMeSeed: 0,          // shuffle seed for Feed Me suggestion
};

// ─── Habits config ────────────────────────────────────────────────────────────
var BUILT_IN_HABITS = [
  { key: "meds",         label: "Took my meds",    emoji: "💊", weekdayOnly: false },
  { key: "breakfast",    label: "Ate breakfast",    emoji: "🌅", weekdayOnly: false },
  { key: "packed_lunch", label: "Packed my lunch",  emoji: "🥗", weekdayOnly: true  },
  { key: "water",        label: "Drank water",      emoji: "💧", weekdayOnly: false },
  { key: "veggie",       label: "Ate a vegetable",  emoji: "🥦", weekdayOnly: false },
  { key: "fruit",        label: "Ate fruit",        emoji: "🍎", weekdayOnly: false },
  { key: "outside",      label: "Got outside",      emoji: "🚶", weekdayOnly: false },
  { key: "sleep",        label: "In bed on time",   emoji: "😴", weekdayOnly: false },
];

function getCustomHabits() {
  var raw = localStorage.getItem("custom_habits");
  return raw ? JSON.parse(raw) : [];
}

function saveCustomHabits(habits) {
  localStorage.setItem("custom_habits", JSON.stringify(habits));
}

function getActiveHabits() {
  var isWeekend = [0, 6].indexOf(new Date().getDay()) !== -1;
  var builtIn = BUILT_IN_HABITS.filter(function(h) { return !h.weekdayOnly || !isWeekend; });
  return builtIn.concat(getCustomHabits());
}

function getHabitStreak(key) {
  // Forgive one missed day — ADHD-friendly: a single gap doesn't reset the streak
  var streak = 0;
  var missedAlready = false;
  var d = new Date();
  d.setDate(d.getDate() - 1); // start from yesterday
  for (var i = 0; i < 60; i++) {
    var log = getDayLog(fmtDate(d));
    if (log.habits && log.habits[key]) {
      streak++;
    } else {
      if (missedAlready) break; // two misses in a row = streak over
      missedAlready = true;     // first miss: forgiven, keep counting
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function el(tag, attrs, children) {
  var node = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(function(k) {
      if (k === "style" && typeof attrs[k] === "object") {
        Object.assign(node.style, attrs[k]);
      } else if (k.startsWith("on")) {
        node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      } else {
        node.setAttribute(k, attrs[k]);
      }
    });
  }
  if (children) {
    (Array.isArray(children) ? children : [children]).forEach(function(c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
  }
  return node;
}

function todayKey() {
  return fmtDate(new Date());
}

function fmtDate(d) {
  return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate());
}

function pad(n) { return n < 10 ? "0"+n : ""+n; }

function weekKey(d) {
  var date = d || new Date();
  var jan4 = new Date(date.getFullYear(), 0, 4);
  var dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  var weekNum = Math.ceil((dayOfYear + jan4.getDay()) / 7);
  return date.getFullYear() + "-W" + pad(weekNum);
}

function getDayLog(dateStr) {
  var raw = localStorage.getItem("log_" + dateStr);
  return raw ? JSON.parse(raw) : { date: dateStr, logged_meals: [], habits: { ate_veggie: false, drank_water: false }, weight_lbs: null };
}

function saveDayLog(log) {
  localStorage.setItem("log_" + log.date, JSON.stringify(log));
}

function getWeekPlan() {
  var raw = localStorage.getItem("plan_" + weekKey());
  return raw ? JSON.parse(raw) : { week: weekKey(), meal_pool: [], shopping_list: [], ticked_items: [] };
}

function saveWeekPlan(plan) {
  localStorage.setItem("plan_" + weekKey(), JSON.stringify(plan));
}

function getWeightLog() {
  var raw = localStorage.getItem("weight_log");
  return raw ? JSON.parse(raw) : [];
}

function saveWeightLog(log) {
  localStorage.setItem("weight_log", JSON.stringify(log));
}

function getMealById(id) {
  return state.meals.find(function(m) { return m.id === id; });
}

function shouldShowWeightPrompt() {
  var logs = getWeightLog();
  if (!logs.length) return true;
  var last = new Date(logs[logs.length - 1].date);
  var diff = (new Date() - last) / (1000 * 60 * 60 * 24);
  return diff >= 6;
}

function getWeekDays() {
  var today = new Date();
  var dow = today.getDay(); // 0=Sun
  var monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  var days = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

// ─── Root ─────────────────────────────────────────────────────────────────────
var root = document.getElementById("app");

function render() {
  var scrollTop = 0;
  var scrollEl = root.querySelector(".scroll-area");
  if (scrollEl && root._lastView === state.view) scrollTop = scrollEl.scrollTop;
  root._lastView = state.view;
  root.innerHTML = "";

  var header = renderHeader();
  var tabs   = renderTabs();
  var sticky = el("div", { style: { flexShrink: "0" } }, [header, tabs]);

  var scroll = el("div", { class: "scroll-area", style: {
    flex: "1",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    paddingBottom: "calc(env(safe-area-inset-bottom, 16px) + 16px)",
  }});

  if (state.view === "feedme") scroll.appendChild(renderFeedMe());
  if (state.view === "week")   scroll.appendChild(renderWeek());
  if (state.view === "plan")   scroll.appendChild(renderPlan());

  root.appendChild(sticky);
  root.appendChild(scroll);

  if (state.modal) root.appendChild(renderModal());

  scroll.scrollTop = scrollTop;
}

// ─── Header ───────────────────────────────────────────────────────────────────
function renderHeader() {
  var plan = getWeekPlan();
  var titles = { feedme: "Feed Me", week: "This Week", plan: plan.shopping_mode ? "Shopping List" : "Plan Week" };
  return el("div", { style: {
    background: C.surface,
    padding: "16px 20px 12px",
    borderBottom: "1px solid " + C.border,
  }}, [
    el("h1", { style: { fontSize: "22px", fontWeight: "700", color: C.textPrimary, letterSpacing: "-0.3px" } }, titles[state.view] || "")
  ]);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function renderTabs() {
  var tabs = [
    { id: "feedme", icon: "🍽️", label: "Feed Me" },
    { id: "week",   icon: "📅", label: "This Week" },
    { id: "plan",   icon: "🛒", label: "Plan" },
  ];
  return el("div", { style: {
    display: "flex",
    background: C.surface,
    borderBottom: "1px solid " + C.border,
  }}, tabs.map(function(t) {
    var active = state.view === t.id;
    return el("button", {
      style: {
        flex: "1",
        padding: "10px 4px 8px",
        border: "none",
        background: "none",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
        borderBottom: active ? "2px solid " + C.brand : "2px solid transparent",
        transition: "border-color 0.15s",
      },
      onClick: function() { state.view = t.id; state.selectedWeekDay = null; render(); }
    }, [
      el("span", { style: { fontSize: "18px" } }, t.icon),
      el("span", { style: { fontSize: "10px", fontWeight: active ? "600" : "400", color: active ? C.brand : C.textMuted } }, t.label),
    ]);
  }));
}

// ─── TODAY TAB ────────────────────────────────────────────────────────────────
function renderFeedMe() {
  var wrap = el("div", { style: { padding: "20px 16px" } });
  var plan = getWeekPlan();
  var log  = getDayLog(todayKey());

  // ── Greeting ────────────────────────────────────────────────────────────────
  var hour = new Date().getHours();
  var greeting = hour < 10 ? "Good morning ☀️" : hour < 15 ? "Hey there 👋" : hour < 20 ? "Good evening 🌙" : "Late night 🌙";
  var mealTime = hour < 10 ? "breakfast" : hour < 15 ? "lunch" : "dinner";
  var now = new Date();
  var dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  wrap.appendChild(el("div", { style: { marginBottom: "24px" } }, [
    el("p", { style: { fontSize: "20px", fontWeight: "700", color: C.textPrimary, marginBottom: "2px" } }, greeting),
    el("p", { style: { fontSize: "13px", color: C.textMuted } }, dayNames[now.getDay()] + ", " + monthNames[now.getMonth()] + " " + now.getDate()),
  ]));

  // ── Skipped-meal nudge: past 1pm with nothing logged ────────────────────────
  var noMealsYet = !log.logged_meals || log.logged_meals.length === 0;
  if (hour >= 13 && noMealsYet) {
    wrap.appendChild(el("div", { style: {
      background: C.purpleLight, border: "1.5px solid " + C.purple,
      borderRadius: "12px", padding: "10px 14px", marginBottom: "20px",
      fontSize: "13px", color: C.purple, fontWeight: "600",
    }}, "⏰ Hey — you haven't logged anything today. Don't forget to eat!"));
  }

  // ── Suggestion engine ────────────────────────────────────────────────────────
  var mealTypeMap = { breakfast: ["breakfast"], lunch: ["lunch"], dinner: ["dinner", "lunch"] };
  var wantedTypes = mealTypeMap[mealTime] || ["dinner"];

  var pool = plan.meal_pool.filter(function(id) {
    var m = getMealById(id);
    if (!m) return false;
    return wantedTypes.some(function(t) { return m.meal_types.indexOf(t) !== -1; });
  });

  // In the morning, prefer protein-rich meals (better for ADHD focus)
  if (mealTime === "breakfast") {
    var proteinPool = pool.filter(function(id) {
      var m = getMealById(id);
      return m && m.tags && m.tags.indexOf("protein-rich") !== -1;
    });
    if (proteinPool.length) pool = proteinPool;
  }

  // Fall back to full pool if nothing matches
  if (!pool.length) pool = plan.meal_pool.filter(function(id) { return !!getMealById(id); });

  var suggestionSection = el("div", { style: { marginBottom: "28px" } });

  if (!pool.length) {
    suggestionSection.appendChild(renderEmptyState(
      "No meals planned yet",
      "Tap Plan to pick this week's meals.",
      "Plan my week →",
      function() { state.view = "plan"; render(); }
    ));
  } else {
    var shuffled = seededShuffle(pool, state.feedMeSeed);
    var suggestedId = shuffled[0];
    var suggested = getMealById(suggestedId);

    suggestionSection.appendChild(el("p", { style: { fontSize: "12px", color: C.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" } },
      "How about for " + mealTime + "?"
    ));

    // Big suggestion card
    var card = el("div", { style: {
      background: C.brand, borderRadius: "16px", padding: "20px",
      marginBottom: "10px", cursor: "pointer",
    }, onClick: function() {
      var l = getDayLog(todayKey());
      if (!l.logged_meals) l.logged_meals = [];
      var idx = l.logged_meals.indexOf(suggestedId);
      if (idx === -1) l.logged_meals.push(suggestedId);
      else l.logged_meals.splice(idx, 1);
      saveDayLog(l); render();
    }});

    var isLogged = log.logged_meals.indexOf(suggestedId) !== -1;
    card.appendChild(el("div", { style: { fontSize: "22px", fontWeight: "700", color: C.white, marginBottom: "6px" } }, suggested.name));
    card.appendChild(el("div", { style: { fontSize: "13px", color: "rgba(255,255,255,0.75)" } },
      suggested.meal_types.join(" · ") + (suggested.tags.indexOf("no-cook") !== -1 ? " · no cook" : "")
    ));
    card.appendChild(el("div", { style: {
      marginTop: "14px", display: "flex", gap: "10px", alignItems: "center"
    }}, [
      el("div", { style: {
        flex: "1", padding: "10px 14px", borderRadius: "10px",
        background: isLogged ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.18)",
        color: C.white, fontSize: "14px", fontWeight: "700", textAlign: "center",
      }}, isLogged ? "✓ Logged" : "I ate this"),
    ]));
    suggestionSection.appendChild(card);

    // Not feeling it + recipe row
    var actRow = el("div", { style: { display: "flex", gap: "8px", marginBottom: "4px" } });
    actRow.appendChild(el("button", {
      style: {
        flex: "1", padding: "10px", borderRadius: "10px",
        border: "1.5px solid " + C.border, background: C.surface,
        fontSize: "13px", fontWeight: "600", color: C.textMuted, cursor: "pointer",
      },
      onClick: function() { state.feedMeSeed = state.feedMeSeed + 1; render(); }
    }, "↻ Not feeling it"));
    if (suggested.recipe) {
      actRow.appendChild(el("button", {
        style: {
          padding: "10px 14px", borderRadius: "10px",
          border: "1.5px solid " + C.border, background: C.surface,
          fontSize: "13px", fontWeight: "600", color: C.purple, cursor: "pointer",
        },
        onClick: function() { state.modal = { type: "recipe", data: suggested }; render(); }
      }, "Recipe ↗"));
    }
    suggestionSection.appendChild(actRow);
  }
  wrap.appendChild(suggestionSection);

  // ── Today's log ──────────────────────────────────────────────────────────────
  var loggedMeals = (log.logged_meals || []).filter(function(id) { return !!getMealById(id); });
  if (loggedMeals.length) {
    wrap.appendChild(el("p", { style: { fontSize: "12px", fontWeight: "600", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" } }, "Eaten today"));
    var logCard = el("div", { style: { background: C.surface, border: "1.5px solid " + C.border, borderRadius: "12px", padding: "4px 14px", marginBottom: "24px" } });
    loggedMeals.forEach(function(id, i) {
      var meal = getMealById(id);
      var row = el("div", {
        style: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", cursor: "pointer", borderBottom: i < loggedMeals.length - 1 ? "1px solid " + C.border : "none" },
        onClick: function() {
          var l = getDayLog(todayKey());
          var idx = l.logged_meals.indexOf(id);
          if (idx !== -1) l.logged_meals.splice(idx, 1);
          saveDayLog(l); render();
        }
      }, [
        el("div", { style: { width: "20px", height: "20px", borderRadius: "50%", background: C.brand, border: "2px solid " + C.brand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: C.white, flexShrink: "0" } }, "✓"),
        el("span", { style: { fontSize: "15px", color: C.textPrimary, flex: "1" } }, meal.name),
        el("span", { style: { fontSize: "11px", color: C.textMuted } }, "tap to remove"),
      ]);
      logCard.appendChild(row);
    });
    wrap.appendChild(logCard);
  }

  // ── Habits ───────────────────────────────────────────────────────────────────
  wrap.appendChild(renderHabitsSection(log));

  return wrap;
}

function renderMealChip(meal, logged, onToggle) {
  var card = el("div", {
    style: {
      background: logged ? C.brand : C.surface,
      border: "1.5px solid " + (logged ? C.brand : C.border),
      borderRadius: "14px",
      padding: "14px 16px",
      cursor: "pointer",
      transition: "all 0.15s",
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    onClick: onToggle,
  });

  var check = el("div", { style: {
    width: "24px", height: "24px", borderRadius: "50%", flexShrink: "0",
    background: logged ? C.white : "transparent",
    border: "2px solid " + (logged ? C.white : C.border),
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "13px",
  }}, logged ? "✓" : "");

  var info = el("div", { style: { flex: "1" } }, [
    el("div", { style: { fontSize: "16px", fontWeight: "600", color: logged ? C.white : C.textPrimary } }, meal.name),
    meal.notes ? el("div", { style: { fontSize: "12px", color: logged ? "rgba(255,255,255,0.75)" : C.textMuted, marginTop: "2px" } }, meal.notes) : null,
  ]);

  var tags = el("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" } });
  if (meal.tags.indexOf("no-dishes") !== -1) {
    tags.appendChild(el("span", { style: { fontSize: "10px", color: logged ? "rgba(255,255,255,0.7)" : C.textMuted } }, "no dishes"));
  } else if (meal.dishes === 1) {
    tags.appendChild(el("span", { style: { fontSize: "10px", color: logged ? "rgba(255,255,255,0.7)" : C.textMuted } }, "1 dish"));
  } else if (meal.dishes === 2) {
    tags.appendChild(el("span", { style: { fontSize: "10px", color: logged ? "rgba(255,255,255,0.7)" : C.textMuted } }, "2 dishes"));
  }
  if (meal.recipe) {
    var recipeBtn = el("span", { style: { fontSize: "10px", color: logged ? "rgba(255,255,255,0.7)" : C.purple, cursor: "pointer", fontWeight: "600" } }, "recipe ↗");
    recipeBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      state.modal = { type: "recipe", data: meal };
      render();
    });
    tags.appendChild(recipeBtn);
  }

  card.appendChild(check);
  card.appendChild(info);
  card.appendChild(tags);
  return card;
}

function renderHabitsSection(log) {
  var habits = getActiveHabits();
  var wrap = el("div", { style: { marginBottom: "24px" } });

  // Header row with edit button
  wrap.appendChild(el("div", { style: { display: "flex", alignItems: "center", marginBottom: "10px" } }, [
    el("p", { style: { fontSize: "12px", fontWeight: "600", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", flex: "1", margin: "0" } }, "Habits"),
    el("button", {
      style: { background: "none", border: "none", fontSize: "12px", color: C.purple, fontWeight: "600", cursor: "pointer", padding: "0" },
      onClick: function() { state.modal = { type: "edit-habits" }; render(); }
    }, "customize"),
  ]));

  var card = el("div", { style: { background: C.surface, border: "1.5px solid " + C.border, borderRadius: "12px", padding: "4px 14px" } });

  habits.forEach(function(h, i) {
    var active = !!(log.habits && log.habits[h.key]);
    var streak = getHabitStreak(h.key);
    var row = el("div", {
      style: {
        display: "flex", alignItems: "center", gap: "12px", padding: "12px 0",
        cursor: "pointer", borderBottom: i < habits.length - 1 ? "1px solid " + C.border : "none",
      },
      onClick: function() {
        var l = getDayLog(todayKey());
        if (!l.habits) l.habits = {};
        l.habits[h.key] = !l.habits[h.key];
        saveDayLog(l); render();
      }
    }, [
      el("span", { style: { fontSize: "18px", width: "24px", textAlign: "center", flexShrink: "0" } }, h.emoji),
      el("span", { style: { fontSize: "15px", color: active ? C.textPrimary : C.textPrimary, flex: "1" } }, h.label),
      streak > 1 ? el("span", { style: { fontSize: "11px", color: C.purple, fontWeight: "600" } }, streak + "🔥") : null,
      el("div", { style: {
        width: "22px", height: "22px", borderRadius: "50%", flexShrink: "0",
        background: active ? C.purple : "transparent",
        border: "2px solid " + (active ? C.purple : C.border),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "12px", color: C.white,
      }}, active ? "✓" : ""),
    ]);
    card.appendChild(row);
  });

  wrap.appendChild(card);
  return wrap;
}

function renderWeightPrompt() {
  var wrap = el("div", { style: {
    background: C.surface, border: "1.5px solid " + C.border,
    borderRadius: "14px", padding: "16px", marginBottom: "16px",
  }});
  wrap.appendChild(el("p", { style: { fontSize: "14px", fontWeight: "600", color: C.textPrimary, marginBottom: "4px" } }, "Weekly weight check-in"));
  wrap.appendChild(el("p", { style: { fontSize: "12px", color: C.textMuted, marginBottom: "12px" } }, "No pressure — just for spotting patterns over time."));

  var row = el("div", { style: { display: "flex", gap: "8px", alignItems: "center" } });
  var input = el("input", { type: "number", placeholder: "lbs", style: {
    flex: "1", padding: "10px 12px", borderRadius: "10px",
    border: "1.5px solid " + C.border, background: C.bg,
    fontSize: "16px", color: C.textPrimary, outline: "none",
  }});
  var btn = el("button", {
    style: {
      padding: "10px 18px", borderRadius: "10px", border: "none",
      background: C.brand, color: C.white, fontSize: "14px", fontWeight: "600", cursor: "pointer",
    },
    onClick: function() {
      var val = parseFloat(input.value);
      if (!val || val < 50 || val > 500) return;
      var logs = getWeightLog();
      logs.push({ date: todayKey(), weight_lbs: val });
      saveWeightLog(logs);
      render();
    }
  }, "Save");

  row.appendChild(input);
  row.appendChild(btn);
  wrap.appendChild(row);
  return wrap;
}

// ─── WEEK TAB ─────────────────────────────────────────────────────────────────
function renderWeek() {
  var wrap = el("div", { style: { padding: "20px 16px" } });
  var days = getWeekDays();
  var todayStr = todayKey();
  var plan = getWeekPlan();
  var dayOfWeek = new Date().getDay(); // 0=Sun

  // ── What's available this week ───────────────────────────────────────────────
  if (plan.meal_pool.length) {
    function isMealNoCookW(m) {
      return m.tags.indexOf("no-cook") !== -1 ||
             (m.tags.indexOf("freezer") !== -1 && m.tags.indexOf("crockpot") === -1);
    }
    function isSnackOnlyW(m) {
      return m.meal_types.indexOf("snack") !== -1 &&
             m.meal_types.indexOf("dinner") === -1 &&
             m.meal_types.indexOf("lunch") === -1;
    }

    var readyMeals = plan.meal_pool.filter(function(id) {
      var m = getMealById(id); return m && (isMealNoCookW(m) || isSnackOnlyW(m));
    });
    var cookMeals = plan.meal_pool.filter(function(id) {
      var m = getMealById(id); return m && !isMealNoCookW(m) && !isSnackOnlyW(m);
    });

    // Cooking nudge: mid-week + uncooked cook meals
    var isMidWeek = dayOfWeek >= 3; // Wed+
    var uncookedCookMeals = cookMeals.filter(function(id) {
      return !days.some(function(d) {
        return getDayLog(fmtDate(d)).logged_meals.indexOf(id) !== -1;
      });
    });
    if (isMidWeek && uncookedCookMeals.length) {
      var nudge = el("div", { style: {
        background: C.purpleLight, border: "1.5px solid " + C.purple,
        borderRadius: "12px", padding: "12px 14px", marginBottom: "20px",
      }});
      nudge.appendChild(el("p", { style: { fontSize: "13px", fontWeight: "700", color: C.purple, marginBottom: "4px" } }, "🍳 Good night to cook?"));
      nudge.appendChild(el("p", { style: { fontSize: "12px", color: C.textMuted, marginBottom: "8px" } }, "You haven't made these yet this week:"));
      uncookedCookMeals.forEach(function(id) {
        var m = getMealById(id);
        var row = el("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" } }, [
          el("span", { style: { fontSize: "14px", color: C.textPrimary, flex: "1" } }, m.name),
        ]);
        if (m.recipe) {
          row.appendChild(el("button", {
            style: { background: "none", border: "none", fontSize: "12px", color: C.purple, fontWeight: "700", cursor: "pointer", padding: "0" },
            onClick: function() { state.modal = { type: "recipe", data: m }; render(); }
          }, "recipe ↗"));
        }
        nudge.appendChild(row);
      });
      wrap.appendChild(nudge);
    }

    if (readyMeals.length) {
      wrap.appendChild(el("p", { style: { fontSize: "12px", fontWeight: "600", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" } }, "Ready to grab"));
      var readyCard = el("div", { style: { background: C.surface, border: "1.5px solid " + C.border, borderRadius: "12px", padding: "4px 14px", marginBottom: "20px" } });
      readyMeals.forEach(function(id, i) {
        var m = getMealById(id);
        readyCard.appendChild(el("div", { style: { padding: "10px 0", borderBottom: i < readyMeals.length - 1 ? "1px solid " + C.border : "none", fontSize: "15px", color: C.textPrimary } }, m.name));
      });
      wrap.appendChild(readyCard);
    }

    if (cookMeals.length) {
      wrap.appendChild(el("p", { style: { fontSize: "12px", fontWeight: "600", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" } }, "Could cook"));
      var cookCard = el("div", { style: { background: C.surface, border: "1.5px solid " + C.border, borderRadius: "12px", padding: "4px 14px", marginBottom: "20px" } });
      cookMeals.forEach(function(id, i) {
        var m = getMealById(id);
        var row = el("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "10px 0", borderBottom: i < cookMeals.length - 1 ? "1px solid " + C.border : "none" } }, [
          el("span", { style: { fontSize: "15px", color: C.textPrimary, flex: "1" } }, m.name),
        ]);
        if (m.recipe) {
          row.appendChild(el("button", {
            style: { background: "none", border: "none", fontSize: "12px", color: C.purple, fontWeight: "700", cursor: "pointer", padding: "0" },
            onClick: function() { state.modal = { type: "recipe", data: m }; render(); }
          }, "recipe ↗"));
        }
        cookCard.appendChild(row);
      });
      wrap.appendChild(cookCard);
    }

    wrap.appendChild(el("div", { style: { height: "1px", background: C.border, margin: "4px 0 20px" } }));
  }

  // ── Day strip ────────────────────────────────────────────────────────────────
  var dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  var strip = el("div", { style: { display: "flex", gap: "6px", marginBottom: "20px" } });
  days.forEach(function(d, i) {
    var dateStr = fmtDate(d);
    var isToday = dateStr === todayStr;
    var isSelected = state.selectedWeekDay === dateStr;
    var log = getDayLog(dateStr);
    var hasMeals = log.logged_meals && log.logged_meals.length > 0;
    strip.appendChild(el("div", {
      style: {
        flex: "1", display: "flex", flexDirection: "column", alignItems: "center",
        gap: "4px", padding: "8px 4px", borderRadius: "12px", cursor: "pointer",
        background: isSelected ? C.brand : isToday ? C.chipInactive : "transparent",
      },
      onClick: function() { state.selectedWeekDay = isSelected ? null : dateStr; render(); }
    }, [
      el("span", { style: { fontSize: "11px", color: isSelected ? "rgba(255,255,255,0.8)" : C.textMuted } }, dayNames[i]),
      el("span", { style: { fontSize: "17px", fontWeight: isToday ? "700" : "400", color: isSelected ? C.white : C.textPrimary } }, String(d.getDate())),
      el("div", { style: { width: "6px", height: "6px", borderRadius: "50%", background: hasMeals ? (isSelected ? C.white : C.brand) : "transparent" } }),
    ]));
  });
  wrap.appendChild(strip);

  // ── Day detail ───────────────────────────────────────────────────────────────
  if (state.selectedWeekDay) {
    var selDate = state.selectedWeekDay;
    var selLog = getDayLog(selDate);
    var selD = new Date(selDate + "T12:00:00");
    var isFutureDay = selD > new Date();
    var fullDayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var monthNames2 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    wrap.appendChild(el("p", { style: { fontSize: "14px", fontWeight: "700", color: C.textPrimary, marginBottom: "10px" } },
      fullDayNames[selD.getDay()] + ", " + monthNames2[selD.getMonth()] + " " + selD.getDate()
    ));

    if (isFutureDay) {
      wrap.appendChild(el("p", { style: { fontSize: "14px", color: C.textMuted, marginBottom: "20px" } }, "Future day — log meals as you go."));
    } else if (!plan.meal_pool.length) {
      wrap.appendChild(el("p", { style: { fontSize: "14px", color: C.textMuted, marginBottom: "20px" } }, "No meals planned this week yet."));
    } else {
      // Slim meal rows
      var dayCard = el("div", { style: { background: C.surface, border: "1.5px solid " + C.border, borderRadius: "12px", padding: "4px 14px", marginBottom: "12px" } });
      plan.meal_pool.forEach(function(mealId, i) {
        var meal = getMealById(mealId); if (!meal) return;
        var logged = selLog.logged_meals && selLog.logged_meals.indexOf(mealId) !== -1;
        var row = el("div", {
          style: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", cursor: "pointer", borderBottom: i < plan.meal_pool.length - 1 ? "1px solid " + C.border : "none" },
          onClick: function() {
            var l = getDayLog(selDate); if (!l.logged_meals) l.logged_meals = [];
            var idx = l.logged_meals.indexOf(mealId);
            if (idx === -1) l.logged_meals.push(mealId); else l.logged_meals.splice(idx, 1);
            saveDayLog(l); render();
          }
        }, [
          el("div", { style: { width: "20px", height: "20px", borderRadius: "50%", flexShrink: "0", background: logged ? C.brand : "transparent", border: "2px solid " + (logged ? C.brand : C.border), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: C.white } }, logged ? "✓" : ""),
          el("span", { style: { fontSize: "15px", color: C.textPrimary, textDecoration: logged ? "line-through" : "none", opacity: logged ? "0.6" : "1" } }, meal.name),
        ]);
        dayCard.appendChild(row);
      });
      wrap.appendChild(dayCard);

      // Habits for the day (slim)
      var habits = getActiveHabits();
      var habitCard = el("div", { style: { background: C.surface, border: "1.5px solid " + C.border, borderRadius: "12px", padding: "4px 14px", marginBottom: "20px" } });
      wrap.appendChild(el("p", { style: { fontSize: "12px", fontWeight: "600", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" } }, "Habits"));
      habits.forEach(function(h, i) {
        var active = !!(selLog.habits && selLog.habits[h.key]);
        var row = el("div", {
          style: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", cursor: "pointer", borderBottom: i < habits.length - 1 ? "1px solid " + C.border : "none" },
          onClick: function() {
            var l = getDayLog(selDate); if (!l.habits) l.habits = {};
            l.habits[h.key] = !l.habits[h.key]; saveDayLog(l); render();
          }
        }, [
          el("span", { style: { fontSize: "16px", width: "22px", textAlign: "center", flexShrink: "0" } }, h.emoji),
          el("span", { style: { fontSize: "14px", color: C.textPrimary, flex: "1" } }, h.label),
          el("div", { style: { width: "20px", height: "20px", borderRadius: "50%", flexShrink: "0", background: active ? C.purple : "transparent", border: "2px solid " + (active ? C.purple : C.border), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: C.white } }, active ? "✓" : ""),
        ]);
        habitCard.appendChild(row);
      });
      wrap.appendChild(habitCard);
    }
    wrap.appendChild(el("div", { style: { height: "1px", background: C.border, margin: "4px 0 20px" } }));
  }

  // ── Week summary dots ────────────────────────────────────────────────────────
  if (!plan.meal_pool.length) {
    wrap.appendChild(renderEmptyState("No meals planned", "Tap Plan to pick this week's meals.", "Plan my week →", function() { state.view = "plan"; render(); }));
    return wrap;
  }

  wrap.appendChild(el("p", { style: { fontSize: "12px", fontWeight: "600", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" } }, "Eaten this week"));
  var trackCard = el("div", { style: { background: C.surface, border: "1.5px solid " + C.border, borderRadius: "12px", padding: "4px 14px" } });
  // Day initials header
  var dayInitials = ["M","T","W","T","F","S","S"];
  var headerRow = el("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 0 4px", borderBottom: "1px solid " + C.border } }, [
    el("span", { style: { fontSize: "12px", color: C.textMuted, flex: "1" } }, ""),
  ]);
  dayInitials.forEach(function(d) {
    headerRow.appendChild(el("span", { style: { fontSize: "10px", color: C.textMuted, width: "14px", textAlign: "center" } }, d));
  });
  trackCard.appendChild(headerRow);
  plan.meal_pool.forEach(function(mealId, i) {
    var meal = getMealById(mealId); if (!meal) return;
    var row = el("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: i < plan.meal_pool.length - 1 ? "1px solid " + C.border : "none" } }, [
      el("span", { style: { fontSize: "13px", color: C.textPrimary, flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, meal.name),
    ]);
    days.forEach(function(d) {
      var had = getDayLog(fmtDate(d)).logged_meals && getDayLog(fmtDate(d)).logged_meals.indexOf(mealId) !== -1;
      row.appendChild(el("div", { style: { width: "14px", height: "14px", borderRadius: "50%", flexShrink: "0", background: had ? C.brand : C.chipInactive } }));
    });
    trackCard.appendChild(row);
  });
  wrap.appendChild(trackCard);

  return wrap;
}

function renderHabitsForDate(log, dateStr) {
  var habits = [
    { key: "ate_veggie",  icon: "🍆", label: "Ate a vegetable", activeColor: C.purple, activeBg: C.purpleLight },
    { key: "drank_water", icon: "💧", label: "Had a glass of water", activeColor: C.accent2, activeBg: "#fce8e0" },
  ];
  var wrap = el("div", {});
  wrap.appendChild(el("p", { style: { fontSize: "13px", fontWeight: "600", color: C.textMuted, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "10px" } }, "Habits"));

  habits.forEach(function(h) {
    var active = log.habits[h.key];
    var row = el("div", {
      style: {
        display: "flex", alignItems: "center", gap: "10px",
        background: active ? h.activeBg : C.surface,
        border: "1.5px solid " + (active ? h.activeColor : C.border),
        borderRadius: "10px", padding: "10px 14px", marginBottom: "8px",
        cursor: "pointer",
      },
      onClick: function() {
        var l = getDayLog(dateStr);
        l.habits[h.key] = !l.habits[h.key];
        saveDayLog(l);
        render();
      }
    }, [
      el("span", { style: { fontSize: "18px" } }, h.icon),
      el("span", { style: { fontSize: "14px", fontWeight: "500", color: active ? h.activeColor : C.textPrimary } }, h.label),
    ]);
    wrap.appendChild(row);
  });
  return wrap;
}

// ─── LIBRARY TAB ──────────────────────────────────────────────────────────────
function renderLibrary() {
  var wrap = el("div", { style: { padding: "20px 16px" } });

  var addBtn = el("button", {
    style: {
      width: "100%", padding: "12px", borderRadius: "12px",
      background: C.brand, color: C.white, border: "none",
      fontSize: "15px", fontWeight: "600", cursor: "pointer", marginBottom: "16px",
    },
    onClick: function() { state.modal = { type: "add-meal", data: null }; render(); }
  }, "+ Add a meal");
  wrap.appendChild(addBtn);

  // ── Filter chips ────────────────────────────────────────────────────────────
  var FILTERS = [
    { key: null,        label: "All" },
    { key: "breakfast", label: "Breakfast" },
    { key: "lunch",     label: "Lunch" },
    { key: "dinner",    label: "Dinner" },
    { key: "snack",     label: "Snack" },
    { key: "no-cook",   label: "No Cook" },
    { key: "crockpot",  label: "Crockpot" },
  ];

  var filterBar = el("div", { style: {
    display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px",
    marginBottom: "20px", WebkitOverflowScrolling: "touch",
  }});

  FILTERS.forEach(function(f) {
    var active = state.libraryFilter === f.key;
    filterBar.appendChild(el("button", {
      style: {
        flexShrink: "0", padding: "6px 14px", borderRadius: "20px",
        border: "1.5px solid " + (active ? C.purple : C.border),
        background: active ? C.purple : C.surface,
        cursor: "pointer", fontSize: "13px", fontWeight: "600",
        color: active ? C.white : C.textPrimary, whiteSpace: "nowrap",
      },
      onClick: function() { state.libraryFilter = f.key; render(); }
    }, f.label));
  });
  wrap.appendChild(filterBar);

  // ── Filter or group meals ───────────────────────────────────────────────────
  function matchesFilter(m) {
    var f = state.libraryFilter;
    if (!f) return true;
    if (f === "no-cook") return m.tags.indexOf("no-cook") !== -1;
    if (f === "crockpot") return m.tags.indexOf("crockpot") !== -1;
    return m.meal_types.indexOf(f) !== -1;
  }

  function renderGroup(title, meals) {
    if (!meals.length) return;
    wrap.appendChild(el("p", { style: { fontSize: "13px", fontWeight: "600", color: C.textMuted, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "10px" } }, title));
    meals.forEach(function(meal) { wrap.appendChild(renderLibraryCard(meal)); });
    wrap.appendChild(el("div", { style: { height: "8px" } }));
  }

  if (state.libraryFilter) {
    var filtered = state.meals.filter(matchesFilter);
    renderGroup(FILTERS.find(function(f) { return f.key === state.libraryFilter; }).label, filtered);
  } else {
    var favorites = state.meals.filter(function(m) { return m.tags.indexOf("favorite") !== -1; });
    var freezer   = state.meals.filter(function(m) { return m.tags.indexOf("favorite") === -1 && m.tags.indexOf("freezer") !== -1; });
    var quick     = state.meals.filter(function(m) { return m.tags.indexOf("favorite") === -1 && m.tags.indexOf("freezer") === -1 && m.tags.indexOf("quick") !== -1 && !m.recipe; });
    var hasRecipe = state.meals.filter(function(m) { return m.tags.indexOf("favorite") === -1 && m.recipe; });
    renderGroup("Favorites", favorites);
    renderGroup("Quick & Easy", quick);
    renderGroup("Freezer", freezer);
    renderGroup("Has a Recipe", hasRecipe);
  }

  return wrap;
}

function renderLibraryCard(meal) {
  var card = el("div", {
    style: {
      background: C.surface, border: "1.5px solid " + C.border,
      borderRadius: "12px", padding: "14px 16px", marginBottom: "10px",
      cursor: "pointer",
    },
    onClick: function() { state.modal = { type: "meal-detail", data: meal }; render(); }
  });

  var row = el("div", { style: { display: "flex", alignItems: "center", gap: "10px" } });

  var info = el("div", { style: { flex: "1" } }, [
    el("div", { style: { fontSize: "15px", fontWeight: "600", color: C.textPrimary } }, meal.name),
    el("div", { style: { fontSize: "12px", color: C.textMuted, marginTop: "3px" } },
      meal.meal_types.join(" · ") + (meal.dishes === 0 ? " · no dishes" : meal.dishes === 1 ? " · 1 dish" : " · 2 dishes")
    ),
  ]);

  row.appendChild(info);
  if (meal.recipe) row.appendChild(el("span", { style: { fontSize: "12px", color: C.purple, fontWeight: "600", background: C.purpleLight, padding: "2px 8px", borderRadius: "10px" } }, "recipe"));
  row.appendChild(el("span", { style: { fontSize: "18px", color: C.textMuted } }, "›"));

  card.appendChild(row);
  return card;
}

// ─── PLAN TAB ─────────────────────────────────────────────────────────────────
var THEMES = [
  { id: "texmex",        label: "Tex-Mex",    emoji: "🌮",
    meals: ["eggo-pb", "salad-kit-chicken", "salsa-verde-enchiladas", "ground-beef-tacos", "veggie-quesadilla", "air-fryer-nachos"] },
  { id: "mediterranean", label: "Med Week",   emoji: "🫒",
    meals: ["avocado-toast", "greek-salad-hummus", "shakshuka", "beef-couscous", "air-fryer-falafel", "white-bean-tomato-soup"] },
  { id: "asian",         label: "Asian",      emoji: "🍜",
    meals: ["eggo-pb", "buddha-bowl", "teriyaki-beef-bowl", "air-fryer-tofu-bowl", "air-fryer-gyoza", "ramen-egg"] },
  { id: "cozy",          label: "Cozy Soups", emoji: "🍲",
    meals: ["eggo-pb", "salad-kit-chicken", "tomato-basil-soup", "potato-leek-soup", "white-bean-tomato-soup", "red-lentil-soup"] },
  { id: "mix",           label: "Mix It Up",  emoji: "✨",
    meals: ["eggo-pb", "salad-kit-chicken", "frozen-veggie-meal", "veggie-quesadilla", "shakshuka", "pasta-jarred-sauce"] },
];

var DEFAULT_SERVINGS = {
  // crockpot soups — one big batch covers most of the week
  "white-bean-tomato-soup": 6, "butternut-squash-soup": 6, "potato-leek-soup": 6,
  "red-lentil-soup": 6, "tomato-basil-soup": 6, "black-bean-soup": 6,
  "corn-chowder": 6, "minestrone": 6,
  // recipes that make a batch
  "salsa-verde-enchiladas": 4,
  "pasta-jarred-sauce": 3, "air-fryer-tofu-bowl": 3,
  "ground-beef-tacos": 3, "teriyaki-beef-bowl": 3, "beef-couscous": 3,
  "air-fryer-gyoza": 3, "air-fryer-falafel": 3,
  // two servings from one prep
  "salad-kit-chicken": 2, "veggie-quesadilla": 2, "shakshuka": 2,
  // batch on Sunday, grab all week
  "hard-boiled-eggs": 6,
  // packed lunch batch meals
  "cold-pasta-salad": 5,
};

function getDefaultServings(id) { return DEFAULT_SERVINGS[id] || 1; }

function seededShuffle(arr, seed) {
  var a = arr.slice(), s = seed + 1;
  for (var i = a.length - 1; i > 0; i--) {
    s = ((s * 1103515245) + 12345) & 0x7fffffff;
    var j = Math.abs(s) % (i + 1);
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function renderPlan() {
  var wrap = el("div", { style: { padding: "20px 16px" } });
  var plan = getWeekPlan();
  if (!plan.servings) plan.servings = {};

  // ── Shopping mode (list only) ──────────────────────────────────────────────
  if (plan.shopping_mode) {
    wrap.appendChild(el("button", {
      style: {
        background: "none", border: "none", cursor: "pointer",
        fontSize: "13px", color: C.purple, fontWeight: "600",
        padding: "0", marginBottom: "20px", display: "block",
      },
      onClick: function() {
        var p = getWeekPlan(); p.shopping_mode = false; saveWeekPlan(p); render();
      }
    }, "← Edit plan"));

    var ticked = plan.ticked_items || [];
    var activeRepeatKeys = plan.repeat_buys !== undefined ? plan.repeat_buys : REPEAT_BUYS.map(function(r) { return r.key; });
    var bySection = buildShoppingList(plan.meal_pool, activeRepeatKeys);
    var hasAny = SECTIONS.some(function(s) { return bySection[s.key] && bySection[s.key].length; });
    var totalItems = SECTIONS.reduce(function(n, s) { return n + (bySection[s.key] ? bySection[s.key].length : 0); }, 0);
    var tickedCount = ticked.length;

    var listHeader = el("div", { style: { display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "16px" } }, [
      el("p", { style: { fontSize: "16px", fontWeight: "700", color: C.textPrimary } }, "Shopping List"),
      tickedCount > 0 ? el("span", { style: { fontSize: "13px", color: C.purple } }, tickedCount + " / " + totalItems + " got it") : null,
    ]);
    if (tickedCount > 0) {
      var clearBtn = el("button", {
        style: { marginLeft: "auto", background: "none", border: "none", fontSize: "12px", color: C.textMuted, cursor: "pointer", padding: "0" },
        onClick: function() { var p = getWeekPlan(); p.ticked_items = []; saveWeekPlan(p); render(); }
      }, "clear all");
      listHeader.appendChild(clearBtn);
    }
    wrap.appendChild(listHeader);

    if (!hasAny) {
      wrap.appendChild(el("p", { style: { color: C.textMuted, fontSize: "14px" } }, "No items yet — edit your plan first."));
    } else {
      SECTIONS.forEach(function(s) {
        var items = bySection[s.key];
        if (!items || !items.length) return;
        wrap.appendChild(el("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", marginTop: "4px" } }, [
          el("span", { style: { fontSize: "16px" } }, s.emoji),
          el("span", { style: { fontSize: "13px", fontWeight: "700", color: C.purple, letterSpacing: "0.4px", textTransform: "uppercase" } }, s.label),
        ]));
        var sectionCard = el("div", { style: { background: C.surface, border: "1.5px solid " + C.border, borderRadius: "12px", padding: "4px 14px", marginBottom: "14px" } });
        items.forEach(function(itemText, i) {
          var isTicked = ticked.indexOf(itemText) !== -1;
          var row = el("div", {
            style: { display: "flex", gap: "12px", alignItems: "center", padding: "12px 0", cursor: "pointer", borderBottom: i < items.length - 1 ? "1px solid " + C.border : "none", opacity: isTicked ? "0.45" : "1" },
            onClick: function() {
              var p = getWeekPlan(); if (!p.ticked_items) p.ticked_items = [];
              var idx = p.ticked_items.indexOf(itemText);
              if (idx === -1) p.ticked_items.push(itemText); else p.ticked_items.splice(idx, 1);
              saveWeekPlan(p); render();
            }
          }, [
            el("div", { style: { width: "22px", height: "22px", borderRadius: "50%", flexShrink: "0", background: isTicked ? C.purple : "transparent", border: "2px solid " + (isTicked ? C.purple : C.border), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: C.white } }, isTicked ? "✓" : ""),
            el("span", { style: { fontSize: "15px", color: C.textPrimary, textDecoration: isTicked ? "line-through" : "none" } }, itemText),
          ]);
          sectionCard.appendChild(row);
        });
        wrap.appendChild(sectionCard);
      });
    }

    // Bottom "back to plan" so you don't have to scroll up
    wrap.appendChild(el("button", {
      style: {
        width: "100%", padding: "14px", borderRadius: "12px", marginTop: "20px", marginBottom: "32px",
        border: "1.5px solid " + C.border, background: "transparent", cursor: "pointer",
        fontSize: "14px", fontWeight: "600", color: C.textMuted,
      },
      onClick: function() {
        var p = getWeekPlan(); p.shopping_mode = false; saveWeekPlan(p); render();
      }
    }, "← Back to plan"));

    return wrap;
  }

  // ── Theme bar ──────────────────────────────────────────────────────────────
  wrap.appendChild(el("p", { style: { fontSize: "12px", color: C.textMuted, marginBottom: "8px" } }, "Quick-start with a theme:"));
  var themeBar = el("div", { style: {
    display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px",
    marginBottom: "24px", WebkitOverflowScrolling: "touch",
  }});
  THEMES.forEach(function(theme) {
    themeBar.appendChild(el("button", {
      style: {
        flexShrink: "0", padding: "8px 14px", borderRadius: "20px",
        border: "1.5px solid " + C.border, background: C.surface,
        cursor: "pointer", fontSize: "13px", fontWeight: "600",
        color: C.textPrimary, whiteSpace: "nowrap",
      },
      onClick: function() {
        var p = getWeekPlan();
        p.meal_pool = theme.meals.filter(function(id) { return !!getMealById(id); });
        p.servings = {};
        p.meal_pool.forEach(function(id) { p.servings[id] = getDefaultServings(id); });
        saveWeekPlan(p);
        state.picker = null;
        render();
      }
    }, theme.emoji + " " + theme.label));
  });
  wrap.appendChild(themeBar);

  // ── Total meals summary ────────────────────────────────────────────────────
  var totalMeals = plan.meal_pool.reduce(function(n, id) {
    return n + ((plan.servings && plan.servings[id]) || 1);
  }, 0);
  if (totalMeals > 0) {
    wrap.appendChild(el("p", { style: { fontSize: "13px", color: C.purple, fontWeight: "600", marginBottom: "20px" } },
      totalMeals + " meals planned this week"
    ));
  }

  // ── No Cook / Cook groups ──────────────────────────────────────────────────
  function isSnackOnly(m) {
    return m.meal_types.indexOf("snack") !== -1 &&
           m.meal_types.indexOf("dinner") === -1 &&
           m.meal_types.indexOf("lunch") === -1;
  }

  function isMealNoCook(m) {
    return !isSnackOnly(m) && (
      m.tags.indexOf("no-cook") !== -1 ||
      (m.tags.indexOf("freezer") !== -1 && m.tags.indexOf("crockpot") === -1)
    );
  }

  var PLAN_GROUPS = [
    { key: "no-cook", label: "No Cook",  emoji: "🥗", subtitle: "Grab, assemble, blend, or heat from frozen", filter: isMealNoCook },
    { key: "cook",    label: "Cook",     emoji: "🍳", subtitle: "Requires cooking — usually makes several meals", filter: function(m) { return !isMealNoCook(m) && !isSnackOnly(m); } },
  ];

  PLAN_GROUPS.forEach(function(grp) {
    var selected = plan.meal_pool.filter(function(id) {
      var m = getMealById(id);
      return m && grp.filter(m);
    });

    var section = el("div", { style: { marginBottom: "24px" } });

    // Section header
    section.appendChild(el("div", { style: { marginBottom: "10px" } }, [
      el("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" } }, [
        el("span", {}, grp.emoji),
        el("span", { style: { fontSize: "13px", fontWeight: "700", color: C.textMuted, letterSpacing: "0.5px", textTransform: "uppercase" } }, grp.label),
      ]),
      el("p", { style: { fontSize: "11px", color: C.textMuted, margin: "0", paddingLeft: "20px" } }, grp.subtitle),
    ]));

    // Selected meal rows
    selected.forEach(function(id) {
      var meal = getMealById(id);
      if (!meal) return;
      var servings = (plan.servings && plan.servings[id]) || 1;
      var mealLabel = servings === 1 ? "1 meal" : servings + " meals";

      var row = el("div", { style: {
        display: "flex", alignItems: "center", gap: "8px",
        background: C.surface, border: "1.5px solid " + C.border,
        borderRadius: "12px", padding: "10px 14px", marginBottom: "8px",
      }}, [
        el("div", { style: { flex: "1", minWidth: "0" } }, [
          el("div", { style: { fontSize: "14px", fontWeight: "600", color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, meal.name),
          el("div", { style: { fontSize: "11px", color: C.purple, fontWeight: "600", marginTop: "2px" } }, mealLabel),
        ]),
        el("button", {
          style: {
            width: "26px", height: "26px", borderRadius: "50%", flexShrink: "0",
            border: "1.5px solid " + (servings > 1 ? C.border : C.chipInactive),
            background: "none", cursor: servings > 1 ? "pointer" : "default",
            fontSize: "15px", color: servings > 1 ? C.textPrimary : C.border,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0",
          },
          onClick: function() {
            if (servings <= 1) return;
            var p = getWeekPlan(); if (!p.servings) p.servings = {};
            p.servings[id] = servings - 1; saveWeekPlan(p); render();
          }
        }, "−"),
        el("button", {
          style: {
            width: "26px", height: "26px", borderRadius: "50%", flexShrink: "0",
            border: "1.5px solid " + C.border, background: "none", cursor: "pointer",
            fontSize: "15px", color: C.textPrimary,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0",
          },
          onClick: function() {
            var p = getWeekPlan(); if (!p.servings) p.servings = {};
            p.servings[id] = servings + 1; saveWeekPlan(p); render();
          }
        }, "+"),
        el("button", {
          style: {
            width: "26px", height: "26px", flexShrink: "0",
            border: "none", background: "none", cursor: "pointer",
            fontSize: "18px", color: C.textMuted, padding: "0",
            display: "flex", alignItems: "center", justifyContent: "center",
          },
          onClick: function() {
            var p = getWeekPlan();
            var idx = p.meal_pool.indexOf(id);
            if (idx !== -1) p.meal_pool.splice(idx, 1);
            if (p.servings) delete p.servings[id];
            saveWeekPlan(p); render();
          }
        }, "×"),
      ]);
      section.appendChild(row);
    });

    // Picker
    var pickerOpen = state.picker && state.picker.type === grp.key;
    if (pickerOpen) {
      var seed = state.picker.seed || 0;
      var candidates = state.meals.filter(function(m) {
        return grp.filter(m) && plan.meal_pool.indexOf(m.id) === -1;
      });
      var shown = seededShuffle(candidates, seed).slice(0, grp.key === "cook" ? 2 : 6);

      var pickerWrap = el("div", { style: {
        background: C.purpleLight, border: "1.5px solid " + C.border,
        borderRadius: "12px", padding: "12px", marginBottom: "8px",
      }});

      if (shown.length === 0) {
        pickerWrap.appendChild(el("p", { style: { fontSize: "13px", color: C.textMuted, padding: "4px 0" } }, "Everything's already in your plan."));
      } else {
        shown.forEach(function(m, idx2) {
          var def = getDefaultServings(m.id);
          pickerWrap.appendChild(el("div", {
            style: {
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 4px", cursor: "pointer",
              borderBottom: idx2 < shown.length - 1 ? "1px solid " + C.border : "none",
            },
            onClick: function() {
              var p = getWeekPlan();
              if (p.meal_pool.indexOf(m.id) === -1) {
                p.meal_pool.push(m.id);
                if (!p.servings) p.servings = {};
                p.servings[m.id] = def;
              }
              saveWeekPlan(p); state.picker = null; render();
            }
          }, [
            el("div", { style: { flex: "1" } }, [
              el("span", { style: { fontSize: "14px", fontWeight: "600", color: C.textPrimary, display: "block" } }, m.name),
              def > 1 ? el("span", { style: { fontSize: "11px", color: C.textMuted } }, "~" + def + " meals from one batch") : null,
            ]),
            el("span", { style: { fontSize: "13px", color: C.purple, fontWeight: "600", flexShrink: "0" } }, "+ add"),
          ]));
        });
      }

      pickerWrap.appendChild(el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px" } }, [
        el("button", {
          style: { background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: C.purple, fontWeight: "600", padding: "0" },
          onClick: function() { state.picker = { type: grp.key, seed: seed + 1 }; render(); }
        }, "↻ different options"),
        el("button", {
          style: { background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: C.textMuted, padding: "0" },
          onClick: function() { state.picker = null; render(); }
        }, "done"),
      ]));
      section.appendChild(pickerWrap);
    }

    if (!pickerOpen) {
      section.appendChild(el("button", {
        style: {
          width: "100%", padding: "10px", borderRadius: "12px",
          border: "1.5px dashed " + C.border, background: "none", cursor: "pointer",
          fontSize: "13px", color: C.textMuted, fontWeight: "500",
        },
        onClick: function() {
          state.picker = { type: grp.key, seed: Math.floor(Math.random() * 100) };
          render();
        }
      }, "+ add a " + grp.label.toLowerCase() + " meal"));
    }

    wrap.appendChild(section);
  });

  // ── Snacks ────────────────────────────────────────────────────────────────
  (function() {
    var allSnacks = state.meals.filter(isSnackOnly);
    var section = el("div", { style: { marginBottom: "24px" } });
    section.appendChild(el("div", { style: { marginBottom: "10px" } }, [
      el("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" } }, [
        el("span", {}, "🍎"),
        el("span", { style: { fontSize: "13px", fontWeight: "700", color: C.textMuted, letterSpacing: "0.5px", textTransform: "uppercase" } }, "Snacks"),
      ]),
      el("p", { style: { fontSize: "11px", color: C.textMuted, margin: "0", paddingLeft: "20px" } }, "Check what you want on hand this week"),
    ]));
    var card = el("div", { style: { background: C.surface, border: "1.5px solid " + C.border, borderRadius: "12px", padding: "4px 14px" } });
    allSnacks.forEach(function(m, i) {
      var isOn = plan.meal_pool.indexOf(m.id) !== -1;
      var row = el("div", {
        style: {
          display: "flex", alignItems: "center", gap: "12px",
          padding: "12px 0", cursor: "pointer",
          borderBottom: i < allSnacks.length - 1 ? "1px solid " + C.border : "none",
        },
        onClick: function() {
          var p = getWeekPlan();
          var idx = p.meal_pool.indexOf(m.id);
          if (idx === -1) p.meal_pool.push(m.id);
          else p.meal_pool.splice(idx, 1);
          saveWeekPlan(p); render();
        }
      }, [
        el("div", { style: {
          width: "22px", height: "22px", borderRadius: "50%", flexShrink: "0",
          background: isOn ? C.purple : "transparent",
          border: "2px solid " + (isOn ? C.purple : C.border),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", color: C.white,
        }}, isOn ? "✓" : ""),
        el("span", { style: { fontSize: "15px", color: C.textPrimary } }, m.name),
      ]);
      card.appendChild(row);
    });
    section.appendChild(card);
    wrap.appendChild(section);
  })();

  // ── Repeat Buys ───────────────────────────────────────────────────────────
  (function() {
    var activeKeys = plan.repeat_buys !== undefined ? plan.repeat_buys : REPEAT_BUYS.map(function(r) { return r.key; });
    var customs = plan.custom_repeat_buys || [];

    var section = el("div", { style: { marginBottom: "24px" } });
    section.appendChild(el("div", { style: { marginBottom: "10px" } }, [
      el("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" } }, [
        el("span", {}, "🔁"),
        el("span", { style: { fontSize: "13px", fontWeight: "700", color: C.textMuted, letterSpacing: "0.5px", textTransform: "uppercase" } }, "Repeat Buys"),
      ]),
      el("p", { style: { fontSize: "11px", color: C.textMuted, margin: "0", paddingLeft: "20px" } }, "Weekly staples — uncheck anything you don't need"),
    ]));

    var allItems = REPEAT_BUYS.map(function(r) { return { key: r.key, label: r.label, section: r.section, custom: false }; })
      .concat(customs.map(function(c) { return { key: "custom:" + c.label, label: c.label, section: c.section || "pantry", custom: true }; }));

    var card = el("div", { style: { background: C.surface, border: "1.5px solid " + C.border, borderRadius: "12px", padding: "4px 14px" } });

    allItems.forEach(function(rb, i) {
      var isOn = activeKeys.indexOf(rb.key) !== -1;
      var row = el("div", {
        style: {
          display: "flex", alignItems: "center", gap: "12px",
          padding: "12px 0", cursor: "pointer",
          borderBottom: i < allItems.length - 1 ? "1px solid " + C.border : "none",
        },
        onClick: function() {
          var p = getWeekPlan();
          var keys = p.repeat_buys !== undefined ? p.repeat_buys.slice() : REPEAT_BUYS.map(function(r) { return r.key; });
          var idx = keys.indexOf(rb.key);
          if (idx === -1) keys.push(rb.key);
          else keys.splice(idx, 1);
          p.repeat_buys = keys;
          saveWeekPlan(p); render();
        }
      }, [
        el("div", { style: {
          width: "22px", height: "22px", borderRadius: "50%", flexShrink: "0",
          background: isOn ? C.purple : "transparent",
          border: "2px solid " + (isOn ? C.purple : C.border),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", color: C.white,
        }}, isOn ? "✓" : ""),
        el("span", { style: { fontSize: "15px", color: C.textPrimary, flex: "1" } }, rb.label),
        rb.custom ? el("button", {
          style: { background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: C.textMuted, padding: "0 0 0 8px", flexShrink: "0" },
          onClick: function(e) {
            e.stopPropagation();
            var p = getWeekPlan();
            p.custom_repeat_buys = (p.custom_repeat_buys || []).filter(function(c) { return c.label !== rb.label; });
            p.repeat_buys = (p.repeat_buys || []).filter(function(k) { return k !== rb.key; });
            saveWeekPlan(p); render();
          }
        }, "×") : null,
      ]);
      card.appendChild(row);
    });

    // Inline add input or add button
    if (state.addingRepeatBuy) {
      var inputRow = el("div", { style: { display: "flex", gap: "8px", padding: "10px 0", borderTop: allItems.length ? "1px solid " + C.border : "none", alignItems: "center" } });
      var input = el("input", { style: { flex: "1", border: "none", outline: "none", fontSize: "15px", background: "transparent", color: C.textPrimary } });
      input.placeholder = "e.g. Sparkling water";
      var saveBtn = el("button", {
        style: { background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: C.purple, fontWeight: "700", padding: "0", flexShrink: "0" },
        onClick: function() {
          var label = input.value.trim();
          if (!label) { state.addingRepeatBuy = false; render(); return; }
          var p = getWeekPlan();
          if (!p.custom_repeat_buys) p.custom_repeat_buys = [];
          p.custom_repeat_buys.push({ label: label, section: "pantry" });
          if (!p.repeat_buys) p.repeat_buys = REPEAT_BUYS.map(function(r) { return r.key; });
          p.repeat_buys.push("custom:" + label);
          saveWeekPlan(p);
          state.addingRepeatBuy = false;
          render();
        }
      }, "Add");
      var cancelBtn = el("button", {
        style: { background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: C.textMuted, padding: "0", flexShrink: "0" },
        onClick: function() { state.addingRepeatBuy = false; render(); }
      }, "Cancel");
      inputRow.appendChild(input);
      inputRow.appendChild(saveBtn);
      inputRow.appendChild(cancelBtn);
      card.appendChild(inputRow);
      // Focus the input after render
      setTimeout(function() { input.focus(); }, 50);
    }

    section.appendChild(card);

    if (!state.addingRepeatBuy) {
      section.appendChild(el("button", {
        style: { background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: C.purple, fontWeight: "600", padding: "8px 0 0 0", display: "block" },
        onClick: function() { state.addingRepeatBuy = true; render(); }
      }, "+ add item"));
    }

    wrap.appendChild(section);
  })();

  // ── Browse all meals ──────────────────────────────────────────────────────
  wrap.appendChild(el("button", {
    style: {
      width: "100%", padding: "12px", borderRadius: "12px",
      border: "1.5px solid " + C.purple, background: "transparent", cursor: "pointer",
      fontSize: "14px", fontWeight: "600", color: C.purple,
      marginBottom: "12px",
    },
    onClick: function() { state.modal = { type: "library" }; render(); }
  }, "Browse all meals →"));

  // ── Done planning button ───────────────────────────────────────────────────
  wrap.appendChild(el("button", {
    style: {
      width: "100%", padding: "14px", borderRadius: "12px",
      border: "none", background: C.purple, cursor: "pointer",
      fontSize: "15px", fontWeight: "700", color: C.white,
      marginBottom: "32px",
    },
    onClick: function() {
      var p = getWeekPlan(); p.shopping_mode = true; saveWeekPlan(p); render();
    }
  }, "Done planning →"));

  return wrap;
}


var SECTIONS = [
  { key: "produce",      label: "Produce",      emoji: "🥬" },
  { key: "refrigerated", label: "Refrigerated",  emoji: "❄️" },
  { key: "frozen",       label: "Frozen",        emoji: "🧊" },
  { key: "pantry",       label: "Pantry",        emoji: "🥫" },
  { key: "household",    label: "Household",     emoji: "🏠" },
];

var REPEAT_BUYS = [
  { key: "milk",         label: "Milk",          section: "refrigerated" },
  { key: "coffee",       label: "Coffee",        section: "pantry" },
  { key: "cat-food-wet", label: "Cat food (wet)", section: "household" },
  { key: "cat-food-dry", label: "Cat food (dry)", section: "household" },
  { key: "cat-litter",   label: "Cat litter",    section: "household" },
];

function buildShoppingList(mealIds, repeatBuyKeys) {
  // Accumulate quantities per item: { itemName: { section, qty, unit } }
  var acc = {};

  function addItem(name, section, qty, unit) {
    if (!acc[name]) {
      acc[name] = { section: section || "pantry", qty: qty || null, unit: unit || null };
    } else {
      // If both have a numeric qty and matching unit, sum them
      if (qty && unit && acc[name].unit === unit) {
        acc[name].qty = (acc[name].qty || 0) + qty;
      }
      // If they don't have matching units (or one has no qty), just keep the entry as-is
    }
  }

  mealIds.forEach(function(id) {
    var meal = getMealById(id);
    if (!meal) return;
    var items = meal.shopping_items || (meal.shopping_item ? [{ item: meal.shopping_item, section: "pantry" }] : []);
    items.forEach(function(si) {
      addItem(si.item, si.section, si.qty, si.unit);
    });
  });

  var plan = getWeekPlan();
  var customs = plan.custom_repeat_buys || [];
  (repeatBuyKeys || []).forEach(function(key) {
    var rb = REPEAT_BUYS.find(function(r) { return r.key === key; });
    if (!rb) {
      var custom = customs.find(function(c) { return "custom:" + c.label === key; });
      if (custom) addItem(custom.label, custom.section || "pantry", null, null);
      return;
    }
    addItem(rb.label, rb.section, null, null);
  });

  // Format label: "Canned black beans (3 cans)" or just "Canned black beans"
  function pluralizeUnit(qty, unit) {
    if (qty <= 1) return unit;
    if (unit === "box") return "boxes";
    if (!unit.endsWith("s")) return unit + "s";
    return unit;
  }
  function formatLabel(name, entry) {
    if (entry.qty && entry.unit) {
      if (entry.unit === "eggs") {
        var cartons = Math.ceil(entry.qty / 12);
        return name + " (" + cartons + " carton" + (cartons > 1 ? "s" : "") + ")";
      }
      return name + " (" + entry.qty + " " + pluralizeUnit(entry.qty, entry.unit) + ")";
    }
    return name;
  }

  // Group into bySection for rendering
  var bySection = {};
  SECTIONS.forEach(function(s) { bySection[s.key] = []; });
  Object.keys(acc).forEach(function(name) {
    var entry = acc[name];
    var sec = entry.section;
    if (!bySection[sec]) bySection[sec] = [];
    bySection[sec].push(formatLabel(name, entry));
  });

  return bySection;
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function renderModal() {
  var overlay = el("div", {
    style: {
      position: "fixed", inset: "0", background: "rgba(61,43,35,0.45)",
      display: "flex", alignItems: "flex-end", zIndex: "100",
    },
    onClick: function(e) { if (e.target === overlay) { state.modal = null; render(); } }
  });

  var sheet = el("div", { style: {
    background: C.surface, borderRadius: "20px 20px 0 0",
    padding: "20px 20px calc(env(safe-area-inset-bottom,16px) + 20px)",
    width: "100%", maxHeight: "85vh", overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  }});

  var handle = el("div", { style: {
    width: "36px", height: "4px", borderRadius: "2px",
    background: C.border, margin: "0 auto 16px",
  }});
  sheet.appendChild(handle);

  if (state.modal.type === "recipe") renderRecipeModal(sheet, state.modal.data);
  if (state.modal.type === "meal-detail") renderMealDetailModal(sheet, state.modal.data);
  if (state.modal.type === "add-meal") renderAddMealModal(sheet);
  if (state.modal.type === "edit-habits") renderEditHabitsModal(sheet);
  if (state.modal.type === "library") renderLibraryModal(sheet);

  overlay.appendChild(sheet);
  return overlay;
}

function renderRecipeModal(sheet, meal) {
  sheet.appendChild(el("h2", { style: { fontSize: "20px", fontWeight: "700", color: C.textPrimary, marginBottom: "6px" } }, meal.name));
  if (meal.notes) {
    sheet.appendChild(el("p", { style: { fontSize: "14px", color: C.textMuted, marginBottom: "16px", lineHeight: "1.5" } }, meal.notes));
  }
  sheet.appendChild(el("div", { style: { height: "1px", background: C.border, marginBottom: "16px" } }));
  meal.recipe.forEach(function(step, i) {
    var row = el("div", { style: { display: "flex", gap: "12px", marginBottom: "14px", alignItems: "flex-start" } }, [
      el("div", { style: {
        width: "24px", height: "24px", borderRadius: "50%", flexShrink: "0",
        background: C.chipInactive, color: C.brand,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "12px", fontWeight: "700",
      }}, (i+1)+""),
      el("p", { style: { fontSize: "15px", color: C.textPrimary, lineHeight: "1.55", paddingTop: "2px" } }, step),
    ]);
    sheet.appendChild(row);
  });
}

function renderMealDetailModal(sheet, meal) {
  sheet.appendChild(el("h2", { style: { fontSize: "20px", fontWeight: "700", color: C.textPrimary, marginBottom: "4px" } }, meal.name));
  sheet.appendChild(el("p", { style: { fontSize: "13px", color: C.textMuted, marginBottom: "16px" } },
    meal.meal_types.join(" · ") + (meal.dishes === 0 ? " · no dishes" : " · " + meal.dishes + " dish" + (meal.dishes > 1 ? "es" : ""))
  ));

  if (meal.notes) {
    sheet.appendChild(el("p", { style: { fontSize: "14px", color: C.textPrimary, lineHeight: "1.5", marginBottom: "16px" } }, meal.notes));
  }

  if (meal.recipe) {
    var recipeBtn = el("button", {
      style: {
        width: "100%", padding: "12px", borderRadius: "10px",
        background: C.chipInactive, border: "none",
        color: C.brand, fontSize: "14px", fontWeight: "600", cursor: "pointer", marginBottom: "12px",
      },
      onClick: function() { state.modal = { type: "recipe", data: meal }; render(); }
    }, "View Recipe →");
    sheet.appendChild(recipeBtn);
  }

  // Tags
  var tagWrap = el("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } });
  meal.tags.forEach(function(tag) {
    tagWrap.appendChild(el("span", { style: {
      padding: "4px 10px", borderRadius: "20px",
      background: C.chipInactive, fontSize: "12px", color: C.textMuted,
    }}, tag));
  });
  sheet.appendChild(tagWrap);
}

function renderAddMealModal(sheet) {
  sheet.appendChild(el("h2", { style: { fontSize: "20px", fontWeight: "700", color: C.textPrimary, marginBottom: "16px" } }, "Add a Meal"));

  var nameInput = el("input", { type: "text", placeholder: "Meal name", style: {
    width: "100%", padding: "12px", borderRadius: "10px",
    border: "1.5px solid " + C.border, background: C.bg,
    fontSize: "16px", color: C.textPrimary, outline: "none", marginBottom: "12px",
  }});

  var notesInput = el("input", { type: "text", placeholder: "Notes (optional)", style: {
    width: "100%", padding: "12px", borderRadius: "10px",
    border: "1.5px solid " + C.border, background: C.bg,
    fontSize: "16px", color: C.textPrimary, outline: "none", marginBottom: "12px",
  }});

  var shopInput = el("input", { type: "text", placeholder: "Shopping list item(s)", style: {
    width: "100%", padding: "12px", borderRadius: "10px",
    border: "1.5px solid " + C.border, background: C.bg,
    fontSize: "16px", color: C.textPrimary, outline: "none", marginBottom: "16px",
  }});

  // Meal type checkboxes
  var typeWrap = el("div", { style: { display: "flex", gap: "8px", marginBottom: "16px" } });
  ["breakfast","lunch","dinner","snack"].forEach(function(t) {
    var active = false;
    var chip = el("div", {
      style: {
        padding: "8px 14px", borderRadius: "20px", cursor: "pointer",
        background: C.chipInactive, border: "1.5px solid " + C.border,
        fontSize: "13px", color: C.textMuted,
      },
      onClick: function() {
        active = !active;
        chip.style.background = active ? C.brand : C.chipInactive;
        chip.style.borderColor = active ? C.brand : C.border;
        chip.style.color = active ? C.white : C.textMuted;
        chip._active = active;
      }
    }, t);
    chip._type = t;
    typeWrap.appendChild(chip);
  });

  var saveBtn = el("button", {
    style: {
      width: "100%", padding: "13px", borderRadius: "12px", border: "none",
      background: C.brand, color: C.white, fontSize: "16px", fontWeight: "600", cursor: "pointer",
    },
    onClick: function() {
      var name = nameInput.value.trim();
      if (!name) return;
      var types = Array.from(typeWrap.children)
        .filter(function(c) { return c._active; })
        .map(function(c) { return c._type; });
      if (!types.length) types = ["lunch"];

      var newMeal = {
        id: "custom-" + Date.now(),
        name: name,
        meal_types: types,
        tags: ["quick"],
        dishes: 0,
        notes: notesInput.value.trim() || null,
        recipe: null,
        shopping_item: shopInput.value.trim() || name,
      };

      var custom = JSON.parse(localStorage.getItem("custom_meals") || "[]");
      custom.push(newMeal);
      localStorage.setItem("custom_meals", JSON.stringify(custom));
      state.meals.push(newMeal);
      state.modal = null;
      render();
    }
  }, "Save Meal");

  sheet.appendChild(el("p", { style: { fontSize: "13px", color: C.textMuted, marginBottom: "8px" } }, "Meal type:"));
  sheet.appendChild(typeWrap);
  sheet.appendChild(nameInput);
  sheet.appendChild(notesInput);
  sheet.appendChild(shopInput);
  sheet.appendChild(saveBtn);
}

function renderEditHabitsModal(sheet) {
  sheet.appendChild(el("h2", { style: { fontSize: "20px", fontWeight: "700", color: C.textPrimary, marginBottom: "4px" } }, "Customize Habits"));
  sheet.appendChild(el("p", { style: { fontSize: "13px", color: C.textMuted, marginBottom: "16px" } }, "Your daily check-ins. Built-in habits can't be removed, but you can add your own."));
  sheet.appendChild(el("div", { style: { height: "1px", background: C.border, marginBottom: "16px" } }));

  // Built-ins (read-only)
  sheet.appendChild(el("p", { style: { fontSize: "11px", fontWeight: "700", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" } }, "Built-in"));
  var builtInCard = el("div", { style: { background: C.chipInactive, borderRadius: "12px", padding: "4px 14px", marginBottom: "20px" } });
  BUILT_IN_HABITS.forEach(function(h, i) {
    builtInCard.appendChild(el("div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: i < BUILT_IN_HABITS.length - 1 ? "1px solid " + C.border : "none" } }, [
      el("span", { style: { fontSize: "16px", width: "22px", textAlign: "center" } }, h.emoji),
      el("span", { style: { fontSize: "14px", color: C.textPrimary, flex: "1" } }, h.label),
      h.weekdayOnly ? el("span", { style: { fontSize: "11px", color: C.textMuted, background: C.border, borderRadius: "6px", padding: "2px 6px" } }, "weekdays") : null,
    ]));
  });
  sheet.appendChild(builtInCard);

  // Custom habits
  var customs = getCustomHabits();
  sheet.appendChild(el("p", { style: { fontSize: "11px", fontWeight: "700", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" } }, "Your habits"));

  if (customs.length) {
    var customCard = el("div", { style: { background: C.surface, border: "1.5px solid " + C.border, borderRadius: "12px", padding: "4px 14px", marginBottom: "16px" } });
    customs.forEach(function(h, i) {
      var row = el("div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: i < customs.length - 1 ? "1px solid " + C.border : "none" } }, [
        el("span", { style: { fontSize: "16px", width: "22px", textAlign: "center" } }, h.emoji || "✅"),
        el("span", { style: { fontSize: "14px", color: C.textPrimary, flex: "1" } }, h.label),
        el("button", {
          style: { background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: C.textMuted, padding: "0 4px" },
          onClick: function() {
            var updated = getCustomHabits().filter(function(x) { return x.key !== h.key; });
            saveCustomHabits(updated);
            render();
          }
        }, "✕"),
      ]);
      customCard.appendChild(row);
    });
    sheet.appendChild(customCard);
  }

  // Add new habit
  var newLabelInput = el("input", { type: "text", placeholder: "Habit name", style: { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid " + C.border, fontSize: "14px", marginBottom: "8px", boxSizing: "border-box", outline: "none", background: C.surface, color: C.textPrimary } });
  var newEmojiInput = el("input", { type: "text", placeholder: "Emoji (optional)", style: { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid " + C.border, fontSize: "14px", marginBottom: "10px", boxSizing: "border-box", outline: "none", background: C.surface, color: C.textPrimary } });
  sheet.appendChild(newLabelInput);
  sheet.appendChild(newEmojiInput);
  sheet.appendChild(el("button", {
    style: { width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: C.purple, color: C.white, fontSize: "14px", fontWeight: "700", cursor: "pointer" },
    onClick: function() {
      var label = newLabelInput.value.trim();
      if (!label) return;
      var emoji = newEmojiInput.value.trim() || "✅";
      var key = "custom_" + Date.now();
      var updated = getCustomHabits();
      updated.push({ key: key, label: label, emoji: emoji });
      saveCustomHabits(updated);
      newLabelInput.value = "";
      newEmojiInput.value = "";
      render();
    }
  }, "Add habit"));
}

function renderLibraryModal(sheet) {
  sheet.appendChild(el("h2", { style: { fontSize: "20px", fontWeight: "700", color: C.textPrimary, marginBottom: "4px" } }, "All Meals"));

  // Filter chips
  var filters = ["All","Breakfast","Lunch","Dinner","Snack","No Cook","Crockpot"];
  var chipRow = el("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" } });
  filters.forEach(function(f) {
    var active = (state.libraryFilter === null && f === "All") || state.libraryFilter === f;
    chipRow.appendChild(el("button", {
      style: { padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600", background: active ? C.purple : C.chipInactive, color: active ? C.white : C.textMuted },
      onClick: function() { state.libraryFilter = f === "All" ? null : f; render(); }
    }, f));
  });
  sheet.appendChild(chipRow);

  // Filter meals
  var meals = state.meals.slice();
  if (state.libraryFilter) {
    var lf = state.libraryFilter;
    meals = meals.filter(function(m) {
      if (lf === "No Cook") return m.tags.indexOf("no-cook") !== -1;
      if (lf === "Crockpot") return m.tags.indexOf("crockpot") !== -1;
      return m.meal_types.indexOf(lf.toLowerCase()) !== -1;
    });
  }

  var plan = getWeekPlan();
  meals.forEach(function(meal) {
    var inPlan = plan.meal_pool.indexOf(meal.id) !== -1;
    var card = el("div", {
      style: { background: C.surface, border: "1.5px solid " + (inPlan ? C.purple : C.border), borderRadius: "12px", padding: "12px 14px", marginBottom: "10px", cursor: "pointer" },
      onClick: function() {
        var p = getWeekPlan();
        var idx = p.meal_pool.indexOf(meal.id);
        if (idx === -1) { p.meal_pool.push(meal.id); p.servings[meal.id] = getDefaultServings(meal.id); }
        else p.meal_pool.splice(idx, 1);
        saveWeekPlan(p);
        render();
      }
    }, [
      el("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
        el("span", { style: { fontSize: "15px", fontWeight: "600", color: C.textPrimary, flex: "1" } }, meal.name),
        el("div", { style: { width: "20px", height: "20px", borderRadius: "50%", flexShrink: "0", background: inPlan ? C.purple : "transparent", border: "2px solid " + (inPlan ? C.purple : C.border), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: C.white } }, inPlan ? "✓" : ""),
      ]),
      el("p", { style: { fontSize: "12px", color: C.textMuted, marginTop: "2px" } }, meal.meal_types.join(" · ")),
    ]);
    sheet.appendChild(card);
  });
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function renderEmptyState(title, body, btnLabel, onBtn) {
  return el("div", { style: {
    textAlign: "center", padding: "40px 20px",
    background: C.surface, borderRadius: "16px", border: "1.5px solid " + C.border,
  }}, [
    el("p", { style: { fontSize: "17px", fontWeight: "600", color: C.textPrimary, marginBottom: "8px" } }, title),
    el("p", { style: { fontSize: "14px", color: C.textMuted, marginBottom: "20px", lineHeight: "1.5" } }, body),
    el("button", {
      style: {
        padding: "11px 22px", borderRadius: "10px", border: "none",
        background: C.brand, color: C.white, fontSize: "14px", fontWeight: "600", cursor: "pointer",
      },
      onClick: onBtn,
    }, btnLabel),
  ]);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
function loadMeals() {
  var custom = JSON.parse(localStorage.getItem("custom_meals") || "[]");
  return fetch("data/meals.json")
    .then(function(r) { return r.json(); })
    .then(function(meals) {
      state.meals = meals.concat(custom);
      render();
    })
    .catch(function() {
      state.meals = custom;
      render();
    });
}

if ("serviceWorker" in navigator) {
  var swFirstInstall = !navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").then(function(reg) { reg.update(); });
  navigator.serviceWorker.addEventListener("controllerchange", function() {
    if (!swFirstInstall) window.location.reload();
    swFirstInstall = false;
  });
}

loadMeals();
