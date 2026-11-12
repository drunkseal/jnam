// JNAM Reactive Controller
const API = {
  status: '/api/status',
  models: '/api/models',
  irs: '/api/irs',
  setModel: '/api/model',
  setIr: '/api/ir',
  setCab: '/api/cab',
  setGain: '/api/gain',
  setQuality: '/api/quality',
  service: '/api/service'
};

let currentStatus = null;
let isUserDraggingGain = false;

// DOM Elements
const txtJack = document.getElementById('txt-jack');
const ledJack = document.getElementById('led-jack');
const txtRig = document.getElementById('txt-rig');
const ledRig = document.getElementById('led-rig');
const txtCpu = document.getElementById('txt-cpu');
const btnRestart = document.getElementById('btn-restart');

const chainNamName = document.getElementById('chain-nam-name');
const chainCabState = document.getElementById('chain-cab-state');
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

const qualityButtons = document.querySelectorAll('.quality-btn');
const sliderInGain = document.getElementById('slider-in-gain');
const valInGain = document.getElementById('val-in-gain');
const sliderOutGain = document.getElementById('slider-out-gain');
const valOutGain = document.getElementById('val-out-gain');

// Fetch Status
async function updateStatus() {
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
      cabInfoBanner.textContent = 'Cab IR bypassed because active model already has baked-in cabinet & microphones.';
    } else {
      cabInfoBanner.textContent = 'Cab IR manually bypassed. Guitar signal routes directly to hardware playback.';
    }
  }

  // Quality button
  const qVal = (data.dsp && data.dsp.quality_scale !== undefined) ? data.dsp.quality_scale : 1.0;
  qualityButtons.forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.quality) === qVal);
  });

  // Gains (only update sliders if user is not actively sliding)
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

// Fetch Models list
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

// Fetch IRs list
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

// Event Listeners
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

// Cab mode switcher buttons
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

// Quality Switcher
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

// Sliders
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

// Restart Engine
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
updateStatus();
setInterval(updateStatus, 1500);
