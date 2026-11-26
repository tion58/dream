/* ============================================================
 * 파일: js/03b-sprites.js
 * 역할: 그림(스프라이트) 불러오기와 그리기 도우미, 주인공 모습(충전 단계), 잔상 구름
 * 들어있는 것: SPRITE_FILES(그림 파일 목록), drawSprite, drawPlayerSprite(주인공), 잔상 구름(spawnAfterimage/stepAfterimages/drawAfterimages), onPlayerLaunch
 * 먼저 로드돼야 하는 파일: 01-core.js (bctx), 03-world-player.js (player)
 * 주의: 그림 파일은 assets/ 폴더에 있음. 파일을 같은 이름으로 바꿔 끼우면 게임 그림이 바뀜(크기가 달라도 중심을 기준으로 그려짐).
 *       그림이 아직 불러와지지 않았거나 파일이 없으면 예전의 네모 모양으로 대신 그림(spriteReady 로 확인)
 * ============================================================ */
const BUILD_03B = 48; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


// ---- 그림 파일 (이름 → 파일 경로) ----
const SPRITE_FILES = {
  playerIdle:    'assets/player_idle.png',     // 주인공: 가만히 있을 때 (작은 구름 위에서 자는 모습)
  playerCharge1: 'assets/player_charge1.png',  // 충전 중(중간): 구름이 몽실하게 커짐
  playerCharge2: 'assets/player_charge2.png',  // 충전 많이 됨: 구름이 더 크게 부풀음
  afterA:        'assets/afterimage_a.png',    // 충전 후 남는 잔상 구름 (납작한 원)
  afterB:        'assets/afterimage_b.png',    // 잔상 구름 (조금 다른 모양)
  enemyPurple:   'assets/enemy_purple.png',    // 보라색 적 (투척형 적, 두 번째 미니게임의 몬스터)
  propComputer:  'assets/prop_computer.png',   // 히든방3의 컴퓨터 (책상 위의 모니터, 키보드, 마우스)
  propDrawer:    'assets/prop_drawer.png',     // 히든방2 방4의 서랍(상자)
  propDocs:      'assets/prop_docs.png',       // 히든방2 방4의 서류 뭉치 (맵에 놓인 모습)
  propGlove:     'assets/prop_glove.png',      // 장갑 (히든방4 실험 공간의 장식)
  propGoggles:   'assets/prop_goggles.png',    // 실험 안경 (히든방4)
  propChem:      'assets/prop_chem.png',       // 화학 기계 (히든방4). 원본을 깔끔한 도트로 다시 그려 보정한 것
  propSwitch:    'assets/prop_switch.png',     // 스위치 (히든방4)
  enemyRed:      'assets/enemy_red.png',       // 빨간 적 (머리 없는 작은 몸통, 붉은 빛이 돔. 보라색 적 그림을 빨갛게 칠하고 머리를 뺀 것)
};
const sprites = {}; // 이름 → { img, ready, w, h, white, red }

// 모양은 그대로 두고 한 가지 색으로만 칠한 복사본 (맞았을 때 번쩍임/붉은 깜빡임에 씀). 픽셀을 읽지 않는 방법이라 파일을 직접 열어도 동작함
function makeTinted(img, color) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}
Object.keys(SPRITE_FILES).forEach(name => {
  const s = { img: new Image(), ready: false, w: 0, h: 0, white: null, red: null };
  s.img.onload = () => {
    s.w = s.img.naturalWidth; s.h = s.img.naturalHeight;
    s.white = makeTinted(s.img, '#ffffff');
    s.red = makeTinted(s.img, '#ff3b3b');
    s.ready = true;
  };
  s.img.onerror = () => { // 그림 파일이 없거나 이름이 다름 (게임은 예전 네모 모양으로 대신 그림)
    if (window.showGameError) window.showGameError('그림 파일을 불러오지 못했어요: ' + SPRITE_FILES[name] + '\n→ assets 폴더에 같은 이름으로 있는지 확인해 주세요. (없으면 예전 네모 모양으로 나와요)');
  };
  s.img.src = SPRITE_FILES[name];
  sprites[name] = s;
});
function spriteReady(name) { return !!(sprites[name] && sprites[name].ready); }

// 그림의 중심을 (cx, cy)에 그림. opts: flip(좌우 뒤집기), alpha(투명도), scale(크기 배율), tint('white' | 'red': 한 가지 색으로 칠한 모습)
// 그림이 아직 준비되지 않았으면 false 를 돌려줌 (그때는 호출한 쪽에서 예전 모양을 그림)
function drawSprite(name, cx, cy, opts) {
  const s = sprites[name];
  if (!s || !s.ready) return false;
  opts = opts || {};
  const sc = opts.scale || 1;
  const w = Math.round(s.w * sc), h = Math.round(s.h * sc);
  const src = opts.tint === 'white' ? s.white : (opts.tint === 'red' ? s.red : s.img);
  bctx.save();
  bctx.imageSmoothingEnabled = false; // 도트가 번지지 않게
  if (opts.alpha !== undefined) bctx.globalAlpha = opts.alpha;
  bctx.translate(Math.round(cx), Math.round(cy));
  if (opts.flip) bctx.scale(-1, 1);
  bctx.drawImage(src, -Math.round(w / 2), -Math.round(h / 2), w, h);
  bctx.restore();
  return true;
}

// ---- 주인공: 충전하는 동안 구름이 점점 커지고, 발사 직후에는 구름이 부푼 채로 날아감 ----
const PLAYER_IDLE_BOB = true; // 가만히 있을 때 1칸 정도 천천히 둥실거리게 할지
let playerPuff = 0; // 발사 직후 구름이 부푼 모습을 유지하는 남은 프레임
function playerChargeFrac() { // 지금 충전 중인 방향 중 가장 많이 찬 정도 (0 ~ 1)
  let best = 0;
  ['up', 'down', 'left', 'right'].forEach(n => {
    if (chargeStart[n] !== null) best = Math.max(best, Math.min(1, (frameCount - chargeStart[n]) / chargeFramesNow()));
  });
  return best;
}
// 충전 정도(frac)와 발사 후 남은 시간(puff), 속도(speed)에 맞는 주인공 그림 이름
function playerSpriteFor(frac, puff, speed) {
  if (frac >= 0.7 || puff > 10) return 'playerCharge2';
  if (frac >= 0.2 || puff > 0 || speed > 3) return 'playerCharge1';
  return 'playerIdle';
}
// 주인공을 (sx, sy)(화면 좌표)에 그림. 그림이 없으면 false
function drawPlayerSprite(sx, sy) {
  const frac = playerChargeFrac();
  const speed = Math.hypot(player.vx, player.vy);
  const name = playerSpriteFor(frac, playerPuff, speed);
  // 충전 중이나 충전 후에는 흔들리지 않음. 완전히 가만히 있을 때만 아주 살짝 둥실거림 (PLAYER_IDLE_BOB 를 false 로 바꾸면 이것도 멈춤)
  let ox = 0, oy = 0;
  if (PLAYER_IDLE_BOB && frac === 0 && playerPuff === 0 && speed < 0.5) oy = Math.round(Math.sin(frameCount * 0.05));
  const flip = player.faceX < 0;
  if (!drawSprite(name, sx + ox, sy + oy, { flip: flip })) return false;
  if (player.stunTimer > 0 && Math.floor(player.stunTimer / 3) % 2 === 0) { // 맞으면 붉게 깜빡임
    drawSprite(name, sx + ox, sy + oy, { flip: flip, tint: 'red', alpha: 0.5 });
  }
  return true;
}

// ---- 잔상 구름: 발사하면 출발한 자리에 큰 구름이, 날아가는 길에는 작은 구름이 남았다가 서서히 사라짐 ----
const afterimages = []; // 메인 게임(방 안 좌표). 방을 옮기면 비움(11-combat-camera.js 의 crossRoom)
let afterVariant = 0;
let lastTrailX = 0, lastTrailY = 0;
function spawnAfterimage(list, x, y, big) {
  list.push({ x: x, y: y + 3, age: 0, life: big ? 64 : 44, big: big, v: afterVariant++ % 2 });
}
function stepAfterimages(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    list[i].age++;
    if (list[i].age >= list[i].life) list.splice(i, 1);
  }
}
// offX: 화면으로 옮길 때 더할 x (메인 게임은 -카메라x, 미니게임은 0)
function drawAfterimages(list, offX) {
  list.forEach(a => {
    const t = a.age / a.life;
    drawSprite(a.v === 0 ? 'afterA' : 'afterB', a.x + offX, a.y, {
      alpha: 0.8 * (1 - t) * (1 - t * 0.2),
      scale: (a.big ? 1.15 : 0.75) * (1 - 0.3 * t),
    });
  });
}
// 메인 게임에서 발사한 순간 (05-input.js 의 releaseDir)
function onPlayerLaunch(power) {
  playerPuff = 18;
  if (power > 1.4) spawnAfterimage(afterimages, player.x, player.y, true); // 아주 살짝 눌러 조금만 나갈 때는 남기지 않음
  lastTrailX = player.x; lastTrailY = player.y;
}
// 매 프레임 (12-update.js): 부푼 모습 시간 줄이기, 날아가는 길에 작은 구름 남기기, 잔상 사라지게 하기
function stepPlayerEffects() {
  if (playerPuff > 0) playerPuff--;
  if (Math.hypot(player.vx, player.vy) > 1.6 && Math.hypot(player.x - lastTrailX, player.y - lastTrailY) > 16) {
    spawnAfterimage(afterimages, player.x, player.y, false);
    lastTrailX = player.x; lastTrailY = player.y;
  }
  stepAfterimages(afterimages);
}
