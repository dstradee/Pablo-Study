const subjects = JSON.parse(localStorage.getItem('pabloStudySubjects') || '[]');
const subjectsEl = document.getElementById('subjects');
const addSubject = document.getElementById('addSubject');
const startBtn = document.getElementById('startBtn');

function render() {
  if (!subjects.length) {
    subjectsEl.className = 'empty';
    subjectsEl.textContent = 'Todavía no has añadido asignaturas.';
    return;
  }
  subjectsEl.className = '';
  subjectsEl.innerHTML = subjects.map(s => `<div style="padding:12px 0;border-bottom:1px solid #eee"><strong>${escapeHtml(s.name)}</strong><div style="color:#777;font-size:13px;margin-top:4px">Examen: ${escapeHtml(s.exam)}</div></div>`).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function add() {
  const name = prompt('Nombre de la asignatura:');
  if (!name) return;
  const exam = prompt('Fecha del examen (DD/MM/AAAA):');
  if (!exam) return;
  subjects.push({name:name.trim(), exam:exam.trim()});
  localStorage.setItem('pabloStudySubjects', JSON.stringify(subjects));
  render();
}

addSubject.addEventListener('click', add);
startBtn.addEventListener('click', add);
render();