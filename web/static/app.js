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
const txtJack = document.getElementById('txt-jack');
const ledJack = document.getElementById('led-jack');
const txtRig = document.getElementById('txt-rig');
const ledRig = document.getElementById('led-rig');
const txtCpu = document.getElementById('txt-cpu');
const btnRestart = document.getElementById('btn-restart');

const chainNamName = document.getElementById('chain-nam-name');
const chainCabState = document.getElementById('chain-cab-state');
const chainInLabel = document.getElementById('chain-in-label');
const chainOutLabel = document.getElementById('chain-out-label');
const nodeCab = document.getElementById('node-cab');
const wireCab = document.getElementById('wire-cab');

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
  if (data.rig_running) {
    txtRig.textContent = 'RUNNING';
    ledRig.className = 'led green';
  } else {
    txtRig.textContent = 'INACTIVE';
    ledRig.className = 'led red';
  }

  // CPU
  const cpuTotal = (data.telemetry.jalv_cpu + data.telemetry.jackd_cpu).toFixed(1);
  txtCpu.textContent = `${cpuTotal}%`;

  // Model display
  const m = data.current_model;
  if (m.filename) {
    displayModelName.textContent = m.filename.replace(/\.nam$/i, '');
    displayModelMeta.textContent = `${m.folder} • Gear: ${m.gear_type.toUpperCase()}`;
    chainNamName.textContent = m.filename.slice(0, 12) + '...';
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
  const cab = data.cab;
  cabModeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === cab.mode);
  });

  if (cab.effective_active) {
    cabBadge.textContent = 'ACTIVE';
    cabBadge.className = 'badge active';
    chainCabState.textContent = 'CONVOLVER';
    nodeCab.classList.remove('bypassed');
    nodeCab.classList.add('active');
    wireCab.classList.add('active');
    cabInfoBanner.style.display = 'none';
  } else {
    cabBadge.textContent = 'BYPASSED';
    cabBadge.className = 'badge bypassed';
    chainCabState.textContent = 'BYPASS';
    nodeCab.classList.add('bypassed');
    nodeCab.classList.remove('active');
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
    footerHardwareInfo.textContent = `${activeCardName} • JACK2 48kHz / 128 Buffer`;
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
    }
    if (data.dsp.output_level !== undefined) {
      sliderOutGain.value = data.dsp.output_level;
      valOutGain.textContent = formatGain(data.dsp.output_level);
    }
  }
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
  } else {
    sliderOutGain.value = val;
    valOutGain.textContent = formatGain(val);
  }
  await fetch(API.setGain, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, value: val })
  });
};

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
updateStatus();
setInterval(updateStatus, 1500);
