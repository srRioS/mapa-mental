const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── COLORS ────────────────────────────────────
const COLORS = [
  {fill:'#2d2060',stroke:'#7f77dd',text:'#c8c4f8'},
  {fill:'#1a3a2a',stroke:'#2ecc71',text:'#a8f0c6'},
  {fill:'#3a1a1a',stroke:'#e05555',text:'#f0a8a8'},
  {fill:'#1a2d3a',stroke:'#4a9edd',text:'#a8d4f0'},
  {fill:'#2d2a10',stroke:'#d4a017',text:'#f0dea8'},
  {fill:'#2a1a30',stroke:'#c060d0',text:'#e0b0f0'},
  {fill:'#1a2d20',stroke:'#50b870',text:'#a8e0b8'},
];
const COLORS_LIGHT = [
  {fill:'#eeedfe',stroke:'#7f77dd',text:'#3c3489'},
  {fill:'#e1f5ee',stroke:'#1d9e75',text:'#085041'},
  {fill:'#faece7',stroke:'#d85a30',text:'#4a1b0c'},
  {fill:'#e6f1fb',stroke:'#378add',text:'#042c53'},
  {fill:'#faeeda',stroke:'#ba7517',text:'#412402'},
  {fill:'#fbeaf0',stroke:'#c060d0',text:'#4b1528'},
  {fill:'#eaf3de',stroke:'#50b870',text:'#173404'},
];

// ── STATE ─────────────────────────────────────
let nodes=[], edges=[], nextId=1, selectedId=null;
let pan={x:0,y:0}, zoom=1;
let dragging=false, dragStart={}, panStart={};
let nodeDrag=null, nodeDragOffset={};
let currentMapId=null, nodeImages={}, nodeNotes={};
let currentUser=null, isLight=false;
let nodeRadius = {}; // per-node border radius override

// ── DOM ───────────────────────────────────────
const scene       = document.getElementById('scene');
const canvasWrap  = document.getElementById('canvas-wrap');
const ctxMenu     = document.getElementById('ctx-menu');
const editBox     = document.getElementById('edit-box');
const editInput   = document.getElementById('edit-input');
const toastEl     = document.getElementById('toast');
const mapTitleIn  = document.getElementById('map-title-input');
const mapsList    = document.getElementById('maps-list');
const imgInput    = document.getElementById('img-input');
const imgModal    = document.getElementById('img-modal');
const modalImg    = document.getElementById('modal-img');
const zoomLabel   = document.getElementById('zoom-label');
const searchInput = document.getElementById('search-input');
const noteModal   = document.getElementById('note-modal');
const noteInput   = document.getElementById('note-input');
const shareModal  = document.getElementById('share-modal');
const sizePanelEl = document.getElementById('node-size-panel');

// ── TOAST ─────────────────────────────────────
let toastTimer;
function showToast(msg, type=''){
  clearTimeout(toastTimer);
  toastEl.textContent=msg;
  toastEl.style.borderColor = type==='error'?'var(--danger)':type==='ok'?'var(--success)':'';
  toastEl.classList.add('show');
  toastTimer=setTimeout(()=>toastEl.classList.remove('show'),2500);
}

// ── THEME ─────────────────────────────────────
document.getElementById('btn-theme').addEventListener('click',()=>{
  isLight=!isLight;
  document.body.classList.toggle('light',isLight);
  document.getElementById('btn-theme').innerHTML=isLight?'<i class="fa fa-sun"></i>':'<i class="fa fa-moon"></i>';
  render();
});
function getColors(idx){ return isLight?COLORS_LIGHT[idx%COLORS_LIGHT.length]:COLORS[idx%COLORS.length]; }

// ── AUTH — EMAIL + PASSWORD ───────────────────
// Tab switching
document.getElementById('tab-signin').addEventListener('click',()=>{
  document.getElementById('tab-signin').classList.add('active');
  document.getElementById('tab-signup').classList.remove('active');
  document.getElementById('form-signin').style.display='flex';
  document.getElementById('form-signup').style.display='none';
});
document.getElementById('tab-signup').addEventListener('click',()=>{
  document.getElementById('tab-signup').classList.add('active');
  document.getElementById('tab-signin').classList.remove('active');
  document.getElementById('form-signup').style.display='flex';
  document.getElementById('form-signin').style.display='none';
});

// Toggle password visibility
function togglePw(inputId, btn){
  const inp = document.getElementById(inputId);
  const showing = inp.type==='text';
  inp.type = showing?'password':'text';
  btn.innerHTML = showing?'<i class="fa fa-eye"></i>':'<i class="fa fa-eye-slash"></i>';
}
document.getElementById('si-eye').addEventListener('click',()=>togglePw('si-pass',document.getElementById('si-eye')));
document.getElementById('su-eye').addEventListener('click',()=>togglePw('su-pass',document.getElementById('su-eye')));

// Sign In
async function signIn(){
  const email=document.getElementById('si-email').value.trim();
  const pass=document.getElementById('si-pass').value;
  const errEl=document.getElementById('si-error');
  errEl.textContent='';
  if(!email||!pass){errEl.textContent='Preencha todos os campos';return;}
  const btn=document.getElementById('btn-signin');
  btn.disabled=true;btn.innerHTML='<i class="fa fa-spinner fa-spin"></i> Entrando...';
  const{error}=await db.auth.signInWithPassword({email,password:pass});
  btn.disabled=false;btn.innerHTML='<i class="fa fa-right-to-bracket"></i> Entrar';
  if(error){errEl.textContent=error.message==='Invalid login credentials'?'E-mail ou senha incorretos':error.message;}
}
document.getElementById('btn-signin').addEventListener('click',signIn);
document.getElementById('si-pass').addEventListener('keydown',e=>{if(e.key==='Enter') signIn();});

// Sign Up
async function signUp(){
  const email=document.getElementById('su-email').value.trim();
  const pass=document.getElementById('su-pass').value;
  const pass2=document.getElementById('su-pass2').value;
  const errEl=document.getElementById('su-error');
  errEl.textContent='';
  if(!email||!pass){errEl.textContent='Preencha todos os campos';return;}
  if(pass.length<6){errEl.textContent='Senha deve ter pelo menos 6 caracteres';return;}
  if(pass!==pass2){errEl.textContent='As senhas não coincidem';return;}
  const btn=document.getElementById('btn-signup');
  btn.disabled=true;btn.innerHTML='<i class="fa fa-spinner fa-spin"></i> Criando...';
  const{error}=await db.auth.signUp({email,password:pass,options:{emailRedirectTo:null,data:{email_confirm:false}}});
  btn.disabled=false;btn.innerHTML='<i class="fa fa-user-plus"></i> Criar conta';
  if(error){errEl.textContent=error.message==='User already registered'?'Este e-mail já está cadastrado':error.message;return;}
  // Auto sign in after signup
  await db.auth.signInWithPassword({email,password:pass});
}
document.getElementById('btn-signup').addEventListener('click',signUp);
document.getElementById('su-pass2').addEventListener('keydown',e=>{if(e.key==='Enter') signUp();});

// Sign Out
document.getElementById('user-avatar').addEventListener('click',async()=>{
  if(confirm('Deseja sair da conta?')){await db.auth.signOut();location.reload();}
});

// Auth state
db.auth.onAuthStateChange(async(event,session)=>{
  if(session?.user){
    currentUser=session.user;
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='flex';
    const av=document.getElementById('user-avatar');
    av.textContent=(currentUser.email||'U')[0].toUpperCase();
    av.title=`${currentUser.email} — clique para sair`;
    initNewMap();
    loadMapsList();
  }
});

// ── SIDEBAR TOGGLE (mobile) ───────────────────
const sidebar=document.getElementById('sidebar');
const sidebarOverlay=document.getElementById('sidebar-overlay');
document.getElementById('btn-sidebar-toggle').addEventListener('click',()=>{
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('show');
});
sidebarOverlay.addEventListener('click',()=>{
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
});

// ── RENDER ────────────────────────────────────
function applyTransform(){
  scene.setAttribute('transform',`translate(${pan.x},${pan.y}) scale(${zoom})`);
}

function getNodeRadius(n){ return nodeRadius[String(n.id)] !== undefined ? nodeRadius[String(n.id)] : 12; }

function render(){
  scene.innerHTML='';
  applyTransform();

  // Edges
  edges.forEach(e=>{
    const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
    if(!a||!b) return;
    const ax=a.x+a.w/2, ay=a.y+a.h/2, bx=b.x+b.w/2, by=b.y+b.h/2, mx=(ax+bx)/2;
    const col=getColors(b.colorIdx);
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',`M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`);
    path.setAttribute('fill','none');
    path.setAttribute('stroke',col.stroke);
    path.setAttribute('stroke-width','2');
    path.setAttribute('opacity','0.5');
    scene.appendChild(path);
  });

  // Nodes
  nodes.forEach(n=>{
    const col=getColors(n.colorIdx);
    const imgUrl=nodeImages[String(n.id)];
    const hasImg=!!imgUrl;
    const hasNote=!!(nodeNotes[String(n.id)]);
    const rx=getNodeRadius(n);
    const nodeH=hasImg?Math.max(n.h,90):n.h;

    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','node'+(n.id===selectedId?' selected':''));
    g.setAttribute('data-id',n.id);

    // Shadow rect (selected glow)
    const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('class','node-rect');
    rect.setAttribute('x',n.x); rect.setAttribute('y',n.y);
    rect.setAttribute('width',n.w); rect.setAttribute('height',nodeH);
    rect.setAttribute('rx',rx);
    rect.setAttribute('fill',col.fill);
    rect.setAttribute('stroke',col.stroke);
    rect.setAttribute('stroke-width',n.id===selectedId?'2.5':'1.2');
    rect.setAttribute('filter',n.id===selectedId?'url(#shadow-sel)':'url(#shadow)');
    rect.setAttribute('opacity',n.id===selectedId?'1':'0.88');
    g.appendChild(rect);

    // Image
    if(hasImg){
      const clipId='clip-'+n.id;
      const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
      const clip=document.createElementNS('http://www.w3.org/2000/svg','clipPath');
      clip.setAttribute('id',clipId);
      const cr=document.createElementNS('http://www.w3.org/2000/svg','rect');
      const imgH=nodeH-n.h-4; const actualImgH=Math.max(imgH,50);
      cr.setAttribute('x',n.x+4); cr.setAttribute('y',n.y+4);
      cr.setAttribute('width',n.w-8); cr.setAttribute('height',actualImgH);
      cr.setAttribute('rx',Math.max(rx-3,4));
      clip.appendChild(cr); defs.appendChild(clip); scene.appendChild(defs);
      const imgEl=document.createElementNS('http://www.w3.org/2000/svg','image');
      imgEl.setAttribute('href',imgUrl);
      imgEl.setAttribute('x',n.x+4); imgEl.setAttribute('y',n.y+4);
      imgEl.setAttribute('width',n.w-8); imgEl.setAttribute('height',actualImgH);
      imgEl.setAttribute('preserveAspectRatio','xMidYMid slice');
      imgEl.setAttribute('clip-path',`url(#${clipId})`);
      g.appendChild(imgEl);
    }

    // Label
    const textY=hasImg?n.y+nodeH-10:n.y+n.h/2+5;
    const text=document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('x',n.x+n.w/2); text.setAttribute('y',textY);
    text.setAttribute('text-anchor','middle');
    text.setAttribute('font-size',Math.max(10,Math.min(14,n.h/3.2)).toFixed(0));
    text.setAttribute('font-family','DM Sans, sans-serif');
    text.setAttribute('font-weight','500');
    text.setAttribute('fill',col.text);
    text.setAttribute('pointer-events','none');
    const maxChars=Math.floor(n.w/7.5);
    text.textContent=n.text.length>maxChars?n.text.slice(0,maxChars-1)+'…':n.text;
    g.appendChild(text);

    // Note badge
    if(hasNote){
      const nb=document.createElementNS('http://www.w3.org/2000/svg','rect');
      nb.setAttribute('x',n.x+n.w-14); nb.setAttribute('y',n.y+3);
      nb.setAttribute('width',11); nb.setAttribute('height',11);
      nb.setAttribute('rx',3); nb.setAttribute('fill',col.stroke);
      g.appendChild(nb);
      const nt=document.createElementNS('http://www.w3.org/2000/svg','text');
      nt.setAttribute('x',n.x+n.w-8.5); nt.setAttribute('y',n.y+11);
      nt.setAttribute('text-anchor','middle'); nt.setAttribute('font-size','7');
      nt.setAttribute('fill','#fff'); nt.setAttribute('pointer-events','none');
      nt.textContent='✎'; g.appendChild(nt);
    }

    // Resize handle (bottom-right corner)
    if(n.id===selectedId){
      const rh=document.createElementNS('http://www.w3.org/2000/svg','rect');
      rh.setAttribute('class','resize-handle');
      rh.setAttribute('x',n.x+n.w-10); rh.setAttribute('y',n.y+nodeH-10);
      rh.setAttribute('width',10); rh.setAttribute('height',10);
      rh.setAttribute('rx',2); rh.setAttribute('fill',col.stroke);
      rh.setAttribute('cursor','se-resize');
      rh.addEventListener('mousedown',e=>{ e.stopPropagation(); startResize(e,n); });
      g.appendChild(rh);
    }

    g.addEventListener('mousedown',e=>{e.stopPropagation();onNodeMouseDown(e,n.id);});
    g.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();selectNode(n.id);showCtxMenu(e.clientX,e.clientY);});
    g.addEventListener('dblclick',e=>{e.stopPropagation();startEdit(n.id);});
    // Touch long-press for context menu
    let longPressT;
    g.addEventListener('touchstart',e=>{
      longPressT=setTimeout(()=>{
        const t=e.touches[0];
        selectNode(n.id);showCtxMenu(t.clientX,t.clientY);
      },600);
    },{passive:true});
    g.addEventListener('touchend',()=>clearTimeout(longPressT));
    g.addEventListener('touchmove',()=>clearTimeout(longPressT));

    scene.appendChild(g);
  });
}

function rebuildEdges(){
  edges=[];
  nodes.forEach(n=>{if(n.parentId) edges.push({from:n.parentId,to:n.id});});
}

// ── NODE OPS ──────────────────────────────────
function makeNode(x,y,text,parentId,colorIdx){
  const ci=colorIdx!==undefined?colorIdx:(nodes.length%COLORS.length);
  return{id:nextId++,x,y,w:140,h:42,text:text||'Nova ideia',parentId:parentId||null,colorIdx:ci};
}
function selectNode(id){selectedId=id;render();updateSizePanel();}
function addChild(parentId){
  const p=nodes.find(n=>n.id===parentId);if(!p) return;
  const siblings=nodes.filter(n=>n.parentId===parentId);
  const ci=(p.colorIdx+1+siblings.length)%COLORS.length;
  const child=makeNode(p.x+p.w+80,p.y+siblings.length*62,'Nova ideia',parentId,ci);
  nodes.push(child);rebuildEdges();selectedId=child.id;render();startEdit(child.id);
}
function addSibling(id){
  const n=nodes.find(x=>x.id===id);if(!n) return;
  const ci=(n.colorIdx+2)%COLORS.length;
  const sib=makeNode(n.x,n.y+62,'Nova ideia',n.parentId,ci);
  nodes.push(sib);rebuildEdges();selectedId=sib.id;render();startEdit(sib.id);
}
function deleteNode(id){
  if(nodes.length<=1){showToast('Não é possível excluir o único nó');return;}
  if(nodes[0]&&id===nodes[0].id){showToast('Não é possível excluir o nó raiz');return;}
  const sub=getSubtree(id);
  sub.forEach(sid=>{delete nodeImages[String(sid)];delete nodeNotes[String(sid)];delete nodeRadius[String(sid)];});
  nodes=nodes.filter(n=>!sub.includes(n.id));
  if(selectedId&&sub.includes(selectedId)) selectedId=null;
  rebuildEdges();render();
}
function getSubtree(id){
  const res=[id];let i=0;
  while(i<res.length){const cur=res[i++];nodes.filter(n=>n.parentId===cur).forEach(n=>res.push(n.id));}
  return res;
}
function changeColor(id){
  const n=nodes.find(x=>x.id===id);
  if(n){n.colorIdx=(n.colorIdx+1)%COLORS.length;render();}
}

// ── NODE RESIZE ───────────────────────────────
function startResize(e,n){
  e.preventDefault();
  const startX=e.clientX, startY=e.clientY;
  const startW=n.w, startH=n.h;
  function onMove(ev){
    n.w=Math.max(80,startW+(ev.clientX-startX)/zoom);
    n.h=Math.max(32,startH+(ev.clientY-startY)/zoom);
    render();updateSizePanel();
  }
  function onUp(){ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); }
  window.addEventListener('mousemove',onMove);
  window.addEventListener('mouseup',onUp);
}

// ── SIZE PANEL ────────────────────────────────
const slW=document.getElementById('sl-width');
const slH=document.getElementById('sl-height');
const slR=document.getElementById('sl-radius');
const slWV=document.getElementById('sl-width-val');
const slHV=document.getElementById('sl-height-val');
const slRV=document.getElementById('sl-radius-val');

function updateSizePanel(){
  const n=nodes.find(x=>x.id===selectedId);
  if(!n) return;
  slW.value=n.w; slWV.textContent=Math.round(n.w);
  slH.value=n.h; slHV.textContent=Math.round(n.h);
  const r=getNodeRadius(n);
  slR.value=r; slRV.textContent=r;
}

slW.addEventListener('input',()=>{
  const n=nodes.find(x=>x.id===selectedId);
  if(n){n.w=+slW.value;slWV.textContent=slW.value;render();}
});
slH.addEventListener('input',()=>{
  const n=nodes.find(x=>x.id===selectedId);
  if(n){n.h=+slH.value;slHV.textContent=slH.value;render();}
});
slR.addEventListener('input',()=>{
  if(selectedId==null) return;
  nodeRadius[String(selectedId)]=+slR.value;
  slRV.textContent=slR.value;render();
});

document.querySelectorAll('.size-dot').forEach(dot=>{
  dot.addEventListener('click',()=>{
    const n=nodes.find(x=>x.id===selectedId);
    if(!n) return;
    n.w=+dot.dataset.w; n.h=+dot.dataset.h;
    nodeRadius[String(n.id)]=+dot.dataset.r;
    document.querySelectorAll('.size-dot').forEach(d=>d.classList.remove('active'));
    dot.classList.add('active');
    updateSizePanel(); render();
  });
});

document.getElementById('btn-node-size').addEventListener('click',e=>{
  e.stopPropagation();
  if(!selectedId){showToast('Selecione um nó primeiro');return;}
  sizePanelEl.classList.toggle('open');
  if(sizePanelEl.classList.contains('open')) updateSizePanel();
});
document.getElementById('cm-resize').addEventListener('click',()=>{
  if(!selectedId) return;
  sizePanelEl.classList.add('open');
  updateSizePanel();
});
document.addEventListener('click',e=>{
  if(!sizePanelEl.contains(e.target)&&e.target.id!=='btn-node-size') sizePanelEl.classList.remove('open');
});

// ── EDIT ──────────────────────────────────────
function startEdit(id){
  const n=nodes.find(x=>x.id===id);if(!n) return;
  const rect=canvasWrap.getBoundingClientRect();
  editBox.style.display='block';
  editBox.style.left=((n.x*zoom)+pan.x+rect.left+4)+'px';
  editBox.style.top=((n.y*zoom)+pan.y+rect.top+8)+'px';
  editInput.style.width=(n.w*zoom-8)+'px';
  editInput.value=n.text; editInput.focus(); editInput.select();
  editInput._nodeId=id;
}
function finishEdit(){
  const id=editInput._nodeId;if(id==null) return;
  const n=nodes.find(x=>x.id===id);
  if(n&&editInput.value.trim()) n.text=editInput.value.trim();
  editBox.style.display='none';editInput._nodeId=null;render();
}
editInput.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Escape') finishEdit();});
editInput.addEventListener('blur',finishEdit);

// ── CTX MENU ──────────────────────────────────
function showCtxMenu(cx,cy){
  const rect=canvasWrap.getBoundingClientRect();
  let x=cx-rect.left,y=cy-rect.top;
  if(x+200>rect.width) x=rect.width-205;
  if(y+240>rect.height) y=rect.height-245;
  ctxMenu.style.left=x+'px';ctxMenu.style.top=y+'px';ctxMenu.style.display='block';
}
document.addEventListener('click',()=>ctxMenu.style.display='none');
document.getElementById('cm-edit').addEventListener('click',()=>{if(selectedId) startEdit(selectedId);});
document.getElementById('cm-child').addEventListener('click',()=>{if(selectedId) addChild(selectedId);});
document.getElementById('cm-sibling').addEventListener('click',()=>{if(selectedId) addSibling(selectedId);});
document.getElementById('cm-del').addEventListener('click',()=>{if(selectedId) deleteNode(selectedId);});
document.getElementById('cm-color').addEventListener('click',()=>{if(selectedId) changeColor(selectedId);});
document.getElementById('cm-note').addEventListener('click',()=>{
  if(!selectedId) return;
  noteInput.value=nodeNotes[String(selectedId)]||'';
  noteModal.style.display='flex'; noteModal.dataset.nodeId=selectedId;
  setTimeout(()=>noteInput.focus(),100);
});
document.getElementById('note-save').addEventListener('click',()=>{
  const id=noteModal.dataset.nodeId;
  nodeNotes[String(id)]=noteInput.value.trim();
  noteModal.style.display='none'; render(); showToast('Nota salva ✓','ok');
});
document.getElementById('note-cancel').addEventListener('click',()=>noteModal.style.display='none');
document.getElementById('cm-image').addEventListener('click',()=>{
  if(!selectedId) return;
  const ex=nodeImages[String(selectedId)];
  if(ex){modalImg.src=ex;imgModal.style.display='flex';imgModal.dataset.nodeId=selectedId;}
  else{imgInput.dataset.nodeId=selectedId;imgInput.click();}
});

// ── IMAGE UPLOAD ──────────────────────────────
imgInput.addEventListener('change',async()=>{
  const file=imgInput.files[0], nodeId=imgInput.dataset.nodeId;
  if(!file||!nodeId) return;
  if(!currentMapId){showToast('Salve o mapa primeiro!','error');return;}
  await uploadImageToNode(file,String(nodeId));
  imgInput.value='';
});
document.getElementById('modal-close').addEventListener('click',()=>imgModal.style.display='none');
document.getElementById('modal-change').addEventListener('click',()=>{imgInput.dataset.nodeId=imgModal.dataset.nodeId;imgInput.click();imgModal.style.display='none';});
document.getElementById('modal-remove').addEventListener('click',async()=>{
  const nodeId=imgModal.dataset.nodeId;
  await db.from('node_images').delete().eq('map_id',currentMapId).eq('node_id',String(nodeId));
  delete nodeImages[String(nodeId)]; imgModal.style.display='none'; render(); showToast('Imagem removida');
});

// Drag & drop image onto canvas
const imgHint=document.getElementById('img-hint');
canvasWrap.addEventListener('dragover',e=>{e.preventDefault();canvasWrap.classList.add('drag-over');imgHint.classList.add('show');});
canvasWrap.addEventListener('dragleave',()=>{canvasWrap.classList.remove('drag-over');imgHint.classList.remove('show');});
canvasWrap.addEventListener('drop',async e=>{
  e.preventDefault();canvasWrap.classList.remove('drag-over');imgHint.classList.remove('show');
  const file=e.dataTransfer.files[0];
  if(!file||!file.type.startsWith('image/')){showToast('Solte uma imagem válida','error');return;}
  const rect=canvasWrap.getBoundingClientRect();
  const mx=(e.clientX-rect.left-pan.x)/zoom, my=(e.clientY-rect.top-pan.y)/zoom;
  const target=nodes.find(n=>mx>=n.x&&mx<=n.x+n.w&&my>=n.y&&my<=n.y+n.h+50);
  if(!target){
    if(!currentMapId){showToast('Salve o mapa primeiro!','error');return;}
    const nn=makeNode(mx-70,my-21,'Imagem',null,nodes.length%COLORS.length);
    nodes.push(nn);rebuildEdges();selectedId=nn.id;render();
    await uploadImageToNode(file,String(nn.id));return;
  }
  selectedId=target.id;render();
  if(!currentMapId){showToast('Salve o mapa primeiro!','error');return;}
  await uploadImageToNode(file,String(target.id));
});

async function uploadImageToNode(file,nodeId){
  if(!currentMapId){showToast('Salve o mapa primeiro!','error');return;}
  showToast('Enviando imagem...');
  const ext=file.name.split('.').pop();
  const path=`${currentUser.id}/${currentMapId}/${nodeId}_${Date.now()}.${ext}`;
  const{error}=await db.storage.from('node-images').upload(path,file,{upsert:true});
  if(error){showToast('Erro ao enviar','error');console.error(error);return;}
  const{data}=db.storage.from('node-images').getPublicUrl(path);
  await db.from('node_images').upsert({map_id:currentMapId,node_id:nodeId,url:data.publicUrl},{onConflict:'map_id,node_id'});
  nodeImages[nodeId]=data.publicUrl;
  showToast('Imagem adicionada! ✓','ok');render();
}

// ── EXPORT ────────────────────────────────────
document.getElementById('btn-export').addEventListener('click',async()=>{
  showToast('Gerando imagem...');
  try{
    const svgEl=document.getElementById('svg');
    const svgData=new XMLSerializer().serializeToString(svgEl);
    const canvas=document.createElement('canvas');
    const rect=svgEl.getBoundingClientRect();
    canvas.width=rect.width*2;canvas.height=rect.height*2;
    const ctx=canvas.getContext('2d');
    ctx.scale(2,2);ctx.fillStyle=isLight?'#f0effe':'#0a0a0f';
    ctx.fillRect(0,0,rect.width,rect.height);
    const img=new Image();
    const blob=new Blob([svgData],{type:'image/svg+xml'});
    const url=URL.createObjectURL(blob);
    img.onload=()=>{ctx.drawImage(img,0,0);URL.revokeObjectURL(url);const a=document.createElement('a');a.download=(mapTitleIn.value||'mapa')+'.png';a.href=canvas.toDataURL('image/png');a.click();showToast('Exportado! ✓','ok');};
    img.src=url;
  }catch(e){showToast('Erro ao exportar','error');}
});

// ── SHARE ─────────────────────────────────────
document.getElementById('btn-share').addEventListener('click',()=>{
  if(!currentMapId){showToast('Salve o mapa primeiro!','error');return;}
  document.getElementById('share-link-input').value=`${window.location.origin}?share=${currentMapId}`;
  shareModal.style.display='flex';
});
document.getElementById('share-close').addEventListener('click',()=>shareModal.style.display='none');
document.getElementById('btn-copy-link').addEventListener('click',()=>{
  const inp=document.getElementById('share-link-input');
  inp.select();navigator.clipboard.writeText(inp.value);showToast('Link copiado! ✓','ok');
});

// ── PAN & ZOOM ────────────────────────────────
function onNodeMouseDown(e,id){
  selectNode(id);
  const n=nodes.find(x=>x.id===id);if(!n) return;
  nodeDrag=id;
  const rect=canvasWrap.getBoundingClientRect();
  nodeDragOffset={x:(e.clientX-rect.left-pan.x)/zoom-n.x,y:(e.clientY-rect.top-pan.y)/zoom-n.y};
  canvasWrap.classList.add('grabbing');
}
canvasWrap.addEventListener('mousedown',e=>{
  if(e.button!==0||nodeDrag) return;
  dragging=true;dragStart={x:e.clientX,y:e.clientY};panStart={x:pan.x,y:pan.y};
  canvasWrap.classList.add('grabbing');
});
window.addEventListener('mousemove',e=>{
  if(nodeDrag){
    const n=nodes.find(x=>x.id===nodeDrag);if(!n) return;
    const rect=canvasWrap.getBoundingClientRect();
    n.x=(e.clientX-rect.left-pan.x)/zoom-nodeDragOffset.x;
    n.y=(e.clientY-rect.top-pan.y)/zoom-nodeDragOffset.y;
    render();return;
  }
  if(!dragging) return;
  pan.x=panStart.x+(e.clientX-dragStart.x);pan.y=panStart.y+(e.clientY-dragStart.y);applyTransform();
});
window.addEventListener('mouseup',()=>{dragging=false;nodeDrag=null;canvasWrap.classList.remove('grabbing');});
canvasWrap.addEventListener('wheel',e=>{
  e.preventDefault();
  const d=e.deltaY<0?1.1:0.91;
  const rect=canvasWrap.getBoundingClientRect();
  const mx=e.clientX-rect.left,my=e.clientY-rect.top;
  pan.x=mx-(mx-pan.x)*d;pan.y=my-(my-pan.y)*d;
  zoom=Math.min(4,Math.max(0.15,zoom*d));
  zoomLabel.textContent=Math.round(zoom*100)+'%';applyTransform();
},{passive:false});

// Touch pan & pinch zoom
let touches={}, lastDist=0;
canvasWrap.addEventListener('touchstart',e=>{
  if(e.touches.length===2){
    lastDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  }
  if(e.touches.length===1&&!nodeDrag){
    dragging=true;
    dragStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
    panStart={x:pan.x,y:pan.y};
  }
},{passive:true});
canvasWrap.addEventListener('touchmove',e=>{
  e.preventDefault();
  if(e.touches.length===2){
    const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    const d=dist/lastDist;lastDist=dist;
    const rect=canvasWrap.getBoundingClientRect();
    const mx=(e.touches[0].clientX+e.touches[1].clientX)/2-rect.left;
    const my=(e.touches[0].clientY+e.touches[1].clientY)/2-rect.top;
    pan.x=mx-(mx-pan.x)*d;pan.y=my-(my-pan.y)*d;
    zoom=Math.min(4,Math.max(0.15,zoom*d));
    zoomLabel.textContent=Math.round(zoom*100)+'%';applyTransform();
  } else if(e.touches.length===1&&dragging&&!nodeDrag){
    pan.x=panStart.x+(e.touches[0].clientX-dragStart.x);
    pan.y=panStart.y+(e.touches[0].clientY-dragStart.y);applyTransform();
  }
},{passive:false});
canvasWrap.addEventListener('touchend',()=>{dragging=false;});

document.getElementById('btn-zoom-in').addEventListener('click',()=>{zoom=Math.min(4,zoom*1.2);zoomLabel.textContent=Math.round(zoom*100)+'%';applyTransform();});
document.getElementById('btn-zoom-out').addEventListener('click',()=>{zoom=Math.max(0.15,zoom/1.2);zoomLabel.textContent=Math.round(zoom*100)+'%';applyTransform();});
document.getElementById('btn-zoom-reset').addEventListener('click',()=>{zoom=1;pan={x:300,y:200};zoomLabel.textContent='100%';applyTransform();});

// ── TOOLBAR ───────────────────────────────────
document.getElementById('btn-add-child').addEventListener('click',()=>{if(selectedId) addChild(selectedId);else showToast('Selecione um nó primeiro');});
document.getElementById('btn-add-sibling').addEventListener('click',()=>{if(selectedId) addSibling(selectedId);else showToast('Selecione um nó primeiro');});
document.getElementById('btn-delete-node').addEventListener('click',()=>{if(selectedId) deleteNode(selectedId);else showToast('Selecione um nó primeiro');});
searchInput.addEventListener('input',()=>loadMapsList(searchInput.value.trim().toLowerCase()));

// ── SAVE / LOAD ───────────────────────────────
async function saveMap(){
  if(!currentUser) return;
  const title=mapTitleIn.value.trim()||'Sem título';
  const payload={title,nodes,edges,next_id:nextId,pan_x:pan.x,pan_y:pan.y,node_notes:nodeNotes,node_radius:nodeRadius,user_id:currentUser.id};
  if(currentMapId){
    const{error}=await db.from('maps').update({...payload,updated_at:new Date().toISOString()}).eq('id',currentMapId).eq('user_id',currentUser.id);
    if(error){showToast('Erro ao salvar','error');console.error(error);return;}
  } else {
    const{data,error}=await db.from('maps').insert(payload).select().single();
    if(error){showToast('Erro ao salvar','error');console.error(error);return;}
    currentMapId=data.id;
  }
  showToast('Mapa salvo ✓','ok');loadMapsList();
}
async function loadMap(id){
  const{data,error}=await db.from('maps').select('*').eq('id',id).single();
  if(error){showToast('Erro ao carregar','error');return;}
  nodes=data.nodes||[];edges=data.edges||[];nextId=data.next_id||(nodes.length+1);
  pan={x:data.pan_x||300,y:data.pan_y||200};currentMapId=id;selectedId=null;
  mapTitleIn.value=data.title||'';nodeNotes=data.node_notes||{};nodeRadius=data.node_radius||{};
  nodeImages={};
  const{data:imgs}=await db.from('node_images').select('*').eq('map_id',id);
  if(imgs) imgs.forEach(img=>{nodeImages[img.node_id]=img.url;});
  zoom=1;zoomLabel.textContent='100%';render();loadMapsList();
  sidebar.classList.remove('open');sidebarOverlay.classList.remove('show');
  showToast('Mapa carregado');
}
async function deleteMap(id){
  await db.from('maps').delete().eq('id',id).eq('user_id',currentUser.id);
  if(currentMapId===id){currentMapId=null;initNewMap();}
  loadMapsList();showToast('Mapa excluído');
}
async function loadMapsList(filter=''){
  if(!currentUser) return;
  const{data}=await db.from('maps').select('id,title,updated_at').eq('user_id',currentUser.id).order('updated_at',{ascending:false});
  mapsList.innerHTML='';
  let items=data||[];
  if(filter) items=items.filter(m=>(m.title||'').toLowerCase().includes(filter));
  if(!items.length){mapsList.innerHTML='<p class="empty-msg">'+(filter?'Nenhum resultado':'Nenhum mapa salvo')+'</p>';return;}
  items.forEach(m=>{
    const div=document.createElement('div');
    div.className='map-item'+(m.id===currentMapId?' active':'');
    div.innerHTML=`<i class="fa fa-brain" style="font-size:11px;opacity:0.4;flex-shrink:0"></i><span class="map-name">${m.title||'Sem título'}</span><span class="map-del" title="Excluir">×</span>`;
    div.addEventListener('click',e=>{if(e.target.classList.contains('map-del')) return;loadMap(m.id);});
    div.querySelector('.map-del').addEventListener('click',e=>{e.stopPropagation();if(confirm('Excluir este mapa?')) deleteMap(m.id);});
    mapsList.appendChild(div);
  });
}
function initNewMap(){
  nodes=[];edges=[];nextId=1;selectedId=null;nodeImages={};nodeNotes={};nodeRadius={};currentMapId=null;
  mapTitleIn.value='';pan={x:300,y:200};zoom=1;zoomLabel.textContent='100%';
  nodes.push(makeNode(-70,-20,'Ideia Central',null,0));rebuildEdges();render();
}
document.getElementById('btn-save').addEventListener('click',saveMap);
document.getElementById('btn-new-map').addEventListener('click',()=>{initNewMap();showToast('Novo mapa criado');});

// ── KEYBOARD ──────────────────────────────────
window.addEventListener('keydown',e=>{
  if([editInput,mapTitleIn,noteInput,searchInput].includes(e.target)) return;
  if(e.key==='Delete'||e.key==='Backspace'){if(selectedId) deleteNode(selectedId);}
  if(e.key==='Tab'){e.preventDefault();if(selectedId) addChild(selectedId);}
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveMap();}
  if(e.key==='F2'){if(selectedId) startEdit(selectedId);}
  if(e.key==='Escape'){selectedId=null;sizePanelEl.classList.remove('open');render();}
});
