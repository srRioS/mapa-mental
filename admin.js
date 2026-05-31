const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentAdmin = null;
let allUsers = [], allMaps = [], allImages = [];

// ── TOAST ──────────────────────────────────────
const toastEl = document.getElementById('toast');
let toastT;
function toast(msg, type=''){
  clearTimeout(toastT);
  toastEl.textContent = msg;
  toastEl.style.borderColor = type==='ok'?'#2ecc71':type==='error'?'#c94f4f':'';
  toastEl.classList.add('show');
  toastT = setTimeout(()=>toastEl.classList.remove('show'), 2600);
}

// ── AUTH ───────────────────────────────────────
document.getElementById('adm-login-btn').addEventListener('click', async()=>{
  const email = document.getElementById('adm-email').value.trim();
  if(!email){ toast('Digite um e-mail','error'); return; }
  const btn = document.getElementById('adm-login-btn');
  btn.disabled=true; btn.innerHTML='<i class="fa fa-spinner fa-spin"></i> Enviando...';
  const { error } = await db.auth.signInWithOtp({ email, options:{ emailRedirectTo: window.location.origin+'/admin.html' }});
  btn.disabled=false; btn.innerHTML='<i class="fa fa-envelope"></i> Enviar Magic Link';
  if(error){ toast('Erro: '+error.message,'error'); return; }
  document.getElementById('adm-sent').style.display='block';
});

document.getElementById('adm-logout').addEventListener('click', async()=>{
  await db.auth.signOut(); location.reload();
});

db.auth.onAuthStateChange(async(event, session)=>{
  if(session?.user){
    currentAdmin = session.user;
    document.getElementById('admin-login').style.display='none';
    document.getElementById('app').style.display='flex';
    document.getElementById('adm-user-label').textContent = currentAdmin.email;
    loadDashboard();
    loadUsers();
    loadMaps();
    loadImages();
  }
});

// ── TABS ───────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t=>t.style.display='none');
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).style.display='block';
  });
});

// ── DASHBOARD ──────────────────────────────────
async function loadDashboard(){
  // Stats
  const { data: maps } = await db.from('maps').select('id,nodes,updated_at,user_id,title');
  const { data: imgs } = await db.from('node_images').select('id');

  // Unique users from maps
  const userIds = [...new Set((maps||[]).map(m=>m.user_id).filter(Boolean))];

  document.getElementById('st-users').textContent = userIds.length;
  document.getElementById('st-maps').textContent = (maps||[]).length;
  document.getElementById('st-images').textContent = (imgs||[]).length;

  let totalNodes = 0;
  (maps||[]).forEach(m=>{ totalNodes += (m.nodes||[]).length; });
  document.getElementById('st-nodes').textContent = totalNodes;

  // Chart: maps per user
  const perUser = {};
  (maps||[]).forEach(m=>{
    const uid = m.user_id||'anon';
    perUser[uid] = (perUser[uid]||0)+1;
  });
  const sortedUsers = Object.entries(perUser).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxU = sortedUsers[0]?.[1]||1;
  const chartMU = document.getElementById('chart-maps-user');
  chartMU.innerHTML = sortedUsers.length ? sortedUsers.map(([uid,cnt])=>`
    <div class="bar-row">
      <div class="bar-label" title="${uid}">${uid.slice(0,10)}…</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(cnt/maxU*100)}%"></div></div>
      <div class="bar-count">${cnt}</div>
    </div>`).join('') : '<div class="empty-state">Sem dados</div>';

  // Chart: recent 7 days
  const days = {};
  for(let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    days[d.toISOString().slice(0,10)]=0;
  }
  (maps||[]).forEach(m=>{
    const day=(m.updated_at||'').slice(0,10);
    if(days[day]!==undefined) days[day]++;
  });
  const maxD = Math.max(...Object.values(days),1);
  const chartR = document.getElementById('chart-recent');
  chartR.innerHTML = Object.entries(days).map(([day,cnt])=>`
    <div class="bar-row">
      <div class="bar-label">${day.slice(5)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(cnt/maxD*100)}%;background:var(--success)"></div></div>
      <div class="bar-count">${cnt}</div>
    </div>`).join('');
}

// ── USERS ──────────────────────────────────────
async function loadUsers(filter=''){
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Carregando...</td></tr>';

  // Get unique users from maps
  const { data: maps } = await db.from('maps').select('user_id,id,updated_at');
  const userMap = {};
  (maps||[]).forEach(m=>{
    if(!m.user_id) return;
    if(!userMap[m.user_id]) userMap[m.user_id]={ id:m.user_id, maps:0, last:m.updated_at };
    userMap[m.user_id].maps++;
    if(m.updated_at > userMap[m.user_id].last) userMap[m.user_id].last = m.updated_at;
  });

  allUsers = Object.values(userMap);
  let rows = allUsers;
  if(filter) rows = rows.filter(u=>u.id.toLowerCase().includes(filter));

  if(!rows.length){ tbody.innerHTML='<tr><td colspan="5" class="empty-state">Nenhum usuário encontrado</td></tr>'; return; }

  tbody.innerHTML = rows.map(u=>`
    <tr>
      <td><span style="font-family:monospace;font-size:11px">${u.id.slice(0,18)}…</span></td>
      <td>—</td>
      <td>${u.last ? new Date(u.last).toLocaleDateString('pt-BR') : '—'}</td>
      <td><span class="tag active">${u.maps} mapas</span></td>
      <td>
        <button class="act-btn danger" onclick="deleteUserMaps('${u.id}')"><i class="fa fa-trash"></i> Excluir mapas</button>
      </td>
    </tr>`).join('');
}

async function deleteUserMaps(userId){
  if(!confirm('Excluir TODOS os mapas deste usuário?')) return;
  const { error } = await db.from('maps').delete().eq('user_id', userId);
  if(error){ toast('Erro ao excluir','error'); return; }
  toast('Mapas excluídos','ok');
  loadUsers(); loadDashboard();
}

document.getElementById('user-search').addEventListener('input', e=>loadUsers(e.target.value.trim().toLowerCase()));

// Invite
document.getElementById('btn-invite').addEventListener('click',()=>document.getElementById('invite-modal').classList.add('open'));
document.getElementById('inv-cancel').addEventListener('click',()=>document.getElementById('invite-modal').classList.remove('open'));
document.getElementById('inv-send').addEventListener('click', async()=>{
  const email = document.getElementById('inv-email').value.trim();
  if(!email){ toast('Digite um e-mail','error'); return; }
  const { error } = await db.auth.signInWithOtp({ email, options:{ emailRedirectTo: window.location.origin }});
  if(error){ toast('Erro: '+error.message,'error'); return; }
  toast('Convite enviado para '+email,'ok');
  document.getElementById('invite-modal').classList.remove('open');
  document.getElementById('inv-email').value='';
});

// ── MAPS ───────────────────────────────────────
let selectedMaps = new Set();

async function loadMaps(filter=''){
  const tbody = document.getElementById('maps-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Carregando...</td></tr>';
  const { data, error } = await db.from('maps').select('id,title,nodes,user_id,updated_at').order('updated_at',{ascending:false});
  allMaps = data||[];
  let rows = allMaps;
  if(filter) rows = rows.filter(m=>(m.title||'').toLowerCase().includes(filter));

  if(!rows.length){ tbody.innerHTML='<tr><td colspan="6" class="empty-state">Nenhum mapa encontrado</td></tr>'; return; }

  tbody.innerHTML = rows.map(m=>`
    <tr>
      <td><input type="checkbox" class="map-chk" data-id="${m.id}" ${selectedMaps.has(m.id)?'checked':''}></td>
      <td><strong style="color:var(--text)">${m.title||'Sem título'}</strong></td>
      <td><span style="font-family:monospace;font-size:11px">${(m.user_id||'anon').slice(0,14)}…</span></td>
      <td>${(m.nodes||[]).length} nós</td>
      <td>${m.updated_at?new Date(m.updated_at).toLocaleDateString('pt-BR'):'—'}</td>
      <td>
        <button class="act-btn danger" onclick="deleteMap('${m.id}')"><i class="fa fa-trash"></i> Excluir</button>
      </td>
    </tr>`).join('');

  document.querySelectorAll('.map-chk').forEach(chk=>{
    chk.addEventListener('change',()=>{
      if(chk.checked) selectedMaps.add(chk.dataset.id);
      else selectedMaps.delete(chk.dataset.id);
    });
  });
}

document.getElementById('chk-all-maps').addEventListener('change', e=>{
  document.querySelectorAll('.map-chk').forEach(chk=>{
    chk.checked = e.target.checked;
    if(e.target.checked) selectedMaps.add(chk.dataset.id);
    else selectedMaps.delete(chk.dataset.id);
  });
});

document.getElementById('btn-del-all-maps').addEventListener('click', async()=>{
  if(!selectedMaps.size){ toast('Selecione mapas primeiro','error'); return; }
  if(!confirm(`Excluir ${selectedMaps.size} mapa(s)?`)) return;
  for(const id of selectedMaps){
    await db.from('maps').delete().eq('id',id);
  }
  selectedMaps.clear();
  toast('Mapas excluídos','ok');
  loadMaps(); loadDashboard();
});

async function deleteMap(id){
  if(!confirm('Excluir este mapa?')) return;
  await db.from('maps').delete().eq('id',id);
  toast('Mapa excluído','ok');
  loadMaps(); loadDashboard();
}

document.getElementById('map-search').addEventListener('input', e=>loadMaps(e.target.value.trim().toLowerCase()));

// ── IMAGES ─────────────────────────────────────
async function loadImages(){
  const grid = document.getElementById('images-grid');
  grid.innerHTML = '<div class="empty-state">Carregando...</div>';
  const { data, error } = await db.from('node_images').select('*').order('created_at',{ascending:false});
  allImages = data||[];
  document.getElementById('img-count').textContent = `${allImages.length} imagem(ns)`;

  if(!allImages.length){ grid.innerHTML='<div class="empty-state">Nenhuma imagem enviada ainda</div>'; return; }

  grid.innerHTML = allImages.map(img=>`
    <div class="img-card">
      <img src="${img.url}" alt="img" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22110%22><rect fill=%22%2322222c%22 width=%22160%22 height=%22110%22/><text fill=%22%235a5870%22 x=%2280%22 y=%2260%22 text-anchor=%22middle%22 font-size=%2212%22>Erro ao carregar</text></svg>'"/>
      <div class="img-card-info">${img.map_id?img.map_id.slice(0,12)+'…':'—'}</div>
      <button class="img-card-del" onclick="deleteImage('${img.id}','${img.map_id}','${img.node_id}')"><i class="fa fa-trash"></i></button>
    </div>`).join('');
}

async function deleteImage(id, mapId, nodeId){
  if(!confirm('Excluir esta imagem?')) return;
  await db.from('node_images').delete().eq('id',id);
  toast('Imagem removida','ok');
  loadImages(); loadDashboard();
}

// Close modal on overlay click
document.getElementById('invite-modal').addEventListener('click', e=>{
  if(e.target===e.currentTarget) e.currentTarget.classList.remove('open');
});
