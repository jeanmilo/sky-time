const shellEl = document.getElementById('shell');
const display = document.getElementById('display');
const displayHit = document.getElementById('displayHit');
const timeInput = document.getElementById('timeInput');
const statusLabel = document.getElementById('statusLabel');
const startStop = document.getElementById('startStop');
const birdBody = document.getElementById('birdbody');
const api = window.timerAPI ?? {};

// this is milliseconds btw 
const MIN_MS = 3 * 1000;
const MAX_MS = 60 * 60 * 1000;

// ---- bird ----
const afps = 6; // animation frames per second 
const BIRD_DEFAULT = 'still.png';
const BIRD_FRAMES = ['still.png', 'bawk.png'];
let flipTimer = null;
let flipIndex = 0;


birdBody.style.backgroundImage = `url('${BIRD_DEFAULT}')`;

function startFlip() {
  stopFlip();
  flipIndex = 0;
  flipTimer = setInterval(() => {
    flipIndex = (flipIndex + 1) % BIRD_FRAMES.length;
    birdBody.style.backgroundImage = `url('${BIRD_FRAMES[flipIndex]}')`;
  }, 1000 / afps);
}

function stopFlip() {
  clearInterval(flipTimer);
  flipTimer = null;
  birdBody.style.backgroundImage = `url('${BIRD_DEFAULT}')`;
}

let durationMs = 15 * 60 * 1000; // default timer time
let remainingMs = durationMs;
let running = false;
let endsAt = 0; 
let rafId = null; // requestAnimationFrame id



// ---- ui render ------
function clockStr(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function render() {
  display.textContent = clockStr(remainingMs);

  shellEl.classList.toggle('running', running);
  statusLabel.textContent = running ? 'RUNNING'
    : remainingMs <= 0 ? 'TIME'
    : remainingMs === durationMs ? 'READY'
    : 'PAUSED';
  startStop.textContent = running ? 'Pause' : remainingMs <= 0 ? 'Reset' : 'Start';
}


// ---- controls ----
const liveMs = () => (running ? Math.max(0, endsAt - Date.now()) : remainingMs);

function stop() {
  running = false;
  cancelAnimationFrame(rafId);
}

function start() {
  if (remainingMs <= 0) return reset();
  running = true;
  shellEl.classList.remove('done');
  stopFlip();
  endsAt = Date.now() + remainingMs;
  loop();
}

function pause() {
  remainingMs = liveMs();
  stop();
  render();
}

function reset() {
  stop();
  stopAlarmRepeat();
  shellEl.classList.remove('done');
  stopFlip();
  remainingMs = durationMs;
  render();
}

function setTime(ms) {
  stop();
  stopAlarmRepeat();
  shellEl.classList.remove('done');
  stopFlip();
  durationMs = remainingMs = ms;
  render();
}

function setMinutes(minutes) {
  setTime(minutes * 60000);
}

function adjustMinutes(delta) {
  const next = Math.min(MAX_MS, Math.max(MIN_MS, liveMs() + delta * 60000));
  remainingMs = next;
  if (running) endsAt = Date.now() + next;
  else durationMs = next;
  stopAlarmRepeat();
  shellEl.classList.remove('done');
  stopFlip();
  render();
}

function finish() {
  stop();
  remainingMs = 0;
  shellEl.classList.add('done');
  startFlip();
  render();
  startAlarmRepeat();
  api.alarm?.();
}

const toggle = () => (remainingMs <= 0 ? reset() : running ? pause() : start());


// ---- type-in time editor ----
// str can be "mm:ss" or a bare number of minutes (e.g. "12" or "7.5").
function parseClockInput(str) {
  const trimmed = str.trim();
  if (!trimmed) return null;

  let totalSeconds;
  if (trimmed.includes(':')) {
    const [m, s] = trimmed.split(':');
    const mins = Number(m);
    const secs = Number(s);
    if (!Number.isFinite(mins) || !Number.isFinite(secs) || secs < 0 || secs > 59) return null;
    totalSeconds = mins * 60 + secs;
  } else {
    const mins = Number(trimmed);
    if (!Number.isFinite(mins) || mins < 0) return null;
    totalSeconds = mins * 60;
  }

  const ms = Math.round(totalSeconds * 1000);
  if (!Number.isFinite(ms)) return null;
  return Math.min(MAX_MS, Math.max(MIN_MS, ms));
}

function openEditor() {
  stop(); // typing a new time while running would fight the live countdown
  timeInput.value = clockStr(remainingMs);
  shellEl.classList.add('editing');
  timeInput.focus();
  timeInput.select();
}

function closeEditor() {
  shellEl.classList.remove('editing');
}

function commitTimeInput() {
  if (!shellEl.classList.contains('editing')) return;
  const ms = parseClockInput(timeInput.value);
  closeEditor();
  if (ms !== null) setTime(ms);
  else render();
}


// ---- time loop ----
function loop() {
  if (!running) return;
  remainingMs = endsAt - Date.now();
  if (remainingMs <= 0) return finish();
  render();
  rafId = requestAnimationFrame(loop);
}

let audioCtx = null;

function chirp() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx ??= new Ctx();
  audioCtx.resume();

  // chirp frequencies
  [0, 0.18, 0.36, 0.54, 0.54, 0.72].forEach((offset, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime + offset;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400 + i * 260, t);
    osc.frequency.exponentialRampToValueAtTime(2200 + i * 260, t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.16);

  });
}
const ALARM_INTERVAL_MS = 2500;
const ALARM_MAX_REPEATS = 12; // ~30s of nagging, then it gives up

let alarmTimer = null;
let alarmCount = 0;

function startAlarmRepeat() {
  stopAlarmRepeat();
  alarmCount = 0;
  chirp();
  alarmTimer = setInterval(() => {
    if (++alarmCount >= ALARM_MAX_REPEATS) return stopAlarmRepeat();
    chirp();
  }, ALARM_INTERVAL_MS);
}

function stopAlarmRepeat() {
  clearInterval(alarmTimer);
  alarmTimer = null;
  alarmCount = 0;
}

// ---- wiring -----
const clicks = {
  displayHit: openEditor,
  startStop: toggle,
  minus: () => adjustMinutes(-0.5),
  plus: () => adjustMinutes(.5),
  reset,
  quit: () => (api.quit ? api.quit() : window.close())
};

for (const [id, fn] of Object.entries(clicks)) {
  document.getElementById(id).addEventListener('click', fn);
}

document.querySelectorAll('.preset').forEach((btn) => {
  btn.addEventListener('click', () => setMinutes(Number(btn.dataset.min)));
});

timeInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') { e.preventDefault(); commitTimeInput(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeEditor(); render(); }
});
timeInput.addEventListener('blur', commitTimeInput);

// ---- keyboard shortcuts ----
const keys = {
  Space: toggle,
  KeyR: reset,
  ArrowUp: () => adjustMinutes(0.5),
  ArrowDown: () => adjustMinutes(-0.5)
};

window.addEventListener('keydown', (e) => {
  const fn = keys[e.code];
  if (!fn) return;
  e.preventDefault();
  fn();
});

render();