import { createOrb } from './orb.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);

// ─── Orbs: das Logo ist dieselbe Kugel, klein ─────────────────────────
createOrb($('#logo-orb'), null, { density: 110, min: 110, interactive: false });
const orb = createOrb($('#orb'), $('#orb-glow'));
if (!orb) $('.orb').classList.add('orb--static');

// ─── Beispiel-Chat: Luna arbeitet (Spur wie im Dashboard), dann spricht sie ──
// Beispiele in der Form echter Chats, keine Mitschnitte.
const ICONS = {
  calendar: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
  learn: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  plan: '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24">${ICONS[name]}</svg>`;

const CHATS = [
  {
    me: 'Got 30 minutes before training. What can I still do?',
    steps: [['calendar', 'Read calendar', 'today'], ['learn', 'Checked learning', 'French · 12 weak words']],
    luna: 'Training is at 18:00, so you have until 17:35. Your French test is on Thursday and 12 words are still weak. That\'s one 15-minute set. Start it?',
  },
  {
    me: 'Check my mail from today and yesterday. Trash the ads.',
    steps: [['mail', 'Searched mail', 'today, yesterday · 31'], ['mail', 'Moved 14 ads to trash', 'undo available'], ['calendar', 'Updated event', 'Match · Sat 14:00']],
    luna: 'Done. Two need you: Saturday\'s match moved to 14:00, so I updated your calendar, and school wants the form back by Friday.',
  },
  {
    me: 'Tell Jonas I\'m 10 minutes late.',
    steps: [['calendar', 'Read calendar', 'Training 18:00'], ['phone', 'Opened WhatsApp', 'on your phone'], ['phone', 'Typed message', 'Chat: Jonas']],
    luna: 'Wrote "Training\'s at 6, I\'ll be there 6:10." Send it?',
  },
  {
    me: 'No time to study now, I\'ll do it in 2 hours.',
    steps: [['plan', 'Checked plan', 'evening is free'], ['learn', 'Moved today\'s practice', '→ 20:30']],
    luna: 'Moved today\'s practice to 20:30. Your test stays on Thursday. I\'ll remind you.',
  },
];

const log = $('#chat');
let chatVisible = true;
new IntersectionObserver(([e]) => { chatVisible = e.isIntersecting; }).observe(log);

function el(tag, cls, html = '') {
  const n = document.createElement(tag);
  n.className = cls;
  n.innerHTML = html;
  return n;
}

async function play() {
  for (let i = 0; ; i = (i + 1) % CHATS.length) {
    while (!chatVisible || document.visibilityState !== 'visible') await wait(400);
    const c = CHATS[i];
    log.classList.remove('is-leaving');
    log.replaceChildren();

    const me = el('p', 'msg msg--me');
    me.textContent = c.me;
    log.append(me);
    await wait(700);

    // Arbeiten: Orb denkt, die Spur wächst Schritt für Schritt.
    orb?.mood('thinking');
    const trace = el('div', 'trace');
    log.append(trace);
    for (const [icon, label, detail] of c.steps) {
      const row = el('div', 'trace__row is-running', '<span class="trace__icon"><span class="spin"></span></span><b class="shimmer"></b><small></small>');
      row.querySelector('b').textContent = `${label}…`;
      trace.append(row);
      await wait(reduced ? 150 : 700 + Math.random() * 300);
      row.classList.remove('is-running');
      row.querySelector('.trace__icon').innerHTML = svg(icon);
      const b = row.querySelector('b');
      b.classList.remove('shimmer');
      b.textContent = label;
      row.querySelector('small').textContent = detail;
    }

    // Sprechen: jedes Wort stösst den Orb an.
    const answer = el('p', 'msg msg--luna');
    log.append(answer);
    if (reduced) {
      answer.textContent = c.luna;
    } else {
      orb?.mood('speaking');
      const words = c.luna.split(' ');
      for (let w = 0; w < words.length; w++) {
        answer.textContent = words.slice(0, w + 1).join(' ');
        orb?.pulse(.55 + Math.random() * .45);
        await wait(55 + Math.random() * 70);
      }
    }
    orb?.mood('idle');
    await wait(4600);
    log.classList.add('is-leaving');
    await wait(380);
  }
}
log.replaceChildren();
play();

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

// ─── Header-Glas, sobald gescrollt wird ───────────────────────────────
const top = $('.top');
const onScroll = () => top.classList.toggle('is-scrolled', window.scrollY > 24);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ─── Einblenden beim Scrollen ─────────────────────────────────────────
const reveal = document.querySelectorAll('.block > .eyebrow, .block > h2, .block__lede, .caps li, .stat, .steps li, .rules li, .cta > :not(.cta__light)');
reveal.forEach((n) => {
  if (n.matches('.caps li, .stat, .steps li, .rules li')) n.style.setProperty('--d', `${([...n.parentElement.children].indexOf(n) % 4) * .08}s`);
  n.setAttribute('data-reveal', '');
});
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px' });
reveal.forEach((n) => io.observe(n));

// ─── Zahlen zählen einmal hoch ────────────────────────────────────────
const countIo = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    countIo.unobserve(e.target);
    if (reduced) continue;
    const n = e.target, to = Number(n.dataset.count), suffix = n.dataset.suffix || '';
    const start = performance.now(), dur = 1400;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      n.textContent = `${Math.round(to * (1 - (1 - k) ** 3))}${suffix}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}, { threshold: .6 });
document.querySelectorAll('[data-count]').forEach((n) => countIo.observe(n));
