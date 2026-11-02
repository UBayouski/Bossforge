import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Exercise real game transitions without requiring a browser or Twitch account.
function game(extraGlobals = {}) {
  const elements = new Map();
  const context = new Proxy(
    {},
    {
      get: (_, key) => (key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}),
    },
  );
  function element(key) {
    if (!elements.has(key))
      elements.set(key, {
        checked: false,
        style: {},
        children: [],
        width: 1100,
        height: 660,
        getContext: () => context,
        focus() {},
        append() {},
        remove() {},
        addEventListener() {},
        setAttribute(name, value) {
          this[name] = value;
        },
        getBoundingClientRect: () => ({ left: 100, top: 50, width: 550, height: 330 }),
        prepend(item) {
          this.children.unshift(item);
        },
        replaceChildren() {
          this.children = [];
        },
        get lastChild() {
          return { remove: () => this.children.pop() };
        },
      });
    return elements.get(key);
  }
  const sandbox = vm.createContext({
    document: {
      querySelector: element,
      querySelectorAll: () => [],
      createElement: () => element(Math.random()),
      createTextNode: (x) => x,
    },
    window: { addEventListener() {} },
    EventSource: class {
      addEventListener() {}
    },
    requestAnimationFrame() {},
    setTimeout: () => 1,
    clearTimeout() {},
    location: { hash: '' },
    URLSearchParams,
    console,
    ...extraGlobals,
  });
  vm.runInContext(readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'), sandbox);
  return (code) => vm.runInContext(code, sandbox);
}
test('one real viewer cannot add multiple parts, and only build phase accepts parts', () => {
  const run = game();
  run("addPart({command:'armor',id:'1',name:'test',source:'twitch'})");
  assert.equal(run('builders.size'), 0);
  run(
    "start(); addPart({command:'armor',id:'1',name:'test',source:'twitch'}); addPart({command:'chaos',id:'1',name:'test',source:'twitch'})",
  );
  assert.equal(run('builders.size'), 1);
  assert.equal(run('parts.armor'), 1);
  assert.equal(run('parts.chaos'), 0);
  run("paused=true; addPart({command:'legs',id:'2',name:'test',source:'twitch'})");
  assert.equal(run('builders.size'), 1);
});
test('build timer enters reveal, pause freezes countdown, combat has its full timer, and restart clears parts', () => {
  const run = game();
  run("start(); fakeCommand('legs'); remaining=.01; update(.02)");
  assert.equal(run('phase'), 'reveal');
  assert.equal(run('remaining'), 4);
  run('paused=true; update(10)');
  assert.equal(run('remaining'), 4);
  run('paused=false; update(4.01)');
  assert.equal(run('phase'), 'fight');
  assert.equal(run('remaining'), 60);
  run('paused=true; update(10)');
  assert.equal(run('remaining'), 60);
  run('paused=false; remaining=.01; update(.02)');
  assert.equal(run('phase'), 'result');
  run('start()');
  assert.equal(run('builders.size'), 0);
  assert.equal(run('player.hp'), 5);
});
test('reveal locks contributions and cannot shoot or damage the player', () => {
  const run = game();
  run(
    "start(); fakeCommand('armor'); fight(); aim.firing=true; keys.add(' '); addPart({command:'chaos',id:'late',name:'late',source:'twitch'}); update(.5); draw()",
  );
  assert.equal(run('phase'), 'reveal');
  assert.equal(run('builders.size'), 1);
  assert.equal(run('shots.length'), 0);
  assert.equal(run('hazards.length'), 0);
  assert.equal(run('player.hp'), 5);
  run('update(4)');
  assert.equal(run('phase'), 'fight');
  assert.equal(run('aim.firing'), false);
  assert.equal(run('keys.size'), 0);
});
test('preview stats match combat and distinct builds render in construction, reveal and combat', () => {
  const run = game();
  for (const type of ['armor', 'legs', 'chaos']) {
    run(`start(); parts.${type}=12; draw(); fight(); draw()`);
    assert.equal(run('boss.maxHp'), run('buildStats().hp'));
    assert.equal(run('boss.speed'), run('buildStats().speed'));
    assert.ok(
      run('identity().name').includes({ armor: 'IRON', legs: 'SKITTER', chaos: 'HEX' }[type]),
    );
    run('beginCombat(); draw()');
  }
  run('start(); parts.armor=3; parts.legs=3; draw()');
  assert.equal(run('identity().name'), 'THE BEAUTIFUL MISTAKE');
  run('start()');
  assert.equal(run('identity().name'), 'THE ORIGINAL BAD IDEA');
});
test('large audiences stay bounded and armor/legs have opposing tradeoffs', () => {
  const run = game();
  run('start(); parts.armor=10000; fight()');
  assert.equal(run('boss.maxHp'), 270);
  assert.equal(run('boss.speed'), 15);
  run('start(); parts.legs=10000; fight()');
  assert.equal(run('boss.maxHp'), 65);
  assert.ok(run('boss.speed') > 35);
});
test('damage respects dash immunity and ends combat at zero health', () => {
  const run = game();
  run('start(); fight(); beginCombat(); player.dash=.1; damage()');
  assert.equal(run('player.hp'), 5);
  run('player.dash=0; player.hp=1; damage()');
  assert.equal(run('phase'), 'result');
});
test('attack patterns, shooting, and rendering execute through a full simulation', () => {
  const run = game();
  run(
    "start(); fakeCommand('chaos'); fight(); beginCombat(); attack(); attack(); keys.add(' '); player.invulnerable=100; for(let i=0;i<1800;i++){aim.x=boss.x; aim.y=boss.y; update(1/60); draw();}",
  );
  assert.ok(run('boss.hp') < run('boss.maxHp'));
  assert.equal(run('phase'), 'result');
});
test('targeted explosions warn first, then punish standing still', () => {
  const run = game();
  run('start(); fight(); beginCombat(); nextAttack=100; attack(); update(.4)');
  assert.equal(run('player.hp'), 5);
  assert.ok(run('boss.recovery') <= 0);
  run('for(let i=0;i<60;i++) update(.01)');
  assert.equal(run('player.hp'), 4);
  run('for(let i=0;i<20;i++) update(.01)');
  assert.ok(run('boss.recovery') > 0);
});
test('half health triggers a faster second phase once and a new round resets it', () => {
  const run = game();
  run('start(); fight(); beginCombat(); boss.hp=boss.maxHp/2; update(.01)');
  assert.equal(run('boss.enraged'), true);
  run('attack()');
  assert.equal(run('nextAttack'), 1.65);
  run('start(); fight(); beginCombat(); attack()');
  assert.equal(run('boss.enraged'), false);
  assert.equal(run('nextAttack'), 2.2);
});
test('an idle player loses even against a boss with no chat parts', () => {
  const run = game();
  run('start(); fight(); beginCombat(); for(let i=0;i<3000 && phase==="fight";i++) update(.01)');
  assert.equal(run('phase'), 'result');
  assert.equal(run('player.hp'), 0);
});
test('shots follow manual aim even when it points away from the boss', () => {
  const run = game();
  run(
    'start(); fight(); beginCombat(); aim.x=player.x+200; aim.y=player.y; aim.firing=true; update(.01)',
  );
  assert.ok(run('shots[0].vx') > 700);
  assert.equal(run('shots[0].vy'), 0);
  run('aim.x=player.x-200; boss.x=player.x+100; shotTimer=0; update(.01)');
  assert.ok(run('shots[shots.length-1].vx') < -700);
});
test('pointer coordinates scale from displayed arena to game space', () => {
  const run = game();
  run('pointAim({clientX:375,clientY:215})');
  assert.equal(run('aim.x'), 550);
  assert.equal(run('aim.y'), 330);
});
test('HiDPI rendering increases pixel resolution without changing world or aim coordinates', () => {
  const run = game();
  run(
    'window.devicePixelRatio=2; canvas.getBoundingClientRect=()=>({left:0,top:0,width:1650,height:990}); draw(); draw(); pointAim({clientX:825,clientY:495})',
  );
  assert.equal(run('canvas.width'), 3300);
  assert.equal(run('canvas.height'), 1980);
  assert.equal(run('W'), 1100);
  assert.equal(run('H'), 660);
  assert.equal(run('aim.x'), 550);
  assert.equal(run('aim.y'), 330);
});
test('aim excludes letterboxing when the arena is constrained by height or width', () => {
  const run = game();
  run(
    'canvas.getBoundingClientRect=()=>({left:100,top:50,width:1100,height:900}); pointAim({clientX:100,clientY:170})',
  );
  assert.equal(run('aim.x'), 0);
  assert.equal(run('aim.y'), 0);
  run(
    'canvas.getBoundingClientRect=()=>({left:100,top:50,width:1600,height:660}); pointAim({clientX:350,clientY:50})',
  );
  assert.equal(run('aim.x'), 0);
  assert.equal(run('aim.y'), 0);
  run('pointAim({clientX:900,clientY:380})');
  assert.equal(run('aim.x'), 550);
  assert.equal(run('aim.y'), 330);
});

test('sound is opt-in, reuses one audio context, and mute prevents new effects', async () => {
  const oscillators = [],
    levels = [];
  let contexts = 0;
  const parameter = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime(value) {
      levels.push(value);
    },
  });
  class AudioContext {
    constructor() {
      contexts++;
      this.state = 'running';
      this.currentTime = 0;
    }
    async resume() {
      this.state = 'running';
    }
    createGain() {
      return { gain: parameter(), connect() {}, disconnect() {} };
    }
    createOscillator() {
      const oscillator = {
        frequency: parameter(),
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
      };
      oscillators.push(oscillator);
      return oscillator;
    }
  }
  const run = game({ window: { addEventListener() {}, AudioContext } });
  run("start(); playSound('shot')");
  assert.equal(contexts, 0);
  await run("$('#sound').onclick()");
  assert.equal(contexts, 1);
  assert.equal(run("$('#sound')['aria-pressed']"), 'true');
  const enabledCount = oscillators.length;
  assert.ok(enabledCount > 0);
  await run("$('#sound').onclick()");
  run("playSound('damage')");
  assert.equal(oscillators.length, enabledCount);
  assert.equal(levels.at(-1), 0);
  assert.equal(run("$('#sound')['aria-pressed']"), 'false');
  await run("$('#sound').onclick()");
  assert.equal(contexts, 1);
  run("for(let i=0;i<100;i++){audio.context.currentTime+=.2; playSound('shot')}");
  assert.equal(run('audio.voices'), 12);
  for (const oscillator of oscillators) oscillator.onended();
  assert.equal(run('audio.voices'), 0);
});

test('browsers without audio support can still play', async () => {
  const run = game();
  await run("$('#sound').onclick()");
  assert.equal(run("$('#sound').textContent"), 'Sound unavailable');
  run("start(); fakeCommand('armor'); fight(); beginCombat(); update(.1)");
  assert.equal(run('phase'), 'fight');
  assert.equal(run('audio.enabled'), false);
});

test('regular layout compacts only when its natural height exceeds the viewport and restores on taller screens', () => {
  const run = game();
  run(`
    const classes = new Set();
    document.body = { classList: {
      contains: name => classes.has(name),
      remove: name => classes.delete(name),
      toggle(name, force) { if (force) classes.add(name); else classes.delete(name); }
    } };
    window.innerWidth = 1280; window.innerHeight = 800; window.scrollY = 0;
    $('main').getBoundingClientRect = () => ({ bottom: classes.has('fit-viewport') ? 720 : 1000 });
    fitViewport();
  `);
  assert.equal(run("classes.has('fit-viewport')"), true);
  run('fitViewport()');
  assert.equal(
    run("classes.has('fit-viewport')"),
    true,
    'must measure the original layout rather than oscillate',
  );
  run('window.innerHeight = 1200; fitViewport()');
  assert.equal(run("classes.has('fit-viewport')"), false);
  run('window.innerHeight = 800; fitViewport()');
  assert.equal(run("classes.has('fit-viewport')"), true);
});

test('regular viewport fitting leaves mobile, Stream view, and fullscreen behavior intact', () => {
  const run = game();
  run(`
    const classes = new Set(['fit-viewport', 'stream-view']);
    document.body = { classList: {
      contains: name => classes.has(name), remove: name => classes.delete(name),
      toggle(name, force) { if (force) classes.add(name); else classes.delete(name); }
    } };
    window.innerWidth = 1280; window.innerHeight = 800; window.scrollY = 0;
    $('main').getBoundingClientRect = () => ({ bottom: 1000 });
    fitViewport();
  `);
  assert.equal(run("classes.has('fit-viewport')"), false);
  assert.equal(run("classes.has('stream-view')"), true);
  run("classes.delete('stream-view'); window.innerWidth = 760; fitViewport()");
  assert.equal(run("classes.has('fit-viewport')"), false);
  run('window.innerWidth = 1280; document.fullscreenElement = {}; fitViewport()');
  assert.equal(run("classes.has('fit-viewport')"), false);
  run('document.fullscreenElement = null; fitViewport()');
  assert.equal(run("classes.has('fit-viewport')"), true);
});
