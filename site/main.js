import { createOrb } from './orb.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Orb ──────────────────────────────────────────────────────────────
const orbBox = document.querySelector('.orb');
const orb = createOrb(document.getElementById('orb'), document.getElementById('orb-glow'));
if (!orb) orbBox.classList.add('orb--static');

// ─── Example chat: Luna thinks, then speaks word by word ──────────────
// Examples of what Luna does (see PRODUCT.md in NeuralHub), not recorded transcripts.
const CONVERSATIONS = [
  {
    me: 'Got 30 minutes before training. What can I still do?',
    luna: 'Training is at 18:00, so you have until 17:35. Your French test is on Thursday and 12 words are still weak. That\'s one 15-minute set. Start it?',
  },
  {
    me: 'Check my mail from today and yesterday. Trash the ads.',
    luna: 'Moved 14 ads to the trash. You can undo that. Two need you: Saturday\'s match moved to 14:00, so I updated your calendar, and school wants the form back by Friday.',
  },
  {
    me: 'Tell Jonas I\'m 10 minutes late.',
    luna: 'Opened WhatsApp and wrote: "Training\'s at 6, I\'ll be there 6:10." Send it?',
  },
  {
    me: 'No time to study now, I\'ll do it in 2 hours.',
    luna: 'Moved today\'s practice to 20:30. Your test stays on Thursday. I\'ll remind you.',
  },
];

const log = document.getElementById('chat');
let chatVisible = true;
new IntersectionObserver(([e]) => { chatVisible = e.isIntersecting; }).observe(log);

function bubble(cls, text = '') {
  const p = document.createElement('p');
  p.className = `msg ${cls}`;
  p.textContent = text;
  log.append(p);
  return p;
}

async function play() {
  for (let i = 0; ; i = (i + 1) % CONVERSATIONS.length) {
    while (!chatVisible || document.visibilityState !== 'visible') await wait(400);
    const c = CONVERSATIONS[i];
    log.replaceChildren();
    bubble('msg--me', c.me);
    await wait(700);

    const typing = bubble('msg--typing');
    typing.setAttribute('aria-label', 'Luna is thinking');
    typing.innerHTML = '<i></i><i></i><i></i>';
    orb?.mood('thinking');
    await wait(reduced ? 600 : 1500);
    typing.remove();

    const answer = bubble('msg--luna');
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
    await wait(4200);
    for (const m of log.children) m.classList.add('is-leaving');
    await wait(380);
  }
}
log.replaceChildren();
play();

// ─── Header glass once the page scrolls ───────────────────────────────
const top = document.querySelector('.top');
const onScroll = () => top.classList.toggle('is-scrolled', window.scrollY > 24);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ─── Reveal on scroll ─────────────────────────────────────────────────
const reveal = document.querySelectorAll('.block > .eyebrow, .block > h2, .block__lede, .card, .stat, .steps li, .rules li, .cta > :not(.cta__light)');
reveal.forEach((el) => {
  const siblings = [...el.parentElement.children].filter((c) => c.matches('.card, .stat, .steps li, .rules li'));
  const idx = siblings.indexOf(el);
  if (idx > 0) el.style.setProperty('--d', `${(idx % 4) * .08}s`);
  el.setAttribute('data-reveal', '');
});
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px' });
reveal.forEach((el) => io.observe(el));

// ─── Numbers count up once ────────────────────────────────────────────
const counters = document.querySelectorAll('[data-count]');
const countIo = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    countIo.unobserve(e.target);
    const el = e.target, to = Number(el.dataset.count), suffix = el.dataset.suffix || '';
    if (reduced) continue;
    const start = performance.now(), dur = 1400;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur), eased = 1 - (1 - k) ** 3;
      el.textContent = `${Math.round(to * eased)}${suffix}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}, { threshold: .6 });
counters.forEach((el) => countIo.observe(el));

// ─── Card light follows the pointer ───────────────────────────────────
if (window.matchMedia('(hover: hover)').matches) {
  for (const card of document.querySelectorAll('.card')) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  }
}
