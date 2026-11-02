// Small sound effects for the ledger, made on the fly with the Web Audio API:
// a rubber stamp's thump, a pen scratching paper, a page turning. No audio
// files to download, and they only play after a tap, so phones allow them.

import { store } from './state.js';

let context = null;

function audio() {
  if (store.db.sound === false) return null;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  context ||= new Context();
  if (context.state === 'suspended') context.resume();
  return context;
}

function noise(ac, seconds) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  return source;
}

function envelope(ac, peak, attack, release) {
  const gain = ac.createGain();
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
  gain.connect(ac.destination);
  return gain;
}

export const sound = {
  // A rubber stamp hitting paper on a wooden desk.
  stamp() {
    const ac = audio();
    if (!ac) return;
    const thud = ac.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(140, ac.currentTime);
    thud.frequency.exponentialRampToValueAtTime(45, ac.currentTime + 0.16);
    thud.connect(envelope(ac, 0.55, 0.004, 0.2));
    thud.start();
    thud.stop(ac.currentTime + 0.25);
    const slap = noise(ac, 0.09);
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    slap.connect(filter).connect(envelope(ac, 0.35, 0.002, 0.08));
    slap.start();
  },

  // A nib scratching a few quick strokes.
  pen() {
    const ac = audio();
    if (!ac) return;
    const scratch = noise(ac, 0.42);
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3800;
    filter.Q.value = 1.2;
    const gain = ac.createGain();
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    for (let stroke = 0; stroke < 4; stroke += 1) {
      const start = now + stroke * 0.1;
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.085);
    }
    scratch.connect(filter).connect(gain).connect(ac.destination);
    scratch.start();
  },

  // A page flicking over.
  page() {
    const ac = audio();
    if (!ac) return;
    const swish = noise(ac, 0.22);
    const filter = ac.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(600, ac.currentTime);
    filter.frequency.exponentialRampToValueAtTime(4200, ac.currentTime + 0.18);
    swish.connect(filter).connect(envelope(ac, 0.16, 0.03, 0.17));
    swish.start();
  },
};
