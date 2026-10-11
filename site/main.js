import { createOrb } from './orb.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);

// ─── Orbs: the logo is the same sphere, small and calm ────────────────
createOrb($('#logo-orb'), null, { density: 110, min: 110, interactive: false });
const orb = createOrb($('#orb'), $('#orb-glow'));
if (!orb) $('.orb').classList.add('orb--static');

// ─── Demo: Luna's start screen, then a chat ───────────────────────────
// Example chats in the shape of real ones: same tools, same trace, example data.
const ICONS = {
  calendar: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>',
  learn: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  plan: '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

const CHATS = [
  {
    title: 'Plan my next 30 minutes', detail: 'Before training',
    me: 'Got 30 minutes before training. What can I still do?',
    steps: [
      { icon: 'calendar', label: 'Read calendar', detail: 'today' },
      { icon: 'learn', label: 'Checked learning', detail: 'French · 12 weak words' },
    ],
    answer: 'Training is at 18:00, so you have until 17:35. Your French test is on Thursday and 12 words are still weak. That\'s one 15-minute set.',
    ask: ['Start it', 'Later'],
  },
  {
    title: 'Clean up my inbox', detail: 'Today and yesterday',
    me: 'Check my mail from today and yesterday. Trash the ads.',
    steps: [
      { icon: 'mail', label: 'Searched mail', detail: 'today, yesterday · 31' },
      { icon: 'mail', label: 'Moved 14 ads to trash', detail: 'undo available' },
      { icon: 'calendar', label: 'Updated event', detail: 'Match · Sat 14:00' },
    ],
    answer: 'Moved 14 ads to the trash. Two need you: Saturday\'s match moved to 14:00, so I updated your calendar, and school wants the form back by Friday.',
  },
  {
    title: 'Tell Jonas I\'m late', detail: 'Uses my phone',
    me: 'Tell Jonas I\'m 10 minutes late.',
    steps: [
      { icon: 'calendar', label: 'Read calendar', detail: 'Training 18:00' },
      { icon: 'phone', label: 'Opened WhatsApp', detail: 'on your phone' },
      { icon: 'phone', label: 'Typed message', detail: 'Chat: Jonas' },
    ],
    answer: 'Wrote "Training\'s at 6, I\'ll be there 6:10." to Jonas. Send it?',
    ask: ['Send', 'Cancel'],
  },
  {
    title: 'Move my studying', detail: 'No time right now',
    me: 'No time to study now, I\'ll do it in 2 hours.',
    steps: [
      { icon: 'learn', label: 'Moved today\'s practice', detail: '→ 20:30' },
      { icon: 'plan', label: 'Checked plan', detail: 'evening is free' },
    ],
    answer: 'Moved today\'s practice to 20:30. Your test stays on Thursday. I\'ll remind you.',
  },
];

const home = $('#home'), thread = $('#thread'), suggest = $('#suggest');
const composerText = $('#composer-text'), send = $('.composer__send');
const cards = CHATS.map((c, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sg';
  b.style.setProperty('--i', i);
  b.innerHTML = `<span class="sg__t"></span><span class="sg__d"></span>`;
  b.querySelector('.sg__t').textContent = c.title;
  b.querySelector('.sg__d').textContent = c.detail;
  b.addEventListener('click', () => run(i, true));
  suggest.append(b);
  return b;
});

let token = 0;          // jede neue Sequenz macht ältere ungültig
let next = 0;           // nächstes Gespräch für die Autoplay-Runde
let userTouched = false;
let appVisible = false;

const alive = (t) => t === token;

function showHome() {
  thread.hidden = true;
  thread.replaceChildren();
  home.hidden = false;
  // Neustart der Einblend-Animationen.
  home.style.animation = 'none'; void home.offsetWidth; home.style.animation = '';
  for (const c of cards) { c.classList.remove('is-hint', 'is-press'); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; }
  composerText.textContent = 'Ask Luna anything';
  composerText.classList.remove('is-typed');
  send.classList.remove('is-ready');
  orb?.mood('idle');
  scheduleAuto();
}

async function type(text, t) {
  composerText.classList.add('is-typed');
  if (reduced) { composerText.textContent = text; send.classList.add('is-ready'); return; }
  for (let i = 1; i <= text.length; i++) {
    if (!alive(t)) return;
    composerText.textContent = text.slice(0, i);
    if (i === 1) send.classList.add('is-ready');
    await wait(18 + Math.random() * 30);
  }
}

async function run(i, byUser = false) {
  const t = ++token;
  if (byUser) userTouched = true;
  const c = CHATS[i];
  next = (i + 1) % CHATS.length;
  if (home.hidden) showHome();
  token = t; // showHome plant Autoplay neu; diese Sequenz bleibt die gültige
  clearTimeout(autoTimer);

  cards[i].classList.add('is-press');
  orb?.mood('thinking');
  await type(c.me, t);
  if (!alive(t)) return;
  await wait(reduced ? 100 : 380);
  if (!alive(t)) return;

  home.hidden = true;
  thread.hidden = false;
  composerText.textContent = 'Ask Luna anything';
  composerText.classList.remove('is-typed');
  send.classList.remove('is-ready');

  const u = document.createElement('div');
  u.className = 'u';
  u.textContent = c.me;
  thread.append(u);

  const l = document.createElement('div');
  l.className = 'l';
  l.innerHTML = '<div class="trace__head"><span class="trace__icon"><span class="spin"></span></span><span class="trace__label shimmer">Thinking…</span></div><ol class="steps-l"></ol><p class="answer"></p>';
  thread.append(l);
  const head = l.querySelector('.trace__head'), label = l.querySelector('.trace__label');
  const list = l.querySelector('.steps-l'), answer = l.querySelector('.answer');
  const started = performance.now();

  await wait(reduced ? 100 : 700);
  for (const s of c.steps) {
    if (!alive(t)) return;
    label.textContent = `${s.label}…`;
    const li = document.createElement('li');
    li.innerHTML = `<span class="ico">${svg(s.icon)}</span><b></b><small></small>`;
    li.querySelector('b').textContent = s.label;
    li.querySelector('small').textContent = s.detail;
    list.append(li);
    await wait(reduced ? 100 : 650 + Math.random() * 350);
  }
  if (!alive(t)) return;

  const secs = Math.max(1, Math.round((performance.now() - started) / 1000));
  head.innerHTML = `<span class="trace__icon">${svg('check')}</span><span class="trace__label"></span><span class="trace__count">${c.steps.length}</span>`;
  head.querySelector('.trace__label').textContent = `Worked for ${secs}s`;

  if (reduced) {
    answer.textContent = c.answer;
  } else {
    for (const w of c.answer.split(' ')) {
      if (!alive(t)) return;
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = `${w} `;
      answer.append(span);
      await wait(45 + Math.random() * 60);
    }
  }
  if (c.ask) {
    const ask = document.createElement('div');
    ask.className = 'ask';
    for (const a of c.ask) { const s = document.createElement('span'); s.textContent = a; ask.append(s); }
    l.append(ask);
  }

  await wait(reduced ? 9000 : 6500);
  if (alive(t)) showHome();
}

// Autoplay: steht die Startseite eine Weile sichtbar und unberührt da, tippt Luna selbst eine Karte an.
let autoTimer = 0;
function scheduleAuto() {
  clearTimeout(autoTimer);
  const t = token;
  autoTimer = setTimeout(async () => {
    if (!alive(t) || home.hidden) return;
    if (!appVisible || document.visibilityState !== 'visible') return scheduleAuto();
    cards[next].classList.add('is-hint');
    await wait(700);
    if (alive(t) && !home.hidden) run(next);
  }, userTouched ? 9000 : 3200);
}

// Klick in einen fertigen Chat: zurück zur Startseite.
thread.addEventListener('click', () => { userTouched = true; token++; showHome(); });

new IntersectionObserver(([e]) => { appVisible = e.isIntersecting; }, { threshold: .4 }).observe($('.app'));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !home.hidden) scheduleAuto(); });
scheduleAuto();

// ─── Clips: nur zeigen, was es wirklich gibt ──────────────────────────
// Neue Aufnahme: media/<name>.mp4 ablegen und den Namen hier eintragen (phone, call, block).
const CLIPS = [];
const clipSection = $('#clips');
for (const v of clipSection.querySelectorAll('video[data-src]')) {
  const name = v.dataset.src.replace(/^media\/|\.mp4$/g, '');
  if (CLIPS.includes(name)) v.src = v.dataset.src;
  else v.closest('figure').remove();
}
if (CLIPS.length) {
  clipSection.hidden = false;
  const vio = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting && !reduced ? e.target.play().catch(() => {}) : e.target.pause();
  }, { threshold: .3 });
  clipSection.querySelectorAll('video').forEach((v) => vio.observe(v));
}

// ─── Header glass once the page scrolls ───────────────────────────────
const top = $('.top');
const onScroll = () => top.classList.toggle('is-scrolled', window.scrollY > 16);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ─── Reveal on scroll ─────────────────────────────────────────────────
const reveal = document.querySelectorAll('.block > .eyebrow, .block > .h2, .block__lede, .caps li, .stats > div, .steps li, .rules li, .cta > *');
reveal.forEach((el) => {
  const idx = [...el.parentElement.children].indexOf(el);
  if (el.matches('.caps li, .stats > div, .steps li, .rules li')) el.style.setProperty('--d', `${(idx % 4) * .07}s`);
  el.setAttribute('data-reveal', '');
});
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px' });
reveal.forEach((el) => io.observe(el));
