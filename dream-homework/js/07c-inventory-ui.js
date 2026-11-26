/* ============================================================
 * 파일: js/07c-inventory-ui.js
 * 역할: 인벤토리 화면(아이템 칸, 설명, 무기 장착)과 무기 제작 탭, 엔딩 카드 모음
 * 들어있는 것: ■■ 만들기(PILL_RECIPE/craftPill)와 먹기(상세 화면의 먹기 버튼), openInventory/closeInventory/toggleInventory, renderInventory, handleInventoryKey, RECIPES(무기 제작법)/craftWeapon(제작), ENDINGS(엔딩 목록), unlockEnding(엔딩 카드 얻기)
 * 먼저 로드돼야 하는 파일: 07-inventory-interact.js (ITEM_DEFS, inventory), 02b-keybinds.js (인벤토리 키)
 * 주의: 무기는 부품으로 만듦("제작" 탭, 제작법은 RECIPES). 부품은 히든방마다 하나씩이라서 한 번 만들면 부품이 소모돼 다른 무기는 만들 수 없음
 *       인벤토리 키(기본 TAB)와 화면 오른쪽 위의 가방 버튼으로 열고 닫음. 열려 있는 동안 게임은 멈춤(quizOpen 을 같이 씀).
 *       엔딩 카드는 아직 얻는 조건이 코드에 없음 → 나중에 엔딩이 일어나는 곳에서 unlockEnding('normalA') 처럼 부르면 카드가 채워지고 브라우저에 저장됨
 * ============================================================ */
const BUILD_07C = 48; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)

// ---- 엔딩 카드 목록 (id 는 unlockEnding 에 쓰는 이름). 글은 임시 → 이야기가 정해지면 바꿀 것 ----
const ENDINGS = [
  { id: 'normalA', title: '노멀 엔딩 A', text: '스스로 죽음을 택했다. 몸에 손상을 입은 채, 장애를 안고 이곳을 탈출했다.' },
  { id: 'normalB', title: '노멀 엔딩 B', text: '졸음 스택이 한계를 넘어 막이 깨졌다. 마지막 모습은 실험관 속에서 영원히 잠든 모습이었다.' },
  { id: 'true',    title: '트루 엔딩',   text: '아무도 해치지 않고 맨정신을 지킨 채 빛나는 출구로 나갔다. 연구를 하던 교수와 일당은 붙잡히고, 주인공은 일상으로 돌아왔다.' },
  { id: 'hidden',  title: '히든 엔딩',   text: '실험 자체가 무너져 내렸다…' },
];
const ENDING_STORAGE = 'dreamEndings';
function loadEndings() { try { return JSON.parse(localStorage.getItem(ENDING_STORAGE) || '{}') || {}; } catch (e) { return {}; } }
let endingsUnlocked = loadEndings();
function unlockEnding(id) {
  const e = ENDINGS.find(x => x.id === id);
  if (!e || endingsUnlocked[id]) return false;
  endingsUnlocked[id] = true;
  try { localStorage.setItem(ENDING_STORAGE, JSON.stringify(endingsUnlocked)); } catch (err) { /* 무시 */ }
  showToast('엔딩 카드를 얻었다: ' + e.title, 3600);
  if (inventoryOpen) renderInventory();
  return true;
}

// ---- 인벤토리 화면 ----
let inventoryOpen = false;
let invTab = 'items';     // 'items' | 'craft' | 'endings'
let invSelected = null;   // 설명을 보고 있는 아이템 종류
let pillConfirm = false;  // ■■ 먹기를 한 번 눌러서 "정말 먹을까?"를 묻는 중인지
const invScreenEl = document.getElementById('inventoryScreen');
const invGridEl = document.getElementById('invGrid');
const invDetailEl = document.getElementById('invDetail');
const invEndingsEl = document.getElementById('invEndings');
const invItemsPaneEl = document.getElementById('invItemsPane');
const invHintEl = document.getElementById('invHint');
const invCraftEl = document.getElementById('invCraft');
const invTabEls = { items: document.getElementById('invTabItems'), craft: document.getElementById('invTabCraft'), endings: document.getElementById('invTabEndings') };
const INV_COLS = 5, INV_MIN_SLOTS = 15;

function openInventory() {
  if (gameState !== 'playing' || quizOpen || rampage.active) return; // 폭주 중에는 못 엶
  inventoryOpen = true;
  quizOpen = true; // 열려 있는 동안 게임을 멈춤
  renderInventory();
  invScreenEl.classList.add('show');
}
function closeInventory() {
  inventoryOpen = false;
  quizOpen = false;
  invScreenEl.classList.remove('show');
}
function toggleInventory() { if (inventoryOpen) closeInventory(); else openInventory(); }
// 인벤토리가 열려 있는 동안 눌린 키 (05-input.js 에서 먼저 호출): 인벤토리 키/ESC 로 닫기
function handleInventoryKey(e) {
  if (e.repeat) return;
  if (matchesBinding(e, 'inventory') || e.key === 'Escape') { e.preventDefault(); closeInventory(); }
}

// ---- 무기 제작법 (id 는 11b-weapons.js 의 WEAPONS 와 같은 이름, parts 는 07-inventory-interact.js 의 부품 아이템) ----
// 부품1은 모든 무기에 들어가는 기본 부품. 나머지 부품 둘은 무기마다 다름 (검=2+3, 방패=3+4, 화염방사기=2+4)
const RECIPES = [
  { id: 'sword',  parts: ['part1', 'part2', 'part3'] },
  { id: 'shield', parts: ['part1', 'part3', 'part4'] },
  { id: 'flame',  parts: ['part1', 'part2', 'part4'] },
];
function recipesKnown() { return inventory.recipeDoc > 0; } // 서류 뭉치(히든방2 방4에서 얻음)를 가져야 제작법이 보임
function canCraft(r) { return recipesKnown() && r.parts.every(p => inventory[p] > 0); }
function craftWeapon(id) {
  const r = RECIPES.find(x => x.id === id);
  if (!r || !canCraft(r)) return;
  r.parts.forEach(p => useItem(p));   // 부품이 소모됨 → 다른 무기는 못 만듦
  addItem(id);
  const def = ITEM_DEFS[id];
  if (!equippedWeapon) { equipWeapon(id); showToast(def.name + ' 완성! 장착했다 ' + def.icon, 3600); }
  else showToast(def.name + ' 완성! ' + def.icon, 3600);
  playReleaseThud();
  renderInventory();
  storyBeat('firstWeapon'); // 인벤토리를 닫은 뒤에 나옴 (07d-dialogue.js)
}
// ---- ■■ 만들기: 용기 + 약품 + 찢어진 쪽지 + 전리품 (쪽지에 적힌 대로). 찢어진 쪽지를 가지면 제작 탭에 나타남 ----
const PILL_RECIPE = ['container', 'medicine', 'tornNote', 'loot'];
function canCraftPill() { return PILL_RECIPE.every(p => inventory[p] > 0); }
function craftPill() {
  if (!canCraftPill()) return;
  PILL_RECIPE.forEach(p => useItem(p));
  addItem('pill');
  showToast('■■ 완성! 💊', 3200);
  playReleaseThud();
  renderInventory();
  storyBeat('madePill'); // 인벤토리를 닫은 뒤에 나옴
}
function renderPillCard() {
  if (!(inventory.tornNote > 0) && !(inventory.pill > 0)) return; // 쪽지를 얻기 전에는 보이지 않음
  const ok = canCraftPill();
  const card = document.createElement('div');
  card.className = 'craftCard' + (ok ? ' ready' : '');
  let parts = '';
  PILL_RECIPE.forEach(p => {
    const have = inventory[p] > 0;
    parts += '<span class="craftPart ' + (have ? 'have' : 'miss') + '">' + ITEM_DEFS[p].icon + ' ' + ITEM_DEFS[p].name + (have ? ' ✔' : '') + '</span>';
  });
  card.innerHTML = '<div class="craftTitle">💊 ■■</div><div class="craftInfo">쪽지에 적힌 대로 재료를 섞는다. (약품은 세 번째 히든방, 전리품은 쓰러뜨린 것에서 나온다)</div><div class="craftParts">' + parts + '</div>';
  const btn = document.createElement('div');
  btn.className = 'bigBtn craftBtn' + (ok ? '' : ' disabled');
  btn.textContent = ok ? '만들기' : '재료가 모자라요';
  if (ok) btn.addEventListener('click', craftPill);
  card.appendChild(btn);
  invCraftEl.appendChild(card);
}

function renderCraft() {
  renderCraftWeapons();
  renderPillCard();
}
function renderCraftWeapons() {
  if (!recipesKnown()) { // 서류를 얻기 전에는 ??? 로 보임
    invCraftEl.innerHTML = '<div class="craftNote">도구 만드는 법이 적힌 서류를 찾아야 해요.</div>';
    RECIPES.forEach(() => {
      const card = document.createElement('div');
      card.className = 'craftCard';
      card.innerHTML = '<div class="craftTitle">❓ ???</div><div class="craftInfo">???</div><div class="craftParts"><span class="craftPart miss">???</span><span class="craftPart miss">???</span><span class="craftPart miss">???</span></div><div class="bigBtn craftBtn disabled">???</div>';
      invCraftEl.appendChild(card);
    });
    return;
  }
  invCraftEl.innerHTML = '<div class="craftNote">부품은 한 번만 쓸 수 있어서, 무기는 하나만 만들 수 있어요.</div>';
  RECIPES.forEach(r => {
    const def = ITEM_DEFS[r.id];
    const ok = canCraft(r);
    const card = document.createElement('div');
    card.className = 'craftCard' + (ok ? ' ready' : '');
    let parts = '';
    r.parts.forEach(p => {
      const have = inventory[p] > 0;
      parts += '<span class="craftPart ' + (have ? 'have' : 'miss') + '">' + ITEM_DEFS[p].icon + ' ' + ITEM_DEFS[p].name + (have ? ' ✔' : '') + '</span>';
    });
    card.innerHTML = '<div class="craftTitle">' + def.icon + ' ' + def.name + '</div><div class="craftInfo">' + WEAPONS[r.id].info + '</div><div class="craftParts">' + parts + '</div>';
    const btn = document.createElement('div');
    btn.className = 'bigBtn craftBtn' + (ok ? '' : ' disabled');
    btn.textContent = ok ? '만들기' : '부품이 모자라요';
    if (ok) btn.addEventListener('click', () => craftWeapon(r.id));
    card.appendChild(btn);
    invCraftEl.appendChild(card);
  });
}

function renderInventory() {
  invTabEls.items.classList.toggle('selected', invTab === 'items');
  invTabEls.craft.classList.toggle('selected', invTab === 'craft');
  invTabEls.endings.classList.toggle('selected', invTab === 'endings');
  const got = ENDINGS.filter(e => endingsUnlocked[e.id]).length;
  invTabEls.endings.textContent = '엔딩 카드 ' + got + '/' + ENDINGS.length;
  invItemsPaneEl.style.display = invTab === 'items' ? 'flex' : 'none';
  invCraftEl.style.display = invTab === 'craft' ? 'flex' : 'none';
  invEndingsEl.style.display = invTab === 'endings' ? 'grid' : 'none';
  invHintEl.textContent = keyCodeLabel(keyBindings.inventory) + ' 키 또는 ESC 로 닫기';
  if (invTab === 'items') renderItemSlots(); else if (invTab === 'craft') renderCraft(); else renderEndingCards();
}
// 아이템 아이콘: 그림 파일(iconImg)이 있으면 그림으로, 없으면 이모지로 (07-inventory-interact.js 의 ITEM_DEFS)
function itemIconHtml(def, size) {
  if (def.iconImg) return '<img class="invIconImg" src="' + def.iconImg + '" style="height:' + size + 'px" alt="">';
  return def.icon;
}
function renderItemSlots() {
  // 가진 아이템을 하나하나 따로 칸에 놓음 (같은 아이템이 2개면 칸 2개)
  const units = [];
  const catOrder = ['무기', '약', '부품', '재료', '도구', '서류', '단서']; // 분류 순서대로 모아서 보여줌
  Object.keys(inventory).sort((a, b) => catOrder.indexOf(ITEM_DEFS[a].cat) - catOrder.indexOf(ITEM_DEFS[b].cat)).forEach(type => { for (let i = 0; i < inventory[type]; i++) units.push(type); });
  if (invSelected && !inventory[invSelected]) invSelected = null;
  const total = Math.max(INV_MIN_SLOTS, Math.ceil(units.length / INV_COLS) * INV_COLS);
  invGridEl.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const slot = document.createElement('div');
    slot.className = 'invSlot';
    const type = units[i];
    if (type) {
      const def = ITEM_DEFS[type];
      slot.classList.add('filled');
      slot.dataset.cat = def.cat || '';
      if (type === invSelected) slot.classList.add('selected');
      if (def.kind === 'weapon' && equippedWeapon === type) slot.classList.add('equipped');
      slot.innerHTML = '<div class="invIcon">' + itemIconHtml(def, 24) + '</div><div class="invName">' + def.name + '</div>' +
        (def.kind === 'weapon' && equippedWeapon === type ? '<div class="invTag">장착</div>' : '');
      slot.addEventListener('click', () => { invSelected = type; pillConfirm = false; renderInventory(); });
    }
    invGridEl.appendChild(slot);
  }
  renderItemDetail();
}
function renderItemDetail() {
  if (!invSelected) { invDetailEl.innerHTML = '<div class="invDetailEmpty">아이템을 눌러 보세요</div>'; return; }
  const def = ITEM_DEFS[invSelected];
  let html = '<div class="invDetailIcon">' + itemIconHtml(def, 34) + '</div><div class="invDetailName">' + def.name + '</div><div class="invDetailCat">분류: ' + (def.cat || '-') + '</div><div class="invDetailDesc">' + def.desc + '</div>';
  if (def.use === 'eat') { // 먹을 수 있는 아이템(■■): 한 번 더 눌러야 먹음 (되돌릴 수 없어서)
    html += '<div class="bigBtn invEquipBtn" id="invEatBtn">' + (pillConfirm ? '정말 먹을까? (한 번 더)' : '먹기') + '</div>';
  }
  if (def.kind === 'weapon') {
    html += '<div class="invDetailStat">' + WEAPONS[invSelected].info + '</div>';
    html += '<div class="bigBtn invEquipBtn" id="invEquipBtn">' + (equippedWeapon === invSelected ? '해제' : '장착') + '</div>';
  }
  invDetailEl.innerHTML = html;
  const eatBtn = document.getElementById('invEatBtn');
  if (eatBtn) eatBtn.addEventListener('click', () => {
    if (!pillConfirm) { pillConfirm = true; renderItemDetail(); return; }
    pillConfirm = false;
    eatPill(); // 12c-story-events.js
  });
  const btn = document.getElementById('invEquipBtn');
  if (btn) btn.addEventListener('click', () => { if (equippedWeapon === invSelected) unequipWeapon(); else equipWeapon(invSelected); });
}
function renderEndingCards() {
  invEndingsEl.innerHTML = '';
  ENDINGS.forEach(e => {
    const card = document.createElement('div');
    if (endingsUnlocked[e.id]) {
      card.className = 'endingCard got';
      card.innerHTML = '<div class="endingTitle">' + e.title + '</div><div class="endingText">' + e.text + '</div>';
    } else {
      card.className = 'endingCard empty'; // 아직 얻지 못한 카드는 빈 칸
      card.innerHTML = '<div class="endingQ">?</div>';
    }
    invEndingsEl.appendChild(card);
  });
}

invTabEls.items.addEventListener('click', () => { invTab = 'items'; renderInventory(); });
invTabEls.craft.addEventListener('click', () => { invTab = 'craft'; renderInventory(); });
invTabEls.endings.addEventListener('click', () => { invTab = 'endings'; renderInventory(); });
document.getElementById('invClose').addEventListener('click', closeInventory);
document.getElementById('invBtn').addEventListener('click', toggleInventory);
