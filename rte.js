// =============================================
// RICH TEXT EDITOR — rte.js
// =============================================

const rteModal     = document.getElementById('rte-modal');
const rteEditor    = document.getElementById('rte-editor');
const rteTitleIn   = document.getElementById('rte-title-input');
const rteAttach    = document.getElementById('rte-attachments');
const rteWords     = document.getElementById('rte-words');
const rteChars     = document.getElementById('rte-chars');
const linkDialog   = document.getElementById('link-dialog');

let rteNodeId      = null;
let nodeRichText   = {};   // nodeId -> { html, title, attachments[] }
let savedRange     = null;

// ── OPEN / CLOSE ─────────────────────────────
function openRTE(nodeId) {
  rteNodeId = nodeId;
  const n    = nodes.find(x => x.id === nodeId);
  const data = nodeRichText[String(nodeId)] || {};

  rteTitleIn.value       = data.title || (n ? n.text : '');
  rteEditor.innerHTML    = data.html  || '';
  renderAttachments(data.attachments || []);

  rteModal.classList.add('open');
  setTimeout(() => { 
    rteEditor.focus();
    if (rteEditor.innerHTML === '') {
      rteEditor.click();
    }
  }, 100);
  updateStats();
}

document.getElementById('rte-save').addEventListener('click',   async () => { await closeRTE(true); });
document.getElementById('rte-cancel').addEventListener('click', () => closeRTE(false));

async function closeRTE(apply) {
  if (apply && rteNodeId != null) {
    const title = rteTitleIn.value.trim();
    const n = nodes.find(x => x.id === rteNodeId);
    if (n && title) n.text = title;

    nodeRichText[String(rteNodeId)] = {
      html: rteEditor.innerHTML,
      title,
      attachments: (nodeRichText[String(rteNodeId)] || {}).attachments || [],
    };
    render();
    const saved = await saveMap();
    if (saved) showToast('Conteúdo salvo ✓', 'ok');
  }
  rteModal.classList.remove('open');
  linkDialog.classList.remove('open');
}

// Close on overlay click
rteModal.addEventListener('click', e => { if (e.target === rteModal) closeRTE(false); });

// ── RIBBON TABS ───────────────────────────────
document.querySelectorAll('.ribbon-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ribbon-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
  });
});

// ── EXEC COMMAND BUTTONS ──────────────────────
document.querySelectorAll('[data-cmd]').forEach(btn => {
  btn.addEventListener('mousedown', e => {
    e.preventDefault();
    const val = btn.dataset.val || null;
    document.execCommand(btn.dataset.cmd, false, val);
    rteEditor.focus();
    updateActiveStates();
  });
});

// ── FONT SIZE ─────────────────────────────────
document.getElementById('rte-font-size').addEventListener('change', function() {
  document.execCommand('fontSize', false, this.value);
  rteEditor.focus();
});

// ── FONT FACE ─────────────────────────────────
document.getElementById('rte-font-face').addEventListener('change', function() {
  document.execCommand('fontName', false, this.value);
  rteEditor.focus();
});

// ── TEXT COLOR ────────────────────────────────
document.getElementById('rte-color').addEventListener('input', function() {
  document.execCommand('foreColor', false, this.value);
  rteEditor.focus();
});

// ── HIGHLIGHT ────────────────────────────────
document.getElementById('rte-bg-color').addEventListener('input', function() {
  document.execCommand('hiliteColor', false, this.value);
  rteEditor.focus();
});

// ── CLEAR FORMAT ─────────────────────────────
document.getElementById('rte-clear-format').addEventListener('click', () => {
  document.execCommand('removeFormat', false, null);
  rteEditor.focus();
});

// ── COLOR SWATCHES ────────────────────────────
document.querySelectorAll('.color-swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    document.execCommand('foreColor', false, sw.dataset.color);
    rteEditor.focus();
  });
});

// ── BLOCKQUOTE ───────────────────────────────
document.getElementById('rte-quote').addEventListener('click', () => {
  document.execCommand('formatBlock', false, 'blockquote');
  rteEditor.focus();
});

// ── INLINE CODE ──────────────────────────────
document.getElementById('rte-code-btn').addEventListener('click', () => {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const code  = document.createElement('code');
  code.textContent = range.toString() || 'código';
  range.deleteContents();
  range.insertNode(code);
  rteEditor.focus();
});

// ── HR ────────────────────────────────────────
document.getElementById('rte-hr').addEventListener('click', () => {
  document.execCommand('insertHorizontalRule', false, null);
  rteEditor.focus();
});

// ── UNDO / REDO ──────────────────────────────
document.getElementById('rte-undo').addEventListener('click', () => { document.execCommand('undo'); rteEditor.focus(); });
document.getElementById('rte-redo').addEventListener('click', () => { document.execCommand('redo'); rteEditor.focus(); });

// ── EMOJI ────────────────────────────────────
const EMOJIS = ['😀','😍','🎉','✅','❌','⚠️','💡','🔥','🚀','💎','📌','📎','🔗','📊','📈','🧠','💬','❓','✨','🎯'];
document.getElementById('rte-emoji').addEventListener('click', e => {
  e.stopPropagation();
  let picker = document.getElementById('emoji-picker');
  if (picker) { picker.remove(); return; }
  picker = document.createElement('div');
  picker.id = 'emoji-picker';
  picker.style.cssText = `position:absolute;background:var(--surface);border:1px solid var(--border2);border-radius:12px;padding:10px;display:flex;flex-wrap:wrap;gap:4px;max-width:220px;z-index:4000;box-shadow:0 8px 30px rgba(0,0,0,0.4)`;
  EMOJIS.forEach(em => {
    const btn = document.createElement('button');
    btn.textContent = em; btn.style.cssText = 'font-size:18px;background:none;border:none;cursor:pointer;border-radius:6px;padding:3px';
    btn.addEventListener('click', () => { document.execCommand('insertText', false, em); picker.remove(); rteEditor.focus(); });
    picker.appendChild(btn);
  });
  document.getElementById('panel-inserir').appendChild(picker);
  document.addEventListener('click', () => picker.remove(), { once: true });
});

// ── LINK ─────────────────────────────────────
function saveSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
}

function restoreSelection() {
  if (!savedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
}

document.getElementById('rte-link-btn').addEventListener('click', e => {
  e.stopPropagation();
  saveSelection();
  const sel = window.getSelection();
  document.getElementById('link-text').value = sel.toString() || '';
  document.getElementById('link-url').value  = '';
  const rect = e.currentTarget.getBoundingClientRect();
  linkDialog.style.top  = (rect.bottom + 6) + 'px';
  linkDialog.style.left = rect.left + 'px';
  linkDialog.classList.toggle('open');
  setTimeout(() => document.getElementById('link-url').focus(), 60);
});

document.getElementById('link-ok').addEventListener('click', () => {
  const url  = document.getElementById('link-url').value.trim();
  const text = document.getElementById('link-text').value.trim() || url;
  if (!url) return;
  restoreSelection();
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.textContent = text;
  const range = window.getSelection().getRangeAt(0);
  range.deleteContents();
  range.insertNode(a);
  linkDialog.classList.remove('open');
  rteEditor.focus();
});

document.getElementById('link-cancel').addEventListener('click', () => linkDialog.classList.remove('open'));

// Ctrl+K shortcut
rteEditor.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('rte-link-btn').click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
});

// ── TABLE ─────────────────────────────────────
document.getElementById('rte-table-btn').addEventListener('click', () => {
  const rows = +document.getElementById('tbl-rows').value || 3;
  const cols = +document.getElementById('tbl-cols').value || 3;
  let html = '<table>';
  html += '<tr>' + Array(cols).fill('<th>Cabeçalho</th>').join('') + '</tr>';
  for (let r = 0; r < rows - 1; r++) {
    html += '<tr>' + Array(cols).fill('<td>Célula</td>').join('') + '</tr>';
  }
  html += '</table><p><br></p>';
  document.execCommand('insertHTML', false, html);
  rteEditor.focus();
});

// ── IMAGE IN EDITOR ───────────────────────────
document.getElementById('rte-img-btn').addEventListener('click', () => {
  document.getElementById('rte-img-input').click();
});
document.getElementById('rte-img-input').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.execCommand('insertImage', false, e.target.result);
    rteEditor.focus();
  };
  reader.readAsDataURL(file);
  this.value = '';
});

// ── PDF / FILE ATTACHMENTS ────────────────────
document.getElementById('rte-pdf-btn').addEventListener('click', () => document.getElementById('rte-pdf-input').click());
document.getElementById('rte-file-btn').addEventListener('click', () => document.getElementById('rte-any-input').click());

async function handleAttachment(file) {
  if (!file) return;
  if (!currentMapId) { showToast('Salve o mapa primeiro!', 'error'); return; }
  showToast('Enviando arquivo...');
  if(!currentUser){ showToast('Faça login para anexar arquivos','error'); return; }
  const ext  = file.name.split('.').pop();
  const path = `${currentMapId}/attach_${Date.now()}.${ext}`;
  const { error } = await db.storage.from('node-images').upload(path, file, { upsert: true });
  if (error) { showToast('Erro ao enviar', 'error'); return; }
  const { data } = db.storage.from('node-images').getPublicUrl(path);
  const att = { name: file.name, url: data.publicUrl, type: file.type };

  if (!nodeRichText[String(rteNodeId)]) nodeRichText[String(rteNodeId)] = { html: '', title: '', attachments: [] };
  nodeRichText[String(rteNodeId)].attachments.push(att);
  renderAttachments(nodeRichText[String(rteNodeId)].attachments);
  showToast('Arquivo anexado ✓', 'ok');
}

document.getElementById('rte-pdf-input').addEventListener('change', function() { handleAttachment(this.files[0]); this.value = ''; });
document.getElementById('rte-any-input').addEventListener('change', function() { handleAttachment(this.files[0]); this.value = ''; });

function renderAttachments(atts) {
  rteAttach.innerHTML = '';
  if (!atts || !atts.length) return;
  atts.forEach((att, i) => {
    const icon = att.type === 'application/pdf' ? 'fa-file-pdf' :
                 att.type.startsWith('image/')   ? 'fa-image'    : 'fa-paperclip';
    const chip = document.createElement('div');
    chip.className = 'attach-chip';
    chip.innerHTML = `<i class="fa ${icon}"></i> ${att.name} <span class="attach-del" data-i="${i}">×</span>`;
    chip.addEventListener('click', e => {
      if (e.target.classList.contains('attach-del')) {
        nodeRichText[String(rteNodeId)].attachments.splice(+e.target.dataset.i, 1);
        renderAttachments(nodeRichText[String(rteNodeId)].attachments);
      } else {
        window.open(att.url, '_blank');
      }
    });
    rteAttach.appendChild(chip);
  });
}

// ── STATS ─────────────────────────────────────
function updateStats() {
  const text  = rteEditor.innerText || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  rteWords.innerHTML = `<i class="fa fa-file-word"></i> ${words} palavra${words !== 1 ? 's' : ''}`;
  rteChars.innerHTML = `<i class="fa fa-font"></i> ${text.length} chars`;
}
rteEditor.addEventListener('input', updateStats);

// ── ACTIVE STATES ─────────────────────────────
function updateActiveStates() {
  ['bold','italic','underline','strikeThrough'].forEach(cmd => {
    const map = { bold:'[data-cmd="bold"]', italic:'[data-cmd="italic"]', underline:'[data-cmd="underline"]', strikeThrough:'[data-cmd="strikeThrough"]' };
    const btn = document.querySelector(map[cmd]);
    if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
  });
}
rteEditor.addEventListener('keyup', updateActiveStates);
rteEditor.addEventListener('mouseup', updateActiveStates);

// ── HOOK INTO CTX MENU ────────────────────────
// Replace the note handler to open RTE instead
document.getElementById('cm-note').addEventListener('click', () => {
  if (!selectedId) return;
  openRTE(selectedId);
});

// Expose for app.js
window.openRTE = openRTE;
window.nodeRichText = nodeRichText;
