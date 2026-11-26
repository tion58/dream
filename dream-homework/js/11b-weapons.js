/* ============================================================
 * 파일: js/11b-weapons.js   (예전 11b-hammer.js 를 대신함)
 * 역할: 무기 3종(검, 방패, 화염방사기)과 공격, 적 넉백, 부술 수 있는 상자 부수기(망치)
 * 들어있는 것: WEAPONS(무기 수치), equipWeapon, attackPress/attackRelease(공격 키), 검/방패 치기(meleeAttack), 방패 막기(E를 누르는 동안 앞쪽만: shieldBlocks), 화염방사기(startFlame/stepFlame), 적 피해(hitEnemy), tryBreak(망치로 상자 부수기), stepWeapons, drawWeaponEffects
 * 먼저 로드돼야 하는 파일: 07-inventory-interact.js (inventory, showToast), 10-rooms.js (enemies, projectiles), 12b-sleep.js (addSleep)
 * 주의: 공격 키는 02b-keybinds.js 에서 플레이어가 정한 키(기본 SPACE). 공격할 때마다 졸음 스택이 늘어남(무기마다 stack 값, 화염방사기는 0.5초마다 +1).
 *       공격 간격은 졸음 스택이 쌓일수록 길어짐(attackCooldownExtraFrames). 적 체력은 10-rooms.js 의 ENEMY_MAX_HP(=10)
 *       검은 호를 그리며 휘두르는 칼날과 잔상, 방패는 앞으로 내밀었다 돌아오며 충격 효과(drawWeaponEffects)
 *       방패는 E를 누르고 있는 동안 바라보는 방향 앞쪽(약 120도)에서 오는 공격만 막음. 뒤/옆에서 오는 공격은 맞음 (shieldHeld)
 *       화염방사기는 공격 키를 누르는 동안 바라보는 방향으로 차징 없이 조금씩 가속하며(이동 거리는 짧음) 앞쪽 부채꼴을 태움. 연료(약 1.2초)는 쓰지 않을 때 5초에 걸쳐 가득 참
 *       무기 공격은 적의 투사체(던지는 공)도 부술 수 있음. 투사체를 부수는 건 "적을 죽였다"로 세지 않음(gameStats.kills 는 적이 죽었을 때만)
 * ============================================================ */
const BUILD_11B = 47; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)

// 무기 수치 (cooldown: 공격 후 다음 공격까지 프레임, 60프레임 = 1초 / stack: 공격할 때 늘어나는 졸음 스택)
const WEAPONS = {
  sword:  { name: '검',         icon: '🗡️', kind: 'melee', damage: 3, cooldown: 60, reach: 20, radius: 24, stack: 1, info: '데미지 3 · 공격 간격 1초' },
  shield: { name: '방패',       icon: '🛡️', kind: 'melee', damage: 1, cooldown: 60, reach: 16, radius: 20, stack: 1, info: '데미지 1 · 공격 간격 1초 · E를 누르고 있는 동안 앞쪽에서 오는 공격을 막아 준다 (뒤나 옆에서 오는 공격은 못 막음)' },
  flame:  { name: '화염방사기', icon: '🔥', kind: 'flame', damage: 1, stack: 1, info: '공격 키를 누르는 동안 바라보는 방향으로 조금씩 나아가며 앞쪽을 태운다 (0.25초마다 데미지 1) · 최대 약 1.2초 · 다 쓰면 5초에 걸쳐 충전 · 0.5초마다 졸음 +1' },
};
const ENEMY_KNOCK_SPEED = 7;   // 맞은 적이 밀려나는 속도
const ATTACK_FX_FRAMES = 10;   // (예비) 공격 모습을 화면에 보여주는 기본 프레임 수
const SWORD_FX_FRAMES = 12;    // 검을 휘두르는 모습이 보이는 프레임 수 (길수록 천천히 휘두르는 느낌)
const SWORD_SWEEP = 1.45;      // 검이 휘둘러지는 각도의 절반 (라디안, 1.45 ≈ 83도 → 앞쪽 약 166도를 쓸어냄)
const SWORD_BLADE_LEN = 36;    // 칼날 길이
const SHIELD_FX_FRAMES = 14;   // 방패를 내미는 모습이 보이는 프레임 수
const SHIELD_PUSH = 16;        // 방패가 앞으로 뻗는 거리
const SHIELD_BLOCK_COS = 0.5;  // 방패가 막는 범위: 바라보는 방향과 공격이 오는 방향 사이 각도가 60도 이내(= 앞쪽 120도) → cos 60° = 0.5
const FLAME_FUEL_MAX = 120;    // 화염방사기 연료 (가득 찬 양)
const FLAME_BURN_RATE = 1.7;   // 불을 뿜는 동안 프레임마다 줄어드는 연료 (120 ÷ 1.7 ≈ 70프레임 = 약 1.2초. 클수록 빨리 바닥남)
const FLAME_REFILL_FRAMES = 300; // 연료가 바닥난 상태에서 가득 찰 때까지 걸리는 시간 (5초)
const FLAME_MIN_START = 15;    // 연료가 이만큼(0.25초) 이상 있어야 다시 켤 수 있음 (바닥난 직후에 깜빡이며 꺼졌다 켜지는 것 방지)
const FLAME_ACCEL = 0.14;      // 켜져 있는 동안 바라보는 방향으로 더해지는 가속. 마찰(0.94)과 맞물려 최고 속도가 약 2.2 (예전 0.47 → 풀차징 속도. 작을수록 이동 거리가 짧음)
const FLAME_RANGE = 58;        // 불꽃이 닿는 거리
const FLAME_HALF_ANGLE = 0.6;  // 불꽃 부채꼴의 절반 각도 (라디안, 0.6 ≈ 34도 → 앞쪽 약 70도)
const FLAME_TICK_FRAMES = 15;  // 적에게 데미지를 주는 간격 (15프레임 = 0.25초)
const FLAME_STACK_FRAMES = 30; // 불을 뿜은 시간이 이만큼 쌓일 때마다 졸음 스택 +1 (30프레임 = 0.5초)
const DIR_VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

let equippedWeapon = null; // 지금 장착한 무기 ('sword' | 'shield' | 'flame' | null)
let weaponCD = 0, weaponCDMax = 1;
let attackFx = null;       // 지금 보이는 공격 모습
let blockFlash = 0;        // 방패가 막은 순간 번쩍이는 시간
let swordSwingSign = 1;    // 검을 휘두르는 방향 (공격할 때마다 번갈아 바뀜: 한 번은 시계 방향, 한 번은 반대 방향)
let shieldHeld = false;    // E 를 눌러 방패를 들고 있는 중인지
let flameFuel = FLAME_FUEL_MAX; // 화염방사기 연료 (프레임)
let flameOn = false;       // 지금 불을 뿜는 중인지
let flameTick = 0, flameBurn = 0; // 데미지 간격 / 졸음 스택 간격을 세는 값
const gameStats = { kills: 0 }; // 이야기 분기용 기록 (적을 무기로 죽인 횟수 등)

const weaponBadgeEl = document.getElementById('weaponBadge');
const weaponBadgeTextEl = document.getElementById('weaponBadgeText');
const weaponBadgeCDEl = document.getElementById('weaponBadgeCD');
const attackBtnEl = document.getElementById('atkBtn');
function updateWeaponBadge() {
  if (attackBtnEl) attackBtnEl.style.display = equippedWeapon ? 'flex' : 'none'; // 휴대폰용 화면 공격 버튼은 무기를 끼고 있을 때만
  if (!equippedWeapon) { weaponBadgeEl.style.display = 'none'; return; }
  const w = WEAPONS[equippedWeapon];
  weaponBadgeEl.style.display = 'block';
  const k = keyCodeLabel(keyBindings.attack);
  let keys = '[' + k + ']';
  if (equippedWeapon === 'shield') keys = '[' + k + ' 치기 · E 꾹: 막기]';
  if (equippedWeapon === 'flame') keys = '[' + k + ' 꾹]';
  weaponBadgeTextEl.textContent = w.icon + ' ' + w.name + '  ' + keys;
}
function equipWeapon(id) {
  if (!WEAPONS[id] || !inventory[id]) return;
  stopFlame(); stopShieldHold();
  equippedWeapon = id;
  updateWeaponBadge();
  if (typeof inventoryOpen !== 'undefined' && inventoryOpen) renderInventory();
}
function unequipWeapon() {
  stopFlame(); stopShieldHold();
  equippedWeapon = null;
  updateWeaponBadge();
  if (typeof inventoryOpen !== 'undefined' && inventoryOpen) renderInventory();
}

// ---- 방패: E 를 누르고 있는 동안 바라보는 방향 앞쪽에서 오는 공격만 막음 (11-combat-camera.js 의 피격 판정이 shieldBlocks 를 부름) ----
function startShieldHold() {
  if (equippedWeapon !== 'shield' || gameState !== 'playing' || quizOpen) return false;
  shieldHeld = true;
  return true;
}
function stopShieldHold() { shieldHeld = false; }
// 공격이 오는 자리(srcX, srcY)가 방패가 막는 앞쪽 범위 안이면 true
function shieldBlocks(srcX, srcY) {
  if (!shieldHeld || equippedWeapon !== 'shield') return false;
  const v = DIR_VEC[player.facing] || DIR_VEC.down;
  const dx = srcX - player.x, dy = srcY - player.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return true;
  return (dx * v[0] + dy * v[1]) / d >= SHIELD_BLOCK_COS;
}
function onShieldBlock() { blockFlash = 8; }

function isDamageable(en) { return en.type === 'enemy' || en.type === 'thrower' || en.type === 'hopper'; }

// ---- 화염방사기 ----
function startFlame() {
  if (equippedWeapon !== 'flame' || gameState !== 'playing' || quizOpen || player.stunTimer > 0) return;
  if (flameOn || flameFuel < FLAME_MIN_START) return;
  cancelAllCharges(); // 차징하던 것은 멈춤
  flameOn = true;
  flameTick = FLAME_TICK_FRAMES; // 켜자마자 첫 데미지
}
function stopFlame() { flameOn = false; }
// 매 프레임 (12-update.js, 이동 계산 직전): 불을 뿜는 동안 앞으로 가속, 앞쪽 부채꼴 태우기, 연료/졸음 스택 계산. 안 뿜을 때는 연료 채우기
function stepFlame() {
  if (flameOn && (equippedWeapon !== 'flame' || quizOpen || player.stunTimer > 0)) flameOn = false;
  if (!flameOn) {
    flameFuel = Math.min(FLAME_FUEL_MAX, flameFuel + FLAME_FUEL_MAX / FLAME_REFILL_FRAMES);
    return;
  }
  flameFuel -= FLAME_BURN_RATE;
  if (flameFuel <= 0) { flameFuel = 0; flameOn = false; return; }
  const v = DIR_VEC[player.facing] || DIR_VEC.down;
  player.vx += v[0] * FLAME_ACCEL; player.vy += v[1] * FLAME_ACCEL; // 차징 없이 바라보는 방향으로 나아감 (마찰과 맞물려 최고 속도가 정해짐)
  if (++flameBurn >= FLAME_STACK_FRAMES) { flameBurn = 0; addSleep(WEAPONS.flame.stack); } // 0.5초마다 졸음 +1
  // 불꽃이 닿는 적/투사체
  const cosHalf = Math.cos(FLAME_HALF_ANGLE);
  const inCone = (x, y, r) => {
    const dx = x - player.x, dy = y - player.y, d = Math.hypot(dx, dy);
    if (d > FLAME_RANGE + r) return false;
    if (d < r + 8) return true;
    return (dx * v[0] + dy * v[1]) / d >= cosHalf;
  };
  for (let i = projectiles.length - 1; i >= 0; i--) if (inCone(projectiles[i].x, projectiles[i].y, projectiles[i].r)) projectiles.splice(i, 1);
  if (++flameTick >= FLAME_TICK_FRAMES) {
    flameTick = 0;
    for (const en of enemies) {
      if (en.dead || !isDamageable(en)) continue;
      if (inCone(en.x, en.y, en.r)) hitEnemy(en, WEAPONS.flame.damage, 0);
    }
  }
}

// ---- 공격 키 / 화면 ⚔ 버튼 (05-input.js 가 부름) ----
function attackPress() {
  if (gameState !== 'playing' || quizOpen || rampage.active || !equippedWeapon) return;
  if (equippedWeapon === 'flame') startFlame(); else attackWithWeapon();
}
function attackRelease() { stopFlame(); }

// 매 프레임 (12-update.js): 쿨다운, 공격 모습, 안내 표시 갱신
function stepWeapons() {
  if (weaponCD > 0) weaponCD--;
  if (attackFx) { attackFx.t++; if (attackFx.t >= attackFx.dur) attackFx = null; }
  if (blockFlash > 0) blockFlash--;
  if (shieldHeld && (quizOpen || gameState !== 'playing')) shieldHeld = false;
  if (equippedWeapon === 'flame') {
    weaponBadgeCDEl.style.width = (100 * flameFuel / FLAME_FUEL_MAX) + '%'; // 연료 게이지
    weaponBadgeCDEl.style.background = flameFuel < FLAME_MIN_START ? '#ff6b6b' : '#ff9f43';
  } else if (equippedWeapon) {
    weaponBadgeCDEl.style.width = (weaponCD > 0 ? 100 * weaponCD / weaponCDMax : 0) + '%';
    weaponBadgeCDEl.style.background = '#ffd86b';
  }
}

// 맞은 적이 밀려났다가 서서히 원래 움직임으로 돌아오게 함 (offX/offY 는 밀려난 거리, kvx/kvy 는 밀려나는 속도)
function stepEnemyKnock(en) {
  if (!en.kvx && !en.kvy && !en.offX && !en.offY) return;
  en.offX = (en.offX || 0) + (en.kvx || 0);
  en.offY = (en.offY || 0) + (en.kvy || 0);
  en.kvx = (en.kvx || 0) * 0.84;
  en.kvy = (en.kvy || 0) * 0.84;
  en.offX *= 0.985; en.offY *= 0.985;
  if (Math.abs(en.kvx) < 0.05) en.kvx = 0;
  if (Math.abs(en.kvy) < 0.05) en.kvy = 0;
  if (Math.abs(en.offX) < 0.05) en.offX = 0;
  if (Math.abs(en.offY) < 0.05) en.offY = 0;
}

// 적을 쓰러뜨리면 전리품이 나옴 (■■의 재료, 07d 의 쪽지 "■■■"). 인벤토리에 바로 들어옴
function dropLoot() {
  addItem('loot');
  showToast(gameStats.kills === 1 ? '전리품을 얻었다 🔸 (인벤토리에서 볼 수 있어요)' : '전리품 +1 🔸', gameStats.kills === 1 ? 3200 : 1500);
}
function hitEnemy(en, damage, knockSpeed) {
  en.hp -= damage;
  en.hurt = 10; // 맞았을 때 하얗게 번쩍임
  if (knockSpeed) {
    let ux = en.x - player.x, uy = en.y - player.y;
    const d = Math.hypot(ux, uy) || 1;
    ux /= d; uy /= d;
    en.kvx = ux * knockSpeed;
    en.kvy = uy * knockSpeed;
  }
  en.hitCD = Math.max(en.hitCD, 24); // 맞자마자 바로 되받아치지 못하게 잠깐 공격을 쉼
  if (en.hp <= 0 && !en.dead) { en.dead = true; gameStats.kills++; dropLoot(); if (gameStats.kills === 1) storyBeat('firstKill'); } // 처음 죽였을 때 찝찝한 혼잣말(트루 엔딩 힌트)
}

// ---- 검/방패 치기 (공격 키) ----
function attackWithWeapon() {
  if (gameState !== 'playing' || quizOpen || !equippedWeapon || weaponCD > 0) return;
  const w = WEAPONS[equippedWeapon];
  if (w.kind !== 'melee') return;
  weaponCDMax = w.cooldown + attackCooldownExtraFrames(); // 졸음이 쌓일수록 공격 간격이 길어짐
  weaponCD = weaponCDMax;
  addSleep(w.stack);                                       // 공격할 때마다 졸음 스택이 늘어남
  playReleaseThud();
  meleeAttack(w);
}

// 검/방패: 바라보는 방향의 앞쪽 원 안의 적을 때리고, 그 안의 투사체는 부숨
function meleeAttack(w) {
  const v = DIR_VEC[player.facing] || DIR_VEC.down;
  const cx = player.x + v[0] * w.reach, cy = player.y + v[1] * w.reach;
  const isSword = equippedWeapon === 'sword';
  attackFx = { kind: equippedWeapon, t: 0, dur: isSword ? SWORD_FX_FRAMES : SHIELD_FX_FRAMES,
               cx: cx, cy: cy, r: w.radius, vx: v[0], vy: v[1], sign: swordSwingSign, hit: false };
  if (isSword) swordSwingSign = -swordSwingSign; // 다음 공격은 반대 방향으로 휘두름
  for (const en of enemies) {
    if (en.dead || !isDamageable(en)) continue;
    if (Math.hypot(en.x - cx, en.y - cy) < w.radius + en.r) { hitEnemy(en, w.damage, equippedWeapon === 'shield' ? 4 : ENEMY_KNOCK_SPEED); attackFx.hit = true; }
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    if (Math.hypot(projectiles[i].x - cx, projectiles[i].y - cy) < w.radius + projectiles[i].r) { projectiles.splice(i, 1); attackFx.hit = true; }
  }
}

// ---- 망치: 금이 간 상자를 한 번 부수면 철 조각이 나오고, 망치는 부서진 망치로 바뀜 ----
function tryBreak(en) {
  if (en.broken) return;
  if (inventory.hammer) {
    en.broken = true;
    useItem('hammer');
    addItem('brokenHammer');
    addItem('iron');
    playReleaseThud();
    showToast('쾅! 상자가 부서지고 철 조각이 나왔다. 하지만 망치도 부서져 버렸다...', 3800);
  } else if (inventory.brokenHammer) {
    showToast('망치가 부서져서 더는 쓸 수 없다...');
  } else {
    showToast('단단해 보인다. 부술 도구가 필요하겠어.');
  }
}

// ---- 그리기: 방패 든 모습, 화염, 공격 모습 (13-render.js 가 주인공을 그릴 때 부름) ----
function drawWeaponEffects(camX) {
  const sx = player.x - camX;
  if (shieldHeld && equippedWeapon === 'shield' && !(attackFx && attackFx.kind === 'shield')) drawHeldShield(sx, player.y);
  if (flameOn) drawFlame(sx, player.y);
  if (!attackFx) return;
  const f = attackFx;
  if (f.kind === 'sword') drawSwordSwing(f, sx, player.y);
  else if (f.kind === 'shield') drawShieldPush(f, sx, player.y);
}

// 방패를 들고 있는 모습: 앞쪽에 방패, 막아 주는 앞쪽 120도 범위를 옅은 호로 보여줌. 막은 순간에는 호가 번쩍임
function drawHeldShield(sx, sy) {
  const v = DIR_VEC[player.facing] || DIR_VEC.down;
  const ang = Math.atan2(v[1], v[0]);
  const flash = blockFlash > 0;
  const half = Math.acos(SHIELD_BLOCK_COS);
  bctx.save();
  bctx.globalAlpha = flash ? 0.9 : 0.3;
  bctx.strokeStyle = flash ? '#ffffff' : '#8fd8ff';
  bctx.lineWidth = flash ? 3 : 1.5;
  bctx.beginPath(); bctx.arc(sx, sy, flash ? 27 : 25, ang - half, ang + half); bctx.stroke();
  bctx.globalAlpha = 1;
  bctx.translate(Math.round(sx + v[0] * 14), Math.round(sy + v[1] * 14));
  bctx.rotate(ang);
  bctx.fillStyle = '#2f5a86'; bctx.fillRect(-4, -12, 8, 24);
  bctx.fillStyle = flash ? '#ffffff' : '#8fd8ff'; bctx.fillRect(-2, -10, 5, 20);
  bctx.fillStyle = '#e8f8ff'; bctx.fillRect(-2, -10, 2, 20);
  bctx.fillStyle = '#ffd86b'; bctx.fillRect(0, -2, 3, 4);
  bctx.restore();
}

// 화염방사기: 앞쪽 부채꼴로 일렁이는 불꽃 (노랑 → 주황 → 빨강, 멀수록 퍼지고 작아짐)
function drawFlame(sx, sy) {
  const v = DIR_VEC[player.facing] || DIR_VEC.down;
  const perp = [-v[1], v[0]];
  const N = 18, spread = Math.tan(FLAME_HALF_ANGLE);
  bctx.save();
  for (let i = 0; i < N; i++) {
    const t = ((i / N) + (frameCount * 0.07) % 1 * (1 / N)) % 1;        // 불꽃 알갱이가 앞으로 흘러감
    const d = 8 + t * (FLAME_RANGE - 8);
    const wob = Math.sin(frameCount * 0.9 + i * 7.3) * spread * d * 0.8;  // 좌우로 일렁임
    const size = Math.max(2, Math.round(6 - t * 4));
    const x = sx + v[0] * d + perp[0] * wob, y = sy + v[1] * d + perp[1] * wob;
    bctx.globalAlpha = 0.95 - t * 0.5;
    bctx.fillStyle = t < 0.3 ? '#fff2a8' : (t < 0.65 ? '#ffb347' : '#ff5a36');
    bctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  }
  bctx.restore();
}

// 검: 앞쪽을 호를 그리며 휘두름. 칼날이 지나간 자리에 꼬리(잔상)가 남았다가 사라짐
function drawSwordSwing(f, sx, sy) {
  const p = Math.min(1, f.t / f.dur);
  const e = 1 - Math.pow(1 - p, 3);                 // 처음엔 빠르게, 끝에서 느려지는 움직임
  const base = Math.atan2(f.vy, f.vx);
  const a0 = base - SWORD_SWEEP * f.sign;           // 휘두르기 시작 각도
  const a1 = base + SWORD_SWEEP * f.sign;           // 끝 각도
  const a = a0 + (a1 - a0) * e;                     // 지금 칼날의 각도
  const fade = p < 0.65 ? 1 : (1 - p) / 0.35;       // 끝나갈수록 흐려짐
  const R = SWORD_BLADE_LEN - 4;
  bctx.save();
  bctx.lineCap = 'butt';
  // 꼬리(잔상): 출발 각도에서 지금 각도까지, 칼날에 가까울수록 진하게
  const N = 9;
  for (let i = 0; i < N; i++) {
    const ta = a0 + (a - a0) * (i / N), tb = a0 + (a - a0) * ((i + 1) / N);
    bctx.globalAlpha = Math.pow((i + 1) / N, 1.6) * 0.65 * fade;
    bctx.strokeStyle = '#fff6c8';
    bctx.lineWidth = 2 + 4 * ((i + 1) / N);
    bctx.beginPath(); bctx.arc(sx, sy, R - 2, Math.min(ta, tb), Math.max(ta, tb)); bctx.stroke();
  }
  // 칼날 (어두운 테두리 → 밝은 날 → 끝의 반짝임), 손잡이 쪽 날밑
  const ca = Math.cos(a), sa = Math.sin(a);
  const r0 = 8; // 손잡이 길이만큼 몸에서 떨어진 곳에서 시작
  bctx.globalAlpha = fade;
  bctx.strokeStyle = '#4a4a62'; bctx.lineWidth = 4;
  bctx.beginPath(); bctx.moveTo(sx + ca * r0, sy + sa * r0); bctx.lineTo(sx + ca * SWORD_BLADE_LEN, sy + sa * SWORD_BLADE_LEN); bctx.stroke();
  bctx.strokeStyle = '#f4f4ff'; bctx.lineWidth = 2;
  bctx.beginPath(); bctx.moveTo(sx + ca * (r0 + 2), sy + sa * (r0 + 2)); bctx.lineTo(sx + ca * (SWORD_BLADE_LEN - 1), sy + sa * (SWORD_BLADE_LEN - 1)); bctx.stroke();
  bctx.strokeStyle = '#d9a441'; bctx.lineWidth = 2; // 날밑(손잡이와 칼날 사이 가로대)
  bctx.beginPath(); bctx.moveTo(sx + ca * (r0 + 1) - sa * 4, sy + sa * (r0 + 1) + ca * 4); bctx.lineTo(sx + ca * (r0 + 1) + sa * 4, sy + sa * (r0 + 1) - ca * 4); bctx.stroke();
  bctx.fillStyle = '#ffffff';
  bctx.beginPath(); bctx.arc(sx + ca * SWORD_BLADE_LEN, sy + sa * SWORD_BLADE_LEN, 2.2, 0, Math.PI * 2); bctx.fill(); // 칼끝 반짝임
  bctx.restore();
}

// 방패: 앞으로 쑥 내밀었다가 돌아옴. 가장 멀리 나갔을 때 부딪힌 자리에 충격 고리와 불꽃이 퍼짐 (적을 맞췄으면 더 크게)
function drawShieldPush(f, sx, sy) {
  const p = Math.min(1, f.t / f.dur);
  const off = 6 + SHIELD_PUSH * Math.sin(Math.PI * Math.pow(p, 0.6)); // 빨리 나가서(p≈0.3에서 최대) 천천히 돌아옴
  const ang = Math.atan2(f.vy, f.vx);
  const fade = p < 0.8 ? 1 : (1 - p) / 0.2;
  const cx = sx + f.vx * off, cy = sy + f.vy * off;
  bctx.save();
  bctx.globalAlpha = fade;
  bctx.translate(Math.round(cx), Math.round(cy));
  bctx.rotate(ang); // 이제 +x 쪽이 앞
  bctx.fillStyle = '#2f5a86'; bctx.fillRect(-4, -12, 8, 24);   // 방패 테두리
  bctx.fillStyle = '#8fd8ff'; bctx.fillRect(-2, -10, 5, 20);   // 방패 면
  bctx.fillStyle = '#e8f8ff'; bctx.fillRect(-2, -10, 2, 20);   // 빛 반사
  bctx.fillStyle = '#ffd86b'; bctx.fillRect(0, -2, 3, 4);      // 가운데 장식
  bctx.restore();
  // 충격 효과: 방패가 가장 멀리 나간 순간(p≈0.3)부터
  const q = (p - 0.3) / 0.7;
  if (q > 0) {
    const ix = sx + f.vx * (off + 4), iy = sy + f.vy * (off + 4);
    const big = f.hit ? 1.4 : 1;
    bctx.save();
    bctx.globalAlpha = (1 - q) * 0.9;
    bctx.strokeStyle = f.hit ? '#fff6c8' : '#bfeaff'; bctx.lineWidth = 2;
    bctx.beginPath(); bctx.arc(ix, iy, (4 + 14 * q) * big, 0, Math.PI * 2); bctx.stroke(); // 퍼지는 충격 고리
    const sparks = f.hit ? 8 : 5;
    bctx.lineWidth = 2; bctx.strokeStyle = f.hit ? '#ffd86b' : '#ffffff';
    for (let i = 0; i < sparks; i++) { // 사방으로 튀는 불꽃
      const ra = ang + (i / sparks) * Math.PI * 2 + 0.3;
      const r1 = (5 + 10 * q) * big, r2 = (9 + 16 * q) * big;
      bctx.beginPath(); bctx.moveTo(ix + Math.cos(ra) * r1, iy + Math.sin(ra) * r1); bctx.lineTo(ix + Math.cos(ra) * r2, iy + Math.sin(ra) * r2); bctx.stroke();
    }
    bctx.restore();
  }
}
