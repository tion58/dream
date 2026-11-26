/* ============================================================
 * 파일: js/04-audio.js
 * 역할: 효과음 (소리 파일 없이 코드로 합성)
 * 들어있는 것: 볼륨 슬라이더 연결, 충전 중 바람 소리, 발사 순간의 "탁" 소리, 대사가 나올 때 글자마다 나는 타자 소리(playTypeBlip)
 * 먼저 로드돼야 하는 파일: 01-core.js, 03-world-player.js
 * 주의: 브라우저 규칙상 소리는 사용자가 한 번 누르거나 키를 눌러야 켜짐
 * ============================================================ */

const BUILD_04 = 46; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)

// ---- 차징 효과음 (필터링된 화이트노이즈로 만든 "바람" 소리, 충전될수록 세지고 높아짐) ----
let audioCtx = null;
let noiseBuffer = null;
let masterGain = null;
let masterVolume = 0.8;
const chargeSounds = {};
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const len = audioCtx.sampleRate * 2;
    noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    masterGain = audioCtx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
document.getElementById('volumeSlider').addEventListener('input', (e) => {
  masterVolume = e.target.value / 100;
  if (masterGain) masterGain.gain.value = masterVolume;
});
function startChargeSound(name) {
  ensureAudio();
  const now = audioCtx.currentTime;
  // 바람(노이즈)만 - 충전 중엔 바람 소리만 남
  const noiseSrc = audioCtx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;
  noiseSrc.loop = true;
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(280, now);
  noiseFilter.Q.setValueAtTime(0.8, now);
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.linearRampToValueAtTime(0.28, now + 0.06);
  noiseSrc.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(masterGain);
  noiseSrc.start();
  chargeSounds[name] = { noiseSrc, noiseFilter, noiseGain, maxStopped: false };
}
function updateChargeSound(name, frac) {
  const s = chargeSounds[name];
  if (!s || !audioCtx) return;
  if (frac >= 1) {
    if (!s.maxStopped) { s.maxStopped = true; stopChargeSoundNodes(s); } // 풀차징되면 바람 소리 정지
    return;
  }
  const now = audioCtx.currentTime;
  s.noiseFilter.frequency.setValueAtTime(280 + frac * 1400, now);
  s.noiseFilter.Q.setValueAtTime(0.8 + frac * 1.5, now);
  s.noiseGain.gain.setValueAtTime(0.24 + frac * 0.18, now);
}
function stopChargeSoundNodes(s) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  s.noiseGain.gain.cancelScheduledValues(now);
  s.noiseGain.gain.setValueAtTime(s.noiseGain.gain.value, now);
  s.noiseGain.gain.linearRampToValueAtTime(0.0001, now + 0.08);
  s.noiseSrc.stop(now + 0.1);
}
function stopChargeSound(name) {
  const s = chargeSounds[name];
  if (!s || !audioCtx) return;
  if (!s.maxStopped) stopChargeSoundNodes(s);
  delete chargeSounds[name];
}
// 발사되는 순간(=차징을 뗀 순간) 나는 사뿐한 "탁" 착지음
function playReleaseThud() {
  ensureAudio();
  const now = audioCtx.currentTime;
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(700, now);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  src.connect(filter); filter.connect(gain); gain.connect(masterGain);
  src.start(now);
  src.stop(now + 0.1);
}

// 대사 글자가 나올 때 나는 부드러운 "톡" 소리 (02-story-settings.js 의 타자 효과가 부름)
// 소리를 더 작게/크게, 더 낮게/높게, 덜 자주/자주 하고 싶으면 아래 세 숫자만 고치면 됨
const TYPE_BLIP_VOLUME = 0.015; // 타자 소리 크기 (0 이면 소리 없음. 예전 0.05 는 너무 튀었음)
const TYPE_BLIP_PITCH = 300;   // 타자 소리 높이 (클수록 높은 소리)
const TYPE_BLIP_EVERY = 2;     // 글자 몇 개마다 한 번 소리를 낼지 (1 이면 글자마다, 2 이면 두 글자에 한 번)
let typeBlipCount = 0;
function playTypeBlip() {
  if (TYPE_BLIP_VOLUME <= 0) return;
  if (typeBlipCount++ % TYPE_BLIP_EVERY !== 0) return;
  ensureAudio();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = 'sine'; // 부드러운 소리
  osc.frequency.setValueAtTime(TYPE_BLIP_PITCH + Math.random() * 40, now);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(TYPE_BLIP_VOLUME, now + 0.006); // 시작이 "딱" 하지 않게 살짝 올라감
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  osc.connect(gain); gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.06);
}
