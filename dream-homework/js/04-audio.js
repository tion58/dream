/* ============================================================
 * 파일: js/04-audio.js
 * 역할: 효과음 (소리 파일 없이 코드로 합성)
 * 들어있는 것: 볼륨 슬라이더 연결, 충전 중 바람 소리, 발사 순간의 "탁" 소리
 * 먼저 로드돼야 하는 파일: 01-core.js, 03-world-player.js
 * 주의: 브라우저 규칙상 소리는 사용자가 한 번 누르거나 키를 눌러야 켜짐
 * ============================================================ */

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
