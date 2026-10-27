/* ============================================================
 * 파일: js/07-inventory-interact.js
 * 역할: 인벤토리와 상호작용(E키)
 * 들어있는 것: nearbyInteractable, 인벤토리(addItem/useItem/updateInventoryUI), tryInteract
 * 먼저 로드돼야 하는 파일: 01-core.js
 * 주의: 새 아이템은 ITEM_ICON에 아이콘을 추가하고 addItem(종류)로 넣음. 열쇠 사용처는 아직 없음
 * ============================================================ */

let nearbyInteractable = null;

// ---- 인벤토리 (임시: 단서 메모 아이템 보관, 열쇠는 사용하면 소모되는 구조만 미리 마련) ----
const inventory = {};
const inventoryBarEl = document.getElementById('inventoryBar');
const interactPromptEl = document.getElementById('interactPrompt');
const ITEM_ICON = { memo: '📝', key: '🔑' };
function addItem(type) { inventory[type] = (inventory[type] || 0) + 1; updateInventoryUI(); }
function useItem(type) {
  if (!inventory[type]) return false;
  inventory[type]--;
  if (inventory[type] <= 0) delete inventory[type];
  updateInventoryUI();
  return true;
}
function updateInventoryUI() {
  inventoryBarEl.innerHTML = '';
  Object.keys(inventory).forEach(type => {
    const badge = document.createElement('div');
    badge.style.cssText = 'background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.4); border-radius:6px; padding:3px 7px; font-size:13px; font-family:monospace;';
    badge.textContent = `${ITEM_ICON[type] || '❔'} x${inventory[type]}`;
    inventoryBarEl.appendChild(badge);
  });
}

// 상호작용 키(E) 또는 모바일 상호작용 버튼
function tryInteract() {
  if (gameState !== 'playing') return;
  if (nearbyInteractable && !nearbyInteractable.solved) startClueGameEnter(nearbyInteractable);
}
