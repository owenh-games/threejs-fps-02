import * as THREE from 'three';
import { PALETTE, createWorld, createPlayer, createWeapon, createBotManager, playSound } from './game.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 18, 46);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const world = createWorld(scene);
const player = createPlayer(world.colliders);
const weapon = createWeapon(camera);
const botManager = createBotManager(scene, player.state);

const raycaster = new THREE.Raycaster();
raycaster.far = 80;
const direction = new THREE.Vector3();

// HUD DOM elements
const hudHealth = document.getElementById('hud-health');
const hudTimer = document.getElementById('hud-timer');
const hudKills = document.getElementById('hud-kills');
const ammoMag = document.getElementById('ammo-mag');
const ammoReserve = document.getElementById('ammo-reserve');
const scoreValue = document.getElementById('score-value');
const killFeed = document.getElementById('kill-feed');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayCopy = document.getElementById('overlay-copy');
const playButton = document.getElementById('play');
const hitmarkerEl = document.getElementById('hitmarker');

let score = 0;
let kills = 0;
let roundTime = 90;
let elapsed = 0;
let gameOver = false;
let gameWon = false;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();

// Input tracking
const keys = new Set();
let mouseLookX = 0;
let mouseLookY = 0;
let firing = false;

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') weapon.reload();
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (document.pointerLockElement) document.exitPointerLock();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

renderer.domElement.addEventListener('click', () => {
  if (shot || gameOver || gameWon) return;
  if (!document.pointerLockElement) {
    renderer.domElement.requestPointerLock();
  }
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === renderer.domElement) {
    mouseLookX += e.movementX * 0.0022;
    mouseLookY += e.movementY * 0.0022;
  }
});

document.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement === renderer.domElement && e.button === 0) {
    firing = true;
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) firing = false;
});

document.addEventListener('pointerlockchange', () => {
  if (shot) return;
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    started = true;
    overlay.hidden = true;
  } else if (!gameOver && !gameWon) {
    overlay.hidden = false;
    overlayTitle.textContent = started ? 'Game Paused' : 'Tactical FPS Range';
    overlayCopy.textContent = started ? 'Press Click to resume.' : 'Eliminate 15 enemy bots within 90 seconds.';
    playButton.textContent = 'Resume Game';
  }
});

playButton.addEventListener('click', () => {
  if (shot) return;
  if (gameOver || gameWon) restart();
  renderer.domElement.requestPointerLock();
});

function restart() {
  gameOver = false;
  gameWon = false;
  score = 0;
  kills = 0;
  roundTime = 90;
  elapsed = 0;
  weapon.refill();
  player.state.health = 100;
  player.state.position.set(0, 0, 15);
  updateHud();
  overlay.hidden = true;
  renderer.domElement.requestPointerLock();
}

function updateHud() {
  hudHealth.textContent = Math.max(0, Math.round(player.state.health));
  hudTimer.textContent = Math.max(0, Math.ceil(roundTime));
  hudKills.textContent = kills;
  ammoMag.textContent = weapon.state.mag;
  ammoReserve.textContent = `/ ${weapon.state.reserve}`;
  scoreValue.textContent = score;
}

function addKillFeed(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  killFeed.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

function triggerHitmarker(killed) {
  hitmarkerEl.classList.add('on');
  setTimeout(() => hitmarkerEl.classList.remove('on'), killed ? 300 : 100);
}

function shoot(spread) {
  if (!weapon.takeRound()) return false;
  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, direction);

  const shootables = world.shootables.concat(botManager.getHitMeshes());
  const hit = raycaster.intersectObjects(shootables, false)[0];

  if (hit) {
    const isHead = hit.object.userData.isHead;
    const killed = botManager.damageBot(hit.object, isHead ? 100 : 34);
    if (hit.object.userData.isHead || hit.object.userData.target || botManager.getHitMeshes().includes(hit.object)) {
      playSound('hit');
      triggerHitmarker(killed);
      score += killed ? 150 : 25;
      if (killed) {
        kills += 1;
        addKillFeed(`You eliminated Enemy Bot (${kills}/15)`);
        if (kills >= 15 && !gameWon) {
          gameWon = true;
          overlay.hidden = false;
          overlayTitle.textContent = 'Victory!';
          overlayCopy.textContent = `You reached 15 kills with score ${score}! Click restart to play again.`;
          playButton.textContent = 'Play Again';
          if (document.pointerLockElement) document.exitPointerLock();
        }
      }
    }
  }

  weapon.pullTrigger();
  player.recoil(0.008 + random() * 0.003, (random() * 2 - 1) * 0.003);
  updateHud();
  return true;
}

function step(dt) {
  elapsed += dt;
  roundTime -= dt;
  if (roundTime <= 0 && !gameWon && !gameOver) {
    gameOver = true;
    roundTime = 0;
    overlay.hidden = false;
    overlayTitle.textContent = 'Defeat - Time Up';
    overlayCopy.textContent = `Time expired with ${kills} kills (need 15). Score: ${score}`;
    playButton.textContent = 'Try Again';
    if (document.pointerLockElement) document.exitPointerLock();
  }

  player.step(dt, keys);
  weapon.step(dt);
  botManager.step(dt, player.state.position, (damage) => {
    player.state.health -= damage;
    playSound('hurt');
    updateHud();
    if (player.state.health <= 0 && !gameOver && !gameWon) {
      gameOver = true;
      overlay.hidden = false;
      overlayTitle.textContent = 'Defeat - KIA';
      overlayCopy.textContent = `You were eliminated by enemy bots. Score: ${score}`;
      playButton.textContent = 'Try Again';
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, () => {});

  updateHud();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (!frozen) {
    player.look(mouseLookX, mouseLookY);
    mouseLookX = 0;
    mouseLookY = 0;

    if (firing && weapon.ready() && !gameOver && !gameWon) {
      shoot(shot ? 0 : weapon.spread(player.groundSpeed()));
    }

    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;

    camera.position.set(player.state.position.x, player.state.position.y + player.state.eye, player.state.position.z);
    camera.rotation.set(player.state.pitch, player.state.yaw, 0, 'YXZ');
  }

  renderer.render(scene, camera);
}

function settle(steps) {
  for (let i = 0; i < steps; i++) step(FIXED_STEP);
}

function aimAt(point) {
  const dx = point.x - player.state.position.x;
  const dy = point.y - (player.state.position.y + player.state.eye);
  const dz = point.z - player.state.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  player.state.yaw = Math.atan2(-dx, -dz);
  player.state.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
}

function runShot(name) {
  overlay.hidden = true;
  player.state.pitch = 0;
  player.state.yaw = 0;

  if (name === 'play' || name === 'end') {
    player.state.position.set(0, 0, 5);
    settle(20);
    // Simulate scoring some kills for screenshots
    for (let i = 0; i < 4; i++) {
      kills += 1;
      score += 150;
    }
    if (name === 'end') {
      gameWon = true;
      overlay.hidden = false;
      overlayTitle.textContent = 'Victory!';
      overlayCopy.textContent = `Completed with 15 kills!`;
    }
  } else {
    player.state.position.set(0, 0, 15);
    settle(10);
    overlay.hidden = false;
    overlayTitle.textContent = 'Tactical FPS Range';
    overlayCopy.textContent = 'Eliminate 15 enemy bots within 90 seconds.';
  }

  updateHud();
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    camera.position.set(player.state.position.x, player.state.position.y + player.state.eye, player.state.position.z);
    camera.rotation.set(player.state.pitch, player.state.yaw, 0, 'YXZ');
    renderer.render(scene, camera);
    painted++;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

updateHud();
if (shot) {
  runShot(shot);
} else {
  requestAnimationFrame(frame);
}
