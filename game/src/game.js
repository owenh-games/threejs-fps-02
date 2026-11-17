import * as THREE from 'three';

export const PALETTE = {
  canvas: 0x14161a,
  surface: 0x1e2228,
  hairline: 0x2c323a,
  ink: 0xe9e6df,
  muted: 0x98a0a8,
  accent: 0xf0a830,
  wall: 0x242930,
  floor: 0x1a1d22,
  metal: 0x3a424e,
  enemy: 0xd84040,
  enemyHead: 0xff6666,
  flash: 0xfffae0
};

// WebAudio Sound Synthesizer
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSound(type) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'shoot') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'hit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(1200, now + 0.05);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'reload') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.setValueAtTime(400, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'hurt') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'botshot') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch (e) {}
}

export function createWorld(scene) {
  const colliders = [];
  const shootables = [];

  // Floor
  const floorGeo = new THREE.PlaneGeometry(80, 80);
  const floorMat = new THREE.MeshStandardMaterial({ color: PALETTE.floor, roughness: 0.8 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  colliders.push(floor);

  // Grid helper on floor
  const grid = new THREE.GridHelper(80, 40, PALETTE.accent, PALETTE.hairline);
  grid.position.y = 0.01;
  scene.add(grid);

  // Lighting
  const ambient = new THREE.AmbientLight(PALETTE.ink, 0.4);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(PALETTE.ink, 0.9);
  dirLight.position.set(20, 35, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);

  // Outer Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.6 });
  const boxMat = new THREE.MeshStandardMaterial({ color: PALETTE.metal, roughness: 0.5 });

  const createWall = (w, h, d, x, y, z, ry = 0) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push(mesh);
    shootables.push(mesh);
    return mesh;
  };

  const createObstacle = (w, h, d, x, y, z) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, boxMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push(mesh);
    shootables.push(mesh);
    return mesh;
  };

  // Arena bounds (40x40 area)
  createWall(80, 8, 2, 0, 4, -40);
  createWall(80, 8, 2, 0, 4, 40);
  createWall(2, 8, 80, -40, 4, 0);
  createWall(2, 8, 80, 40, 4, 0);

  // Tactical cover / obstacles inside
  createObstacle(6, 3, 2, -10, 1.5, -10);
  createObstacle(2, 3, 6, 12, 1.5, -15);
  createObstacle(8, 4, 2, 0, 2, -22);
  createObstacle(4, 2.5, 4, -18, 1.25, 10);
  createObstacle(6, 3, 2, 15, 1.5, 12);
  createObstacle(2, 5, 2, -5, 2.5, 20);
  createObstacle(5, 3, 5, 20, 1.5, -5);

  return { colliders, shootables };
}

export function createPlayer(colliders) {
  const state = {
    position: new THREE.Vector3(0, 0, 15),
    velocity: new THREE.Vector3(),
    pitch: 0,
    yaw: 0,
    eye: 1.6,
    health: 100,
    isGrounded: false
  };

  const radius = 0.5;
  const speed = 5.5;
  const sprintMultiplier = 1.6;
  const jumpForce = 6.5;
  const gravity = 20;

  function look(dx, dy) {
    state.yaw -= dx;
    state.pitch -= dy;
    const limit = Math.PI / 2 - 0.01;
    state.pitch = Math.max(-limit, Math.min(limit, state.pitch));
  }

  function step(dt, keys) {
    const moveDir = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);

    if (keys.has('KeyW') || keys.has('ArrowUp')) moveDir.add(forward);
    if (keys.has('KeyS') || keys.has('ArrowDown')) moveDir.sub(forward);
    if (keys.has('KeyD') || keys.has('ArrowRight')) moveDir.add(right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) moveDir.sub(right);
    moveDir.y = 0;
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    let currentSpeed = speed;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) {
      currentSpeed *= sprintMultiplier;
    }

    state.velocity.x = moveDir.x * currentSpeed;
    state.velocity.z = moveDir.z * currentSpeed;

    if (state.isGrounded) {
      if (keys.has('Space')) {
        state.velocity.y = jumpForce;
        state.isGrounded = false;
      } else {
        state.velocity.y = 0;
      }
    } else {
      state.velocity.y -= gravity * dt;
    }

    state.position.addScaledVector(state.velocity, dt);

    // Floor collision
    if (state.position.y <= 0) {
      state.position.y = 0;
      state.velocity.y = 0;
      state.isGrounded = true;
    }

    // Simple bounds collision
    state.position.x = Math.max(-38, Math.min(38, state.position.x));
    state.position.z = Math.max(-38, Math.min(38, state.position.z));
  }

  function groundSpeed() {
    return Math.hypot(state.velocity.x, state.velocity.z);
  }

  function recoil(dpitch, dyaw) {
    state.pitch += dpitch;
    state.yaw += dyaw;
  }

  return { state, look, step, groundSpeed, recoil };
}

export function createWeapon(camera) {
  const state = {
    mag: 30,
    reserve: 90,
    reloading: false,
    reloadTimer: 0,
    lastShotTime: 0
  };

  const fireRate = 0.12; // seconds between shots
  const reloadTime = 1.5;

  // Viewmodel gun mesh attached to camera
  const gunGroup = new THREE.Group();
  const bodyGeo = new THREE.BoxGeometry(0.12, 0.15, 0.6);
  const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.metal, roughness: 0.4 });
  const gunMesh = new THREE.Mesh(bodyGeo, bodyMat);
  gunMesh.position.set(0.2, -0.22, -0.45);
  gunGroup.add(gunMesh);

  // Barrel / Muzzle
  const barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.2);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.2, -0.2, -0.75);
  gunGroup.add(barrel);

  // Muzzle Flash light/mesh
  const flashGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const flashMat = new THREE.MeshBasicMaterial({ color: PALETTE.flash });
  const flashMesh = new THREE.Mesh(flashGeo, flashMat);
  flashMesh.position.set(0.2, -0.2, -0.85);
  flashMesh.visible = false;
  gunGroup.add(flashMesh);

  camera.add(gunGroup);

  function ready() {
    const now = performance.now() / 1000;
    return !state.reloading && state.mag > 0 && (now - state.lastShotTime) >= fireRate;
  }

  function takeRound() {
    if (!ready()) return false;
    state.mag -= 1;
    state.lastShotTime = performance.now() / 1000;
    playSound('shoot');
    flashMesh.visible = true;
    setTimeout(() => { flashMesh.visible = false; }, 50);
    return true;
  }

  function reload() {
    if (state.reloading || state.mag >= 30 || state.reserve <= 0) return;
    state.reloading = true;
    state.reloadTimer = reloadTime;
    playSound('reload');
  }

  function refill() {
    state.mag = 30;
    state.reserve = 90;
    state.reloading = false;
  }

  function step(dt) {
    if (state.reloading) {
      state.reloadTimer -= dt;
      if (state.reloadTimer <= 0) {
        const needed = 30 - state.mag;
        const available = Math.min(needed, state.reserve);
        state.mag += available;
        state.reserve -= available;
        state.reloading = false;
      }
    }
    // slight weapon bobbing
    gunMesh.position.y = -0.22 + Math.sin(performance.now() * 0.01) * 0.002;
  }

  function spread(speed) {
    return 0.01 + (speed > 4 ? 0.03 : 0);
  }

  return { state, ready, takeRound, reload, refill, step, spread };
}

export function createBotManager(scene, playerState) {
  const bots = [];
  const botGeo = new THREE.BoxGeometry(0.8, 1.8, 0.6);
  const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const botMat = new THREE.MeshStandardMaterial({ color: PALETTE.enemy, roughness: 0.5 });
  const headMat = new THREE.MeshStandardMaterial({ color: PALETTE.enemyHead, roughness: 0.4 });

  function spawnBot(x, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(botGeo, botMat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.75;
    head.userData = { isHead: true };
    group.add(head);

    group.position.set(x, 0, z);
    scene.add(group);

    bots.push({
      group,
      body,
      head,
      hp: 100,
      alive: true,
      shootCooldown: Math.random() * 2,
      patrolTimer: Math.random() * 5,
      strafeDir: Math.random() > 0.5 ? 1 : -1
    });
  }

  // Spawn initial bots
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const dist = 20 + Math.random() * 12;
    spawnBot(Math.cos(angle) * dist, Math.sin(angle) * dist);
  }

  function step(dt, playerPos, onPlayerDamaged, onBotKilled) {
    for (let i = bots.length - 1; i >= 0; i--) {
      const bot = bots[i];
      if (!bot.alive) continue;

      const dist = bot.group.position.distanceTo(playerPos);

      // Bot AI: move towards player or strafe
      bot.patrolTimer -= dt;
      if (bot.patrolTimer <= 0) {
        bot.patrolTimer = 2 + Math.random() * 3;
        bot.strafeDir *= -1;
      }

      const dirToPlayer = new THREE.Vector3().subVectors(playerPos, bot.group.position);
      dirToPlayer.y = 0;
      dirToPlayer.normalize();

      if (dist > 8) {
        // Advance towards player
        bot.group.position.addScaledVector(dirToPlayer, 3.5 * dt);
      } else {
        // Strafe around player
        const strafeVec = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x).multiplyScalar(bot.strafeDir);
        bot.group.position.addScaledVector(strafeVec, 2.5 * dt);
      }

      bot.group.lookAt(playerPos.x, bot.group.position.y, playerPos.z);

      // Bot shooting at player
      bot.shootCooldown -= dt;
      if (bot.shootCooldown <= 0 && dist < 35) {
        bot.shootCooldown = 1.2 + Math.random() * 1.5;
        playSound('botshot');
        if (Math.random() < 0.65) {
          onPlayerDamaged(15);
        }
      }

      // Respawn bot if too far or dead
      if (bot.group.position.length() > 50) {
        bot.group.position.set((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40);
      }
    }
  }

  function damageBot(object, amount) {
    for (const bot of bots) {
      if (!bot.alive) continue;
      if (bot.body === object || bot.head === object) {
        const dmg = object.userData.isHead ? 100 : amount;
        bot.hp -= dmg;
        if (bot.hp <= 0) {
          bot.alive = false;
          scene.remove(bot.group);
          // Respawn a new bot elsewhere after a short delay
          setTimeout(() => {
            const angle = Math.random() * Math.PI * 2;
            const dist = 25 + Math.random() * 15;
            spawnBot(Math.cos(angle) * dist, Math.sin(angle) * dist);
          }, 2000);
          onBotKilled();
          return true;
        }
        return false;
      }
    }
    return false;
  }

  function getHitMeshes() {
    const meshes = [];
    for (const bot of bots) {
      if (bot.alive) {
        meshes.push(bot.body, bot.head);
      }
    }
    return meshes;
  }

  return { bots, step, damageBot, getHitMeshes };
}
