const $ = s => document.querySelector(s);
const canvas = $('#game'), ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const colors = { armor: '#b7d2ff', legs: '#d3ff69', chaos: '#ffae83' };
const keys = new Set();
const aim = { x: W / 2, y: 0, firing: false, visible: false };
let phase = 'lobby', paused = false, round = 1, remaining = 45, time = 0, last = 0, simTimer = 0, nextAttack = 0;
let parts = { armor: 0, legs: 0, chaos: 0 }, builders = new Map(), feed = [], particles = [], shots = [], hazards = [];
let player, boss, pattern = 0, shotTimer = 0, fakeId = 0, toastTimer;
let shake = 0, result = '';
let assembly = null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Original synthesized effects: no downloads, music, or external audio assets.
const audio = { context: null, master: null, enabled: false, voices: 0, last: new Map() };
const soundEffects = {
  start: [[330, 440, .12], [440, 660, .16]],
  armor: [[180, 110, .12], [280, 200, .09]],
  legs: [[440, 660, .07], [660, 880, .09]],
  chaos: [[740, 220, .12], [330, 880, .12]],
  reveal: [[110, 165, .22], [165, 330, .25]],
  fight: [[440, 440, .1], [660, 880, .2]],
  shot: [[550, 180, .045]],
  hit: [[200, 90, .055]],
  damage: [[150, 55, .2]],
  dash: [[180, 900, .09]],
  warning: [[330, 260, .1]],
  enrage: [[140, 100, .15], [140, 80, .2]],
  win: [[523, 523, .12], [659, 659, .12], [784, 1047, .28]],
  lose: [[330, 260, .16], [220, 110, .3]],
};
function playSound(name) {
  const context = audio.context;
  if (!audio.enabled || context?.state !== 'running') return;
  const now = context.currentTime;
  const cooldown = ['armor', 'legs', 'chaos'].includes(name) ? .12 : .07;
  if (now - (audio.last.get(name) ?? -Infinity) < cooldown) return;
  audio.last.set(name, now);
  let delay = 0;
  for (const [from, to, duration] of soundEffects[name] ?? []) {
    if (audio.voices >= 12) break;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const at = now + delay;
    oscillator.type = ['shot', 'hit', 'damage', 'warning'].includes(name) ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(name === 'shot' ? .12 : .25, at + .005);
    gain.gain.exponentialRampToValueAtTime(.001, at + duration);
    oscillator.connect(gain); gain.connect(audio.master);
    audio.voices++;
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); audio.voices--; };
    oscillator.start(at); oscillator.stop(at + duration + .01);
    delay += duration;
  }
}
$('#sound').onclick = async () => {
  const button = $('#sound');
  button.disabled = true;
  try {
    if (!audio.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { button.textContent = 'Sound unavailable'; return; }
      audio.context = new AudioContext();
      audio.master = audio.context.createGain();
      audio.master.gain.value = 0;
      audio.master.connect(audio.context.destination);
    }
    await audio.context.resume();
    audio.enabled = !audio.enabled;
    audio.master.gain.setTargetAtTime(audio.enabled ? .325 : 0, audio.context.currentTime, .015);
    button.textContent = audio.enabled ? 'Sound on' : 'Sound off';
    button.setAttribute('aria-pressed', String(audio.enabled));
    if (audio.enabled) playSound('start');
  } catch {
    audio.enabled = false;
    if (audio.master) audio.master.gain.value = 0;
    button.textContent = 'Sound off';
    button.setAttribute('aria-pressed', 'false');
    announce('Audio could not start. Try enabling sound again.');
  } finally {
    button.disabled = !audio.context && button.textContent === 'Sound unavailable';
  }
};

function fitWorkshop() {
  const panel = $('.layout > aside'), workshop = $('.workshop');
  // Stacked mobile panels keep their natural height.
  if (getComputedStyle(panel).containerType !== 'size') {
    workshop.style.removeProperty('--workshop-font');
    return;
  }
  const available = workshop.clientHeight;
  if (!available) return;
  const requiredHeight = () => {
    const style = getComputedStyle(workshop);
    return parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      + [...workshop.children].reduce((height, child) => {
        const childStyle = getComputedStyle(child);
        return height + child.getBoundingClientRect().height
          + parseFloat(childStyle.marginTop) + parseFloat(childStyle.marginBottom);
      }, 0);
  };
  // Measure the controls plus the reserved name rows together. Fewer rows
  // leave room for larger controls; more rows scale the whole workshop down.
  let low = 0, high = Math.min(36, panel.clientWidth * .042);
  for (let step = 0; step < 12; step++) {
    const size = (low + high) / 2;
    workshop.style.setProperty('--workshop-font', `${size}px`);
    if (requiredHeight() <= available) low = size;
    else high = size;
  }
  workshop.style.setProperty('--workshop-font', `${low}px`);
}
function fitViewport() {
  if (document.fullscreenElement) return;
  const body = document.body;
  // Measure the original layout each time; measuring the compact layout would
  // incorrectly switch back as soon as it fits and cause repeated toggling.
  body.classList.remove('fit-viewport');
  if (body.classList.contains('stream-view') || window.innerWidth <= 760) return;
  const naturalBottom = $('main').getBoundingClientRect().bottom + window.scrollY;
  body.classList.toggle('fit-viewport', naturalBottom > window.innerHeight + 1);
}
let viewportFrame = 0;
function scheduleViewportFit() {
  if (viewportFrame) return;
  viewportFrame = requestAnimationFrame(() => { viewportFrame = 0; fitViewport(); });
}
window.addEventListener('resize', scheduleViewportFit);
document.addEventListener?.('fullscreenchange', scheduleViewportFit);
scheduleViewportFit();

if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(fitWorkshop).observe($('.layout > aside'));
  const layoutObserver = new ResizeObserver(scheduleViewportFit);
  layoutObserver.observe($('header'));
  layoutObserver.observe($('.intro'));
  document.fonts?.ready.then(fitWorkshop);
  document.fonts?.ready.then(scheduleViewportFit);
  document.fonts?.addEventListener('loadingdone', fitWorkshop);
  document.fonts?.addEventListener('loadingdone', scheduleViewportFit);
}

function buildStats() {
  const a = Math.log2(1 + parts.armor), l = Math.log2(1 + parts.legs), c = Math.log2(1 + parts.chaos);
  return { hp: Math.round(clamp(110 + a * 24 - l * 11, 65, 270)),
    speed: Math.max(15, 35 + l * 16 - a * 5), chaos: Math.min(5, c), recovery: .55 + c * .15 };
}
function identity() {
  const max = Math.max(...Object.values(parts));
  if (!max) return { name: 'THE ORIGINAL BAD IDEA', trait: 'No parts. Still dangerous.', color: '#d3ff69' };
  const leaders = Object.keys(parts).filter(type => parts[type] === max);
  if (leaders.length > 1) return { name: 'THE BEAUTIFUL MISTAKE', trait: 'A hybrid built by committee.', color: '#d3ff69' };
  const type = leaders[0];
  return { name: { armor: 'THE IRON GRUDGE', legs: 'THE SKITTER ENGINE', chaos: 'THE HEX REACTOR' }[type],
    trait: { armor: 'Heavy plating. Slower pursuit.', legs: 'Fast feet. Fragile core.', chaos: 'Extra firepower. Longer recovery.' }[type], color: colors[type] };
}

function announce(text) {
  $('#announcement').textContent = text; $('#announcement').style.opacity = 1;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#announcement').style.opacity = 0, 2200);
}
function resetActors() {
  assembly = null; keys.clear();
  aim.x = W / 2; aim.y = 0; aim.firing = false; aim.visible = false;
  player = { x: W / 2, y: H - 135, hp: 5, invulnerable: 0, dash: 0, cooldown: 0 };
  boss = { x: W / 2, y: 245, hp: 100, maxHp: 100, r: 63, hit: 0, recovery: 0, recoveryDelay: 0, enraged: false };
  shots = []; hazards = []; particles = []; nextAttack = 2; pattern = 0; shotTimer = 0;
}
function clearBuild() {
  parts = { armor: 0, legs: 0, chaos: 0 }; builders = new Map(); feed = [];
  for (const type in parts) $(`#count-${type}`).textContent = 0;
  $('#viewers').textContent = '0 builders';
  $('#feed').replaceChildren();
}
function start() {
  clearBuild(); resetActors(); phase = 'build'; paused = false; remaining = 45; result = ''; simTimer = .6;
  $('#pause').textContent = 'Pause'; $('#start').innerHTML = 'Restart building <span>↗</span>';
  announce('Chat, build your monster!'); updateHUD();
  playSound('start');
}
function addPart({ command, id, name, source }) {
  if (phase !== 'build' || paused) { if (source === 'local') announce('Start a build round first'); return; }
  if (builders.has(id)) { if (source === 'local') announce('One part per viewer per round'); return; }
  builders.set(id, { name, command }); parts[command]++;
  $(`#count-${command}`).textContent = parts[command]; $('#viewers').textContent = `${builders.size} builders`;
  const li = document.createElement('li'), label = document.createElement('span'), viewerName = document.createElement('span');
  viewerName.className = 'contributor-name'; viewerName.textContent = name; viewerName.title = name;
  li.append(viewerName); label.textContent = `+ ${command}`; label.style.color = colors[command]; li.append(label);
  $('#feed').prepend(li);
  feed.unshift({ name, command }); burst(boss.x, boss.y, colors[command], 12); shake = 3;
  assembly = { type: command, name, life: 1 };
  playSound(command);
}
function fakeCommand(command) {
  const id = ++fakeId;
  addPart({ command, id: `sim-${id}`, name: ['pixelwitch', 'toast.exe', 'mosslord', 'oops_all_legs', 'voidcat', 'armor_enjoyer'][id % 6] + id, source: 'local' });
}
function fight() {
  if (phase !== 'build') return;
  // Diminishing returns keep a raid-sized audience playable.
  const stats = buildStats();
  boss.maxHp = stats.hp; boss.hp = boss.maxHp;
  boss.speed = stats.speed; boss.chaos = stats.chaos; boss.recoveryDuration = stats.recovery;
  phase = 'reveal'; remaining = 4; paused = false; aim.firing = false; keys.clear(); assembly = null;
  $('#pause').textContent = 'Pause'; canvas.focus(); updateHUD();
  playSound('reveal');
}
function beginCombat() {
  if (phase !== 'reveal') return;
  phase = 'fight'; remaining = 60; nextAttack = 1.5; paused = false;
  aim.firing = false; keys.clear();
  $('#pause').textContent = 'Pause'; canvas.focus(); announce('It’s alive. Good luck.'); updateHUD();
  playSound('fight');
}
function finish(won) {
  phase = 'result'; result = won ? 'MONSTER DOWN.' : player.hp <= 0 ? 'CHAT WINS.' : 'TIME’S UP. CHAT WINS.';
  if (won) burst(boss.x, boss.y, '#d3ff69', 90);
  playSound(won ? 'win' : 'lose');
  $('#start').innerHTML = 'Build another monster <span>↗</span>'; round++; updateHUD();
}
function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, speed = 30 + Math.random() * 180;
    particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .4 + Math.random() * .5, color });
  }
}
function attack() {
  pattern++;
  playSound('warning');
  const warning = boss.enraged ? .65 : .85;
  const projectileSpeed = (boss.enraged ? 360 : 290) + boss.chaos * 12;
  const volley = (x, y, count, spread) => hazards.push({
    type: 'volley', x, y, angle: Math.atan2(player.y - y, player.x - x),
    count, spread, speed: projectileSpeed, age: -warning, life: 0
  });
  if (pattern % 3 === 1) {
    // Lock onto the current position and its flanks, forcing a deliberate escape.
    const count = 3 + Math.floor(boss.chaos);
    for (let i = 0; i < count; i++) {
      const offset = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 115;
      hazards.push({ type: 'circle', x: clamp(player.x + offset, 55, W - 55), y: player.y,
        r: boss.enraged ? 83 : 72, age: -warning - i * .1, life: .65 });
    }
    // Later explosions create a brief recovery opportunity after the barrage.
    boss.recoveryDelay = warning + (count - 1) * .1;
  } else if (pattern % 3 === 2) {
    volley(boss.x, boss.y, 7 + Math.floor(boss.chaos) * 2, .15);
    boss.recoveryDelay = warning;
  } else {
    // Side volleys prevent simply retreating to the bottom of the arena.
    volley(25, 180, 5 + Math.floor(boss.chaos), .16);
    volley(W - 25, 180, 5 + Math.floor(boss.chaos), .16);
    boss.recoveryDelay = warning;
  }
  nextAttack = boss.enraged ? 1.65 : 2.2;
  boss.recovery = 0;
}
function damage() {
  if (player.invulnerable > 0 || player.dash > 0) return;
  player.hp--; player.invulnerable = 1.25; shake = 10; burst(player.x, player.y, '#ff8069', 15);
  playSound('damage');
  if (player.hp <= 0) finish(false);
}
function update(dt) {
  if (paused) return;
  time += dt; shake = Math.max(0, shake - dt * 24);
  if (assembly && (assembly.life -= dt) <= 0) assembly = null;
  particles = particles.filter(p => (p.life -= dt) > 0);
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; }
  if (phase === 'build') {
    remaining -= dt;
    if ($('#simulation').checked && (simTimer -= dt) <= 0) { simTimer = .55 + Math.random() * .8; fakeCommand(['armor', 'legs', 'chaos'][Math.floor(Math.random() * 3)]); }
    if (remaining <= 0) fight();
  } else if (phase === 'reveal') {
    remaining -= dt;
    if (remaining <= 0) beginCombat();
  } else if (phase === 'fight') {
    remaining -= dt;
    player.invulnerable -= dt; player.dash -= dt; player.cooldown -= dt; boss.hit -= dt; boss.recovery -= dt;
    if (!boss.enraged && boss.hp > 0 && boss.hp <= boss.maxHp / 2) {
      boss.enraged = true; nextAttack = Math.min(nextAttack, .6);
      playSound('enrage');
      announce('PHASE 2 · The workshop wants revenge'); burst(boss.x, boss.y, '#ffae83', 35);
    }
    if (boss.recoveryDelay > 0) {
      boss.recoveryDelay -= dt;
      if (boss.recoveryDelay <= 0) boss.recovery = boss.recoveryDuration;
    }
    let dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    let dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    const length = Math.hypot(dx, dy) || 1;
    if (keys.has('shift') && player.cooldown <= 0 && (dx || dy)) { player.dash = .17; player.cooldown = 1.6; burst(player.x, player.y, '#d3ff69', 10); playSound('dash'); }
    const speed = player.dash > 0 ? 830 : 285;
    player.x = clamp(player.x + dx / length * speed * dt, 30, W - 30); player.y = clamp(player.y + dy / length * speed * dt, 145, H - 35);
    const aggression = boss.enraged ? 1.5 : 1;
    boss.x += (W / 2 + Math.sin(time * aggression) * 340 - boss.x) * dt * boss.speed / 65 * aggression;
    boss.y = 260 + Math.sin(time * 1.8 * aggression) * 70;
    if ((shotTimer -= dt) <= 0 && (keys.has(' ') || aim.firing)) {
      shotTimer = .15; const angle = Math.atan2(aim.y - player.y, aim.x - player.x);
      shots.push({ x: player.x, y: player.y, vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720, life: 2 });
      playSound('shot');
    }
    shots = shots.filter(s => {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (distance(s, boss) < boss.r) { boss.hp -= boss.recovery > 0 ? 2.7 : .9; boss.hit = .08; burst(s.x, s.y, '#d3ff69', 3); playSound('hit'); return false; }
      return s.life > 0;
    });
    if ((nextAttack -= dt) <= 0) attack();
    const spawned = [];
    hazards = hazards.filter(h => {
      const oldAge = h.age; h.age += dt;
      if (h.type === 'volley') {
        if (h.age >= 0) {
          for (let i = 0; i < h.count; i++) {
            const angle = h.angle + (i - (h.count - 1) / 2) * h.spread;
            spawned.push({ type: 'bullet', x: h.x, y: h.y, vx: Math.cos(angle) * h.speed, vy: Math.sin(angle) * h.speed, age: 0, life: 5 });
          }
          return false;
        }
      } else if (h.type === 'bullet') {
        h.x += h.vx * dt; h.y += h.vy * dt; if (distance(h, player) < 22) damage();
      } else if (h.age >= 0 && distance(h, player) < h.r + 10) damage();
      if (h.type === 'circle' && oldAge < 0 && h.age >= 0) burst(h.x, h.y, '#ffae83', 12);
      return h.age < h.life;
    });
    hazards.push(...spawned);
    if (distance(player, boss) < boss.r + 12) damage();
    if (phase === 'fight') { if (boss.hp <= 0) finish(true); else if (remaining <= 0) finish(false); }
  }
  updateHUD();
}
function updateHUD() {
  $('#phase').textContent = paused ? 'PAUSED / TAKE A BREATHER' : { lobby: 'LOBBY / READY TO BUILD', build: '01 / CHAT IS BUILDING', reveal: '02 / MEET YOUR CREATION', fight: '03 / SURVIVE YOUR CREATION', result: '04 / THE VERDICT' }[phase];
  $('#timer').textContent = ['build', 'reveal', 'fight'].includes(phase) ? `${Math.max(0, Math.ceil(remaining))} SEC` : `ROUND ${String(round).padStart(2, '0')}`;
  $('#skip').disabled = phase !== 'build';
}
function text(value, x, y, size = 16, color = '#edf1e8', align = 'center', weight = 600) {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px "DM Sans", sans-serif`; ctx.textAlign = align; ctx.fillText(value, x, y);
}
function rect(x, y, w, h, color, radius = 0) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function drawBoss() {
  const { x, y } = boss, bob = Math.sin(time * 2) * 6;
  const armor = Math.min(1, Math.log2(1 + parts.armor) / 3);
  const legsPower = Math.min(1, Math.log2(1 + parts.legs) / 3);
  const chaos = Math.min(1, Math.log2(1 + parts.chaos) / 3);
  const stride = Math.sin(time * (3 + legsPower * 15)) * (2 + legsPower * 6);
  ctx.save(); ctx.translate(x, y + (phase === 'fight' ? 0 : bob));
  if (phase === 'reveal') ctx.scale(1.2, 1.2);
  ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(0, 107, 100 + legsPower * 35, 17, 0, 0, Math.PI * 2); ctx.fill();
  if (chaos > 0) {
    ctx.save(); ctx.rotate(time * (.5 + chaos)); ctx.strokeStyle = '#ffae8355'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 87 + Math.sin(time * 5) * 5, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 3 + Math.ceil(chaos * 5); i++) {
      const angle = i * Math.PI * 2 / (3 + Math.ceil(chaos * 5));
      ctx.save(); ctx.translate(Math.cos(angle) * 93, Math.sin(angle) * 93); ctx.rotate(Math.PI / 4);
      rect(-4, -4, 8, 8, '#ffae83', 1); ctx.restore();
    }
    ctx.restore();
  }
  const legs = 2 + Math.min(6, parts.legs) * 2;
  ctx.lineWidth = 12 - legsPower * 5; ctx.lineCap = 'round';
  for (let i = 0; i < legs; i++) {
    const side = i % 2 ? 1 : -1, spread = 40 + Math.floor(i / 2) * 10 + legsPower * 35;
    const kneeY = 48 - Math.floor(i / 2) * 12;
    const footY = 92 - Math.floor(i / 2) * 10 + Math.sin(time * (5 + legsPower * 12) + i) * (5 + legsPower * 9);
    ctx.strokeStyle = '#a4c654'; ctx.beginPath(); ctx.moveTo(side * 32, 25 - i * 2); ctx.lineTo(side * spread, kneeY); ctx.lineTo(side * (spread + 18), footY); ctx.stroke();
    circle(side * spread, kneeY, 5, '#e0fda8');
  }
  ctx.translate(legsPower * stride, -legsPower * 8 + Math.abs(stride) * legsPower * .5);
  const spikes = Math.min(10, 2 + parts.chaos);
  for (let i = 0; i < spikes; i++) {
    const a = Math.PI + (i / Math.max(1, spikes - 1)) * Math.PI;
    ctx.save(); ctx.rotate(a); ctx.fillStyle = '#ffae83'; ctx.beginPath(); ctx.moveTo(48, -12); ctx.lineTo(83 + chaos * 20 + Math.sin(time * 3 + i) * 6, 0); ctx.lineTo(48, 12); ctx.fill(); ctx.restore();
  }
  if (armor > 0) {
    // Broad shoulders and layered chest plates change the silhouette, not the core hitbox.
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side * (64 + armor * 12), -4); ctx.rotate(side * -.15);
      rect(-15 - armor * 8, -42, 30 + armor * 16, 88, '#596d86', 10);
      rect(-12 - armor * 8, -39, 24 + armor * 16, 70, '#b7d2ff', 8);
      rect(-7, -28, 14, 5, '#e5efff', 2); ctx.restore();
    }
  }
  rect(-65, -53, 130, 120, boss.hit > 0 ? '#fff' : '#7c9653', 35);
  rect(-53, -43, 106, 88, '#b6d77c', 28);
  if (armor > 0) {
    rect(-50, 20, 100, 22 + armor * 13, '#6f88a6', 8);
    rect(-45, 22, 90, 14 + armor * 10, '#b7d2ff', 5);
    for (const px of [-33, 33]) circle(px, 31, 3, '#eef5ff');
  }
  rect(-42, -17, 84, 36, '#25321c', 10);
  const eyeColor = chaos > 0 ? '#ffae83' : '#f2ffae';
  ctx.shadowColor = eyeColor; ctx.shadowBlur = chaos * (12 + Math.sin(time * 8) * 5);
  rect(-29, -8, 16, 13, eyeColor, 3); rect(13, -8, 16, 13, eyeColor, 3); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#27391a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-15, 37); ctx.lineTo(0, 44); ctx.lineTo(15, 37); ctx.stroke();
  if (phase === 'fight' && boss.recovery > 0) text('VULNERABLE', 0, -100, 13, '#d3ff69');
  ctx.restore();
}
function drawBuildStats(y) {
  const stats = buildStats();
  const entries = [['ARMOR', `${stats.hp} HP`, 'More health · slower', stats.hp / 270, colors.armor],
    ['LEGS', `${Math.round(stats.speed)} SPEED`, 'Faster · less health', stats.speed / 160, colors.legs],
    ['CHAOS', `+${Math.floor(stats.chaos)} ATTACKS`, `${stats.recovery.toFixed(2)}s recovery`, stats.chaos / 5, colors.chaos]];
  for (let i = 0; i < entries.length; i++) {
    const [label, value, hint, fill, color] = entries[i], x = 170 + i * 260;
    rect(x, y, 240, 86, '#1a2419', 9);
    text(label, x + 15, y + 21, 10, color, 'left'); text(value, x + 225, y + 21, 12, '#edf1e8', 'right');
    rect(x + 15, y + 33, 210, 4, '#36422f', 2); rect(x + 15, y + 33, 210 * clamp(fill, 0, 1), 4, color, 2);
    text(hint, x + 15, y + 62, 11, '#aebda0', 'left');
  }
}
function draw() {
  // Keep world coordinates fixed while rendering enough pixels for a large/HiDPI display.
  const pixelScale = clamp(arenaBounds().width * (window.devicePixelRatio || 1) / W, 1, 3);
  const renderWidth = Math.round(W * pixelScale), renderHeight = Math.round(H * pixelScale);
  if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
    canvas.width = renderWidth; canvas.height = renderHeight;
  }
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.clearRect(0, 0, W, H); ctx.save();
  ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  rect(0, 0, W, H, '#151b14');
  ctx.strokeStyle = '#25301f'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 44) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const glow = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 450); glow.addColorStop(0, '#b6f9670b'); glow.addColorStop(1, '#00000000'); rect(0, 0, W, H, glow);
  ctx.strokeStyle = '#53653a'; ctx.setLineDash([5, 12]); ctx.beginPath(); ctx.ellipse(W / 2, 320, 300, 195, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  if (phase === 'fight') {
    text(boss.enraged ? 'PHASE 2 / ENRAGED' : 'THE COMMUNITY’S CREATION', W / 2, 36, 11, boss.enraged ? '#ffae83' : '#9da98f');
    rect(230, 50, W - 460, 10, '#33402b', 5); rect(230, 50, (W - 460) * Math.max(0, boss.hp / boss.maxHp), 10, '#d3ff69', 5);
    text(`${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`, W / 2, 81, 12, '#c2cdb7');
    for (const h of hazards) {
      if (h.type === 'circle') {
        circle(h.x, h.y, h.r, h.age < 0 ? '#ff936322' : '#ff936399');
        ctx.strokeStyle = '#ffae83'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (h.age < 0 ? clamp(1 + h.age / 1.2, .05, 1) : 1), 0, Math.PI * 2); ctx.stroke();
        if (h.age < 0) text('!', h.x, h.y + 7, 24, '#ffae83');
      } else if (h.type === 'bullet') { circle(h.x, h.y, 9, '#ffae83'); circle(h.x, h.y, 4, '#ffe3bb'); }
      else {
        const halfAngle = (h.count - 1) * h.spread / 2 + .04;
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.angle);
        ctx.fillStyle = '#ffae8328'; ctx.strokeStyle = '#ffae8370'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 200, -halfAngle, halfAngle); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
  }
  if (phase !== 'result' || boss.hp > 0) drawBoss();
  if (phase === 'lobby' || phase === 'build') {
    text(phase === 'lobby' ? 'MEET YOUR NEXT BAD IDEA.' : 'SOMETHING TERRIBLE IS TAKING SHAPE.', W / 2, 82, 15, '#c3d0b2');
    text(phase === 'lobby' ? 'Start a round. Let chat assemble the consequences.' : `${builders.size} builders · ${parts.armor} armor · ${parts.legs} legs · ${parts.chaos} chaos`, W / 2, 110, 12, '#8f9f80');
    if (phase === 'build') {
      const look = identity(); text(look.name, W / 2, 421, 20, look.color);
      if (assembly) text(`${assembly.name.slice(0, 25)} added ${assembly.type.toUpperCase()}`, W / 2, 449, 12, colors[assembly.type]);
      drawBuildStats(479);
    } else {
      text('YOUR MONSTER AWAITS', W / 2, H - 100, 13, '#d3ff69');
      text('!armor     /     !legs     /     !chaos', W / 2, H - 73, 13, '#a7b59a');
    }
    if (phase === 'build') { rect(160, H - 35, W - 320, 4, '#34422a'); rect(160, H - 35, (W - 320) * Math.max(0, remaining / 45), 4, '#d3ff69'); }
  }
  if (assembly && phase === 'build') {
    ctx.globalAlpha = assembly.life; ctx.strokeStyle = colors[assembly.type]; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(boss.x, boss.y, 90 + (1 - assembly.life) * 60, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (phase === 'reveal') {
    const look = identity();
    text('CHAT HAS FINISHED COOKING', W / 2, 39, 12, '#aebda0');
    text(look.name, W / 2, 82, 32, look.color, 'center', 800);
    text(look.trait, W / 2, 110, 14, '#c3d0b2');
    text(`${builders.size} BUILDERS · ${parts.armor} ARMOR / ${parts.legs} LEGS / ${parts.chaos} CHAOS`, W / 2, 415, 12, '#aebda0');
    drawBuildStats(444);
    text(`GET READY  ${Math.max(1, Math.ceil(remaining))}`, W / 2, 579, 26, look.color, 'center', 800);
    text('WASD move · Mouse aim · Click shoot · Shift dash', W / 2, 610, 12, '#aebda0');
  }
  if (phase === 'fight') {
    for (const s of shots) { circle(s.x, s.y, 5, '#e5ffb3'); }
    ctx.save(); ctx.translate(player.x, player.y);
    if (player.invulnerable > 0 && Math.floor(time * 12) % 2) ctx.globalAlpha = .35;
    if (player.dash > 0) circle(0, 0, 27, '#d3ff6933');
    rect(-13, -16, 26, 32, '#e2edcf', 7); rect(-9, -10, 18, 9, '#354b27', 3);
    ctx.rotate(Math.atan2(aim.y - player.y, aim.x - player.x)); rect(9, -5, 22, 10, '#d3ff69', 3); ctx.restore();
    if (aim.visible) {
      ctx.strokeStyle = '#d3ff69'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(aim.x, aim.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(aim.x + dx * 14, aim.y + dy * 14); ctx.lineTo(aim.x + dx * 20, aim.y + dy * 20);
      }
      ctx.stroke();
    }
    text('YOU', player.x, player.y + 34, 10, '#d3ff69');
    text('INTEGRITY', 28, H - 33, 10, '#9aaa8a', 'left');
    for (let i = 0; i < 5; i++) rect(28 + i * 24, H - 23, 18, 7, i < player.hp ? '#d3ff69' : '#394330', 2);
    text(player.cooldown > 0 ? `DASH ${player.cooldown.toFixed(1)}s` : 'DASH READY', W - 28, H - 25, 11, '#b7c4a7', 'right');
  }
  for (const p of particles) { ctx.globalAlpha = clamp(p.life * 2, 0, 1); rect(p.x, p.y, 4, 4, p.color); } ctx.globalAlpha = 1;
  if (phase === 'result') {
    rect(0, 0, W, H, '#10170de8');
    text(boss.hp <= 0 ? 'THE STREAMER SURVIVED' : 'THE AUDIENCE SENDS ITS REGARDS', W / 2, 180, 13, '#d3ff69');
    text(result, W / 2, 258, 48, '#edf1e8', 'center', 800);
    text(`${builders.size} builders. One questionable creation.`, W / 2, 305, 17, '#aebda0');
    const top = Object.keys(parts).sort((a, b) => parts[b] - parts[a])[0];
    const look = identity(); text(look.name, W / 2, 342, 22, look.color);
    text(builders.size ? `SIGNATURE INGREDIENT: ${top.toUpperCase()} × ${parts[top]}` : look.trait, W / 2, 372, 12, look.color);
    const contributor = feed.find(v => v.command === top);
    if (contributor) text(`Shoutout to ${contributor.name} and the rest of the workshop.`, W / 2, 396, 13, '#aebda0');
    text('Build another monster to settle the score. ↗', W / 2, 477, 14, '#d3ff69');
  }
  if (paused) { rect(0, 0, W, H, '#10170dbb'); text('PAUSED', W / 2, H / 2, 44, '#d3ff69'); }
  ctx.restore();
}
function frame(now) { const dt = Math.min((now - last) / 1000 || 0, .04); last = now; update(dt); draw(); requestAnimationFrame(frame); }
function arenaBounds() {
  const bounds = canvas.getBoundingClientRect();
  // Viewport layouts contain the arena in the available space; exclude letterboxing.
  const width = Math.min(bounds.width, bounds.height * W / H), height = width * H / W;
  return { width, height, left: bounds.left + (bounds.width - width) / 2, top: bounds.top + (bounds.height - height) / 2 };
}
function pointAim(event) {
  const bounds = arenaBounds();
  aim.x = clamp((event.clientX - bounds.left) * W / bounds.width, 0, W);
  aim.y = clamp((event.clientY - bounds.top) * H / bounds.height, 0, H);
  aim.visible = true;
}
canvas.addEventListener('pointermove', pointAim);
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || event.pointerType === 'touch') return;
  event.preventDefault(); canvas.focus(); pointAim(event);
  aim.firing = phase === 'fight' && !paused;
});
canvas.addEventListener('pointerleave', () => { aim.firing = false; aim.visible = false; });
canvas.addEventListener('pointercancel', () => { aim.firing = false; });
window.addEventListener('pointerup', () => { aim.firing = false; });
window.addEventListener('keydown', e => {
  if (e.target.matches('input,button') || $('#setup').open) return;
  const key = e.key.toLowerCase(); if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(key)) e.preventDefault(); keys.add(key);
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); aim.firing = false; if (phase === 'fight' || phase === 'reveal') { paused = true; $('#pause').textContent = 'Resume'; updateHUD(); } });
$('#start').onclick = start;
$('#skip').onclick = fight;
$('#pause').onclick = () => { if (!['fight', 'build', 'reveal'].includes(phase)) return; paused = !paused; $('#pause').textContent = paused ? 'Resume' : 'Pause'; canvas.focus(); updateHUD(); };
$('#reset').onclick = () => { phase = 'lobby'; paused = false; clearBuild(); resetActors(); $('#start').innerHTML = 'Start building <span>↗</span>'; $('#pause').textContent = 'Pause'; updateHUD(); };
for (const button of document.querySelectorAll('[data-part]')) button.onclick = () => fakeCommand(button.dataset.part);
$('#fullscreen').onclick = () => document.fullscreenElement ? document.exitFullscreen() : $('.stage').requestFullscreen();
$('#stream-view').onclick = () => {
  const enabled = document.body.classList.toggle('stream-view');
  $('#stream-view').setAttribute('aria-pressed', String(enabled));
  $('#stream-view').textContent = enabled ? 'Exit stream view' : 'Stream view';
  fitViewport();
  canvas.focus();
};
$('#close-setup').onclick = () => $('#setup').close();
let connected = false;
const events = new EventSource('/api/events');
events.addEventListener('command', e => addPart(JSON.parse(e.data)));
events.addEventListener('status', e => {
  const data = JSON.parse(e.data); connected = data.connected;
  $('#status').textContent = data.message; $('#dot').style.background = connected ? '#d3ff69' : '#8c9685';
  $('#connect').textContent = connected ? 'Disconnect' : 'Connect Twitch ↗';
  if (connected) $('#simulation').checked = false;
});
events.onerror = () => { $('#status').textContent = 'Server disconnected · retrying…'; $('#dot').style.background = '#ffae83'; };
async function connectTwitch() {
  try {
    if (connected) {
      const response = await fetch('/api/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error('Could not disconnect Twitch. Try again.');
      return;
    }
    const config = await (await fetch('/api/config')).json();
    if (!config.clientId) { $('#redirect').textContent = config.redirectUri; $('#setup').showModal(); return; }
    const state = crypto.randomUUID(); sessionStorage.setItem('twitch-state', state);
    const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'token', scope: 'user:read:chat', state });
    location.href = `https://id.twitch.tv/oauth2/authorize?${params}`;
  } catch (e) { announce(e.message); }
}
$('#connect').onclick = connectTwitch;
async function authorize() {
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (!fragment.has('access_token')) return;
  history.replaceState(null, '', '/');
  const expected = sessionStorage.getItem('twitch-state'); sessionStorage.removeItem('twitch-state');
  if (!expected || fragment.get('state') !== expected) { announce('Authorization state mismatch. Connect again.'); return; }
  try {
    const res = await fetch('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: fragment.get('access_token') }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error);
    announce('Connecting your Twitch chat…');
  } catch (e) { announce(e.message); }
}
resetActors(); updateHUD(); requestAnimationFrame(frame); authorize();
