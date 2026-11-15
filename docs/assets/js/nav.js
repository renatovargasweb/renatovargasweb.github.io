/* "On this page" strip: marks the section the reader has reached. */
(() => {
const links = [...document.querySelectorAll('.onpage a[href^="#"]')];
const secs = links.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
if (!links.length || secs.includes(null)) return;
let queued = false, forced = null;
// A link that was just followed keeps the mark until the reader scrolls on their own:
// near the foot of a page two short sections can both be in view.
const follow = (hash) => { const i = links.findIndex((a) => a.hash === hash); forced = i < 0 ? null : i; };
function mark() {
  queued = false;
  // the last section whose top has passed the upper third of the window;
  // at the foot of the page, where short sections cannot climb that high, three quarters
  const page = document.scrollingElement || document.documentElement;
  const atFoot = innerHeight + page.scrollTop >= page.scrollHeight - 200;
  const line = innerHeight * (atFoot ? .75 : .35);
  // sections that sit side by side share a top: the first of them keeps the mark
  let k = 0, best = -Infinity;
  secs.forEach((s, i) => { const t = s.getBoundingClientRect().top; if (t <= line && t > best + 40) { k = i; best = t; } });
  if (forced != null) k = forced;
  links.forEach((a, i) => a.classList.toggle('now', i === k));
  links[k].scrollIntoView({block: 'nearest', inline: 'nearest'});
}
addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(mark); } }, {passive: true});
addEventListener('resize', mark);
addEventListener('load', mark);
addEventListener('hashchange', () => { follow(location.hash); mark(); });
['wheel', 'touchmove', 'keydown'].forEach((ev) => addEventListener(ev, () => { forced = null; }, {passive: true}));
follow(location.hash);
mark();
})();
