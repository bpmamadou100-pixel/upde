const levels = ['L1', 'L2'];
const subjectsByLevel = {
  L1: ['Analyse', 'Algèbre', 'ISE', 'Programmation', 'Algorithme', 'Architecture', 'Mécanique'],
  L2: ['Analyse', 'Algèbre', 'SD', 'PSE', 'Électromagnétique', 'TEC']
};
const categories = ['Cours', 'TD', 'Corrections', 'Examens', 'Fiches résumé'];
let user = JSON.parse(localStorage.getItem('upde_user') || 'null');

function optionList(items, emptyText=''){
  return (emptyText ? `<option value="">${emptyText}</option>` : '') + items.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
}
function updateSubjectSelect(sel, level, includeAll=false){
  if(!sel) return;
  if(!level){
    const allSubjects = [...new Set([...subjectsByLevel.L1, ...subjectsByLevel.L2])];
    sel.innerHTML = optionList(allSubjects, includeAll ? 'Toutes les matières' : 'Choisir une matière');
    return;
  }
  sel.innerHTML = optionList(subjectsByLevel[level] || [], includeAll ? 'Toutes les matières' : 'Choisir une matière');
}
function fillSelects(){
  const levelSelect = document.querySelector('select[name="level"]');
  if(levelSelect){
    levelSelect.innerHTML = optionList(levels, 'Choisir le niveau');
    levelSelect.value = 'L1';
    updateSubjectSelect(document.querySelector('select[name="subject"]'), 'L1');
  }
  const filterLevel = document.getElementById('filterLevel');
  if(filterLevel) filterLevel.innerHTML = optionList(levels, 'Tous les niveaux');
  updateSubjectSelect(document.getElementById('filterSubject'), '', true);
  document.querySelectorAll('select[name="category"], #filterCategory').forEach(sel => {
    sel.innerHTML = (sel.id === 'filterCategory' ? '<option value="">Toutes les catégories</option>' : '') + categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  });
}
fillSelects();
if(user) showApp();

function showAuth(id, btn){
  document.getElementById('loginBox').classList.add('hidden');
  document.getElementById('registerBox').classList.add('hidden');
  document.getElementById(id).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
}
function toggleBox(id){ document.getElementById(id).classList.toggle('hidden'); }

async function login(){
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('loginMsg');
  msg.textContent = 'Connexion...';
  try {
    const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email,password}) });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Erreur');
    user = data;
    localStorage.setItem('upde_user', JSON.stringify(user));
    showApp();
  } catch(e){ msg.textContent = e.message; }
}
async function registerStudent(){
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const level = document.getElementById('regLevel').value;
  const msg = document.getElementById('regMsg');
  msg.textContent = 'Création du compte...';
  try{
    const res = await fetch('/api/register', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name,email,password,level})});
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Erreur');
    user = data; localStorage.setItem('upde_user', JSON.stringify(user)); showApp();
  }catch(e){ msg.textContent = e.message; }
}
function showApp(){
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('welcome').textContent = 'Bienvenue ' + user.name;
  document.getElementById('roleText').textContent = user.role === 'prof' ? 'Espace professeur' : `Espace étudiant ${user.level || ''}`;
  document.getElementById('adminBox').style.display = user.role === 'prof' ? 'block' : 'none';
  document.getElementById('studentBox').classList.toggle('hidden', user.role !== 'prof');
  loadStats(); loadDocuments(); if(user.role === 'prof') loadStudents();
}
function logout(){ localStorage.removeItem('upde_user'); location.reload(); }

async function changePassword(){
  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const msg = document.getElementById('passwordMsg');
  try{
    const res = await fetch('/api/change-password', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:user.email, oldPassword, newPassword})});
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Erreur');
    msg.textContent = 'Mot de passe modifié. Garde-le bien.';
    document.getElementById('oldPassword').value=''; document.getElementById('newPassword').value='';
  }catch(e){ msg.textContent = e.message; }
}
async function loadStats(){
  const s = await fetch('/api/stats').then(r=>r.json());
  document.getElementById('statDocs').textContent = s.totalDocs || 0;
  document.getElementById('statStudents').textContent = s.totalStudents || 0;
  document.getElementById('statL1').textContent = (s.byLevel && s.byLevel.L1) || 0;
  document.getElementById('statL2').textContent = (s.byLevel && s.byLevel.L2) || 0;
}
function onFilterLevelChange(){
  const level = document.getElementById('filterLevel').value;
  updateSubjectSelect(document.getElementById('filterSubject'), level, true);
  loadDocuments();
}
async function loadDocuments(){
  const level = document.getElementById('filterLevel').value;
  const s = document.getElementById('filterSubject').value;
  const c = document.getElementById('filterCategory').value;
  const search = document.getElementById('searchInput').value.trim();
  const qs = new URLSearchParams();
  if(level) qs.set('level', level); if(s) qs.set('subject', s); if(c) qs.set('category', c); if(search) qs.set('search', search);
  const docs = await fetch('/api/documents?' + qs.toString()).then(r=>r.json());
  const box = document.getElementById('documents');
  if(!docs.length){ box.innerHTML = '<p>Aucun document disponible pour le moment.</p>'; return; }
  box.innerHTML = docs.map(d => `
    <div class="doc">
      <h3>${escapeHtml(d.title)}</h3>
      <span class="badge">${escapeHtml(d.level || 'Ancien')}</span><span class="badge">${escapeHtml(d.subject)}</span><span class="badge">${escapeHtml(d.category)}</span>
      <br><small>${new Date(d.date).toLocaleString('fr-FR')} • ${formatSize(d.size || 0)} • ${escapeHtml(d.originalName || '')}</small><br>
      <a href="/uploads/${encodeURIComponent(d.filename)}" target="_blank">Ouvrir / télécharger le PDF</a>
      ${user.role === 'prof' ? `<button class="edit" onclick="editDoc(${d.id}, '${jsq(d.title)}', '${jsq(d.level)}', '${jsq(d.subject)}', '${jsq(d.category)}')">Modifier</button><button class="delete" onclick="deleteDoc(${d.id})">Supprimer</button>` : ''}
    </div>`).join('');
}
const form = document.getElementById('uploadForm');
form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const msg = document.getElementById('uploadMsg');
  const fd = new FormData(form);
  fd.append('userEmail', user.email);
  msg.textContent = 'Envoi du PDF...';
  try{
    const res = await fetch('/api/documents', { method:'POST', body:fd });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Erreur upload');
    msg.textContent = 'Document publié avec succès.';
    form.reset(); fillSelects(); loadStats(); loadDocuments();
  }catch(e){ msg.textContent = e.message; }
});
async function deleteDoc(id){
  if(!confirm('Supprimer ce document ?')) return;
  await fetch('/api/documents/' + id + '?email=' + encodeURIComponent(user.email), { method:'DELETE' });
  loadStats(); loadDocuments();
}
async function editDoc(id, title, level, subject, category){
  const newTitle = prompt('Nouveau titre', title); if(!newTitle) return;
  const newLevel = prompt('Niveau : L1 ou L2', level) || level;
  const newSubject = prompt('Matière', subject) || subject;
  const newCategory = prompt('Catégorie', category) || category;
  await fetch('/api/documents/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({userEmail:user.email, title:newTitle, level:newLevel, subject:newSubject, category:newCategory}) });
  loadStats(); loadDocuments();
}
async function loadStudents(){
  const students = await fetch('/api/students?email=' + encodeURIComponent(user.email)).then(r=>r.json()).catch(()=>[]);
  const box = document.getElementById('students');
  if(!students.length){ box.innerHTML = '<p>Aucun étudiant inscrit.</p>'; return; }
  box.innerHTML = students.map(s=>`<div class="student"><span>${escapeHtml(s.name)} — ${escapeHtml(s.email)}</span><b>${escapeHtml(s.level || '')}</b></div>`).join('');
}
function escapeHtml(str){ return String(str ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function jsq(str){ return String(str ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' '); }
function formatSize(n){ if(!n) return ''; if(n < 1024) return n+' o'; if(n < 1024*1024) return Math.round(n/1024)+' Ko'; return (n/1024/1024).toFixed(1)+' Mo'; }
