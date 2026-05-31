const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const COLORS = [
  {fill:'#2d2060',stroke:'#7f77dd',text:'#c8c4f8'},
  {fill:'#1a3a2a',stroke:'#2ecc71',text:'#a8f0c6'},
  {fill:'#3a1a1a',stroke:'#e05555',text:'#f0a8a8'},
  {fill:'#1a2d3a',stroke:'#4a9edd',text:'#a8d4f0'},
  {fill:'#2d2a10',stroke:'#d4a017',text:'#f0dea8'},
  {fill:'#2a1a30',stroke:'#c060d0',text:'#e0b0f0'},
  {fill:'#1a2d20',stroke:'#50b870',text:'#a8e0b8'},
];

let nodes=[],edges=[],nextId=1,selectedId=null;
let pan={x:0,y:0},zoom=1;
let dragging=false,dragStart={},panStart={};
let nodeDrag=null,nodeDragOffset={};
let currentMapId=null,nodeImages={};

const scene=document.getElementById('scene');
const canvasWrap=document.getElementById('canvas-wrap');
const ctxMenu=document.getElementById('ctx-menu');
const editBox=document.getElementById('edit-box');
const editInput=document.getElementById('edit-input');
const toastEl=document.getElementById('toast');
const mapTitleInput=document.getElementById('map-title-input');
const mapsList=document.getElementById('maps-list');
const imgInput=document.getElementById('img-input');
const imgModal=document.getElementById('img-modal');
const modalImg=document.getElementById('modal-img');
const zoomLabel=document.getElementById('zoom-label');

let toastTimer;
function showToast(msg,type=''){
  clearTimeout(toastTimer);
  toastEl.textContent=msg;
  toastEl.style.borderColor=type==='error'?'var(--danger)':'';
  toastEl.classList.add('show');
  toastTimer=setTimeout(()=>toastEl.classList.remove('show'),2500);
}

function applyTransform(){
  scene.setAttribute('transform',`translate(${pan.x},${pan.y}) scale(${zoom})`);
}

function render(){
  scene.innerHTML='';
  applyTransform();

  edges.forEach(e=>{
    const a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);
    if(!a||!b) return;
    const ax=a.x+a.w/2,ay=a.y+a.h/2,bx=b.x+b.w/2,by=b.y+b.h/2,mx=(ax+bx)/2;
    const col=COLORS[b.colorIdx%COLORS.length];
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',`M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`);
    path.setAttribute('fill','none');
    path.setAttribute('stroke',col.stroke);
    path.setAttribute('stroke-width','1.8');
    path.setAttribute('opacity','0.45');
    scene.appendChild(path);
  });

  nodes.forEach(n=>{
    const col=COLORS[n.colorIdx%COLORS.length];
    const imgUrl=nodeImages[String(n.id)];
    const hasImg=!!imgUrl;
    const nodeH=hasImg?90:n.h;
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','node'+(n.id===selectedId?' selected':''));
    g.setAttribute('data-id',n.id);

    const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('class','node-rect');
    rect.setAttribute('x',n.x);rect.setAttribute('y',n.y);
    rect.setAttribute('width',n.w);rect.setAttribute('height',nodeH);
    rect.setAttribute('rx',12);
    rect.setAttribute('fill',col.fill);
    rect.setAttribute('stroke',col.stroke);
    rect.setAttribute('stroke-width',n.id===selectedId?'2.5':'1.2');
    rect.setAttribute('opacity',n.id===selectedId?'1':'0.85');
    if(n.id===selectedId) rect.setAttribute('filter','url(#shadow)');
    g.appendChild(rect);

    if(hasImg){
      const clipId='clip-'+n.id;
      const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
      const clip=document.createElementNS('http://www.w3.org/2000/svg','clipPath');
      clip.setAttribute('id',clipId);
      const cr=document.createElementNS('http://www.w3.org/2000/svg','rect');
      cr.setAttribute('x',n.x+4);cr.setAttribute('y',n.y+4);
      cr.setAttribute('width',n.w-8);cr.setAttribute('height',52);cr.setAttribute('rx',8);
      clip.appendChild(cr);defs.appendChild(clip);scene.appendChild(defs);
      const imgEl=document.createElementNS('http://www.w3.org/2000/svg','image');
      imgEl.setAttribute('href',imgUrl);
      imgEl.setAttribute('x',n.x+4);imgEl.setAttribute('y',n.y+4);
      imgEl.setAttribute('width',n.w-8);imgEl.setAttribute('height',52);
      imgEl.setAttribute('preserveAspectRatio','xMidYMid slice');
      imgEl.setAttribute('clip-path',`url(#${clipId})`);
      g.appendChild(imgEl);
    }

    const textY=hasImg?n.y+74:n.y+n.h/2+5;
    const text=document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('x',n.x+n.w/2);text.setAttribute('y',textY);
    text.setAttribute('text-anchor','middle');
    text.setAttribute('font-size','12');
    text.setAttribute('font-family','DM Sans, sans-serif');
    text.setAttribute('font-weight','500');
    text.setAttribute('fill',col.text);
    const maxChars=Math.floor(n.w/7.5);
    text.textContent=n.text.length>maxChars?n.text.slice(0,maxChars-1)+'…':n.text;
    g.appendChild(text);

    g.addEventListener('mousedown',e=>{e.stopPropagation();onNodeMouseDown(e,n.id);});
    g.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();selectNode(n.id);showCtxMenu(e.clientX,e.clientY);});
    g.addEventListener('dblclick',e=>{e.stopPropagation();startEdit(n.id);});
    scene.appendChild(g);
  });
}

function rebuildEdges(){
  edges=[];
  nodes.forEach(n=>{if(n.parentId) edges.push({from:n.parentId,to:n.id});});
}

function makeNode(x,y,text,parentId,colorIdx){
  const ci=colorIdx!==undefined?colorIdx:(nodes.length%COLORS.length);
  return{id:nextId++,x,y,w:140,h:42,text:text||'Nova ideia',parentId:parentId||null,colorIdx:ci};
}

function selectNode(id){selectedId=id;render();}

function addChild(parentId){
  const p=nodes.find(n=>n.id===parentId);if(!p) return;
  const siblings=nodes.filter(n=>n.parentId===parentId);
  const ci=(p.colorIdx+1+siblings.length)%COLORS.length;
  const child=makeNode(p.x+p.w+70,p.y+siblings.length*60,'Nova ideia',parentId,ci);
  nodes.push(child);rebuildEdges();selectedId=child.id;render();startEdit(child.id);
}

function addSibling(id){
  const n=nodes.find(x=>x.id===id);if(!n) return;
  const ci=(n.colorIdx+2)%COLORS.length;
  const sib=makeNode(n.x,n.y+60,'Nova ideia',n.parentId,ci);
  nodes.push(sib);rebuildEdges();selectedId=sib.id;render();startEdit(sib.id);
}

function deleteNode(id){
  if(nodes.length<=1){showToast('Não é possível excluir o único nó');return;}
  if(nodes[0]&&id===nodes[0].id){showToast('Não é possível excluir o nó raiz');return;}
  const sub=getSubtree(id);
  sub.forEach(sid=>delete nodeImages[String(sid)]);
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

function startEdit(id){
  const n=nodes.find(x=>x.id===id);if(!n) return;
  const rect=canvasWrap.getBoundingClientRect();
  editBox.style.display='block';
  editBox.style.left=((n.x*zoom)+pan.x+rect.left+4)+'px';
  editBox.style.top=((n.y*zoom)+pan.y+rect.top+8)+'px';
  editInput.style.width=(n.w*zoom-8)+'px';
  editInput.value=n.text;
  editInput.focus();editInput.select();
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

function showCtxMenu(cx,cy){
  const rect=canvasWrap.getBoundingClientRect();
  ctxMenu.style.left=(cx-rect.left)+'px';
  ctxMenu.style.top=(cy-rect.top)+'px';
  ctxMenu.style.display='block';
}

document.addEventListener('click',()=>ctxMenu.style.display='none');
document.getElementById('cm-edit').addEventListener('click',()=>{if(selectedId) startEdit(selectedId);});
document.getElementById('cm-child').addEventListener('click',()=>{if(selectedId) addChild(selectedId);});
document.getElementById('cm-sibling').addEventListener('click',()=>{if(selectedId) addSibling(selectedId);});
document.getElementById('cm-del').addEventListener('click',()=>{if(selectedId) deleteNode(selectedId);});
document.getElementById('cm-color').addEventListener('click',()=>{if(selectedId) changeColor(selectedId);});
document.getElementById('cm-image').addEventListener('click',()=>{
  if(!selectedId) return;
  const existing=nodeImages[String(selectedId)];
  if(existing){modalImg.src=existing;imgModal.style.display='flex';imgModal.dataset.nodeId=selectedId;}
  else{imgInput.dataset.nodeId=selectedId;imgInput.click();}
});

imgInput.addEventListener('change',async()=>{
  const file=imgInput.files[0];
  const nodeId=imgInput.dataset.nodeId;
  if(!file||!nodeId){return;}
  if(!currentMapId){showToast('Salve o mapa primeiro!','error');return;}
  showToast('Enviando imagem...');
  const ext=file.name.split('.').pop();
  const path=`${currentMapId}/${nodeId}_${Date.now()}.${ext}`;
  const{error:upErr}=await db.storage.from('node-images').upload(path,file,{upsert:true});
  if(upErr){showToast('Erro ao enviar imagem','error');console.error(upErr);return;}
  const{data}=db.storage.from('node-images').getPublicUrl(path);
  const url=data.publicUrl;
  await db.from('node_images').upsert({map_id:currentMapId,node_id:String(nodeId),url},{onConflict:'map_id,node_id'});
  nodeImages[String(nodeId)]=url;
  showToast('Imagem adicionada!');render();
  imgInput.value='';
});

document.getElementById('modal-close').addEventListener('click',()=>imgModal.style.display='none');
document.getElementById('modal-change').addEventListener('click',()=>{
  imgInput.dataset.nodeId=imgModal.dataset.nodeId;imgInput.click();imgModal.style.display='none';
});
document.getElementById('modal-remove').addEventListener('click',async()=>{
  const nodeId=imgModal.dataset.nodeId;
  await db.from('node_images').delete().eq('map_id',currentMapId).eq('node_id',String(nodeId));
  delete nodeImages[String(nodeId)];
  imgModal.style.display='none';render();showToast('Imagem removida');
});

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
  pan.x=panStart.x+(e.clientX-dragStart.x);
  pan.y=panStart.y+(e.clientY-dragStart.y);
  applyTransform();
});

window.addEventListener('mouseup',()=>{dragging=false;nodeDrag=null;canvasWrap.classList.remove('grabbing');});

canvasWrap.addEventListener('wheel',e=>{
  e.preventDefault();
  const delta=e.deltaY<0?1.1:0.91;
  const rect=canvasWrap.getBoundingClientRect();
  const mx=e.clientX-rect.left,my=e.clientY-rect.top;
  pan.x=mx-(mx-pan.x)*delta;pan.y=my-(my-pan.y)*delta;
  zoom=Math.min(3,Math.max(0.2,zoom*delta));
  zoomLabel.textContent=Math.round(zoom*100)+'%';
  applyTransform();
},{passive:false});

document.getElementById('btn-zoom-in').addEventListener('click',()=>{zoom=Math.min(3,zoom*1.2);zoomLabel.textContent=Math.round(zoom*100)+'%';applyTransform();});
document.getElementById('btn-zoom-out').addEventListener('click',()=>{zoom=Math.max(0.2,zoom/1.2);zoomLabel.textContent=Math.round(zoom*100)+'%';applyTransform();});
document.getElementById('btn-zoom-reset').addEventListener('click',()=>{zoom=1;pan={x:300,y:200};zoomLabel.textContent='100%';applyTransform();});

document.getElementById('btn-add-child').addEventListener('click',()=>{if(selectedId) addChild(selectedId);else showToast('Selecione um nó primeiro');});
document.getElementById('btn-add-sibling').addEventListener('click',()=>{if(selectedId) addSibling(selectedId);else showToast('Selecione um nó primeiro');});
document.getElementById('btn-delete-node').addEventListener('click',()=>{if(selectedId) deleteNode(selectedId);else showToast('Selecione um nó primeiro');});

async function saveMap(){
  const title=mapTitleInput.value.trim()||'Sem título';
  const payload={title,nodes,edges,next_id:nextId,pan_x:pan.x,pan_y:pan.y};
  if(currentMapId){
    const{error}=await db.from('maps').update({...payload,updated_at:new Date().toISOString()}).eq('id',currentMapId);
    if(error){showToast('Erro ao salvar','error');console.error(error);return;}
  }else{
    const{data,error}=await db.from('maps').insert(payload).select().single();
    if(error){showToast('Erro ao salvar','error');console.error(error);return;}
    currentMapId=data.id;
  }
  showToast('Mapa salvo ✓');loadMapsList();
}

async function loadMap(id){
  const{data,error}=await db.from('maps').select('*').eq('id',id).single();
  if(error){showToast('Erro ao carregar','error');return;}
  nodes=data.nodes||[];edges=data.edges||[];nextId=data.next_id||(nodes.length+1);
  pan={x:data.pan_x||300,y:data.pan_y||200};currentMapId=id;selectedId=null;
  mapTitleInput.value=data.title||'';
  nodeImages={};
  const{data:imgs}=await db.from('node_images').select('*').eq('map_id',id);
  if(imgs) imgs.forEach(img=>{nodeImages[img.node_id]=img.url;});
  zoom=1;zoomLabel.textContent='100%';render();loadMapsList();showToast('Mapa carregado');
}

async function deleteMap(id){
  await db.from('maps').delete().eq('id',id);
  if(currentMapId===id){currentMapId=null;initNewMap();}
  loadMapsList();showToast('Mapa excluído');
}

async function loadMapsList(){
  const{data,error}=await db.from('maps').select('id,title,updated_at').order('updated_at',{ascending:false});
  mapsList.innerHTML='';
  if(error||!data||!data.length){mapsList.innerHTML='<p class="empty-msg">Nenhum mapa salvo</p>';return;}
  data.forEach(m=>{
    const div=document.createElement('div');
    div.className='map-item'+(m.id===currentMapId?' active':'');
    div.innerHTML=`<i class="fa fa-brain" style="font-size:11px;opacity:0.5"></i><span class="map-name">${m.title||'Sem título'}</span><span class="map-del" title="Excluir">×</span>`;
    div.addEventListener('click',e=>{if(e.target.classList.contains('map-del')) return;loadMap(m.id);});
    div.querySelector('.map-del').addEventListener('click',e=>{e.stopPropagation();deleteMap(m.id);});
    mapsList.appendChild(div);
  });
}

function initNewMap(){
  nodes=[];edges=[];nextId=1;selectedId=null;nodeImages={};currentMapId=null;
  mapTitleInput.value='';pan={x:300,y:200};zoom=1;zoomLabel.textContent='100%';
  const root=makeNode(-70,-20,'Ideia Central',null,0);
  nodes.push(root);rebuildEdges();render();
}

document.getElementById('btn-save').addEventListener('click',saveMap);
document.getElementById('btn-new-map').addEventListener('click',()=>{initNewMap();showToast('Novo mapa criado');});

window.addEventListener('keydown',e=>{
  if(e.target===editInput||e.target===mapTitleInput) return;
  if(e.key==='Delete'||e.key==='Backspace'){if(selectedId) deleteNode(selectedId);}
  if(e.key==='Tab'){e.preventDefault();if(selectedId) addChild(selectedId);}
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveMap();}
  if(e.key==='F2'){if(selectedId) startEdit(selectedId);}
});

initNewMap();
loadMapsList();
