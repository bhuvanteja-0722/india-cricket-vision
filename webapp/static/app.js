const $ = (id) => document.getElementById(id);
const HISTORY_KEY = 'indiaCricketVision.history.v1';
let chosen = null;
let previewUrl = null;
let dragDepth = 0;
const input = $('file');
const drop = $('drop');

$('browse').onclick = () => input.click();
drop.onclick = (event) => {
  if (event.target.tagName !== 'BUTTON') input.click();
};
input.onchange = () => input.files[0] && selectFile(input.files[0]);
drop.addEventListener('dragenter', (event) => {
  event.preventDefault();
  dragDepth += 1;
  drop.classList.add('is-dragover');
});
drop.addEventListener('dragover', (event) => {
  event.preventDefault();
  drop.classList.add('is-dragover');
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});
drop.addEventListener('dragleave', (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) drop.classList.remove('is-dragover');
});
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  drop.classList.remove('is-dragover');
  const files = Array.from(event.dataTransfer?.files || []);
  if (!files.length) {
    $('status').textContent = 'Drop an image file to continue.';
    return;
  }
  if (files.length > 1) $('status').textContent = 'More than one file was dropped; using the first image.';
  selectFile(files[0]);
});
window.addEventListener('dragover', (event) => {
  if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
});
window.addEventListener('drop', (event) => {
  if (event.dataTransfer?.files?.length) event.preventDefault();
});

function selectFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  const allowedType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  const allowedExtension = ['jpg', 'jpeg', 'png', 'webp'].includes(extension);
  if ((!allowedType && !allowedExtension) || file.size > 12 * 1024 * 1024) {
    $('status').textContent = file.size > 12 * 1024 * 1024
      ? 'This image is over the 12 MB limit.'
      : 'Use a JPG, PNG or WEBP image.';
    input.value = '';
    chosen = null;
    $('analyse').disabled = true;
    $('preview').hidden = true;
    $('preview').removeAttribute('src');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    return;
  }
  chosen = file;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  $('preview').src = previewUrl;
  $('preview').hidden = false;
  $('analyse').disabled = false;
  $('status').textContent = `Image ready · ${file.name}`;
}

function clearUpload() {
  chosen = null;
  input.value = '';
  $('analyse').disabled = true;
  $('preview').hidden = true;
  $('preview').removeAttribute('src');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

async function makeThumbnail(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.72);
}

function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function renderHistory() {
  const history = readHistory();
  $('historyList').innerHTML = history.map((item) => {
    const date = new Date(item.createdAt).toLocaleString();
    return `<article class="history-card">
      <img src="${item.thumbnail}" alt="Saved upload ${esc(item.filename || '')}">
      <div><small class="gold">${esc(item.filename || 'Analysed portrait')}</small>
      <h3>${esc(item.player)}</h3>
      <p class="score">${Number(item.confidence).toFixed(1)}% score</p>
      <p>${esc(date)}</p></div>
    </article>`;
  }).join('');
  $('historyEmpty').hidden = history.length > 0;
}

function saveHistory(entry) {
  const history = [entry, ...readHistory()].slice(0, 12);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (_) {
    // If storage is near quota, retain fewer recent thumbnails and retry.
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 5))); } catch (_) { /* browser storage is unavailable */ }
  }
  renderHistory();
}

$('clearHistory').onclick = () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
};

$('analyse').onclick = async () => {
  if (!chosen) return;
  const file = chosen;
  const form = new FormData();
  form.append('file', file);
  $('analyse').disabled = true;
  $('analyse').textContent = 'ANALYSING…';
  $('status').textContent = 'Image is being analysed locally…';
  try {
    const response = await fetch('/api/predict', { method: 'POST', body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'The image could not be analysed.');
    $('result').innerHTML = `<div><small class="gold">RECOGNITION RESULT</small>
      <h2>${esc(data.player)}</h2><h2 class="gold">${Number(data.confidence).toFixed(1)}%</h2>
      <p>${Number(data.latency_ms).toFixed(0)} ms · ${esc(data.device)} · ${data.face_detected ? 'face detected' : 'full image used'}</p>
      <h3>TOP MATCHES</h3>${data.top_matches.map((match, index) => `<p>${index + 1}. ${esc(match.name)} <b>${Number(match.confidence).toFixed(1)}%</b></p>`).join('')}
      <small class="gold">Portrait preview cleared · saved to local history</small></div>`;
    try {
      const thumbnail = await makeThumbnail(file);
      saveHistory({ thumbnail, filename: file.name, player: data.player, confidence: data.confidence, createdAt: new Date().toISOString() });
    } catch (_) {
      $('status').textContent = 'Match complete. Browser storage could not save this image to history.';
    }
    $('status').textContent = 'Match complete · upload cleared';
  } catch (error) {
    $('result').innerHTML = `<div><small class="gold">MODEL RESPONSE</small><p>${esc(error.message)}</p></div>`;
    $('status').textContent = 'Analysis finished · upload cleared';
  } finally {
    clearUpload();
    $('analyse').textContent = 'ANALYSE IMAGE →';
  }
};

function percent(value) {
  return value == null ? '—' : `${(Number(value) * 100).toFixed(1)}%`;
}

function renderBars(containerId, items, maxValue = 1) {
  const container = $(containerId);
  if (!items.length) {
    container.innerHTML = '<p class="graph-note">No chart data is available.</p>';
    return;
  }
  container.innerHTML = items.map((item) => {
    const height = Math.max(0, Math.min(100, (Number(item.value) / maxValue) * 100));
    const style = item.selected ? ' selected' : '';
    const extra = item.test ? ' test' : '';
    return `<div class="bar-row"><span class="bar-label">${esc(item.label)}</span>
      <span class="bar-track"><span class="bar-fill${style}${extra}" style="height:${height}%"></span></span>
      <span class="bar-value">${esc(item.display)}</span></div>`;
  }).join('');
}

async function loadStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    const metrics = data.metrics || {};
    $('players').textContent = data.classes || '—';
    $('accuracy').textContent = percent(metrics.test_accuracy);
    $('datasetImages').textContent = Number(metrics.total_images || 0).toLocaleString() || '—';
    $('testAccuracy').textContent = percent(metrics.test_accuracy);
    $('trainAccuracy').textContent = percent(metrics.training_accuracy);
    $('validationAccuracy').textContent = percent(metrics.validation_accuracy);
    $('testF1').textContent = percent(metrics.test_macro_f1);
    $('mimages').textContent = Number(metrics.total_images || 0).toLocaleString() || '—';
    $('mclasses').textContent = metrics.num_classes || '—';
    $('modelstate').textContent = data.model_ready ? 'TRAINED MODEL LOADED' : 'MODEL NOT TRAINED';
    renderBars('splitChart', [
      { label: 'Training fit', value: metrics.training_accuracy || 0, display: percent(metrics.training_accuracy) },
      { label: 'Validation', value: metrics.validation_accuracy || 0, display: percent(metrics.validation_accuracy) },
      { label: 'Held-out test', value: metrics.test_accuracy || 0, display: percent(metrics.test_accuracy), test: true }
    ]);
    const candidates = metrics.validation_candidates || [];
    renderBars('classifierChart', candidates.map((item) => ({
      label: `C=${item.C}`, value: item.macro_f1 || 0, display: percent(item.macro_f1), selected: Number(item.C) === Number(metrics.selected_C)
    })));
    const scoreBands = metrics.test_confidence_histogram || [];
    const maxCount = Math.max(1, ...scoreBands.map((item) => Number(item.count) || 0));
    renderBars('scoreChart', scoreBands.map((item) => ({
      label: item.range, value: Number(item.count) || 0, display: (Number(item.count) || 0).toLocaleString()
    })), maxCount);
    $('status').textContent = data.model_ready ? `Model ready · ${data.classes} player classes` : 'Model is not ready';
  } catch (_) {
    $('status').textContent = 'Local API unavailable';
  }
}

renderHistory();
loadStatus();
