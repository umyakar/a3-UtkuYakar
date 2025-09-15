const qs = s => document.querySelector(s);

// views
const loginView = qs('#login-view');
const appView = qs('#app-view');
const authNav = qs('#auth-nav');
const welcome = qs('#welcome');

// table bits
const resultsBody = qs('#results-body');
const emptyState = qs('#empty-state');


// login/logout
const loginForm = qs('#login-form');
const loginMsg = qs('#login-msg');
const logoutBtn = qs('#logoutBtn');

// form
const form = qs('#plant-form');
const cancelEditBtn = qs('#cancelEditBtn');
const submitBtn = qs('#submitBtn');
const formError = qs('#form-error');
const editIdInput = qs('#editId');

init();

async function init() {
  // events
  loginForm?.addEventListener('submit', onLocalLogin);
  logoutBtn?.addEventListener('click', onLogout);
  form?.addEventListener('submit', onSubmitItem);
  cancelEditBtn?.addEventListener('click', resetForm);

  await whoAmI();
}

async function whoAmI() {
  try {
    const r = await fetch('/api/me');
    const { user } = await r.json();
    if (user) {
      welcome.textContent = `Welcome, ${user.username}`;
      showApp();
      await refresh();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function showLogin() {
  loginView.classList.remove('hidden');
  appView.classList.add('hidden');
  authNav.classList.add('hidden');
}


function showApp() {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  authNav.classList.remove('hidden');
}

async function onLocalLogin(e) {
  e.preventDefault();
  loginMsg.textContent = '';
  const username = qs('#login-username').value.trim();
  const password = qs('#login-password').value;
  if (!username || !password) { loginMsg.textContent = 'Please enter a username and password.'; return; }

  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await r.json();
    if (!r.ok) { loginMsg.textContent = data.error || 'Login failed'; return; }
    await whoAmI();
  } catch {
    loginMsg.textContent = 'Login failed';
  }
}


async function onLogout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); }
  finally {
    resultsBody.innerHTML = '';
    emptyState.classList.add('hidden');
    showLogin();
  }
}

// form helpers
function getFormData() {
  return {
    name: qs('#name').value.trim(),
    species: qs('#species').value.trim(),
    lastWatered: qs('#lastWatered').value,
    intervalDays: parseInt(qs('#intervalDays').value, 10),
    sunlight: qs('#sunlight').value,
    indoors: qs('#indoors').checked,
    notes: qs('#notes').value.trim()
  };
}
function setFormData(item) {
  qs('#name').value = item.name ?? '';
  qs('#species').value = item.species ?? '';
  qs('#lastWatered').value = item.lastWatered ? formatDateInput(item.lastWatered) : '';
  qs('#intervalDays').value = item.intervalDays ?? '';
  qs('#sunlight').value = item.sunlight ?? 'medium';
  qs('#indoors').checked = !!item.indoors;
  qs('#notes').value = item.notes ?? '';
}
function resetForm() {
  form.reset();
  editIdInput.value = '';
  cancelEditBtn.classList.add('hidden');
  submitBtn.textContent = 'Save';
  formError.textContent = '';
}

async function onSubmitItem(e) {
  e.preventDefault();
  formError.textContent = '';
  const payload = getFormData();
  if (!payload.name || !payload.lastWatered || !payload.intervalDays) {
    formError.textContent = 'Please fill in all required fields.'; return;
  }
  const id = editIdInput.value;
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/items/${id}` : '/api/items';
  try {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Save failed');
    resetForm();
    await refresh();
  } catch (err) {
    formError.textContent = err.message;
  }
}

async function refresh() {
  try {
    const r = await fetch('/api/items');
    const { items } = await r.json();
    renderItems(items || []);
  } catch {}
}

function renderItems(items) {
  resultsBody.innerHTML = '';
  if (!items.length) { emptyState.classList.remove('hidden'); return; }
  emptyState.classList.add('hidden');
  for (const it of items) resultsBody.appendChild(renderRow(it));
}

function renderRow(it) {
  const tr = document.createElement('tr');
  const last = new Date(it.lastWatered);
  const next = addDays(last, Number(it.intervalDays));
  const { label: statusLabel, className: statusClass } = wateringStatus(next);

  const cells = [
    textCell(it.name || ''),
    textCell(it.species || ''),
    textCell(fmt(last)),
    textCell(String(it.intervalDays)),
    textCell(fmt(next)),
    badgeCell(statusLabel, statusClass),
    textCell(capitalize(it.sunlight || 'medium')),
    textCell(it.indoors ? 'Yes' : 'No'),
    textCell(it.notes || ''),
    actionsCell(it._id),
  ];
  cells.forEach(td => tr.appendChild(td));
  return tr;
}

function textCell(text){ const td=document.createElement('td'); td.textContent=text; return td; }
function badgeCell(text, cls){ const td=document.createElement('td'); const span=document.createElement('span'); span.className=`badge ${cls}`; span.textContent=text; td.appendChild(span); return td; }


function actionsCell(id) {
  const td = document.createElement('td'); td.className='actions';
  const editBtn = document.createElement('button'); editBtn.type='button'; editBtn.textContent='Edit'; editBtn.addEventListener('click',()=>startEdit(id));
  const delBtn = document.createElement('button'); delBtn.type='button'; delBtn.className='secondary'; delBtn.textContent='Delete'; delBtn.addEventListener('click',()=>onDelete(id));
  td.append(editBtn, ' ', delBtn); return td;
}

async function startEdit(id) {
  try {
    const r = await fetch('/api/items');
    const { items } = await r.json();
    const item = (items || []).find(x => x._id === id);
    if (!item) return;
    setFormData(item);
    editIdInput.value = id;
    cancelEditBtn.classList.remove('hidden');
    submitBtn.textContent = 'Update';
    document.getElementById('add')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {}
}

async function onDelete(id) {
  if (!confirm('Delete this plant?')) return;
  try {
    const r = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || 'Delete failed');
    }
    await refresh();
  } catch (e) {
    alert(e.message);
  }
}

// utils
function fmt(d){ if(!(d instanceof Date)||isNaN(d.getTime()))return ''; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function formatDateInput(v){ return fmt(new Date(v)); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+Number(n||0)); return x; }
function wateringStatus(next){ const today=new Date(); const diff=Math.floor((stripTime(next)-stripTime(today))/(1000*60*60*24)); if(diff>=2)return{label:'On track',className:'ok'}; if(diff>=0)return{label:'Water soon',className:'warn'}; return{label:'Overdue',className:'danger'}; }
function stripTime(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function capitalize(s=''){ return s.charAt(0).toUpperCase()+s.slice(1); }