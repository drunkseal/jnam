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
  metronome: '/api/metronome',
  plugins: '/api/plugins',
  pedalboard: '/api/pedalboard',
  pedalboardAdd: '/api/pedalboard/add',
  pedalboardRemove: '/api/pedalboard/remove',
  pedalboardReorder: '/api/pedalboard/reorder',
  pedalboardSlot: '/api/pedalboard/slot',
  pedalboardClear: '/api/pedalboard/clear',
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

const patchbayStrip = document.getElementById('patchbay-strip');

// Modular Pedalboard Elements
const pedalboardSlotsContainer = document.getElementById('pedalboard-slots-container');
const badgePedalCount = document.getElementById('badge-pedal-count');
const btnAddPedalOpen = document.getElementById('btn-add-pedal-open');
const pedalModalOverlay = document.getElementById('pedal-modal-overlay');
const btnPedalModalClose = document.getElementById('btn-pedal-modal-close');
const inputPedalSearch = document.getElementById('input-pedal-search');
const pedalCatPills = document.querySelectorAll('.pedal-cat-pill');
const pedalCatalogGrid = document.getElementById('pedal-catalog-grid');
const txtPluginCount = document.getElementById('txt-plugin-count');

let pluginCatalog = [];
let featuredPlugins = [];
let pedalboardState = { slots: [] };
let isUserDraggingPedalKnob = false;
let activePedalCategoryFilter = 'all';
let pedalSearchQuery = '';
let pedalDebounceTimers = {};

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
const selectTunerTuning = document.getElementById('select-tuner-tuning');
const tunerStringsStrip = document.getElementById('tuner-strings-strip');
const tunerTargetBadge = document.getElementById('tuner-target-badge');
const tunerQuickPills = document.querySelectorAll('.tuner-pill');

// Metronome Elements
const btnMetroOpen = document.getElementById('btn-metro-open');
const btnMetroClose = document.getElementById('btn-metro-close');
const btnMetroExit = document.getElementById('btn-metro-exit');
const metroOverlay = document.getElementById('metro-overlay');
const ledHeaderMetro = document.getElementById('led-header-metro');
const badgeHeaderBpm = document.getElementById('badge-header-bpm');
const metroStatusIndicator = document.getElementById('metro-status-indicator');
const metroTempoMark = document.getElementById('metro-tempo-mark');
const metroBpmText = document.getElementById('metro-bpm-text');
const metroDotsRow = document.getElementById('metro-dots-row');
const metroSweepNeedle = document.getElementById('metro-sweep-needle');
const btnMetroM5 = document.getElementById('btn-metro-m5');
const btnMetroM1 = document.getElementById('btn-metro-m1');
const btnMetroTap = document.getElementById('btn-metro-tap');
const btnMetroP1 = document.getElementById('btn-metro-p1');
const btnMetroP5 = document.getElementById('btn-metro-p5');
const metroBpmSlider = document.getElementById('metro-bpm-slider');
const metroBeatsPills = document.querySelectorAll('#metro-beats-pills .metro-pill');
const metroSubdivPills = document.querySelectorAll('#metro-subdiv-pills .metro-pill');
const selectMetroSound = document.getElementById('select-metro-sound');
const metroVolSlider = document.getElementById('metro-vol-slider');
const txtMetroVol = document.getElementById('txt-metro-vol');
const metroCheckHw = document.getElementById('metro-check-hw');
const metroCheckWeb = document.getElementById('metro-check-web');
const btnMetroToggle = document.getElementById('btn-metro-toggle');
const metroStompLed = document.getElementById('metro-stomp-led');
const metroStompText = document.getElementById('metro-stomp-text');

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
    if (chainInLabel && hw.input_channel === 'both') {
      chainInLabel.textContent = 'In 1 + 2';
    } else if (chainInLabel && hw.input_channel === '1') {
      chainInLabel.textContent = 'In 1 (Mic)';
    } else if (chainInLabel) {
      chainInLabel.textContent = 'In 2 (Guitar)';
    }

    outChanButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.chan === hw.output_channel);
    });
    if (chainOutLabel && hw.output_channel === 'stereo') {
      chainOutLabel.textContent = 'Stereo';
    } else if (chainOutLabel && hw.output_channel === '1') {
      chainOutLabel.textContent = 'Left (1)';
    } else if (chainOutLabel) {
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

  // Render Modular Pedalboard & Signal Routing Matrix
  if (data.pedalboard && !isUserDraggingPedalKnob) {
    pedalboardState = data.pedalboard;
    renderPedalboard(data.pedalboard);
  } else {
    renderSignalRoutingMatrix();
  }

  // Metronome state sync
  if (data.metronome) {
    renderMetronomeStatus(data.metronome);
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
// Real-Time Chromatic & Alternate Tuner Engine
// ============================================================================

const TUNINGS = {
  // Standard & Drop Tunings
  std_e: {
    id: 'std_e',
    name: 'Standard E',
    desc: 'E · A · D · G · B · E',
    strings: [
      { num: 6, note: 'E', octave: 2, midi: 40 },
      { num: 5, note: 'A', octave: 2, midi: 45 },
      { num: 4, note: 'D', octave: 3, midi: 50 },
      { num: 3, note: 'G', octave: 3, midi: 55 },
      { num: 2, note: 'B', octave: 3, midi: 59 },
      { num: 1, note: 'E', octave: 4, midi: 64 },
    ]
  },
  drop_d: {
    id: 'drop_d',
    name: 'Drop D',
    desc: 'D · A · D · G · B · E',
    strings: [
      { num: 6, note: 'D', octave: 2, midi: 38 },
      { num: 5, note: 'A', octave: 2, midi: 45 },
      { num: 4, note: 'D', octave: 3, midi: 50 },
      { num: 3, note: 'G', octave: 3, midi: 55 },
      { num: 2, note: 'B', octave: 3, midi: 59 },
      { num: 1, note: 'E', octave: 4, midi: 64 },
    ]
  },
  double_drop_d: {
    id: 'double_drop_d',
    name: 'Double Drop D',
    desc: 'D · A · D · G · B · D',
    strings: [
      { num: 6, note: 'D', octave: 2, midi: 38 },
      { num: 5, note: 'A', octave: 2, midi: 45 },
      { num: 4, note: 'D', octave: 3, midi: 50 },
      { num: 3, note: 'G', octave: 3, midi: 55 },
      { num: 2, note: 'B', octave: 3, midi: 59 },
      { num: 1, note: 'D', octave: 4, midi: 62 },
    ]
  },
  half_step: {
    id: 'half_step',
    name: 'Eb / D# Standard',
    desc: 'Eb · Ab · Db · Gb · Bb · Eb',
    strings: [
      { num: 6, note: 'D#', octave: 2, midi: 39 },
      { num: 5, note: 'G#', octave: 2, midi: 44 },
      { num: 4, note: 'C#', octave: 3, midi: 49 },
      { num: 3, note: 'F#', octave: 3, midi: 54 },
      { num: 2, note: 'A#', octave: 3, midi: 58 },
      { num: 1, note: 'D#', octave: 4, midi: 63 },
    ]
  },
  drop_cs: {
    id: 'drop_cs',
    name: 'Drop C# / Db',
    desc: 'C# · G# · C# · F# · A# · D#',
    strings: [
      { num: 6, note: 'C#', octave: 2, midi: 37 },
      { num: 5, note: 'G#', octave: 2, midi: 44 },
      { num: 4, note: 'C#', octave: 3, midi: 49 },
      { num: 3, note: 'F#', octave: 3, midi: 54 },
      { num: 2, note: 'A#', octave: 3, midi: 58 },
      { num: 1, note: 'D#', octave: 4, midi: 63 },
    ]
  },
  full_step: {
    id: 'full_step',
    name: 'D Standard (Full Step Down)',
    desc: 'D · G · C · F · A · D',
    strings: [
      { num: 6, note: 'D', octave: 2, midi: 38 },
      { num: 5, note: 'G', octave: 2, midi: 43 },
      { num: 4, note: 'C', octave: 3, midi: 48 },
      { num: 3, note: 'F', octave: 3, midi: 53 },
      { num: 2, note: 'A', octave: 3, midi: 57 },
      { num: 1, note: 'D', octave: 4, midi: 62 },
    ]
  },
  drop_c: {
    id: 'drop_c',
    name: 'Drop C',
    desc: 'C · G · C · F · A · D',
    strings: [
      { num: 6, note: 'C', octave: 2, midi: 36 },
      { num: 5, note: 'G', octave: 2, midi: 43 },
      { num: 4, note: 'C', octave: 3, midi: 48 },
      { num: 3, note: 'F', octave: 3, midi: 53 },
      { num: 2, note: 'A', octave: 3, midi: 57 },
      { num: 1, note: 'D', octave: 4, midi: 62 },
    ]
  },
  c_std: {
    id: 'c_std',
    name: 'C Standard (Two Steps Down)',
    desc: 'C · F · A# · D# · G · C',
    strings: [
      { num: 6, note: 'C', octave: 2, midi: 36 },
      { num: 5, note: 'F', octave: 2, midi: 41 },
      { num: 4, note: 'A#', octave: 2, midi: 46 },
      { num: 3, note: 'D#', octave: 3, midi: 51 },
      { num: 2, note: 'G', octave: 3, midi: 55 },
      { num: 1, note: 'C', octave: 4, midi: 60 },
    ]
  },
  drop_b: {
    id: 'drop_b',
    name: 'Drop B',
    desc: 'B · F# · B · E · G# · C#',
    strings: [
      { num: 6, note: 'B', octave: 1, midi: 35 },
      { num: 5, note: 'F#', octave: 2, midi: 42 },
      { num: 4, note: 'B', octave: 2, midi: 47 },
      { num: 3, note: 'E', octave: 3, midi: 52 },
      { num: 2, note: 'G#', octave: 3, midi: 56 },
      { num: 1, note: 'C#', octave: 4, midi: 61 },
    ]
  },
  b_std: {
    id: 'b_std',
    name: 'B Standard (Baritone)',
    desc: 'B · E · A · D · F# · B',
    strings: [
      { num: 6, note: 'B', octave: 1, midi: 35 },
      { num: 5, note: 'E', octave: 2, midi: 40 },
      { num: 4, note: 'A', octave: 2, midi: 45 },
      { num: 3, note: 'D', octave: 3, midi: 50 },
      { num: 2, note: 'F#', octave: 3, midi: 54 },
      { num: 1, note: 'B', octave: 3, midi: 59 },
    ]
  },
  drop_a: {
    id: 'drop_a',
    name: 'Drop A',
    desc: 'A · E · A · D · F# · B',
    strings: [
      { num: 6, note: 'A', octave: 1, midi: 33 },
      { num: 5, note: 'E', octave: 2, midi: 40 },
      { num: 4, note: 'A', octave: 2, midi: 45 },
      { num: 3, note: 'D', octave: 3, midi: 50 },
      { num: 2, note: 'F#', octave: 3, midi: 54 },
      { num: 1, note: 'B', octave: 3, midi: 59 },
    ]
  },

  // Open & Modal Tunings
  dadgad: {
    id: 'dadgad',
    name: 'DADGAD (Celtic / Kashmir)',
    desc: 'D · A · D · G · A · D',
    strings: [
      { num: 6, note: 'D', octave: 2, midi: 38 },
      { num: 5, note: 'A', octave: 2, midi: 45 },
      { num: 4, note: 'D', octave: 3, midi: 50 },
      { num: 3, note: 'G', octave: 3, midi: 55 },
      { num: 2, note: 'A', octave: 3, midi: 57 },
      { num: 1, note: 'D', octave: 4, midi: 62 },
    ]
  },
  open_d: {
    id: 'open_d',
    name: 'Open D (Vestapol)',
    desc: 'D · A · D · F# · A · D',
    strings: [
      { num: 6, note: 'D', octave: 2, midi: 38 },
      { num: 5, note: 'A', octave: 2, midi: 45 },
      { num: 4, note: 'D', octave: 3, midi: 50 },
      { num: 3, note: 'F#', octave: 3, midi: 54 },
      { num: 2, note: 'A', octave: 3, midi: 57 },
      { num: 1, note: 'D', octave: 4, midi: 62 },
    ]
  },
  open_g: {
    id: 'open_g',
    name: 'Open G (Stones / Blues)',
    desc: 'D · G · D · G · B · D',
    strings: [
      { num: 6, note: 'D', octave: 2, midi: 38 },
      { num: 5, note: 'G', octave: 2, midi: 43 },
      { num: 4, note: 'D', octave: 3, midi: 50 },
      { num: 3, note: 'G', octave: 3, midi: 55 },
      { num: 2, note: 'B', octave: 3, midi: 59 },
      { num: 1, note: 'D', octave: 4, midi: 62 },
    ]
  },
  open_c: {
    id: 'open_c',
    name: 'Open C',
    desc: 'C · G · C · G · C · E',
    strings: [
      { num: 6, note: 'C', octave: 2, midi: 36 },
      { num: 5, note: 'G', octave: 2, midi: 43 },
      { num: 4, note: 'C', octave: 3, midi: 48 },
      { num: 3, note: 'G', octave: 3, midi: 55 },
      { num: 2, note: 'C', octave: 4, midi: 60 },
      { num: 1, note: 'E', octave: 4, midi: 64 },
    ]
  },
  open_e: {
    id: 'open_e',
    name: 'Open E (Slide)',
    desc: 'E · B · E · G# · B · E',
    strings: [
      { num: 6, note: 'E', octave: 2, midi: 40 },
      { num: 5, note: 'B', octave: 2, midi: 47 },
      { num: 4, note: 'E', octave: 3, midi: 52 },
      { num: 3, note: 'G#', octave: 3, midi: 56 },
      { num: 2, note: 'B', octave: 3, midi: 59 },
      { num: 1, note: 'E', octave: 4, midi: 64 },
    ]
  },
  open_a: {
    id: 'open_a',
    name: 'Open A',
    desc: 'E · A · E · A · C# · E',
    strings: [
      { num: 6, note: 'E', octave: 2, midi: 40 },
      { num: 5, note: 'A', octave: 2, midi: 45 },
      { num: 4, note: 'E', octave: 3, midi: 52 },
      { num: 3, note: 'A', octave: 3, midi: 57 },
      { num: 2, note: 'C#', octave: 4, midi: 61 },
      { num: 1, note: 'E', octave: 4, midi: 64 },
    ]
  },

  // Extended Range (7-String & Bass)
  seven_std: {
    id: 'seven_std',
    name: '7-String Standard',
    desc: 'B · E · A · D · G · B · E',
    strings: [
      { num: 7, note: 'B', octave: 1, midi: 35 },
      { num: 6, note: 'E', octave: 2, midi: 40 },
      { num: 5, note: 'A', octave: 2, midi: 45 },
      { num: 4, note: 'D', octave: 3, midi: 50 },
      { num: 3, note: 'G', octave: 3, midi: 55 },
      { num: 2, note: 'B', octave: 3, midi: 59 },
      { num: 1, note: 'E', octave: 4, midi: 64 },
    ]
  },
  seven_drop_a: {
    id: 'seven_drop_a',
    name: '7-String Drop A',
    desc: 'A · E · A · D · G · B · E',
    strings: [
      { num: 7, note: 'A', octave: 1, midi: 33 },
      { num: 6, note: 'E', octave: 2, midi: 40 },
      { num: 5, note: 'A', octave: 2, midi: 45 },
      { num: 4, note: 'D', octave: 3, midi: 50 },
      { num: 3, note: 'G', octave: 3, midi: 55 },
      { num: 2, note: 'B', octave: 3, midi: 59 },
      { num: 1, note: 'E', octave: 4, midi: 64 },
    ]
  },
  bass_4_std: {
    id: 'bass_4_std',
    name: 'Bass 4-String Standard',
    desc: 'E · A · D · G',
    strings: [
      { num: 4, note: 'E', octave: 1, midi: 28 },
      { num: 3, note: 'A', octave: 1, midi: 33 },
      { num: 2, note: 'D', octave: 2, midi: 38 },
      { num: 1, note: 'G', octave: 2, midi: 43 },
    ]
  },
  bass_4_drop_d: {
    id: 'bass_4_drop_d',
    name: 'Bass 4-String Drop D',
    desc: 'D · A · D · G',
    strings: [
      { num: 4, note: 'D', octave: 1, midi: 26 },
      { num: 3, note: 'A', octave: 1, midi: 33 },
      { num: 2, note: 'D', octave: 2, midi: 38 },
      { num: 1, note: 'G', octave: 2, midi: 43 },
    ]
  },
  bass_5_std: {
    id: 'bass_5_std',
    name: 'Bass 5-String Standard',
    desc: 'B · E · A · D · G',
    strings: [
      { num: 5, note: 'B', octave: 0, midi: 23 },
      { num: 4, note: 'E', octave: 1, midi: 28 },
      { num: 3, note: 'A', octave: 1, midi: 33 },
      { num: 2, note: 'D', octave: 2, midi: 38 },
      { num: 1, note: 'G', octave: 2, midi: 43 },
    ]
  },

  // Freeform Chromatic
  chromatic: {
    id: 'chromatic',
    name: 'Chromatic (All 12 Semitones)',
    desc: 'Any Note Detection',
    strings: []
  }
};

// Compute calibrated frequencies for all strings (A4 = 440 Hz)
Object.values(TUNINGS).forEach(t => {
  if (t.strings) {
    t.strings.forEach(s => {
      s.freq = 440.0 * Math.pow(2.0, (s.midi - 69) / 12.0);
    });
  }
});

let currentTuningKey = localStorage.getItem('jnam_tuner_tuning') || 'std_e';
if (!TUNINGS[currentTuningKey]) currentTuningKey = 'std_e';
let lockedStringIdx = null; // null = Auto String Tracking; number = user-selected string peg

function setTuning(tuningKey) {
  if (!TUNINGS[tuningKey]) return;
  currentTuningKey = tuningKey;
  lockedStringIdx = null;
  try {
    localStorage.setItem('jnam_tuner_tuning', tuningKey);
  } catch (e) {}

  if (selectTunerTuning) {
    selectTunerTuning.value = tuningKey;
  }
  if (tunerQuickPills) {
    tunerQuickPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.tuning === tuningKey);
    });
  }
  renderStringPegs();
  resetTunerDisplay();
}

function renderStringPegs() {
  if (!tunerStringsStrip) return;
  tunerStringsStrip.innerHTML = '';

  const tuning = TUNINGS[currentTuningKey];
  if (!tuning || !tuning.strings || tuning.strings.length === 0) {
    // Chromatic mode
    const banner = document.createElement('div');
    banner.className = 'tuner-chromatic-banner';
    banner.textContent = 'AUTO CHROMATIC • 12-TET FULL SEMITONE TRACKING';
    tunerStringsStrip.appendChild(banner);
    if (tunerTargetBadge) {
      tunerTargetBadge.textContent = 'CHROMATIC MODE';
      tunerTargetBadge.className = 'tuner-target-badge';
    }
    return;
  }

  tuning.strings.forEach((s, idx) => {
    const peg = document.createElement('div');
    peg.className = 'tuner-string-peg';
    peg.dataset.strIdx = idx;
    if (lockedStringIdx === idx) {
      peg.classList.add('locked');
    }

    peg.innerHTML = `
      <span class="peg-num">STR ${s.num}</span>
      <span class="peg-note">${s.note}${s.octave}</span>
      <span class="peg-freq">${s.freq.toFixed(1)} Hz</span>
    `;

    peg.addEventListener('click', () => {
      if (lockedStringIdx === idx) {
        lockedStringIdx = null;
      } else {
        lockedStringIdx = idx;
      }
      renderStringPegs();
      resetTunerDisplay();
    });

    tunerStringsStrip.appendChild(peg);
  });

  if (tunerTargetBadge) {
    if (lockedStringIdx !== null) {
      const lockedStr = tuning.strings[lockedStringIdx];
      tunerTargetBadge.textContent = `LOCKED: STR ${lockedStr.num} (${lockedStr.note}${lockedStr.octave})`;
      tunerTargetBadge.className = 'tuner-target-badge locked';
    } else {
      tunerTargetBadge.textContent = `AUTO: ${tuning.name}`;
      tunerTargetBadge.className = 'tuner-target-badge';
    }
  }
}

function openTuner() {
  tunerOverlay.classList.remove('hidden');
  renderStringPegs();
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

  const tuning = TUNINGS[currentTuningKey];
  if (tunerTargetBadge) {
    if (!tuning || !tuning.strings || tuning.strings.length === 0) {
      tunerTargetBadge.textContent = 'CHROMATIC MODE';
      tunerTargetBadge.className = 'tuner-target-badge';
    } else if (lockedStringIdx !== null && tuning.strings[lockedStringIdx]) {
      const lockedStr = tuning.strings[lockedStringIdx];
      tunerTargetBadge.textContent = `LOCKED: STR ${lockedStr.num} (${lockedStr.note}${lockedStr.octave})`;
      tunerTargetBadge.className = 'tuner-target-badge locked';
    } else {
      tunerTargetBadge.textContent = `AUTO: ${tuning.name}`;
      tunerTargetBadge.className = 'tuner-target-badge';
    }
  }

  document.querySelectorAll('.tuner-string-peg').forEach(peg => {
    peg.classList.remove('active', 'in-tune');
  });
}

function renderTunerData(data) {
  if (!data.active || !data.freq || data.freq <= 0) {
    // String stopped or silence
    tunerNote.className = 'tuner-note-name';
    tunerNeedle.className = 'tuner-meter-needle';
    tunerStatusText.className = 'tuner-status-text';
    tunerStatusText.textContent = 'LISTENING FOR GUITAR...';
    if (tunerNote.textContent === '--') {
      tunerFreq.textContent = 'Pluck a string...';
    }
    document.querySelectorAll('.tuner-string-peg').forEach(peg => {
      peg.classList.remove('active', 'in-tune');
    });
    return;
  }

  const f = data.freq;
  tunerFreq.textContent = `${f.toFixed(2)} Hz`;

  const tuning = TUNINGS[currentTuningKey];
  const isChromatic = !tuning || !tuning.strings || tuning.strings.length === 0;

  if (isChromatic) {
    // Pure Chromatic Tracking
    tunerNote.textContent = data.note;
    tunerOctave.textContent = data.octave !== undefined ? data.octave : '';

    const cents = data.cents;
    const sign = cents > 0 ? '+' : '';
    tunerCents.textContent = `${sign}${cents.toFixed(1)} Cents`;

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
    return;
  }

  // Preset Mode (Alternate / Standard Tunings)
  let targetString = null;
  let targetIdx = -1;

  if (lockedStringIdx !== null && tuning.strings[lockedStringIdx]) {
    targetIdx = lockedStringIdx;
    targetString = tuning.strings[lockedStringIdx];
  } else {
    // Auto String Identification: find string with closest pitch
    let minDiff = Infinity;
    tuning.strings.forEach((s, idx) => {
      const diff = Math.abs(12 * Math.log2(f / s.freq));
      if (diff < minDiff) {
        minDiff = diff;
        targetString = s;
        targetIdx = idx;
      }
    });
  }

  if (targetString) {
    // Exact cents deviation relative to target string note frequency
    const cents = 1200 * Math.log2(f / targetString.freq);
    const inTune = Math.abs(cents) <= 3.0;

    // Display target note name
    tunerNote.textContent = targetString.note;
    tunerOctave.textContent = targetString.octave;

    const sign = cents > 0 ? '+' : '';
    tunerCents.textContent = `${sign}${cents.toFixed(1)} Cents`;

    const clampedCents = Math.max(-50, Math.min(50, cents));
    const needlePct = 50 + (clampedCents / 50) * 44;
    tunerNeedle.style.left = `${needlePct.toFixed(1)}%`;

    // Highlight target string peg
    const pegs = document.querySelectorAll('.tuner-string-peg');
    pegs.forEach((peg, idx) => {
      peg.classList.toggle('active', idx === targetIdx);
      peg.classList.toggle('in-tune', idx === targetIdx && inTune);
    });

    if (tunerTargetBadge) {
      const modeTag = lockedStringIdx !== null ? 'LOCKED' : 'TARGET';
      tunerTargetBadge.textContent = `${modeTag}: STR ${targetString.num} • ${targetString.note}${targetString.octave} (${targetString.freq.toFixed(1)} Hz)`;
      tunerTargetBadge.className = lockedStringIdx !== null ? 'tuner-target-badge locked' : 'tuner-target-badge';
    }

    if (inTune) {
      tunerNote.className = 'tuner-note-name in-tune';
      tunerNeedle.className = 'tuner-meter-needle in-tune';
      tunerStatusText.textContent = `● STRING ${targetString.num} IN TUNE (${targetString.note}${targetString.octave}) ●`;
      tunerStatusText.className = 'tuner-status-text in-tune';
    } else {
      tunerNote.className = 'tuner-note-name';
      tunerNeedle.className = 'tuner-meter-needle';
      if (cents < -3.0) {
        tunerStatusText.textContent = `◄ TUNE UP STRING ${targetString.num} (${targetString.note}${targetString.octave} · ${Math.abs(cents).toFixed(1)}c flat)`;
      } else {
        tunerStatusText.textContent = `► TUNE DOWN STRING ${targetString.num} (${targetString.note}${targetString.octave} · +${cents.toFixed(1)}c sharp)`;
      }
      tunerStatusText.className = 'tuner-status-text';
    }
  }
}

// Event Listeners
if (btnTunerOpen) btnTunerOpen.addEventListener('click', openTuner);
if (btnTunerClose) btnTunerClose.addEventListener('click', closeTuner);

if (selectTunerTuning) {
  selectTunerTuning.addEventListener('change', (e) => {
    setTuning(e.target.value);
  });
}

if (tunerQuickPills) {
  tunerQuickPills.forEach(pill => {
    pill.addEventListener('click', () => {
      setTuning(pill.dataset.tuning);
    });
  });
}

/* ==============================================================================
   STUDIO PRACTICE METRONOME MODULE (DUAL JACK HW & WEB AUDIO ENGINE)
   ============================================================================== */

const metroState = {
  enabled: false,
  bpm: 120,
  beats: 4,
  subdiv: 1,
  volume: 0.8,
  sound: 0,
  hwEnabled: true,
  webEnabled: true
};

let isUserDraggingMetro = false;
let metroSyncTimeout = null;
let tapTimestamps = [];
let metroAudioCtx = null;
let metroSchedulerTimer = null;
let metroNextNoteTime = 0.0;
let metroCurrentSubdivIndex = 0;
let metroAnimFrameId = null;

// Lazy initialize AudioContext on user interaction
function getMetroAudioContext() {
  if (!metroAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      metroAudioCtx = new AudioContextClass();
    }
  }
  if (metroAudioCtx && metroAudioCtx.state === 'suspended') {
    metroAudioCtx.resume().catch(() => {});
  }
  return metroAudioCtx;
}

// Tempo Markings
function getTempoMarking(bpm) {
  if (bpm < 60) return 'LARGO';
  if (bpm < 76) return 'ADAGIO';
  if (bpm < 108) return 'ANDANTE';
  if (bpm <= 120) return 'MODERATO';
  if (bpm < 168) return 'ALLEGRO';
  if (bpm <= 200) return 'PRESTO';
  return 'PRESTISSIMO';
}

// Render dynamic beat dots
function renderMetroDots() {
  if (!metroDotsRow) return;
  metroDotsRow.innerHTML = '';
  for (let i = 0; i < metroState.beats; i++) {
    const dot = document.createElement('span');
    dot.className = i === 0 ? 'metro-dot accent' : 'metro-dot';
    dot.dataset.beat = i;
    metroDotsRow.appendChild(dot);
  }
}

// Update all Metronome UI elements to reflect metroState
function updateMetroUI() {
  const bpm = Math.round(metroState.bpm);
  if (badgeHeaderBpm) badgeHeaderBpm.textContent = bpm;
  if (metroBpmText) metroBpmText.textContent = bpm;
  if (metroBpmSlider && !isUserDraggingMetro) metroBpmSlider.value = bpm;
  if (metroTempoMark) metroTempoMark.textContent = getTempoMarking(bpm);

  if (txtMetroVol) txtMetroVol.textContent = `${Math.round(metroState.volume * 100)}%`;
  if (metroVolSlider && !isUserDraggingMetro) metroVolSlider.value = Math.round(metroState.volume * 100);

  if (selectMetroSound) selectMetroSound.value = String(metroState.sound);
  if (metroCheckHw) metroCheckHw.checked = !!metroState.hwEnabled;
  if (metroCheckWeb) metroCheckWeb.checked = !!metroState.webEnabled;

  // Active state on header button
  if (btnMetroOpen) btnMetroOpen.classList.toggle('active', !!metroState.enabled);
  if (btnMetroToggle) {
    btnMetroToggle.classList.toggle('active', !!metroState.enabled);
    if (metroStompText) {
      metroStompText.textContent = metroState.enabled ? 'STOP METRONOME' : 'START METRONOME';
    }
  }

  // Time signature pills
  if (metroBeatsPills) {
    metroBeatsPills.forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.beats) === metroState.beats);
    });
  }

  // Subdivision pills
  if (metroSubdivPills) {
    metroSubdivPills.forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.subdiv) === metroState.subdiv);
    });
  }
}

// Flash visual beat
function triggerBeatFlash(beatIndex, isAccent) {
  // Flash header LED
  if (ledHeaderMetro) {
    ledHeaderMetro.className = isAccent ? 'metro-header-led pulse-accent' : 'metro-header-led pulse';
    setTimeout(() => {
      if (ledHeaderMetro) ledHeaderMetro.className = 'metro-header-led';
    }, 80);
  }

  // Flash modal beat dots
  if (metroDotsRow) {
    const dots = metroDotsRow.querySelectorAll('.metro-dot');
    dots.forEach((dot, idx) => {
      if (idx === beatIndex) {
        dot.classList.add('active');
        setTimeout(() => dot.classList.remove('active'), 90);
      } else {
        dot.classList.remove('active');
      }
    });
  }
}

// Smooth Visual Pendulum Sweep Animation
function startMetroAnimation() {
  if (metroAnimFrameId) cancelAnimationFrame(metroAnimFrameId);

  function frame() {
    if (!metroState.enabled) {
      if (metroSweepNeedle) metroSweepNeedle.style.left = '50%';
      return;
    }

    const ctx = metroAudioCtx;
    const now = ctx ? ctx.currentTime : (performance.now() / 1000);
    const beatDuration = 60.0 / Math.max(20, metroState.bpm);
    const barDuration = beatDuration * 2; // sweeps left-to-right on beat 1, right-to-left on beat 2
    const phase = (now % barDuration) / barDuration; // 0..1
    const tri = phase < 0.5 ? (phase * 2) : ((1 - phase) * 2); // 0 -> 1 -> 0
    const leftPct = 8 + tri * 84; // 8% to 92%

    if (metroSweepNeedle) {
      metroSweepNeedle.style.left = `${leftPct.toFixed(1)}%`;
    }

    metroAnimFrameId = requestAnimationFrame(frame);
  }

  metroAnimFrameId = requestAnimationFrame(frame);
}

function stopMetroAnimation() {
  if (metroAnimFrameId) {
    cancelAnimationFrame(metroAnimFrameId);
    metroAnimFrameId = null;
  }
  if (metroSweepNeedle) metroSweepNeedle.style.left = '50%';
}

// Web Audio API Synthesizer (4 Studio Sounds)
function playWebAudioClick(time, isAccent, isBeat) {
  if (!metroState.webEnabled) return;
  const ctx = getMetroAudioContext();
  if (!ctx) return;

  const masterVol = Math.max(0, Math.min(1, metroState.volume));
  if (masterVol <= 0.001) return;

  const gainScale = isAccent ? 1.0 : (isBeat ? 0.72 : 0.45);
  const clickGain = masterVol * gainScale;
  const sound = metroState.sound;

  if (sound === 0) {
    // 0: Digital Beep (crisp high-cut studio sine)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq = isAccent ? 1760 : (isBeat ? 880 : 660);
    osc.frequency.setValueAtTime(freq, time);
    osc.type = 'sine';

    gain.gain.setValueAtTime(clickGain * 0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.038);

  } else if (sound === 1) {
    // 1: Acoustic Woodblock (dual-tone hollow pitch sweep)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = isAccent ? 1200 : 850;
    osc1.frequency.setValueAtTime(baseFreq, time);
    osc1.frequency.exponentialRampToValueAtTime(320, time + 0.04);
    osc1.type = 'sine';

    osc2.frequency.setValueAtTime(baseFreq * 2.3, time);
    osc2.frequency.exponentialRampToValueAtTime(600, time + 0.035);
    osc2.type = 'sine';

    gain.gain.setValueAtTime(clickGain * 0.85, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.042);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.045);
    osc2.stop(time + 0.045);

  } else if (sound === 2) {
    // 2: Cross-Stick / Rimshot (bandpass filtered noise burst + ping)
    const bufferSize = Math.floor(ctx.sampleRate * 0.035);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isAccent ? 3200 : 2400, time);
    filter.Q.setValueAtTime(3.0, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(clickGain * 0.65, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.032);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.setValueAtTime(isAccent ? 650 : 420, time);
    osc.type = 'triangle';
    oscGain.gain.setValueAtTime(clickGain * 0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    whiteNoise.start(time);
    osc.start(time);
    whiteNoise.stop(time + 0.035);
    osc.stop(time + 0.038);

  } else {
    // 3: Rock Cowbell (two metallic square-sine tones with ringing resonance)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    const f1 = isAccent ? 587 : 540;
    const f2 = isAccent ? 880 : 800;
    osc1.frequency.setValueAtTime(f1, time);
    osc1.type = 'sine';
    osc2.frequency.setValueAtTime(f2, time);
    osc2.type = 'square';

    gain.gain.setValueAtTime(clickGain * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.085);
    osc2.stop(time + 0.085);
  }
}

// Lookahead Scheduler
function startMetroScheduler() {
  stopMetroScheduler();
  const ctx = getMetroAudioContext();
  if (!ctx) return;

  metroNextNoteTime = ctx.currentTime + 0.05;
  metroCurrentSubdivIndex = 0;

  const scheduleAheadTime = 0.1; // 100ms
  const lookaheadInterval = 25;  // 25ms

  metroSchedulerTimer = setInterval(() => {
    if (!metroState.enabled) return;

    while (metroNextNoteTime < ctx.currentTime + scheduleAheadTime) {
      const subdiv = Math.max(1, metroState.subdiv);
      const beats = Math.max(1, metroState.beats);
      const totalSubdivsInBar = beats * subdiv;

      const subdivInBeat = metroCurrentSubdivIndex % subdiv;
      const beatInBar = Math.floor(metroCurrentSubdivIndex / subdiv) % beats;

      const isAccent = (beatInBar === 0 && subdivInBeat === 0);
      const isBeat = (subdivInBeat === 0);

      // Play Web Audio click
      playWebAudioClick(metroNextNoteTime, isAccent, isBeat);

      // Visual flash on beats
      if (isBeat) {
        const delayMs = Math.max(0, (metroNextNoteTime - ctx.currentTime) * 1000);
        const b = beatInBar;
        const acc = isAccent;
        setTimeout(() => triggerBeatFlash(b, acc), delayMs);
      }

      // Advance time
      const secPerSubdiv = 60.0 / (Math.max(20, metroState.bpm) * subdiv);
      metroNextNoteTime += secPerSubdiv;
      metroCurrentSubdivIndex = (metroCurrentSubdivIndex + 1) % totalSubdivsInBar;
    }
  }, lookaheadInterval);

  startMetroAnimation();
}

function stopMetroScheduler() {
  if (metroSchedulerTimer) {
    clearInterval(metroSchedulerTimer);
    metroSchedulerTimer = null;
  }
  stopMetroAnimation();
}

// Tap Tempo Handler
function handleMetroTap() {
  const now = performance.now();
  if (btnMetroTap) {
    btnMetroTap.classList.add('tapped');
    setTimeout(() => btnMetroTap.classList.remove('tapped'), 120);
  }

  if (tapTimestamps.length > 0 && (now - tapTimestamps[tapTimestamps.length - 1]) > 2500) {
    tapTimestamps = [];
  }

  tapTimestamps.push(now);
  if (tapTimestamps.length > 5) tapTimestamps.shift();

  if (tapTimestamps.length >= 2) {
    let total = 0;
    for (let i = 1; i < tapTimestamps.length; i++) {
      total += (tapTimestamps[i] - tapTimestamps[i - 1]);
    }
    const avg = total / (tapTimestamps.length - 1);
    let calculatedBpm = Math.round(60000 / avg);
    calculatedBpm = Math.max(20, Math.min(300, calculatedBpm));
    setMetroBpm(calculatedBpm);
  }
}

// BPM Setter
function setMetroBpm(newBpm) {
  const clamped = Math.max(20, Math.min(300, Math.round(newBpm)));
  metroState.bpm = clamped;
  updateMetroUI();
  syncMetroWithBackend(80);
}

// Backend Sync
function syncMetroWithBackend(debounceMs = 0) {
  clearTimeout(metroSyncTimeout);
  const doSend = () => {
    fetch(API.metronome, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: !!metroState.enabled,
        bpm: parseFloat(metroState.bpm),
        beats: parseInt(metroState.beats),
        subdiv: parseInt(metroState.subdiv),
        volume: parseFloat(metroState.volume),
        sound: parseInt(metroState.sound),
        hw_enabled: !!metroState.hwEnabled
      })
    }).catch(err => console.error('Metronome sync error:', err));
  };

  if (debounceMs > 0) {
    metroSyncTimeout = setTimeout(doSend, debounceMs);
  } else {
    doSend();
  }
}

// Master Toggle
async function toggleMetronome() {
  metroState.enabled = !metroState.enabled;
  getMetroAudioContext();
  updateMetroUI();

  if (metroState.enabled) {
    startMetroScheduler();
  } else {
    stopMetroScheduler();
  }

  syncMetroWithBackend(0);
}

// Modal open / close
function openMetronome() {
  if (metroOverlay) metroOverlay.classList.remove('hidden');
  getMetroAudioContext();
}

function closeMetronome() {
  if (metroOverlay) metroOverlay.classList.add('hidden');
}

// Sync from backend telemetry
function renderMetronomeStatus(dataMetro) {
  if (!dataMetro || isUserDraggingMetro) return;

  let changed = false;
  if (dataMetro.bpm !== undefined && Math.abs(metroState.bpm - dataMetro.bpm) > 0.1) {
    metroState.bpm = dataMetro.bpm;
    changed = true;
  }
  if (dataMetro.beats !== undefined && metroState.beats !== dataMetro.beats) {
    metroState.beats = dataMetro.beats;
    renderMetroDots();
    changed = true;
  }
  if (dataMetro.subdiv !== undefined && metroState.subdiv !== dataMetro.subdiv) {
    metroState.subdiv = dataMetro.subdiv;
    changed = true;
  }
  if (dataMetro.volume !== undefined && Math.abs(metroState.volume - dataMetro.volume) > 0.02) {
    metroState.volume = dataMetro.volume;
    changed = true;
  }
  if (dataMetro.sound !== undefined && metroState.sound !== dataMetro.sound) {
    metroState.sound = dataMetro.sound;
    changed = true;
  }
  if (dataMetro.hw_enabled !== undefined && metroState.hwEnabled !== dataMetro.hw_enabled) {
    metroState.hwEnabled = dataMetro.hw_enabled;
    changed = true;
  }
  if (dataMetro.enabled !== undefined && metroState.enabled !== dataMetro.enabled) {
    metroState.enabled = dataMetro.enabled;
    if (metroState.enabled) {
      startMetroScheduler();
    } else {
      stopMetroScheduler();
    }
    changed = true;
  }

  if (changed) {
    updateMetroUI();
  }
}

// Metronome Event Listeners
if (btnMetroOpen) btnMetroOpen.addEventListener('click', openMetronome);
if (btnMetroClose) btnMetroClose.addEventListener('click', closeMetronome);
if (btnMetroExit) btnMetroExit.addEventListener('click', closeMetronome);
if (btnMetroToggle) btnMetroToggle.addEventListener('click', toggleMetronome);
if (btnMetroTap) btnMetroTap.addEventListener('click', handleMetroTap);

if (btnMetroM5) btnMetroM5.addEventListener('click', () => setMetroBpm(metroState.bpm - 5));
if (btnMetroM1) btnMetroM1.addEventListener('click', () => setMetroBpm(metroState.bpm - 1));
if (btnMetroP1) btnMetroP1.addEventListener('click', () => setMetroBpm(metroState.bpm + 1));
if (btnMetroP5) btnMetroP5.addEventListener('click', () => setMetroBpm(metroState.bpm + 5));

if (metroBpmSlider) {
  metroBpmSlider.addEventListener('input', (e) => {
    isUserDraggingMetro = true;
    const v = parseInt(e.target.value);
    metroState.bpm = v;
    if (metroBpmText) metroBpmText.textContent = v;
    if (badgeHeaderBpm) badgeHeaderBpm.textContent = v;
    if (metroTempoMark) metroTempoMark.textContent = getTempoMarking(v);
  });
  metroBpmSlider.addEventListener('change', (e) => {
    isUserDraggingMetro = false;
    setMetroBpm(parseInt(e.target.value));
  });
}

if (metroBeatsPills) {
  metroBeatsPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const b = parseInt(pill.dataset.beats);
      metroState.beats = b;
      renderMetroDots();
      updateMetroUI();
      syncMetroWithBackend(0);
    });
  });
}

if (metroSubdivPills) {
  metroSubdivPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const s = parseInt(pill.dataset.subdiv);
      metroState.subdiv = s;
      updateMetroUI();
      syncMetroWithBackend(0);
    });
  });
}

if (selectMetroSound) {
  selectMetroSound.addEventListener('change', (e) => {
    metroState.sound = parseInt(e.target.value);
    syncMetroWithBackend(0);
  });
}

if (metroVolSlider) {
  metroVolSlider.addEventListener('input', (e) => {
    isUserDraggingMetro = true;
    const pct = parseInt(e.target.value);
    metroState.volume = pct / 100.0;
    if (txtMetroVol) txtMetroVol.textContent = `${pct}%`;
  });
  metroVolSlider.addEventListener('change', (e) => {
    isUserDraggingMetro = false;
    const pct = parseInt(e.target.value);
    metroState.volume = pct / 100.0;
    syncMetroWithBackend(50);
  });
}

if (metroCheckHw) {
  metroCheckHw.addEventListener('change', (e) => {
    metroState.hwEnabled = e.target.checked;
    syncMetroWithBackend(0);
  });
}

if (metroCheckWeb) {
  metroCheckWeb.addEventListener('change', (e) => {
    metroState.webEnabled = e.target.checked;
    if (metroState.webEnabled) getMetroAudioContext();
  });
}

/* ==============================================================================
   MODULAR PEDALBOARD FX ENGINE (DYNAMIC LV2 HOSTING & ROUTING)
   ============================================================================== */

async function loadPluginCatalog() {
  try {
    const res = await fetch(API.plugins);
    if (!res.ok) return;
    const data = await res.json();
    pluginCatalog = data.plugins || [];
    featuredPlugins = data.featured || [];
    if (txtPluginCount) {
      txtPluginCount.textContent = `(${pluginCatalog.length} Plugins Available)`;
    }
    renderPluginCatalog();
  } catch (err) {
    console.error('Failed to load plugin catalog:', err);
  }
}

function renderPluginCatalog() {
  if (!pedalCatalogGrid) return;
  pedalCatalogGrid.innerHTML = '';

  const q = pedalSearchQuery.trim().toLowerCase();
  const cat = activePedalCategoryFilter;

  const filtered = pluginCatalog.filter(p => {
    const isFeatured = featuredPlugins.some(f => f.uri === p.uri);
    if (cat === 'featured' && !isFeatured) return false;
    if (cat !== 'all' && cat !== 'featured' && p.category !== cat) return false;

    if (q) {
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchClass = (p.class || '').toLowerCase().includes(q);
      const matchUri = (p.uri || '').toLowerCase().includes(q);
      const featured = featuredPlugins.find(f => f.uri === p.uri);
      const matchTag = featured && (featured.tagline || '').toLowerCase().includes(q);
      if (!matchName && !matchClass && !matchUri && !matchTag) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    pedalCatalogGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: var(--text-muted); font-family: var(--font-mono); font-size: 0.8rem;">
        No plugins found matching "${escapeHtml(q)}". Try searching for TS9, Delay, Reverb, Chorus, or Flanger.
      </div>
    `;
    return;
  }

  filtered.forEach(plugin => {
    const featured = featuredPlugins.find(f => f.uri === plugin.uri);
    const card = document.createElement('div');
    card.className = 'plugin-card';

    const catColors = {
      distortion: '#10b981',
      modulation: '#3b82f6',
      delay: '#00e5ff',
      reverb: '#a855f7',
      dynamics: '#ef4444',
      filter: '#f97316',
      pitch: '#8b5cf6',
      utility: '#64748b'
    };
    const color = (featured && featured.color) || catColors[plugin.category] || '#64748b';

    const tagline = (featured && featured.tagline) || plugin.class || plugin.author || 'LV2 Audio DSP Effect';

    card.innerHTML = `
      <div>
        <div class="plugin-card-top">
          <span class="plugin-cat-badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40;">
            ${escapeHtml(plugin.category)}
          </span>
          <span class="plugin-io-badge">${plugin.is_stereo ? 'Stereo' : 'Mono'}</span>
        </div>
        <div class="plugin-card-name">${escapeHtml(plugin.name)}</div>
        <div class="plugin-card-desc">${escapeHtml(tagline)}</div>
      </div>
      <div class="plugin-card-actions">
        <button type="button" class="btn-add-to-chain pre" data-uri="${plugin.uri}" data-pos="pre" title="Add to Pre-Amp chain (before amplifier)">+ PRE-AMP</button>
        <button type="button" class="btn-add-to-chain post" data-uri="${plugin.uri}" data-pos="post" title="Add to Post-Amp FX loop (after amplifier & cab)">+ POST-AMP</button>
      </div>
    `;

    const btnPre = card.querySelector('.btn-add-to-chain.pre');
    const btnPost = card.querySelector('.btn-add-to-chain.post');

    btnPre.addEventListener('click', () => addPedalToBoard(plugin.uri, 'pre'));
    btnPost.addEventListener('click', () => addPedalToBoard(plugin.uri, 'post'));

    pedalCatalogGrid.appendChild(card);
  });
}

async function loadPedalboard() {
  try {
    const res = await fetch(API.pedalboard);
    if (!res.ok) return;
    const data = await res.json();
    renderPedalboard(data);
  } catch (err) {
    console.error('Failed to load pedalboard:', err);
  }
}

function formatParamValue(val, symbol = '') {
  const sym = symbol.toLowerCase();
  const v = parseFloat(val);
  if (isNaN(v)) return String(val);

  if (sym.includes('time') || sym.includes('delay')) {
    if (v < 1.0) return `${Math.round(v * 1000)} ms`;
    return `${Math.round(v)} ms`;
  }
  if (sym.includes('gain') || sym.includes('level') || sym.includes('db')) {
    const sign = v > 0 ? '+' : '';
    return `${sign}${v.toFixed(1)} dB`;
  }
  if (sym.includes('freq') || sym.includes('tone')) {
    if (v >= 1000) return `${(v / 1000).toFixed(1)} kHz`;
    return `${Math.round(v)} Hz`;
  }
  if (sym.includes('pct') || sym.includes('mix') || sym.includes('wet') || sym.includes('room') || sym.includes('damp')) {
    return `${Math.round(v <= 1.0 && v >= 0 ? v * 100 : v)}%`;
  }
  if (sym.includes('drive') || sym.includes('depth') || sym.includes('feedback')) {
    return v <= 1.0 && v >= 0 ? `${Math.round(v * 100)}%` : `${v.toFixed(2)}`;
  }
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}

function bindPedalKnobUnit(unit, onParamChange) {
  const input = unit.querySelector('input[type="range"]');
  const knob = unit.querySelector('.knob-wrapper');
  const readout = unit.querySelector('.knob-readout');
  if (!input || !knob) return;

  updateKnobVisual(input);

  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const isInteger = input.dataset.integer === 'true';

  let isDragging = false;
  let startY = 0;
  let startVal = 0;

  knob.addEventListener('pointerdown', (e) => {
    isDragging = true;
    isUserDraggingPedalKnob = true;
    startY = e.clientY;
    startVal = parseFloat(input.value);
    knob.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  knob.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dy = startY - e.clientY;
    const delta = (dy / 140) * (max - min);
    let newVal = Math.max(min, Math.min(max, startVal + delta));
    if (isInteger) newVal = Math.round(newVal);
    input.value = newVal;
    updateKnobVisual(input);
    if (readout) readout.textContent = formatParamValue(newVal, input.dataset.symbol);
    if (onParamChange) onParamChange(newVal);
  });

  const stopDrag = () => {
    if (isDragging) {
      isDragging = false;
      setTimeout(() => { isUserDraggingPedalKnob = false; }, 100);
      updateKnobVisual(input);
    }
  };

  knob.addEventListener('pointerup', stopDrag);
  knob.addEventListener('pointercancel', stopDrag);

  knob.addEventListener('wheel', (e) => {
    e.preventDefault();
    const range = max - min;
    const delta = (e.deltaY < 0 ? 1 : -1) * (range / 50);
    let newVal = Math.max(min, Math.min(max, parseFloat(input.value) + delta));
    if (isInteger) newVal = Math.round(newVal);
    input.value = newVal;
    updateKnobVisual(input);
    if (readout) readout.textContent = formatParamValue(newVal, input.dataset.symbol);
    if (onParamChange) onParamChange(newVal);
  }, { passive: false });
}

function getPedalCategoryIcon(category) {
  switch ((category || '').toLowerCase()) {
    case 'distortion':
      return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    case 'modulation':
      return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 12c4-8 8-8 12 0s8 8 12 0"/></svg>`;
    case 'delay':
      return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>`;
    case 'reverb':
      return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 12h20M2 12a10 10 0 0 1 20 0M5 12a7 7 0 0 1 14 0"/></svg>`;
    case 'dynamics':
      return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20h16M4 4h16M7 16l5-8 5 8"/></svg>`;
    case 'filter':
      return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`;
    case 'pitch':
      return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
}

function renderSignalRoutingMatrix() {
  const patchbayStrip = document.getElementById('patchbay-strip');
  if (!patchbayStrip) return;

  const isRunning = currentStatus && currentStatus.services && currentStatus.services.jack && currentStatus.services.rig;
  const hw = (currentStatus && currentStatus.hardware) || {};
  const model = (currentStatus && currentStatus.model) || {};
  const cab = (currentStatus && currentStatus.cab) || {};
  const slots = (pedalboardState && pedalboardState.slots) || [];

  // Capture label
  let inLabel = 'In 1 + 2';
  if (hw.input_channel === '1') inLabel = 'In 1 (Mic)';
  else if (hw.input_channel === '2') inLabel = 'In 2 (Guitar)';

  // Playback label
  let outLabel = 'Stereo';
  if (hw.output_channel === '1') outLabel = 'Left (1)';
  else if (hw.output_channel === '2') outLabel = 'Right (2)';

  // Model name
  let modelLabel = 'No Model';
  if (model.name) {
    modelLabel = model.name.replace(/\.nam$/i, '').substring(0, 16);
  }

  // Cab status
  const isCabEffective = !!cab.effective_active;
  let cabSub = 'BYPASSED';
  if (isCabEffective) {
    cabSub = cab.name ? cab.name.replace(/\.wav$/i, '').substring(0, 12) : 'CONVOLVER';
  } else if (cab.auto_bypassed) {
    cabSub = 'RIG IR';
  }

  const preSlots = slots.filter(s => s.position === 'pre');
  const postSlots = slots.filter(s => s.position === 'post');

  // Build ordered node list
  const nodes = [];

  // 1. Capture node
  nodes.push({
    type: 'capture',
    id: 'node-in',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`,
    label: 'CAPTURE',
    sub: inLabel,
    active: isRunning,
    bypassed: false,
    title: 'Hardware Input Capture (Click to focus routing)',
    onClick: () => {
      const el = document.getElementById('in-channel-group');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // 2. Pre-amp pedals
  preSlots.forEach(slot => {
    const isSlotActive = isRunning && !!slot.enabled;
    const cat = (slot.category || 'fx').toUpperCase();
    nodes.push({
      type: 'pedal',
      slotId: slot.id,
      icon: getPedalCategoryIcon(slot.category),
      label: `PRE: ${cat.substring(0, 8)}`,
      sub: slot.enabled ? slot.name.substring(0, 14) : 'BYPASS',
      active: isSlotActive,
      bypassed: !slot.enabled,
      color: slot.color || '#10b981',
      title: `${slot.name} (${slot.enabled ? 'ENGAGED - Click to Bypass' : 'BYPASSED - Click to Engage'})`,
      onClick: () => togglePedalStomp(slot.id)
    });
  });

  // 3. NAM Core
  nodes.push({
    type: 'nam',
    id: 'node-nam',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>`,
    label: 'NAM CORE',
    sub: modelLabel,
    active: isRunning,
    bypassed: false,
    title: `Neural Amp Modeler: ${model.name || 'Default'} (Click to select model)`,
    onClick: () => {
      const el = document.getElementById('select-model');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }
  });

  // 4. Cab Conv
  nodes.push({
    type: 'cab',
    id: 'node-cab',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`,
    label: 'CAB CONV',
    sub: cabSub,
    active: isRunning && isCabEffective,
    bypassed: !isCabEffective,
    title: `Cabinet IR (${isCabEffective ? 'ENGAGED - Click to Cycle Mode' : 'BYPASSED - Click to Cycle Mode'})`,
    onClick: async () => {
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
    }
  });

  // 5. Post-amp pedals
  postSlots.forEach(slot => {
    const isSlotActive = isRunning && !!slot.enabled;
    const cat = (slot.category || 'fx').toUpperCase();
    nodes.push({
      type: 'pedal',
      slotId: slot.id,
      icon: getPedalCategoryIcon(slot.category),
      label: `POST: ${cat.substring(0, 8)}`,
      sub: slot.enabled ? slot.name.substring(0, 14) : 'BYPASS',
      active: isSlotActive,
      bypassed: !slot.enabled,
      color: slot.color || '#00e5ff',
      title: `${slot.name} (${slot.enabled ? 'ENGAGED - Click to Bypass' : 'BYPASSED - Click to Engage'})`,
      onClick: () => togglePedalStomp(slot.id)
    });
  });

  // 6. Playback node
  nodes.push({
    type: 'playback',
    id: 'node-out',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`,
    label: 'PLAYBACK',
    sub: outLabel,
    active: isRunning,
    bypassed: false,
    title: 'Hardware Audio Playback (Click to focus routing)',
    onClick: () => {
      const el = document.getElementById('out-channel-group');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // Render HTML
  let html = '';
  nodes.forEach((node, idx) => {
    if (idx > 0) {
      const delay = ((idx - 1) * 0.35) % 2.4;
      html += `
        <div class="chain-wire ${isRunning ? 'active' : ''}">
          <div class="wire-pulse" style="animation-delay: ${delay.toFixed(2)}s"></div>
        </div>
      `;
    }

    const activeCls = node.active ? 'active' : '';
    const bypassCls = node.bypassed ? 'bypassed' : '';
    const colorStyle = (node.color && node.active) ? `border-top-color: ${node.color}; box-shadow: 0 0 10px ${node.color}30;` : '';

    html += `
      <div class="chain-node ${activeCls} ${bypassCls}" ${node.id ? `id="${node.id}"` : ''} data-index="${idx}" title="${escapeHtml(node.title || '')}" style="${colorStyle}">
        <div class="node-icon-wrap" ${node.color && node.active ? `style="color: ${node.color}; border-color: ${node.color}60; background: ${node.color}15;"` : ''}>
          ${node.icon}
        </div>
        <div class="node-content">
          <span class="node-label">${escapeHtml(node.label)}</span>
          <span class="node-sub" ${node.color && node.active ? `style="color: ${node.color};"` : ''}>${escapeHtml(node.sub)}</span>
        </div>
      </div>
    `;
  });

  patchbayStrip.innerHTML = html;

  // Attach click listeners to interactive nodes
  const nodeEls = patchbayStrip.querySelectorAll('.chain-node');
  nodeEls.forEach(el => {
    const idx = parseInt(el.dataset.index, 10);
    const nodeObj = nodes[idx];
    if (nodeObj && nodeObj.onClick) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        nodeObj.onClick();
      });
    }
  });
}

function renderPedalboard(pb) {
  if (!pb || !pb.slots) return;
  if (isUserDraggingPedalKnob) return;

  pedalboardState = pb;

  const activeCount = pb.slots.filter(s => s.enabled).length;
  const preCount = pb.slots.filter(s => s.enabled && s.position === 'pre').length;
  const postCount = pb.slots.filter(s => s.enabled && s.position === 'post').length;

  if (badgePedalCount) {
    badgePedalCount.textContent = `${activeCount} ACTIVE (${preCount} Pre / ${postCount} Post)`;
    badgePedalCount.className = activeCount > 0 ? 'badge active' : 'badge';
  }

  renderSignalRoutingMatrix();

  if (!pedalboardSlotsContainer) return;
  pedalboardSlotsContainer.innerHTML = '';

  if (pb.slots.length === 0) {
    pedalboardSlotsContainer.innerHTML = `
      <div class="pedalboard-empty-state">
        <svg class="pedalboard-empty-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="4" y="2" width="16" height="20" rx="3"/>
          <circle cx="12" cy="7" r="2.5"/>
          <circle cx="8" cy="14" r="1.5"/>
          <circle cx="16" cy="14" r="1.5"/>
          <rect x="9" y="17" width="6" height="3" rx="1"/>
        </svg>
        <div class="pedalboard-empty-title">MODULAR PEDALBOARD IS EMPTY</div>
        <div class="pedalboard-empty-sub">
          Load any installed LV2 effect pedal (Overdrive, Distortion, Fuzz, Chorus, Delay, Reverb, Noise Gate) into your Pre-Amp or Post-Amp FX loop!
        </div>
        <button type="button" class="btn-add-pedal" onclick="openPedalModal()" style="padding: 8px 16px; font-size: 0.8rem;">
          + ADD YOUR FIRST PEDAL
        </button>
      </div>
    `;
    return;
  }

  pb.slots.forEach(slot => {
    const card = document.createElement('div');
    card.className = `stompbox-card ${slot.enabled ? 'active' : ''}`;
    card.id = `stomp-${slot.id}`;

    const color = slot.color || '#3b82f6';
    card.style.borderTopColor = color;
    if (slot.enabled) {
      card.style.boxShadow = `0 0 16px ${color}25`;
    }

    // Header
    const header = document.createElement('div');
    header.className = 'stomp-header';
    header.innerHTML = `
      <div class="stomp-title">
        <span class="stomp-led ${slot.enabled ? 'active' : ''}" style="${slot.enabled ? `background: ${color}; box-shadow: 0 0 10px ${color}` : ''}"></span>
        <span class="stomp-name">${escapeHtml(slot.name)}</span>
      </div>
      <div class="stomp-header-right">
        <button type="button" class="pedal-pos-pill ${slot.position}" title="Click to toggle between Pre-Amp and Post-Amp FX loop">
          ${slot.position === 'pre' ? 'PRE-AMP' : 'POST-AMP'}
        </button>
        <button type="button" class="btn-pedal-nav btn-prev" title="Move earlier in chain">◄</button>
        <button type="button" class="btn-pedal-nav btn-next" title="Move later in chain">►</button>
        <button type="button" class="btn-pedal-del" title="Remove pedal">✕</button>
      </div>
    `;

    // Position toggle
    header.querySelector('.pedal-pos-pill').addEventListener('click', () => {
      togglePedalPosition(slot.id);
    });

    // Reorder buttons
    header.querySelector('.btn-prev').addEventListener('click', () => {
      shiftPedalOrder(slot.id, -1);
    });
    header.querySelector('.btn-next').addEventListener('click', () => {
      shiftPedalOrder(slot.id, 1);
    });

    // Delete button
    header.querySelector('.btn-pedal-del').addEventListener('click', () => {
      removePedalFromBoard(slot.id);
    });

    card.appendChild(header);

    // Controls Area (Knobs)
    const controlsWrap = document.createElement('div');
    controlsWrap.className = 'stomp-controls';

    // Look up control metadata
    let pluginMeta = pluginCatalog.find(p => p.uri === slot.uri);
    let controlsList = (pluginMeta && pluginMeta.controls) || [];

    // If controls metadata not yet loaded from catalog, synthesize from saved params
    if (controlsList.length === 0 && slot.params) {
      controlsList = Object.keys(slot.params).map(sym => ({
        symbol: sym,
        name: sym.replace(/_/g, '').toUpperCase(),
        min: 0.0,
        max: 1.0,
        default: slot.params[sym]
      }));
    }

    controlsList.forEach(ctrl => {
      const sym = ctrl.symbol;
      const curVal = (slot.params && slot.params[sym] !== undefined) ? slot.params[sym] : ctrl.default;
      const min = ctrl.min !== undefined ? ctrl.min : 0.0;
      const max = ctrl.max !== undefined ? ctrl.max : 1.0;
      const step = ctrl.is_integer ? 1 : ((max - min) / 100);

      const knobUnit = document.createElement('div');
      knobUnit.className = 'pedal-knob-unit';
      knobUnit.innerHTML = `
        <span class="knob-label">${escapeHtml(ctrl.name || sym)}</span>
        <div class="knob-wrapper" title="${escapeHtml(ctrl.name || sym)} (Drag or Scroll)">
          <svg class="knob-svg" viewBox="0 0 60 60">
            <circle class="knob-track-bg" cx="30" cy="30" r="23" />
            <circle class="knob-track-val" cx="30" cy="30" r="23" style="stroke: ${color};" />
          </svg>
          <div class="knob-cap">
            <div class="knob-indicator"></div>
          </div>
        </div>
        <span class="knob-readout">${formatParamValue(curVal, sym)}</span>
        <input type="range" class="knob-hidden-input" min="${min}" max="${max}" step="${step}" value="${curVal}" data-symbol="${sym}" data-integer="${ctrl.is_integer ? 'true' : 'false'}" autocomplete="off">
      `;

      bindPedalKnobUnit(knobUnit, (newVal) => {
        updatePedalParam(slot.id, sym, newVal);
      });

      controlsWrap.appendChild(knobUnit);
    });

    card.appendChild(controlsWrap);

    // Stomp Footswitch Row
    const footRow = document.createElement('div');
    footRow.className = 'stomp-footswitch-row';
    const btnStomp = document.createElement('button');
    btnStomp.type = 'button';
    btnStomp.className = `btn-stomp ${slot.enabled ? 'active' : ''}`;
    btnStomp.innerHTML = `<span>${slot.enabled ? 'ENGAGED' : 'BYPASS'}</span>`;
    btnStomp.addEventListener('click', () => {
      togglePedalStomp(slot.id);
    });

    footRow.appendChild(btnStomp);
    card.appendChild(footRow);

    pedalboardSlotsContainer.appendChild(card);
  });

  syncAllKnobsVisuals();
}

async function addPedalToBoard(uri, position = 'post') {
  closePedalModal();
  try {
    const res = await fetch(API.pedalboardAdd, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri, position })
    });
    const data = await res.json();
    if (data.pedalboard) {
      renderPedalboard(data.pedalboard);
    }
    setTimeout(updateStatus, 300);
  } catch (err) {
    console.error('Failed to add pedal:', err);
  }
}

async function removePedalFromBoard(slotId) {
  try {
    const res = await fetch(API.pedalboardRemove, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: slotId })
    });
    const data = await res.json();
    if (data.pedalboard) {
      renderPedalboard(data.pedalboard);
    }
    setTimeout(updateStatus, 300);
  } catch (err) {
    console.error('Failed to remove pedal:', err);
  }
}

async function togglePedalPosition(slotId) {
  const slot = pedalboardState.slots.find(s => s.id === slotId);
  if (!slot) return;
  const newPos = slot.position === 'pre' ? 'post' : 'pre';
  try {
    const res = await fetch(API.pedalboardSlot, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: slotId, position: newPos })
    });
    const data = await res.json();
    if (data.pedalboard) {
      renderPedalboard(data.pedalboard);
    }
    setTimeout(updateStatus, 300);
  } catch (err) {
    console.error('Failed to toggle pedal position:', err);
  }
}

async function shiftPedalOrder(slotId, direction) {
  const idx = pedalboardState.slots.findIndex(s => s.id === slotId);
  if (idx < 0) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= pedalboardState.slots.length) return;

  const newSlots = [...pedalboardState.slots];
  const [moved] = newSlots.splice(idx, 1);
  newSlots.splice(targetIdx, 0, moved);

  const ids = newSlots.map(s => s.id);
  try {
    const res = await fetch(API.pedalboardReorder, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const data = await res.json();
    if (data.pedalboard) {
      renderPedalboard(data.pedalboard);
    }
    setTimeout(updateStatus, 300);
  } catch (err) {
    console.error('Failed to reorder pedals:', err);
  }
}

async function togglePedalStomp(slotId) {
  const slot = pedalboardState.slots.find(s => s.id === slotId);
  if (!slot) return;
  const newEnabled = !slot.enabled;
  slot.enabled = newEnabled; // optimistic update
  renderPedalboard(pedalboardState);

  try {
    const res = await fetch(API.pedalboardSlot, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: slotId, enabled: newEnabled })
    });
    const data = await res.json();
    if (data.pedalboard) {
      renderPedalboard(data.pedalboard);
    }
    setTimeout(updateStatus, 300);
  } catch (err) {
    console.error('Failed to toggle stomp:', err);
  }
}

function updatePedalParam(slotId, symbol, value) {
  const slot = pedalboardState.slots.find(s => s.id === slotId);
  if (slot) {
    slot.params = slot.params || {};
    slot.params[symbol] = value;
  }

  clearTimeout(pedalDebounceTimers[slotId]);
  pedalDebounceTimers[slotId] = setTimeout(() => {
    fetch(API.pedalboardSlot, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: slotId, params: { [symbol]: value } })
    }).catch(err => console.error(err));
  }, 40);
}

function openPedalModal() {
  if (pedalModalOverlay) {
    pedalModalOverlay.classList.remove('hidden');
    renderPluginCatalog();
    if (inputPedalSearch) inputPedalSearch.focus();
  }
}

function closePedalModal() {
  if (pedalModalOverlay) {
    pedalModalOverlay.classList.add('hidden');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Modal Event Listeners
if (btnAddPedalOpen) btnAddPedalOpen.addEventListener('click', openPedalModal);
if (btnPedalModalClose) btnPedalModalClose.addEventListener('click', closePedalModal);

if (pedalModalOverlay) {
  pedalModalOverlay.addEventListener('click', (e) => {
    if (e.target === pedalModalOverlay) closePedalModal();
  });
}

if (inputPedalSearch) {
  inputPedalSearch.addEventListener('input', (e) => {
    pedalSearchQuery = e.target.value.toLowerCase();
    renderPluginCatalog();
  });
}

if (pedalCatPills) {
  pedalCatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      pedalCatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activePedalCategoryFilter = pill.dataset.cat || 'all';
      renderPluginCatalog();
    });
  });
}

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

// Sliders & Controls
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
setTuning(currentTuningKey);
renderMetroDots();
updateMetroUI();
loadPluginCatalog();
loadPedalboard();
updateStatus();
setInterval(updateStatus, 4000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateStatus();
    syncAllKnobsVisuals();
  }
});
