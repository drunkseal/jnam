// JNAM Reactive Controller with Real-Time Chromatic Tuner & SSE
const API = {
  status: '/api/status',
  models: '/api/models',
  irs: '/api/irs',
  devices: '/api/devices',
  setModel: '/api/model',
  setIr: '/api/ir',
  setCab: '/api/cab',
  setRouting: '/api/routing',
  setBuffer: '/api/buffer',
  setFx: '/api/fx',
  setGain: '/api/gain',
  setQuality: '/api/quality',
  tunerStream: '/api/tuner/stream',
  tunerStop: '/api/tuner/stop',
  service: '/api/service'
};

let currentStatus = null;
let isUserDraggingGain = false;
let tunerEventSource = null;

// DOM Elements
const headerMetaStats = document.getElementById('header-meta-stats');
const txtJack = document.getElementById('txt-jack');
const ledJack = document.getElementById('led-jack');
const txtRig = document.getElementById('txt-rig');
const ledRig = document.getElementById('led-rig');
const txtCpu = document.getElementById('txt-cpu');
const btnRestart = document.getElementById('btn-restart');

const nodeIn = document.getElementById('node-in');
const wireDrive = document.getElementById('wire-drive');
const nodeDrive = document.getElementById('node-drive');
const chainDriveState = document.getElementById('chain-drive-state');

const wireNam = document.getElementById('wire-nam');
const nodeNam = document.getElementById('node-nam');
const chainNamName = document.getElementById('chain-nam-name');

const wireCab = document.getElementById('wire-cab');
const nodeCab = document.getElementById('node-cab');
const chainCabState = document.getElementById('chain-cab-state');

const wireDelay = document.getElementById('wire-delay');
const nodeDelay = document.getElementById('node-delay');
const chainDelayState = document.getElementById('chain-delay-state');

const wireReverb = document.getElementById('wire-reverb');
const nodeReverb = document.getElementById('node-reverb');
const chainReverbState = document.getElementById('chain-reverb-state');

const wireOut = document.getElementById('wire-out');
const nodeOut = document.getElementById('node-out');
const chainInLabel = document.getElementById('chain-in-label');
const chainOutLabel = document.getElementById('chain-out-label');

// Pedalboard Badges & Cards
const badgeFxDrive = document.getElementById('badge-fx-drive');
const badgeFxDelay = document.getElementById('badge-fx-delay');
const badgeFxReverb = document.getElementById('badge-fx-reverb');

const stompDriveCard = document.getElementById('stomp-drive-card');
const ledFxDrive = document.getElementById('led-fx-drive');
const btnToggleDrive = document.getElementById('btn-toggle-drive');
const sliderDriveDrive = document.getElementById('slider-drive-drive');
const valDriveDrive = document.getElementById('val-drive-drive');
const sliderDriveTone = document.getElementById('slider-drive-tone');
const valDriveTone = document.getElementById('val-drive-tone');
const sliderDriveLevel = document.getElementById('slider-drive-level');
const valDriveLevel = document.getElementById('val-drive-level');

const stompDelayCard = document.getElementById('stomp-delay-card');
const ledFxDelay = document.getElementById('led-fx-delay');
const btnToggleDelay = document.getElementById('btn-toggle-delay');
const sliderDelayTime = document.getElementById('slider-delay-time');
const valDelayTime = document.getElementById('val-delay-time');
const sliderDelayLfo = document.getElementById('slider-delay-lfo');
const valDelayLfo = document.getElementById('val-delay-lfo');
const sliderDelayLevel = document.getElementById('slider-delay-level');
const valDelayMix = document.getElementById('val-delay-level') || document.getElementById('val-delay-mix');

const stompReverbCard = document.getElementById('stomp-reverb-card');
const ledFxReverb = document.getElementById('led-fx-reverb');
const btnToggleReverb = document.getElementById('btn-toggle-reverb');
const sliderReverbRoom = document.getElementById('slider-reverb-room');
const valReverbRoom = document.getElementById('val-reverb-room');
const sliderReverbDamp = document.getElementById('slider-reverb-damp');
const valReverbDamp = document.getElementById('val-reverb-damp');
const sliderReverbMix = document.getElementById('slider-reverb-mix');
const valReverbMix = document.getElementById('val-reverb-mix');

let isUserDraggingFx = false;

const displayModelName = document.getElementById('display-model-name');
const displayModelMeta = document.getElementById('display-model-meta');
const modelBadge = document.getElementById('model-badge');
const selectModel = document.getElementById('select-model');

const cabBadge = document.getElementById('cab-badge');
const selectIr = document.getElementById('select-ir');
const cabInfoBanner = document.getElementById('cab-info-banner');
const cabModeButtons = document.querySelectorAll('.cab-mode-selector .mode-btn');

// Hardware & Routing Elements
const selectAudioDevice = document.getElementById('select-audio-device');
const deviceBadge = document.getElementById('device-badge');
const inChanButtons = document.querySelectorAll('#in-channel-group .chan-btn');
const outChanButtons = document.querySelectorAll('#out-channel-group .chan-btn');
const bufferButtons = document.querySelectorAll('#buffer-size-group .chan-btn');
const footerHardwareInfo = document.getElementById('footer-hardware-info');

// DSP Controls
const qualityButtons = document.querySelectorAll('.quality-btn');
const sliderInGain = document.getElementById('slider-in-gain');
const valInGain = document.getElementById('val-in-gain');
const sliderOutGain = document.getElementById('slider-out-gain');
const valOutGain = document.getElementById('val-out-gain');

// Tuner Elements
const btnTunerOpen = document.getElementById('btn-tuner-open');
const btnTunerClose = document.getElementById('btn-tuner-close');
const tunerOverlay = document.getElementById('tuner-overlay');
const tunerNote = document.getElementById('tuner-note');
const tunerOctave = document.getElementById('tuner-octave');
const tunerFreq = document.getElementById('tuner-freq');
const tunerNeedle = document.getElementById('tuner-needle');
const tunerCents = document.getElementById('tuner-cents');
const tunerStatusText = document.getElementById('tuner-status-text');

// Fetch Status
async function updateStatus() {
  if (tunerEventSource) return; // Don't poll while in tuner mode
  try {
    const res = await fetch(API.status);
    if (!res.ok) return;
    const data = await res.json();
    currentStatus = data;
    renderStatus(data);
  } catch (err) {
    console.error('Status fetch failed', err);
  }
}

function renderStatus(data) {
  // Top bar JACK
  if (data.jack_running) {
    txtJack.textContent = 'ONLINE';
    ledJack.className = 'led green';
  } else {
    txtJack.textContent = 'STOPPED';
    ledJack.className = 'led red';
  }

  // Top bar Rig
  const isRunning = !!data.rig_running;
  if (isRunning) {
    txtRig.textContent = 'RUNNING';
    ledRig.className = 'led green';
  } else {
    txtRig.textContent = 'INACTIVE';
    ledRig.className = 'led red';
  }

  // Signal Routing Wires & Static Nodes
  const allWires = [wireDrive, wireNam, wireCab, wireDelay, wireReverb, wireOut];
  allWires.forEach(w => {
    if (w) w.classList.toggle('active', isRunning);
  });
  if (nodeIn) nodeIn.classList.toggle('active', isRunning);
  if (nodeNam) nodeNam.classList.toggle('active', isRunning);
  if (nodeOut) nodeOut.classList.toggle('active', isRunning);

  // CPU
  const cpuTotal = (data.telemetry.jalv_cpu + data.telemetry.jackd_cpu).toFixed(1);
  txtCpu.textContent = `${cpuTotal}%`;

  // Model display
  const m = data.current_model || {};
  if (m.filename) {
    displayModelName.textContent = m.filename.replace(/\.nam$/i, '');
    displayModelMeta.textContent = `${m.folder} • Gear: ${(m.gear_type || 'amp').toUpperCase()}`;
    if (chainNamName) chainNamName.textContent = m.filename.slice(0, 12) + '...';
    if (m.is_full_rig) {
      modelBadge.textContent = 'FULL RIG (CAB BAKED-IN)';
      modelBadge.className = 'badge';
    } else {
      modelBadge.textContent = 'DI CAPTURE (AMP ONLY)';
      modelBadge.className = 'badge bypassed';
    }
  } else {
    displayModelName.textContent = 'None Selected';
    displayModelMeta.textContent = 'Please choose a model';
  }

  // Cab & Bypass display
  const cab = data.cab || {};
  cabModeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === cab.mode);
  });

  if (cab.effective_active) {
    cabBadge.textContent = 'ACTIVE';
    cabBadge.className = 'badge active';
    if (chainCabState) chainCabState.textContent = 'CONVOLVER';
    if (nodeCab) {
      nodeCab.classList.remove('bypassed');
      nodeCab.classList.toggle('active', isRunning);
    }
    cabInfoBanner.style.display = 'none';
  } else {
    cabBadge.textContent = 'BYPASSED';
    cabBadge.className = 'badge bypassed';
    if (chainCabState) chainCabState.textContent = 'BYPASS';
    if (nodeCab) {
      nodeCab.classList.add('bypassed');
      nodeCab.classList.remove('active');
    }
    cabInfoBanner.style.display = 'block';
    if (m.is_full_rig) {
      cabInfoBanner.textContent = 'Cab IR bypassed because active model already contains a physical cabinet & microphone capture.';
    } else {
      cabInfoBanner.textContent = 'Cab IR manually bypassed. Guitar signal routes directly to hardware playback.';
    }
  }

  // Audio Hardware & Routing
  if (data.audio_hardware) {
    const hw = data.audio_hardware;

    inChanButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.chan === hw.input_channel);
    });
    if (hw.input_channel === 'both') {
      chainInLabel.textContent = 'In 1 + 2';
    } else if (hw.input_channel === '1') {
      chainInLabel.textContent = 'In 1 (Mic)';
    } else {
      chainInLabel.textContent = 'In 2 (Guitar)';
    }

    outChanButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.chan === hw.output_channel);
    });
    if (hw.output_channel === 'stereo') {
      chainOutLabel.textContent = 'Stereo';
    } else if (hw.output_channel === '1') {
      chainOutLabel.textContent = 'Left (1)';
    } else {
      chainOutLabel.textContent = 'Right (2)';
    }

    let activeCardName = 'Auto-Detect';
    if (hw.available_cards) {
      hw.available_cards.forEach(card => {
        if (card.is_active) {
          activeCardName = card.id || card.name;
        }
      });
    }
    deviceBadge.textContent = activeCardName.toUpperCase();

    const sRate = hw.sample_rate ? (hw.sample_rate / 1000).toFixed(0) : '48';
    const bSize = hw.buffer_size || 256;
    const latMs = hw.latency_ms !== undefined ? hw.latency_ms : ((bSize / 48000) * 1000).toFixed(2);

    if (headerMetaStats) {
      headerMetaStats.textContent = `${sRate} kHz • ${bSize} spl • ${latMs} ms`;
    }
    footerHardwareInfo.textContent = `${activeCardName} • JACK2 ${sRate}kHz / ${bSize} Buffer (${latMs} ms)`;

    // Highlight active buffer button
    bufferButtons.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.buf) === hw.buffer_size);
    });
  }

  // Quality button
  const qVal = (data.dsp && data.dsp.quality_scale !== undefined) ? data.dsp.quality_scale : 1.0;
  qualityButtons.forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.quality) === qVal);
  });

  // Gains
  if (!isUserDraggingGain && data.dsp) {
    if (data.dsp.input_level !== undefined) {
      sliderInGain.value = data.dsp.input_level;
      valInGain.textContent = formatGain(data.dsp.input_level);
      updateKnobVisual(sliderInGain);
    }
    if (data.dsp.output_level !== undefined) {
      sliderOutGain.value = data.dsp.output_level;
      valOutGain.textContent = formatGain(data.dsp.output_level);
      updateKnobVisual(sliderOutGain);
    }
  }

  // Render Pedalboard FX
  if (data.fx) {
    const fx = data.fx;
    const d = fx.drive || {};
    const l = fx.delay || {};
    const r = fx.reverb || {};

    // Drive Stompbox & Node
    if (stompDriveCard) stompDriveCard.classList.toggle('active', !!d.enabled);
    if (ledFxDrive) ledFxDrive.classList.toggle('active', !!d.enabled);
    if (btnToggleDrive) {
      btnToggleDrive.classList.toggle('active', !!d.enabled);
      btnToggleDrive.textContent = d.enabled ? 'ENGAGED' : 'STOMP';
    }
    if (badgeFxDrive) {
      badgeFxDrive.textContent = d.enabled ? 'DRIVE: ACTIVE' : 'DRIVE: OFF';
      badgeFxDrive.className = d.enabled ? 'badge active' : 'badge';
    }
    if (chainDriveState) chainDriveState.textContent = d.enabled ? 'TS-9' : 'BYPASS';
    if (nodeDrive) {
      nodeDrive.classList.toggle('active', isRunning && !!d.enabled);
      nodeDrive.classList.toggle('bypassed', !d.enabled);
    }

    // Delay Stompbox & Node
    if (stompDelayCard) stompDelayCard.classList.toggle('active', !!l.enabled);
    if (ledFxDelay) ledFxDelay.classList.toggle('active', !!l.enabled);
    if (btnToggleDelay) {
      btnToggleDelay.classList.toggle('active', !!l.enabled);
      btnToggleDelay.textContent = l.enabled ? 'ENGAGED' : 'STOMP';
    }
    if (badgeFxDelay) {
      badgeFxDelay.textContent = l.enabled ? 'DELAY: ACTIVE' : 'DELAY: OFF';
      badgeFxDelay.className = l.enabled ? 'badge active' : 'badge';
    }
    if (chainDelayState) chainDelayState.textContent = l.enabled ? 'DELAY' : 'BYPASS';
    if (nodeDelay) {
      nodeDelay.classList.toggle('active', isRunning && !!l.enabled);
      nodeDelay.classList.toggle('bypassed', !l.enabled);
    }

    // Reverb Stompbox & Node
    if (stompReverbCard) stompReverbCard.classList.toggle('active', !!r.enabled);
    if (ledFxReverb) ledFxReverb.classList.toggle('active', !!r.enabled);
    if (btnToggleReverb) {
      btnToggleReverb.classList.toggle('active', !!r.enabled);
      btnToggleReverb.textContent = r.enabled ? 'ENGAGED' : 'STOMP';
    }
    if (badgeFxReverb) {
      badgeFxReverb.textContent = r.enabled ? 'REVERB: ACTIVE' : 'REVERB: OFF';
      badgeFxReverb.className = r.enabled ? 'badge active' : 'badge';
    }
    if (chainReverbState) chainReverbState.textContent = r.enabled ? 'REVERB' : 'BYPASS';
    if (nodeReverb) {
      nodeReverb.classList.toggle('active', isRunning && !!r.enabled);
      nodeReverb.classList.toggle('bypassed', !r.enabled);
    }

    // Sliders & Readouts (only update when user is not dragging)
    if (!isUserDraggingFx) {
      if (d.drive !== undefined && sliderDriveDrive) {
        sliderDriveDrive.value = d.drive;
        if (valDriveDrive) valDriveDrive.textContent = `${Math.round(d.drive * 100)}%`;
        updateKnobVisual(sliderDriveDrive);
      }
      if (d.tone !== undefined && sliderDriveTone) {
        sliderDriveTone.value = d.tone;
        if (valDriveTone) valDriveTone.textContent = `${Math.round(d.tone)} Hz`;
        updateKnobVisual(sliderDriveTone);
      }
      if (d.level !== undefined && sliderDriveLevel) {
        sliderDriveLevel.value = d.level;
        if (valDriveLevel) valDriveLevel.textContent = `${parseFloat(d.level).toFixed(1)} dB`;
        updateKnobVisual(sliderDriveLevel);
      }

      if (l.time !== undefined && sliderDelayTime) {
        sliderDelayTime.value = l.time;
        if (valDelayTime) valDelayTime.textContent = `${Math.round(l.time)} ms`;
        updateKnobVisual(sliderDelayTime);
      }
      if (l.level !== undefined && sliderDelayLevel) {
        sliderDelayLevel.value = l.level;
        if (valDelayMix) valDelayMix.textContent = `${parseFloat(l.level).toFixed(1)} dB`;
        updateKnobVisual(sliderDelayLevel);
      }
      if (l.lfo !== undefined && sliderDelayLfo) {
        sliderDelayLfo.value = l.lfo;
        if (valDelayLfo) valDelayLfo.textContent = `${Math.round(l.lfo * 10)}%`;
        updateKnobVisual(sliderDelayLfo);
      }

      if (r.roomsize !== undefined && sliderReverbRoom) {
        sliderReverbRoom.value = r.roomsize;
        if (valReverbRoom) valReverbRoom.textContent = `${Math.round(r.roomsize * 100)}%`;
        updateKnobVisual(sliderReverbRoom);
      }
      if (r.damp !== undefined && sliderReverbDamp) {
        sliderReverbDamp.value = r.damp;
        if (valReverbDamp) valReverbDamp.textContent = `${Math.round(r.damp * 100)}%`;
        updateKnobVisual(sliderReverbDamp);
      }
      if (r.dry_wet !== undefined && sliderReverbMix) {
        sliderReverbMix.value = r.dry_wet;
        if (valReverbMix) valReverbMix.textContent = `${Math.round(r.dry_wet)}%`;
        updateKnobVisual(sliderReverbMix);
      }
    }
  }

  // Always sync all knob visuals
  syncAllKnobsVisuals();
}

function formatGain(val) {
  const num = parseFloat(val);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(1)} dB`;
}

// Fetch Models
async function loadModels() {
  try {
    const res = await fetch(API.models);
    const data = await res.json();
    selectModel.innerHTML = '';
    data.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.path;
      const tag = m.is_full_rig ? '[Full Rig]' : '[DI]';
      opt.textContent = `${tag} ${m.folder} / ${m.filename}`;
      if (m.is_active) opt.selected = true;
      selectModel.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed loading models', err);
  }
}

// Fetch IRs
async function loadIrs() {
  try {
    const res = await fetch(API.irs);
    const data = await res.json();
    selectIr.innerHTML = '';
    data.irs.forEach(ir => {
      const opt = document.createElement('option');
      opt.value = ir.path;
      opt.textContent = `${ir.folder} / ${ir.filename}`;
      if (ir.is_active) opt.selected = true;
      selectIr.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed loading IRs', err);
  }
}

// Fetch Audio Devices
async function loadDevices() {
  try {
    const res = await fetch(API.devices);
    const data = await res.json();
    selectAudioDevice.innerHTML = '<option value="auto">Auto-Detect USB Interface</option>';
    data.cards.forEach(card => {
      const opt = document.createElement('option');
      opt.value = card.hw;
      opt.textContent = `[${card.hw}] ${card.name} (${card.desc})`;
      if (card.hw === data.configured || (data.configured === 'auto' && card.is_active)) {
        opt.selected = true;
      }
      selectAudioDevice.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed loading devices', err);
  }
}

// ============================================================================
// Real-Time Chromatic Tuner Logic (SSE Stream)
// ============================================================================
function openTuner() {
  tunerOverlay.classList.remove('hidden');
  resetTunerDisplay();

  if (tunerEventSource) {
    tunerEventSource.close();
  }

  tunerEventSource = new EventSource(API.tunerStream);

  tunerEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      renderTunerData(data);
    } catch (e) {
      console.error('Tuner parse error', e);
    }
  };

  tunerEventSource.onerror = (err) => {
    console.warn('Tuner SSE disconnected', err);
  };
}

function closeTuner() {
  if (tunerEventSource) {
    tunerEventSource.close();
    tunerEventSource = null;
  }
  tunerOverlay.classList.add('hidden');
  resetTunerDisplay();

  // Inform backend to restore audio and unmute
  fetch(API.tunerStop, { method: 'POST' }).then(() => {
    setTimeout(updateStatus, 300);
  });
}

function resetTunerDisplay() {
  tunerNote.textContent = '--';
  tunerNote.className = 'tuner-note-name';
  tunerOctave.textContent = '';
  tunerFreq.textContent = 'Pluck a string...';
  tunerNeedle.style.left = '50%';
  tunerNeedle.className = 'tuner-meter-needle';
  tunerCents.textContent = '0.0 Cents';
  tunerStatusText.textContent = 'LISTENING FOR GUITAR...';
  tunerStatusText.className = 'tuner-status-text';
}

function renderTunerData(data) {
  if (data.active) {
    tunerNote.textContent = data.note;
    tunerOctave.textContent = data.octave !== undefined ? data.octave : '';
    tunerFreq.textContent = `${data.freq.toFixed(2)} Hz`;

    const cents = data.cents;
    const sign = cents > 0 ? '+' : '';
    tunerCents.textContent = `${sign}${cents.toFixed(1)} Cents`;

    // Map -50..+50 cents to 4%..96% needle position
    const clampedCents = Math.max(-50, Math.min(50, cents));
    const needlePct = 50 + (clampedCents / 50) * 44;
    tunerNeedle.style.left = `${needlePct.toFixed(1)}%`;

    if (data.in_tune) {
      tunerNote.className = 'tuner-note-name in-tune';
      tunerNeedle.className = 'tuner-meter-needle in-tune';
      tunerStatusText.textContent = '● IN TUNE ●';
      tunerStatusText.className = 'tuner-status-text in-tune';
    } else {
      tunerNote.className = 'tuner-note-name';
      tunerNeedle.className = 'tuner-meter-needle';
      if (cents < -3.0) {
        tunerStatusText.textContent = `◄ TUNE UP (${Math.abs(cents).toFixed(1)}c flat)`;
      } else {
        tunerStatusText.textContent = `► TUNE DOWN (+${cents.toFixed(1)}c sharp)`;
      }
      tunerStatusText.className = 'tuner-status-text';
    }
  } else {
    // String stopped or silence
    tunerNote.className = 'tuner-note-name';
    tunerNeedle.className = 'tuner-meter-needle';
    tunerStatusText.className = 'tuner-status-text';
    tunerStatusText.textContent = 'LISTENING FOR GUITAR...';
    if (tunerNote.textContent === '--') {
      tunerFreq.textContent = 'Pluck a string...';
    }
  }
}

// Event Listeners
btnTunerOpen.addEventListener('click', openTuner);
btnTunerClose.addEventListener('click', closeTuner);

selectModel.addEventListener('change', async (e) => {
  displayModelName.textContent = 'Switching model...';
  try {
    await fetch(API.setModel, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: e.target.value })
    });
    setTimeout(updateStatus, 800);
  } catch (err) {
    console.error(err);
  }
});

selectIr.addEventListener('change', async (e) => {
  try {
    await fetch(API.setIr, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: e.target.value })
    });
    setTimeout(updateStatus, 800);
  } catch (err) {
    console.error(err);
  }
});

selectAudioDevice.addEventListener('change', async (e) => {
  deviceBadge.textContent = 'SWITCHING...';
  try {
    await fetch(API.setRouting, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: e.target.value })
    });
    setTimeout(updateStatus, 1500);
  } catch (err) {
    console.error(err);
  }
});

inChanButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const chan = btn.dataset.chan;
    inChanButtons.forEach(b => b.classList.toggle('active', b === btn));
    try {
      await fetch(API.setRouting, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_channel: chan })
      });
      setTimeout(updateStatus, 200);
    } catch (err) {
      console.error(err);
    }
  });
});

outChanButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const chan = btn.dataset.chan;
    outChanButtons.forEach(b => b.classList.toggle('active', b === btn));
    try {
      await fetch(API.setRouting, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output_channel: chan })
      });
      setTimeout(updateStatus, 200);
    } catch (err) {
      console.error(err);
    }
  });
});

bufferButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const bufSize = parseInt(btn.dataset.buf);
    bufferButtons.forEach(b => b.classList.toggle('active', b === btn));
    try {
      await fetch(API.setBuffer, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buffer_size: bufSize })
      });
      setTimeout(updateStatus, 300);
    } catch (err) {
      console.error(err);
    }
  });
});

cabModeButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const mode = btn.dataset.mode;
    try {
      await fetch(API.setCab, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      setTimeout(updateStatus, 800);
    } catch (err) {
      console.error(err);
    }
  });
});

qualityButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const val = parseFloat(btn.dataset.quality);
    try {
      await fetch(API.setQuality, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: val })
      });
      qualityButtons.forEach(b => b.classList.toggle('active', b === btn));
    } catch (err) {
      console.error(err);
    }
  });
});

let inGainDebounce = null;
sliderInGain.addEventListener('input', (e) => {
  isUserDraggingGain = true;
  const val = parseFloat(e.target.value);
  valInGain.textContent = formatGain(val);
  clearTimeout(inGainDebounce);
  inGainDebounce = setTimeout(() => {
    fetch(API.setGain, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'in', value: val })
    });
    isUserDraggingGain = false;
  }, 100);
});

let outGainDebounce = null;
sliderOutGain.addEventListener('input', (e) => {
  isUserDraggingGain = true;
  const val = parseFloat(e.target.value);
  valOutGain.textContent = formatGain(val);
  clearTimeout(outGainDebounce);
  outGainDebounce = setTimeout(() => {
    fetch(API.setGain, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'out', value: val })
    });
    isUserDraggingGain = false;
  }, 100);
});

window.setGain = async function(channel, val) {
  if (channel === 'in') {
    sliderInGain.value = val;
    valInGain.textContent = formatGain(val);
    updateKnobVisual(sliderInGain);
  } else {
    sliderOutGain.value = val;
    valOutGain.textContent = formatGain(val);
    updateKnobVisual(sliderOutGain);
  }
  await fetch(API.setGain, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, value: val })
  });
};

sliderInGain.addEventListener('change', () => { isUserDraggingGain = false; });
sliderOutGain.addEventListener('change', () => { isUserDraggingGain = false; });

// Pedalboard FX Stomp Buttons
async function toggleFxSlot(slot, btnElement, cardElement, ledElement) {
  const isCurrentlyOn = currentStatus && currentStatus.fx && currentStatus.fx[slot] && currentStatus.fx[slot].enabled;
  const nextState = !isCurrentlyOn;
  
  if (cardElement) cardElement.classList.toggle('active', nextState);
  if (ledElement) ledElement.classList.toggle('active', nextState);
  if (btnElement) {
    btnElement.classList.toggle('active', nextState);
    btnElement.textContent = nextState ? 'ENGAGED' : 'STOMP';
  }

  // Optimistically update routing matrix node
  let node = null;
  let stateLabel = null;
  let labelText = 'ACTIVE';
  if (slot === 'drive') { node = nodeDrive; stateLabel = chainDriveState; labelText = 'TS-9'; }
  else if (slot === 'delay') { node = nodeDelay; stateLabel = chainDelayState; labelText = 'DELAY'; }
  else if (slot === 'reverb') { node = nodeReverb; stateLabel = chainReverbState; labelText = 'REVERB'; }

  if (node) {
    node.classList.toggle('active', nextState);
    node.classList.toggle('bypassed', !nextState);
  }
  if (stateLabel) {
    stateLabel.textContent = nextState ? labelText : 'BYPASS';
  }

  try {
    const res = await fetch(API.setFx, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, enabled: nextState })
    });
    if (res.ok) {
      setTimeout(updateStatus, 150);
    }
  } catch (err) {
    console.error('Failed to toggle FX slot:', slot, err);
  }
}

if (btnToggleDrive) btnToggleDrive.addEventListener('click', () => toggleFxSlot('drive', btnToggleDrive, stompDriveCard, ledFxDrive));
if (btnToggleDelay) btnToggleDelay.addEventListener('click', () => toggleFxSlot('delay', btnToggleDelay, stompDelayCard, ledFxDelay));
if (btnToggleReverb) btnToggleReverb.addEventListener('click', () => toggleFxSlot('reverb', btnToggleReverb, stompReverbCard, ledFxReverb));

// Matrix patchbay interactive click triggers
if (nodeDrive) {
  nodeDrive.style.cursor = 'pointer';
  nodeDrive.title = 'Click to Toggle TS-9 Overdrive';
  nodeDrive.addEventListener('click', () => toggleFxSlot('drive', btnToggleDrive, stompDriveCard, ledFxDrive));
}
if (nodeDelay) {
  nodeDelay.style.cursor = 'pointer';
  nodeDelay.title = 'Click to Toggle Stereo Delay';
  nodeDelay.addEventListener('click', () => toggleFxSlot('delay', btnToggleDelay, stompDelayCard, ledFxDelay));
}
if (nodeReverb) {
  nodeReverb.style.cursor = 'pointer';
  nodeReverb.title = 'Click to Toggle Studio Reverb';
  nodeReverb.addEventListener('click', () => toggleFxSlot('reverb', btnToggleReverb, stompReverbCard, ledFxReverb));
}
if (nodeCab) {
  nodeCab.style.cursor = 'pointer';
  nodeCab.title = 'Click to Cycle Cab Mode';
  nodeCab.addEventListener('click', async () => {
    const curMode = (currentStatus && currentStatus.cab && currentStatus.cab.mode) || 'auto';
    const nextMode = curMode === 'auto' ? 'bypass' : (curMode === 'bypass' ? 'force' : 'auto');
    try {
      await fetch(API.setCab, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nextMode })
      });
      setTimeout(updateStatus, 300);
    } catch (err) {
      console.error(err);
    }
  });
}

// Boutique Rotary Knob Controllers for Stompboxes
function updateKnobVisual(input) {
  if (!input) return;
  const unit = input.closest('.pedal-knob-unit');
  if (!unit) return;
  const cap = unit.querySelector('.knob-cap');
  const arc = unit.querySelector('.knob-track-val');
  if (!cap || !arc) return;

  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const val = parseFloat(input.value);
  if (isNaN(min) || isNaN(max) || isNaN(val) || max === min) return;
  const pct = Math.max(0, Math.min(1, (val - min) / (max - min)));
  const angle = -135 + (pct * 270);
  cap.style.transform = `rotate(${angle}deg)`;
  const totalArc = 108.38; // 270 deg of radius 23
  arc.style.strokeDashoffset = (totalArc * (1 - pct)).toFixed(2);
}

function syncAllKnobsVisuals() {
  document.querySelectorAll('.pedal-knob-unit input').forEach(input => {
    updateKnobVisual(input);
  });
}

function initRotaryKnobs() {
  document.querySelectorAll('.pedal-knob-unit').forEach(unit => {
    const input = unit.querySelector('input[type="range"]');
    const knob = unit.querySelector('.knob-wrapper');
    if (!input || !knob) return;

    updateKnobVisual(input);

    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const step = parseFloat(input.step) || ((max - min) / 100);

    let isDragging = false;
    let startY = 0;
    let startVal = 0;

    knob.addEventListener('pointerdown', (e) => {
      isDragging = true;
      isUserDraggingFx = true;
      startY = e.clientY;
      startVal = parseFloat(input.value);
      knob.setPointerCapture(e.pointerId);
      knob.classList.add('dragging');
      e.preventDefault();
    });

    knob.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const deltaY = startY - e.clientY; // Up = positive
      const range = max - min;
      const sensitivity = e.shiftKey ? 360 : 120; // Shift for fine-tuning
      const valDelta = (deltaY / sensitivity) * range;
      let newVal = Math.max(min, Math.min(max, startVal + valDelta));
      newVal = Math.round(newVal / step) * step;

      input.value = newVal;
      updateKnobVisual(input);
      input.dispatchEvent(new Event('input'));
    });

    const endDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      isUserDraggingFx = false;
      isUserDraggingGain = false;
      knob.classList.remove('dragging');
      try { knob.releasePointerCapture(e.pointerId); } catch(err) {}
      input.dispatchEvent(new Event('change'));
    };

    knob.addEventListener('pointerup', endDrag);
    knob.addEventListener('pointercancel', endDrag);

    // Mouse Wheel support
    knob.addEventListener('wheel', (e) => {
      e.preventDefault();
      const range = max - min;
      const dir = e.deltaY < 0 ? 1 : -1;
      const mult = e.shiftKey ? 1 : (range > 10 ? 5 : 2);
      let val = parseFloat(input.value) + (dir * step * mult);
      val = Math.max(min, Math.min(max, Math.round(val / step) * step));
      input.value = val;
      updateKnobVisual(input);
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
    }, { passive: false });
  });
}

function attachFxSlider(slider, readout, slot, paramKey, formatFn) {
  if (!slider) return;
  let debounceTimer = null;
  slider.addEventListener('input', (e) => {
    isUserDraggingFx = true;
    const val = parseFloat(e.target.value);
    if (readout) readout.textContent = formatFn(val);
    updateKnobVisual(slider);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetch(API.setFx, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, [paramKey]: val })
      }).catch(err => console.error(err));
    }, 50);
  });
  slider.addEventListener('change', () => {
    isUserDraggingFx = false;
    updateKnobVisual(slider);
  });
}

attachFxSlider(sliderDriveDrive, valDriveDrive, 'drive', 'drive', v => `${Math.round(v * 100)}%`);
attachFxSlider(sliderDriveTone, valDriveTone, 'drive', 'tone', v => `${Math.round(v)} Hz`);
attachFxSlider(sliderDriveLevel, valDriveLevel, 'drive', 'level', v => `${v.toFixed(1)} dB`);

attachFxSlider(sliderDelayTime, valDelayTime, 'delay', 'time', v => `${Math.round(v)} ms`);
attachFxSlider(sliderDelayLevel, valDelayMix, 'delay', 'level', v => `${v.toFixed(1)} dB`);
attachFxSlider(sliderDelayLfo, valDelayLfo, 'delay', 'lfo', v => `${Math.round(v * 10)}%`);

attachFxSlider(sliderReverbRoom, valReverbRoom, 'reverb', 'roomsize', v => `${Math.round(v * 100)}%`);
attachFxSlider(sliderReverbDamp, valReverbDamp, 'reverb', 'damp', v => `${Math.round(v * 100)}%`);
attachFxSlider(sliderReverbMix, valReverbMix, 'reverb', 'dry_wet', v => `${Math.round(v)}%`);

btnRestart.addEventListener('click', async () => {
  btnRestart.style.transform = 'rotate(180deg)';
  btnRestart.disabled = true;
  try {
    await fetch(API.service, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restart' })
    });
  } catch (err) {
    console.error(err);
  }
  setTimeout(() => {
    btnRestart.style.transform = 'none';
    btnRestart.disabled = false;
    updateStatus();
  }, 1500);
});

// Init
loadModels();
loadIrs();
loadDevices();
initRotaryKnobs();
updateStatus();
setInterval(updateStatus, 4000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateStatus();
    syncAllKnobsVisuals();
  }
});
