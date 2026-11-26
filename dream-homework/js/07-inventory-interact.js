/* ============================================================
 * 파일: js/07-inventory-interact.js
 * 역할: 아이템 정의와 인벤토리 데이터, 상호작용(E키), 화면 위쪽 안내 메시지(토스트)
 * 들어있는 것: ITEM_DEFS(아이템 목록: 아이콘/이름/분류(cat)/설명), inventory(가진 개수), addItem/useItem, showToast, tryInteract, interactWith(오브젝트 종류별 동작), pickUp(줍기), collectClueDirect
 * 먼저 로드돼야 하는 파일: 01-core.js
 * 주의: 새 아이템은 ITEM_DEFS 에 한 줄 추가하면 인벤토리 화면(07c-inventory-ui.js)에 따로따로 나타남. 무기 아이템은 kind: 'weapon' 이고 이름이 11b-weapons.js 의 WEAPONS 와 같아야 함.
 *       새 상호작용 오브젝트는 interactWith 에 동작을 추가하고, 12-update.js 의 INTERACTABLE_TYPES, 13-render.js 의 그리기 분기에도 같이 추가할 것
 *       주운 아이템(pickup)은 taken 이 true 가 되어 맵에서 사라지고 다시 주울 수 없음
 * ============================================================ */
const BUILD_07 = 48; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)

let nearbyInteractable = null;

// ---- 아이템 목록 (icon: 아이콘, name: 이름, kind: item/weapon, cat: 인벤토리에서 보이는 분류, desc: 설명) ----
const ITEM_DEFS = {
  memo:         { icon: '📝', name: '단서 메모',   kind: 'item',   cat: '단서', desc: '찾아낸 단서를 적어 둔 메모. 정답은 정해진 방으로 넘어갈 때 적는다.' },
  key:          { icon: '🔑', name: '열쇠',        kind: 'item',   cat: '단서', desc: '어딘가의 문을 열 수 있을 것 같다.' },
  container:    { icon: '🧪', name: '용기',        kind: 'item',   cat: '재료', desc: '재료를 섞을 수 있는 용기. 쪽지에 적힌 첫 번째 준비물이다.' },
  iron:         { icon: '🔩', name: '철 조각',     kind: 'item',   cat: '재료', desc: '단단한 철 조각. (지금은 쓸 곳이 없다.)' },
  tornNote:     { icon: '📃', name: '찢어진 쪽지', kind: 'item',   cat: '재료', desc: '"■■ 만드는 방법"이 적힌 쪽지. 용기, 약품, 이 쪽지, ■■■를 합치라고 한다. 마지막 줄은 찢겨 있다.' },
  medicine:     { icon: '💉', name: '약품',        kind: 'item',   cat: '재료', desc: '작업실에서 찾은 약품. ■■의 재료인 것 같다.' },
  loot:         { icon: '🔸', name: '전리품',      kind: 'item',   cat: '재료', desc: '쓰러뜨린 것에서 떨어진 조각. 쪽지의 "■■■"가 이것일까.' },
  pill:         { icon: '💊', name: '■■',          kind: 'item',   cat: '약',   desc: '쪽지대로 만든 ■■. 먹으면 이곳에서 탈출할 수 있다고 한다. 하지만 왠지 불길하다.', use: 'eat' },
  escapeNote:   { icon: '📜', name: '낡은 메모',   kind: 'item',   cat: '서류', desc: '"■■를 먹으면 이곳에서 탈출할 수 있을 것이다." 아래는 번져서 읽을 수 없다.' },
  hammer:       { icon: '🔨', name: '망치',        kind: 'item',   cat: '도구', desc: '금이 간 상자를 부술 수 있다. 한 번 쓰면 부서진다.' },
  brokenHammer: { icon: '💥', name: '부서진 망치', kind: 'item',   cat: '도구', desc: '부서져서 더는 쓸 수 없다.' },
  recipeDoc:    { icon: '📄', iconImg: 'assets/icon_docs.png', name: '서류 뭉치',   kind: 'item',   cat: '서류', desc: '도구 만드는 법이 적혀 있다. 인벤토리의 "제작" 탭에서 언제든 볼 수 있다.' },
  sword:        { icon: '🗡️', name: '검',          kind: 'weapon', cat: '무기', desc: '균형 잡힌 근접 무기.' },
  shield:       { icon: '🛡️', name: '방패',        kind: 'weapon', cat: '무기', desc: 'E를 누르고 있는 동안 앞쪽에서 오는 공격을 막아 준다. 뒤나 옆에서 오는 공격은 막지 못한다.' },
  flame:        { icon: '🔥', name: '화염방사기',  kind: 'weapon', cat: '무기', desc: '공격 키를 누르는 동안 바라보는 방향으로 조금씩 나아가며 앞쪽을 태운다. 연료는 1초 남짓.' },
  // 무기를 만드는 부품 (히든방마다 하나씩. 무기 제작은 인벤토리의 "제작" 탭, 07c-inventory-ui.js)
  part1:        { icon: '⚙️', name: '부품 1',      kind: 'item',   cat: '부품', desc: '모든 무기에 들어가는 기본 부품.' },
  part2:        { icon: '🔧', name: '부품 2',      kind: 'item',   cat: '부품', desc: '무기를 만드는 데 쓰는 부품.' },
  part3:        { icon: '🔋', name: '부품 3',      kind: 'item',   cat: '부품', desc: '무기를 만드는 데 쓰는 부품.' },
  part4:        { icon: '💡', name: '부품 4',      kind: 'item',   cat: '부품', desc: '무기를 만드는 데 쓰는 부품.' },
};

// ---- 인벤토리: 종류별 개수. 화면(07c)에서는 하나하나 따로 칸으로 보여줌 ----
const inventory = {};
const interactPromptEl = document.getElementById('interactPrompt');
function addItem(type) { inventory[type] = (inventory[type] || 0) + 1; updateInventoryUI(); }
function useItem(type) {
  if (!inventory[type]) return false;
  inventory[type]--;
  if (inventory[type] <= 0) delete inventory[type];
  updateInventoryUI();
  return true;
}
// 인벤토리 화면이 열려 있으면 다시 그림
function updateInventoryUI() {
  if (typeof inventoryOpen !== 'undefined' && inventoryOpen) renderInventory();
}

// ---- 화면 위쪽에 잠깐 뜨는 안내 메시지 (아이템을 얻었을 때 등) ----
const toastMsgEl = document.getElementById('toastMsg');
let toastTimer = null, toastHideTimer = null;
function showToast(text, ms) {
  clearTimeout(toastTimer); clearTimeout(toastHideTimer);
  toastMsgEl.textContent = text;
  toastMsgEl.style.display = 'block';
  requestAnimationFrame(() => { toastMsgEl.style.opacity = '1'; });
  toastTimer = setTimeout(() => {
    toastMsgEl.style.opacity = '0';
    toastHideTimer = setTimeout(() => { toastMsgEl.style.display = 'none'; }, 350);
  }, ms || 2800);
}

// 상호작용 키(E) 또는 화면의 E 버튼
// 가까이에 상호작용할 것이 있으면 그걸 함. 없을 때는: 방패를 끼고 있으면 E 를 누르는 동안 방패를 들어 앞쪽 공격을 막음 (놓으면 내림, 05-input.js)
// E 는 공격하지 않음 (공격은 공격 키(기본 SPACE)나 화면 ⚔ 버튼)
function tryInteract() {
  if (gameState !== 'playing' || quizOpen || rampage.active) return;
  if (nearbyInteractable) { interactWith(nearbyInteractable); return; }
  startShieldHold();
}

// 아이템 줍기: 한 번 주우면 맵에서 사라지고 다시 주울 수 없음
function pickUp(en) {
  if (en.taken) return;
  en.taken = true;
  addItem(en.item);
  const def = ITEM_DEFS[en.item];
  if (def.kind === 'weapon' && !equippedWeapon) {
    equipWeapon(en.item);
    showToast(def.name + ' 획득! 장착했다 (인벤토리에서 바꿀 수 있어요)', 3600);
  } else {
    showToast(def.name + ' 획득! ' + def.icon);
  }
}
// 미니게임 없이 바로 얻는 단서
function collectClueDirect(en) {
  const alreadyHave = pendingClue && pendingClue.cp === en; // 같은 단서를 또 눌러도 메모가 또 생기지 않게
  pendingClue = { cp: en, answer: en.answer, useAtRoom: en.useAtRoom };
  if (!alreadyHave) addItem('memo');
  showToast('단서를 찾았다! → ' + en.answer, 3600);
}

// 노트/쪽지를 다 읽고 닫을 때, 그 오브젝트에 giveItem 이 있으면 아이템을 처음 한 번만 줌
function giveReadItem(en) {
  if (!en.giveItem || en.given) return;
  en.given = true;
  addItem(en.giveItem);
  showToast(ITEM_DEFS[en.giveItem].name + ' 획득! ' + ITEM_DEFS[en.giveItem].icon + ' (인벤토리에서 볼 수 있어요)', 3200);
}

// 오브젝트 종류별 상호작용 동작
function interactWith(en) {
  if (en.type === 'cluePoint') {
    if (en.solved) return;
    if (en.game) startClueGameEnter(en); // 미니게임이 정해진 단서만 미니게임을 함 (game: 'lanes' | 'circle')
    else collectClueDirect(en);          // 정해지지 않은 단서는 바로 얻음
  } else if (en.type === 'notebook') {
    // 노트 오브젝트에 pages/title 이 있으면 그 글을 읽음. giveItem 이 있으면 다 읽고 닫을 때 그 아이템을 처음 한 번만 얻음 (예: 서류 뭉치, 낡은 메모)
    openReader(en.pages || NOTEBOOK_PAGES, 'notebook', en.title, () => giveReadItem(en));
  } else if (en.type === 'tornNote') {
    openReader(TORN_NOTE_PAGES, 'paper', undefined, () => giveReadItem(en)); // 다 읽고 닫으면 찢어진 쪽지 아이템을 처음 한 번만 얻음
  } else if (en.type === 'prop') {
    showToast(PROP_TEXTS[en.text] || '…', 3000); // 장식 소품: 살펴보면 한 줄 설명만 나옴 (글은 01b-story-text.js 의 PROP_TEXTS)
  } else if (en.type === 'pickup') {
    pickUp(en);
  } else if (en.type === 'drawer') {
    // 서랍: 문제를 풀어야 열림. 풀면 망치를 얻음 (취소하고 나중에 다시 와도 됨)
    openActionQuiz('[ 서랍 잠금 해제 ]', () => {
      en.opened = true;
      addItem('hammer');
      showToast('서랍 안에서 망치를 찾았다! (금이 간 상자를 부술 수 있다)', 3600);
    }, true);
  } else if (en.type === 'breakable') {
    tryBreak(en);
  }
}
