"use strict";

/* DOM refs */
const input = document.getElementById('password');
const meter = document.getElementById('strength-meter');
const label = document.getElementById('strength-label');
const entropyBits = document.getElementById('entropy-bits');
const toggleBtn = document.getElementById('toggle-visibility');

const requirementsList = document.getElementById('requirements');
const confirmInput = document.getElementById('confirm');
const matchNote = document.getElementById('match-note');
const createBtn = document.getElementById('create');

const lenSlider = document.getElementById('len');
const lenVal = document.getElementById('len-val');
const gLower = document.getElementById('g-lower');
const gUpper = document.getElementById('g-upper');
const gDigit = document.getElementById('g-digit');
const gSymbol = document.getElementById('g-symbol');
const genBtn = document.getElementById('gen');
const copyBtn = document.getElementById('copy');

const crackEl = document.getElementById('crack-time');

/* Requirements + weights (harsher common) */
const REQUIREMENTS = {
  length:  { test: (s) => s.length >= 12, weight: 25 },
  lower:   { test: (s) => /[a-z]/.test(s), weight: 12 },
  upper:   { test: (s) => /[A-Z]/.test(s), weight: 12 },
  digit:   { test: (s) => /\d/.test(s),    weight: 12 },
  symbol:  { test: (s) => /[^A-Za-z0-9]/.test(s), weight: 12 },
  repeats: { test: (s) => !/(.)\1{3,}/.test(s),   weight: 12 },
  common:  { test: (s) => !looksCommonPattern(s), weight: 20 }, // increased
};

/* Pattern detectors */
function looksWordYearPattern(s) {
  const re = /^(?=.{8,}$)[A-Za-z]+(?:of)?\d{4}[!@#$%^&*()_+{}\[\]:;<>,.?/~`\-=]*$/;
  const months = /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|spring|summer|fall|autumn|winter)/i;
  return re.test(s) || (months.test(s) && /\d{4}/.test(s));
}

function looksCommonPattern(s) {
  const low = s.toLowerCase();
  const badFragments = [
    'password','letmein','iloveyou','admin','welcome','dragon',
    'qwerty','asdf','zxcv','abc','abcd','1234','12345','123456','1111',
    'sunshine','princess','football','monkey','shadow','baseball',
    'summer','winter','spring','fall'
  ];

function looksWordYearPattern(s) {
    // word(s) + optional "of" + 4-digit year + optional trailing symbols
    const re = /^(?=.{8,}$)[A-Za-z]+(?:of)?\d{4}[!@#$%^&*()_+{}\[\]:;<>,.?/~`\-=]*$/;
    // month/season + year (e.g., Summer2021, Oct2020)
    const months = /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|spring|summer|fall|autumn|winter)/i;
    return re.test(s) || (months.test(s) && /\d{4}/.test(s));
}

  const isSequential = (str) => {
    if (str.length < 5) return false;
    let asc = true, desc = true;
    for (let i = 1; i < str.length; i++) {
      asc  = asc  && (str.charCodeAt(i) === str.charCodeAt(i-1) + 1);
      desc = desc && (str.charCodeAt(i) === str.charCodeAt(i-1) - 1);
    }
    return asc || desc;
  };

  if (badFragments.some(b => low.includes(b))) return true;
  if (isSequential(low)) return true;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return true;
  if (looksWordYearPattern(s)) return true; // NEW
  return false;
}

/* Entropy (more skeptical on patterns) */
function estimateEntropyBits(s) {
  if (!s) return 0;
  let charset = 0;
  if (/[a-z]/.test(s)) charset += 26;
  if (/[A-Z]/.test(s)) charset += 26;
  if (/\d/.test(s))    charset += 10;
  if (/[^A-Za-z0-9]/.test(s)) charset += 33;

  if (looksCommonPattern(s)) charset = Math.max(10, Math.floor(charset * 0.6));
  if (looksWordYearPattern(s)) charset = Math.max(8, Math.floor(charset * 0.5)); // extra discount

  return Math.round(s.length * Math.log2(Math.max(charset, 2)));
}

/* Scoring */
function computeScore(s) {
  let total = 0;
  for (const key of Object.keys(REQUIREMENTS)) {
    if (REQUIREMENTS[key].test(s)) total += REQUIREMENTS[key].weight;
  }
  if (s.length >= 16) total = Math.min(100, total + 5);

  // Variety penalty (fewer than 3 sets)
  const sets = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].reduce((n, r) => n + (r.test(s) ? 1 : 0), 0);
  if (sets < 3) total = Math.max(0, total - 10);

  // Extra penalty for word+year pattern
  if (looksWordYearPattern(s)) total = Math.max(0, total - 10);

  return Math.max(0, Math.min(100, total));
}

/* Label gating (requires string) */
function scoreToLabel(score, s) {
  const sets = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].reduce((n, r) => n + (r.test(s) ? 1 : 0), 0);
  const veryStrongGate =
    score >= 90 &&
    s.length >= 16 &&
    sets >= 4 &&
    !looksCommonPattern(s) &&
    !looksWordYearPattern(s) &&
    !/(.)\1{2,}/.test(s);

  if (veryStrongGate) return 'Very Strong';
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Okay';
  if (score >= 30) return 'Weak';
  return 'Very Weak';
}

/* Crack-time (toy) */
const GUESSES_PER_SECOND = 1e11;
function estimateCrackSeconds(bits) {
  if (!bits || bits <= 1) return 0;
  return Math.pow(2, bits - 1) / GUESSES_PER_SECOND;
}
function formatCrackTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '—';
  const units = [['year',31557600],['day',86400],['hour',3600],['min',60],['sec',1]];
  for (const [name, s] of units) {
    if (seconds >= s) { const val = (seconds / s).toFixed(1); return `${val} ${name}${val >= 2 ? 's' : ''}`; }
  }
  return 'seconds';
}

/* UI update (neutral when empty; ✓/✕ when typing) */
function updateUI(s) {
  const isEmpty = s.length === 0;

  document.querySelectorAll('#requirements li').forEach((li) => {
    const key = li.getAttribute('data-check');
    const rule = REQUIREMENTS[key];
    const iconEl = li.querySelector('.icon');

    if (isEmpty || !rule) {
      li.classList.remove('ok', 'nope');
      if (iconEl) iconEl.textContent = '⬤';
      return;
    }

    const passed = rule.test(s);
    li.classList.toggle('ok', passed);
    li.classList.toggle('nope', !passed);
    if (iconEl) iconEl.textContent = passed ? '✓' : '✕';
  });

  const score = computeScore(s);
  if (meter) meter.value = score;
  if (label) label.textContent = s ? scoreToLabel(score, s) : 'Start typing…';

  const bits = estimateEntropyBits(s);
  if (entropyBits) entropyBits.textContent = String(bits);
  if (crackEl) crackEl.textContent = formatCrackTime(estimateCrackSeconds(bits));

  updateMatchUI();
}

/* Match gate */
function passwordsMatch(p, c) { return p.length > 0 && p === c; }
function updateMatchUI() {
  if (!confirmInput || !matchNote || !createBtn) return;
  const p = input.value;
  const c = confirmInput.value;
  const match = passwordsMatch(p, c);
  matchNote.textContent = c ? (match ? 'Passwords match' : 'Passwords do not match') : '';
  matchNote.className = 'note ' + (c ? (match ? 'ok' : 'warn') : '');
  const strongEnough = computeScore(p) >= 80;
  createBtn.disabled = !(match && strongEnough);
}

/* Generator (crypto-strong) */
const CHARS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digit: '0123456789',
  symbol: '!@#$%^&*()_+{}[]|:;<>,.?/~`-='
};
function randInt(n) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xFFFFFFFF / n) * n;
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
  return x % n;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function generatePassword(len, sets) {
  const pools = [];
  if (sets.lower) pools.push(CHARS.lower);
  if (sets.upper) pools.push(CHARS.upper);
  if (sets.digit) pools.push(CHARS.digit);
  if (sets.symbol) pools.push(CHARS.symbol);
  if (!pools.length) return '';
  const chars = [];
  for (const pool of pools) chars.push(pool[randInt(pool.length)]);
  const all = pools.join('');
  while (chars.length < len) chars.push(all[randInt(all.length)]);
  shuffle(chars);
  return chars.join('');
}

/* Events */
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    toggleBtn.textContent = showing ? 'Show' : 'Hide';
    toggleBtn.setAttribute('aria-pressed', String(!showing));
    toggleBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    input.focus({ preventScroll: true });
  });
}

input.addEventListener('input', (e) => updateUI(e.target.value));
if (confirmInput) {
  confirmInput.addEventListener('input', updateMatchUI);
  input.addEventListener('input', updateMatchUI);
}
if (lenSlider && lenVal) {
  lenSlider.addEventListener('input', () => { lenVal.textContent = lenSlider.value; });
}
if (genBtn) {
  genBtn.addEventListener('click', () => {
    const pwd = generatePassword(parseInt(lenSlider.value, 10), {
      lower: gLower.checked, upper: gUpper.checked, digit: gDigit.checked, symbol: gSymbol.checked
    });
    input.value = pwd; updateUI(pwd);
    if (confirmInput) { confirmInput.value = ''; updateMatchUI(); }
    input.focus();
  });
}
if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(input.value || '');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy to clipboard'), 900);
    } catch {
      copyBtn.textContent = 'Copy failed';
      setTimeout(() => (copyBtn.textContent = 'Copy to clipboard'), 1200);
    }
  });
}
if (createBtn) {
  createBtn.addEventListener('click', () => alert('✅ Password accepted (strong + matching).'));
}

/* Init */
updateUI(input.value || '');
if (lenVal && lenSlider) lenVal.textContent = lenSlider.value;
