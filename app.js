const STORAGE_KEY = 'pabloStudySubjects';
const SETTINGS_KEY = 'pabloStudySettings';

const state = {
  subjects: load(STORAGE_KEY, []),
  settings: load(SETTINGS_KEY, { studyDays: [], defaultDuration: 105 }),
  editingId: null,
  selectedPdf: null
};

const $ = (id) => document.getElementById(id);
const els = {
  subjects: $('subjects'), nextSession: $('nextSession'), progressBar: $('progressBar'), progressText: $('progressText'),
  studiedCount: $('studiedCount'), pendingCount: $('pendingCount'), examCount: $('examCount'),
  modal: $('modalBackdrop'), form: $('subjectForm'), modalTitle: $('modalTitle'), subjectId: $('subjectId'),
  name: $('name'), examDate: $('examDate'), startTopic: $('startTopic'), endTopic: $('endTopic'), duration: $('duration'),
  customDurationWrap: $('customDurationWrap'), customDuration: $('customDuration'), days: $('days'), pdf: $('pdf'), fileName: $('fileName'),
  error: $('formError'), saveBtn: $('saveBtn')
};

const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const DAY_SHORT = ['L','M','X','J','V','S','D'];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function uid() { return `sub_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function formatDate(date) { if (!date) return 'Sin fecha'; return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${date}T12:00:00`)); }
function durationValue() { return els.duration.value === 'custom' ? Number(els.customDuration.value) : Number(els.duration.value); }

function render() {
  renderSubjects();
  renderOverview();
  renderNextSession();
}

function renderSubjects() {
  if (!state.subjects.length) {
    els.subjects.innerHTML = `<div class="empty"><strong>Tu espacio de estudio está vacío.</strong><span>Añade una asignatura para empezar a construir tu plan.</span></div>`;
    return;
  }
  els.subjects.innerHTML = state.subjects.map(subject => {
    const progress = Number(subject.progress || 0);
    const days = (subject.studyDays || []).map(d => DAY_NAMES[d]).join(' · ') || 'Sin días';
    return `<article class="subject-card">
      <div class="subject-top">
        <div><h3 class="subject-name">${escapeHtml(subject.name)}</h3><p class="subject-exam">Examen · ${escapeHtml(formatDate(subject.examDate))}</p></div>
        <div class="subject-actions"><button class="icon-btn" data-action="edit" data-id="${subject.id}" title="Editar">✎</button><button class="icon-btn" data-action="delete" data-id="${subject.id}" title="Eliminar">×</button></div>
      </div>
      <div class="subject-detail"><b>Temario:</b> ${escapeHtml(subject.startTopic)} → ${escapeHtml(subject.endTopic)}<br><b>Días:</b> ${escapeHtml(days)} · <b>Sesión:</b> ${subject.duration} min<br><b>PDF:</b> ${escapeHtml(subject.pdf?.name || 'Pendiente')}</div>
      <div class="subject-bottom"><div class="progress-meta"><span>Progreso</span><b>${progress}%</b></div><div class="mini-progress"><div style="width:${progress}%"></div></div></div>
    </article>`;
  }).join('');
}

function renderOverview() {
  const total = state.subjects.length;
  const progress = total ? Math.round(state.subjects.reduce((sum,s) => sum + Number(s.progress || 0),0) / total) : 0;
  els.progressBar.style.width = `${progress}%`;
  els.progressText.textContent = `${progress}%`;
  els.studiedCount.textContent = state.subjects.reduce((sum,s) => sum + Math.round(Number(s.progress || 0) / 100 * Number(s.topicCount || 0)),0);
  els.pendingCount.textContent = state.subjects.reduce((sum,s) => sum + Math.max(0,Number(s.topicCount || estimateTopicCount(s.startTopic,s.endTopic)) - Math.round(Number(s.progress || 0) / 100 * Number(s.topicCount || 0))),0);
  els.examCount.textContent = total;
}

function estimateTopicCount(start, end) {
  const a = Number(String(start || '').match(/\d+/)?.[0]);
  const b = Number(String(end || '').match(/\d+/)?.[0]);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a + 1 : 0;
}

function renderNextSession() {
  if (!state.subjects.length) {
    els.nextSession.innerHTML = `<h2>Todavía no tienes ninguna sesión preparada.</h2><p>Configura una asignatura y, en la siguiente fase, el planificador decidirá automáticamente qué estudiar cada día.</p>`;
    return;
  }
  const subject = [...state.subjects].sort((a,b) => new Date(a.examDate) - new Date(b.examDate))[0];
  const days = subject.studyDays || [];
  const nextDay = days.length ? DAY_NAMES[days[0]] : 'Tu próximo día de estudio';
  els.nextSession.innerHTML = `<h2>${escapeHtml(subject.name)}</h2><p><strong>${escapeHtml(subject.startTopic)} → ${escapeHtml(subject.endTopic)}</strong> · ${subject.duration} min · ${escapeHtml(nextDay)}</p><p class="session-note">Sesión de ejemplo. El planificador inteligente se conectará en el siguiente paso.</p>`;
}

function openModal(subject = null) {
  state.editingId = subject?.id || null;
  state.selectedPdf = null;
  els.modalTitle.textContent = subject ? 'Editar asignatura' : 'Configura tu asignatura';
  els.saveBtn.textContent = subject ? 'Guardar cambios' : 'Guardar asignatura';
  els.form.reset();
  els.error.classList.add('hidden');
  els.subjectId.value = subject?.id || '';
  els.name.value = subject?.name || '';
  els.examDate.value = subject?.examDate || '';
  els.startTopic.value = subject?.startTopic || '';
  els.endTopic.value = subject?.endTopic || '';
  els.duration.value = subject?.duration && ![90,105,120].includes(Number(subject.duration)) ? 'custom' : String(subject?.duration || 105);
  els.customDuration.value = subject?.duration || 105;
  els.customDurationWrap.classList.toggle('hidden', els.duration.value !== 'custom');
  els.fileName.textContent = subject?.pdf?.name || 'Ningún PDF seleccionado';
  renderDays(subject?.studyDays || state.settings.studyDays || []);
  els.modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => els.name.focus(), 50);
}

function closeModal() { els.modal.classList.add('hidden'); document.body.style.overflow = ''; state.editingId = null; state.selectedPdf = null; }

function renderDays(selected) {
  els.days.innerHTML = DAY_NAMES.map((name,index) => `<label class="day-option"><input type="checkbox" value="${index}" ${selected.includes(index) ? 'checked' : ''}><span>${DAY_SHORT[index]}<br><small>${name}</small></span></label>`).join('');
}

function selectedDays() { return [...els.days.querySelectorAll('input:checked')].map(input => Number(input.value)); }

function showError(message) { els.error.textContent = message; els.error.classList.remove('hidden'); }

function saveSubject(event) {
  event.preventDefault();
  els.error.classList.add('hidden');
  const days = selectedDays();
  if (days.length !== 2) return showError('Selecciona exactamente 2 días de estudio.');
  const duration = durationValue();
  if (!Number.isFinite(duration) || duration < 30 || duration > 360) return showError('La duración debe estar entre 30 y 360 minutos.');

  const existing = state.subjects.find(s => s.id === state.editingId);
  const pdf = state.selectedPdf || existing?.pdf || null;
  const subject = {
    id: state.editingId || uid(), name: els.name.value.trim(), examDate: els.examDate.value,
    startTopic: els.startTopic.value.trim(), endTopic: els.endTopic.value.trim(), studyDays: days,
    duration, pdf, progress: existing?.progress || 0, topicCount: existing?.topicCount || estimateTopicCount(els.startTopic.value,els.endTopic.value),
    detectedTopics: existing?.detectedTopics || [], difficulty: existing?.difficulty || {}, topicStatus: existing?.topicStatus || {},
    lastStudiedAt: existing?.lastStudiedAt || null, nextReviewAt: existing?.nextReviewAt || null,
    ai: existing?.ai || { analyzed:false, provider:null, source:'user_pdf', chunks:[] }, updatedAt:new Date().toISOString()
  };
  if (!subject.name || !subject.examDate || !subject.startTopic || !subject.endTopic) return showError('Completa todos los campos obligatorios.');
  if (state.editingId) state.subjects = state.subjects.map(s => s.id === state.editingId ? subject : s); else state.subjects.push(subject);
  state.settings.studyDays = days; state.settings.defaultDuration = duration;
  save(STORAGE_KEY,state.subjects); save(SETTINGS_KEY,state.settings);
  closeModal(); render(); toast(state.editingId ? 'Asignatura actualizada' : 'Asignatura guardada');
}

function handlePdf(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.type !== 'application/pdf') { event.target.value = ''; return showError('Selecciona un archivo PDF válido.'); }
  state.selectedPdf = { name:file.name, size:file.size, type:file.type, lastModified:file.lastModified, storage:'supabase-storage-pending' };
  els.fileName.textContent = file.name;
  els.error.classList.add('hidden');
}

function editSubject(id) { const subject = state.subjects.find(s => s.id === id); if (subject) openModal(subject); }
function deleteSubject(id) {
  const subject = state.subjects.find(s => s.id === id);
  if (!subject || !confirm(`¿Eliminar "${subject.name}"?`)) return;
  state.subjects = state.subjects.filter(s => s.id !== id); save(STORAGE_KEY,state.subjects); render(); toast('Asignatura eliminada');
}
function toast(message) { const el=document.createElement('div'); el.className='toast'; el.textContent=message; document.body.appendChild(el); setTimeout(()=>el.remove(),2200); }

$('addSubject').addEventListener('click', () => openModal());
$('heroAdd').addEventListener('click', () => openModal());
$('startBtn').addEventListener('click', () => state.subjects.length ? toast('El plan automático estará disponible en el siguiente paso.') : openModal());
$('closeModal').addEventListener('click', closeModal);
$('cancelBtn').addEventListener('click', closeModal);
els.form.addEventListener('submit', saveSubject);
els.duration.addEventListener('change', () => els.customDurationWrap.classList.toggle('hidden', els.duration.value !== 'custom'));
$('uploadBtn').addEventListener('click', () => els.pdf.click());
els.pdf.addEventListener('change', handlePdf);
els.subjects.addEventListener('click', event => { const button=event.target.closest('[data-action]'); if(!button)return; button.dataset.action==='edit'?editSubject(button.dataset.id):deleteSubject(button.dataset.id); });
els.modal.addEventListener('click', event => { if(event.target === els.modal) closeModal(); });
document.addEventListener('keydown', event => { if(event.key === 'Escape' && !els.modal.classList.contains('hidden')) closeModal(); });

renderDays(state.settings.studyDays || []);
render();

// Future integration contract: the backend can consume this normalized subject object.
// No API keys or secrets belong in this frontend. Supabase URL/anon key will be injected
// through a dedicated public configuration module in a later step, while privileged
// service keys remain server-side only.
window.PabloStudy = {
  version: '0.4.0',
  storageKey: STORAGE_KEY,
  getSubjects: () => structuredClone(state.subjects),
  saveSubjects: () => save(STORAGE_KEY,state.subjects),
  subjectSchema: ['id','name','examDate','startTopic','endTopic','studyDays','duration','pdf','progress','topicCount','detectedTopics','difficulty','topicStatus','lastStudiedAt','nextReviewAt','ai']
};