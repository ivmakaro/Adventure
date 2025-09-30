const STORAGE_KEY = 'mood-pulse-log';
const SESSION_TIMEOUT_MINUTES = 10;

const moodButtons = document.querySelectorAll('.mood-button');
const logList = document.querySelector('#log-list');
const emptyState = document.querySelector('#log-empty');
const clearButton = document.querySelector('#clear-log');
const activeSessionEl = document.querySelector('#active-session');

const template = document.querySelector('#log-item-template');

const clone = (value) =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const initialState = {
  entries: [],
  activeEntryId: null,
};

let state = loadState();

hydrateState();
render();

moodButtons.forEach((button) => {
  button.addEventListener('click', () => handleMoodTap(button.dataset.mood));
});

clearButton.addEventListener('click', () => {
  if (!state.entries.length) return;
  const confirmClear = window.confirm(
    'Clear all saved moods? This action cannot be undone.'
  );
  if (!confirmClear) return;
  state = clone(initialState);
  persistState();
  render();
});

function handleMoodTap(mood) {
  const now = new Date();

  const activeEntry = getActiveEntry(now);
  if (activeEntry && activeEntry.mood === mood) {
    activeEntry.intensity += 1;
    activeEntry.lastTap = now.toISOString();
    persistState();
    render();
    return;
  }

  state.activeEntryId = null;

  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    mood,
    startedAt: now.toISOString(),
    intensity: 1,
    lastTap: now.toISOString(),
  };

  state.entries = [entry, ...state.entries];
  state.activeEntryId = entry.id;

  persistState();
  render();
}

function getActiveEntry(now) {
  if (!state.activeEntryId) return null;
  const entry = state.entries.find((item) => item.id === state.activeEntryId);
  if (!entry) {
    state.activeEntryId = null;
    return null;
  }

  const lastTapTime = new Date(entry.lastTap);
  const elapsed = now.getTime() - lastTapTime.getTime();
  const timeout = SESSION_TIMEOUT_MINUTES * 60 * 1000;
  if (elapsed > timeout) {
    state.activeEntryId = null;
    persistState();
    return null;
  }

  return entry;
}

function render() {
  const now = new Date();
  const activeEntry = getActiveEntry(now);

  logList.innerHTML = '';

  if (!state.entries.length) {
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
    const fragment = document.createDocumentFragment();

    state.entries.forEach((entry) => {
      const listItem = template.content.firstElementChild.cloneNode(true);
      listItem.dataset.active = entry.id === state.activeEntryId;

      const moodEl = listItem.querySelector('.log-mood');
      const intensityEl = listItem.querySelector('.log-intensity');
      const timeEl = listItem.querySelector('time');

      moodEl.textContent = entry.mood;
      intensityEl.textContent = `Intensity: ${entry.intensity}`;
      timeEl.dateTime = entry.startedAt;
      timeEl.textContent = formatDate(entry.startedAt);

      fragment.appendChild(listItem);
    });

    logList.appendChild(fragment);
  }

  if (activeEntry) {
    activeSessionEl.textContent = `${activeEntry.mood} · intensity ${activeEntry.intensity}. Keep tapping to grow it or choose another mood to start fresh.`;
  } else if (state.entries.length) {
    activeSessionEl.textContent = 'Tap a mood to begin a new entry.';
  } else {
    activeSessionEl.textContent = '';
  }
}

function formatDate(iso) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(initialState);
    const parsed = JSON.parse(raw);
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      activeEntryId: parsed.activeEntryId ?? null,
    };
  } catch (error) {
    console.error('Failed to parse saved state', error);
    return clone(initialState);
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hydrateState() {
  if (!state.entries.length) return;
  // Drop the active entry if it has already timed out when the page loads.
  const now = new Date();
  const activeEntry = getActiveEntry(now);
  if (!activeEntry) {
    state.activeEntryId = null;
    persistState();
  }
}
