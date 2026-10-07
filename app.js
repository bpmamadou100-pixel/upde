const levels = ['L1', 'L2'];
const subjectsByLevel = {
  L1: ['Analyse', 'Algèbre', 'ISE', 'Programmation', 'Algorithme', 'Architecture', 'Mécanique'],
  L2: ['Analyse', 'Algèbre', 'SD', 'PSE', 'Électromagnétique', 'TEC']
};
const categories = ['Cours', 'TD', 'Corrections', 'Examens', 'Fiches résumé'];

let sb = null;
let authUser = null;
let user = null;

function optionList(items, emptyText=''){
  return (emptyText ? `<option value="">${emptyText}</option>` : '') +
    items.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
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
    sel.innerHTML =
      (sel.id === 'filterCategory' ? '<option value="">Toutes les catégories</option>' : '') +
      categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  });
}

function showAuth(id, btn){
  document.getElementById('loginBox').classList.add('hidden');
  document.getElementById('registerBox').classList.add('hidden');
  document.getElementById(id).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
}

function toggleBox(id){
  document.getElementById(id).classList.toggle('hidden');
}

function configIsReady(){
  return window.UPDE_SUPABASE_URL &&
    window.UPDE_SUPABASE_KEY &&
    !window.UPDE_SUPABASE_URL.includes('COLLER_ICI') &&
    !window.UPDE_SUPABASE_KEY.includes('COLLER_ICI');
}

async function boot(){
  fillSelects();

  if(!configIsReady()){
    document.getElementById('loginMsg').textContent =
      "Configuration Supabase manquante : ouvre config.js et colle le Project URL et la Publishable key.";
    return;
  }

  sb = window.supabase.createClient(
    window.UPDE_SUPABASE_URL,
    window.UPDE_SUPABASE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  const { data, error } = await sb.auth.getSession();
  if(error){
    document.getElementById('loginMsg').textContent = error.message;
    return;
  }

  if(data.session?.user){
    try{
      await setCurrentUser(data.session.user);
      showApp();
    }catch(e){
      document.getElementById('loginMsg').textContent = e.message;
      await sb.auth.signOut();
    }
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if(event === 'SIGNED_OUT'){
      authUser = null;
      user = null;
      document.getElementById('app').classList.add('hidden');
      document.getElementById('login').classList.remove('hidden');
    }
  });
}

async function fetchProfile(userId, retries=3){
  for(let i=0; i<retries; i++){
    const { data, error } = await sb
      .from('profiles')
      .select('id,name,email,role,level')
      .eq('id', userId)
      .single();

    if(!error && data) return data;

    if(i < retries - 1){
      await new Promise(r => setTimeout(r, 500));
    } else {
      throw new Error(
        "Profil introuvable. Vérifie que tu as exécuté SUPABASE_SETUP.sql dans Supabase."
      );
    }
  }
}

async function setCurrentUser(supabaseUser){
  authUser = supabaseUser;
  const profile = await fetchProfile(supabaseUser.id);
  user = {
    id: profile.id,
    name: profile.name || supabaseUser.email,
    email: profile.email || supabaseUser.email,
    role: profile.role || 'student',
    level: profile.level || 'L1'
  };
}

async function login(){
  if(!sb){
    document.getElementById('loginMsg').textContent = "Supabase n'est pas encore configuré.";
    return;
  }

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('loginMsg');

  if(!email || !password){
    msg.textContent = 'Entre ton email et ton mot de passe.';
    return;
  }

  msg.textContent = 'Connexion...';

  try{
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if(error) throw error;

    await setCurrentUser(data.user);
    msg.textContent = '';
    showApp();
  }catch(e){
    msg.textContent = humanAuthError(e);
  }
}

async function registerStudent(){
  if(!sb){
    document.getElementById('regMsg').textContent = "Supabase n'est pas encore configuré.";
    return;
  }

  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const level = document.getElementById('regLevel').value;
  const msg = document.getElementById('regMsg');

  if(!name || !email || !password){
    msg.textContent = 'Nom, email et mot de passe obligatoires.';
    return;
  }
  if(password.length < 6){
    msg.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
    return;
  }

  msg.textContent = 'Création du compte...';

  try{
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { name, level }
      }
    });
    if(error) throw error;

    if(data.session?.user){
      await setCurrentUser(data.session.user);
      msg.textContent = '';
      showApp();
    }else{
      msg.textContent =
        "Compte créé. Vérifie ton e-mail pour confirmer ton inscription, puis reviens te connecter.";
    }
  }catch(e){
    msg.textContent = humanAuthError(e);
  }
}

function showApp(){
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('welcome').textContent = 'Bienvenue ' + user.name;
  document.getElementById('roleText').textContent =
    user.role === 'prof' ? 'Espace professeur' : `Espace étudiant ${user.level || ''}`;

  document.getElementById('adminBox').style.display = user.role === 'prof' ? 'block' : 'none';
  document.getElementById('studentBox').classList.toggle('hidden', user.role !== 'prof');

  loadStats();
  loadDocuments();
  if(user.role === 'prof') loadStudents();
}

async function logout(){
  if(sb) await sb.auth.signOut();
  location.reload();
}

async function changePassword(){
  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const msg = document.getElementById('passwordMsg');

  if(!oldPassword || !newPassword){
    msg.textContent = 'Entre l’ancien et le nouveau mot de passe.';
    return;
  }
  if(newPassword.length < 6){
    msg.textContent = 'Le nouveau mot de passe doit contenir au moins 6 caractères.';
    return;
  }

  try{
    // Re-vérifie l'ancien mot de passe avant de changer.
    const { error: reauthError } = await sb.auth.signInWithPassword({
      email: user.email,
      password: oldPassword
    });
    if(reauthError) throw new Error('Ancien mot de passe incorrect.');

    const { error } = await sb.auth.updateUser({ password: newPassword });
    if(error) throw error;

    msg.textContent = 'Mot de passe modifié avec succès.';
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
  }catch(e){
    msg.textContent = e.message;
  }
}

async function loadStats(){
  try{
    const { data: docs, error } = await sb
      .from('documents')
      .select('level');

    if(error) throw error;

    const list = docs || [];
    document.getElementById('statDocs').textContent = list.length;
    document.getElementById('statL1').textContent = list.filter(d => d.level === 'L1').length;
    document.getElementById('statL2').textContent = list.filter(d => d.level === 'L2').length;

    if(user.role === 'prof'){
      const { count, error: countError } = await sb
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      if(countError) throw countError;
      document.getElementById('statStudents').textContent = count ?? 0;
    }else{
      document.getElementById('statStudents').textContent = '—';
    }
  }catch(e){
    console.error('Stats:', e);
  }
}

function onFilterLevelChange(){
  const level = document.getElementById('filterLevel').value;
  updateSubjectSelect(document.getElementById('filterSubject'), level, true);
  loadDocuments();
}

async function loadDocuments(){
  const box = document.getElementById('documents');

  try{
    const level = document.getElementById('filterLevel').value;
    const subject = document.getElementById('filterSubject').value;
    const category = document.getElementById('filterCategory').value;
    const search = document.getElementById('searchInput').value.trim().toLowerCase();

    let query = sb
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if(level) query = query.eq('level', level);
    if(subject) query = query.eq('subject', subject);
    if(category) query = query.eq('category', category);

    const { data, error } = await query;
    if(error) throw error;

    let docs = data || [];

    if(search){
      docs = docs.filter(d =>
        [d.title, d.level, d.subject, d.category, d.original_name]
          .some(v => String(v || '').toLowerCase().includes(search))
      );
    }

    if(!docs.length){
      box.innerHTML = '<p>Aucun document disponible pour le moment.</p>';
      return;
    }

    const docsWithUrls = await Promise.all(docs.map(async d => {
      const { data: signed, error: signError } = await sb.storage
        .from('documents')
        .createSignedUrl(d.storage_path, 60 * 60);

      return {
        ...d,
        signedUrl: signError ? '' : signed?.signedUrl || ''
      };
    }));

    box.innerHTML = docsWithUrls.map(d => `
      <div class="doc">
        <h3>${escapeHtml(d.title)}</h3>
        <span class="badge">${escapeHtml(d.level)}</span>
        <span class="badge">${escapeHtml(d.subject)}</span>
        <span class="badge">${escapeHtml(d.category)}</span>
        <br>
        <small>
          ${new Date(d.created_at).toLocaleString('fr-FR')}
          • ${formatSize(d.size || 0)}
          • ${escapeHtml(d.original_name || '')}
        </small>
        <br>
        ${d.signedUrl
          ? `<a href="${escapeHtml(d.signedUrl)}" target="_blank" rel="noopener">Ouvrir / télécharger le PDF</a>`
          : `<span>PDF indisponible</span>`
        }
        ${user.role === 'prof'
          ? `<button class="edit" onclick="editDoc('${d.id}', '${jsq(d.title)}', '${jsq(d.level)}', '${jsq(d.subject)}', '${jsq(d.category)}')">Modifier</button>
             <button class="delete" onclick="deleteDoc('${d.id}')">Supprimer</button>`
          : ''
        }
      </div>
    `).join('');
  }catch(e){
    console.error(e);
    box.innerHTML = `<p class="msg">Erreur de chargement : ${escapeHtml(e.message)}</p>`;
  }
}

const form = document.getElementById('uploadForm');
form.addEventListener('submit', async (e)=>{
  e.preventDefault();

  const msg = document.getElementById('uploadMsg');

  if(user?.role !== 'prof'){
    msg.textContent = 'Accès professeur uniquement.';
    return;
  }

  const fd = new FormData(form);
  const file = fd.get('pdf');
  const title = String(fd.get('title') || '').trim();
  const level = String(fd.get('level') || '');
  const subject = String(fd.get('subject') || '');
  const category = String(fd.get('category') || '');

  if(!file || !file.name){
    msg.textContent = 'Choisis un fichier PDF.';
    return;
  }

  if(!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))){
    msg.textContent = 'Seuls les fichiers PDF sont acceptés.';
    return;
  }

  if(file.size > 50 * 1024 * 1024){
    msg.textContent = 'Le PDF dépasse 50 Mo.';
    return;
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const uuid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  const storagePath = `${Date.now()}-${uuid}-${safeName}`;

  msg.textContent = 'Envoi du PDF...';

  try{
    const { error: uploadError } = await sb.storage
      .from('documents')
      .upload(storagePath, file, {
        contentType: 'application/pdf',
        upsert: false
      });

    if(uploadError) throw uploadError;

    const { error: insertError } = await sb
      .from('documents')
      .insert({
        title,
        level,
        subject,
        category,
        storage_path: storagePath,
        original_name: file.name,
        size: file.size,
        created_by: user.id
      });

    if(insertError){
      await sb.storage.from('documents').remove([storagePath]);
      throw insertError;
    }

    msg.textContent = 'Document publié avec succès.';
    form.reset();
    fillSelects();
    await loadStats();
    await loadDocuments();
  }catch(e){
    console.error(e);
    msg.textContent = 'Erreur : ' + e.message;
  }
});

async function deleteDoc(id){
  if(user?.role !== 'prof') return;
  if(!confirm('Supprimer ce document ?')) return;

  try{
    const { data: doc, error: readError } = await sb
      .from('documents')
      .select('storage_path')
      .eq('id', id)
      .single();

    if(readError) throw readError;

    if(doc?.storage_path){
      const { error: storageError } = await sb.storage
        .from('documents')
        .remove([doc.storage_path]);
      if(storageError) throw storageError;
    }

    const { error } = await sb
      .from('documents')
      .delete()
      .eq('id', id);

    if(error) throw error;

    await loadStats();
    await loadDocuments();
  }catch(e){
    alert('Erreur de suppression : ' + e.message);
  }
}

async function editDoc(id, title, level, subject, category){
  if(user?.role !== 'prof') return;

  const newTitle = prompt('Nouveau titre', title);
  if(!newTitle) return;

  const newLevel = prompt('Niveau : L1 ou L2', level) || level;
  const newSubject = prompt('Matière', subject) || subject;
  const newCategory = prompt('Catégorie', category) || category;

  try{
    const { error } = await sb
      .from('documents')
      .update({
        title: newTitle.trim(),
        level: newLevel,
        subject: newSubject,
        category: newCategory,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if(error) throw error;
    await loadDocuments();
  }catch(e){
    alert('Erreur de modification : ' + e.message);
  }
}

async function loadStudents(){
  const box = document.getElementById('students');

  try{
    const { data, error } = await sb
      .from('profiles')
      .select('name,email,level')
      .eq('role', 'student')
      .order('name', { ascending: true });

    if(error) throw error;

    const students = data || [];
    if(!students.length){
      box.innerHTML = '<p>Aucun étudiant inscrit.</p>';
      return;
    }

    box.innerHTML = students.map(s => `
      <div class="student">
        <span>${escapeHtml(s.name)} — ${escapeHtml(s.email)}</span>
        <b>${escapeHtml(s.level || '')}</b>
      </div>
    `).join('');
  }catch(e){
    box.innerHTML = `<p class="msg">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

function humanAuthError(e){
  const m = String(e?.message || e || '');
  if(/invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
  if(/email not confirmed/i.test(m)) return 'Confirme ton adresse e-mail avant de te connecter.';
  if(/user already registered/i.test(m)) return 'Cet e-mail possède déjà un compte.';
  return m || 'Erreur de connexion.';
}

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#039;',
    '"':'&quot;'
  }[c]));
}

function jsq(str){
  return String(str ?? '')
    .replace(/\\/g,'\\\\')
    .replace(/'/g,"\\'")
    .replace(/\n/g,' ');
}

function formatSize(n){
  if(!n) return '';
  if(n < 1024) return n + ' o';
  if(n < 1024 * 1024) return Math.round(n / 1024) + ' Ko';
  return (n / 1024 / 1024).toFixed(1) + ' Mo';
}

boot();
