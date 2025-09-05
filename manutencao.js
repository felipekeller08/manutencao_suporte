// manutencao.js
import {
  auth, onAuthStateChanged, signOut,
  db, doc, getDoc, setDoc, updateDoc, collection,
  query, orderBy, onSnapshot, serverTimestamp, deleteDoc
} from './firebase.js';

/* ===== Config ===== */
const ADMIN_PASS = 'admin123'; // troque por uma senha forte

/* ===== Helpers ===== */
const $  = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const fmt = d => d ? (d.toDate ? d.toDate() : d).toLocaleString() : '';

function escapeHtml(s=''){
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

const daysBetween = (a,b) => {
  try {
    const A = a?.toDate ? a.toDate() : a;
    const B = b?.toDate ? b.toDate() : b;
    const diff = Math.ceil((B - A) / 86400000);
    return Math.max(1, diff);
  } catch { return 1; }
};

const monthKey = (dateObj)=>{
  const d = dateObj || new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); // YYYY-MM
};
const monthLabel = (key)=>{
  const [y,m] = key.split('-').map(Number);
  const d = new Date(y, m-1, 1);
  return d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
};

/* ===== Tabs ===== */
function bindTabs(){
  $$('.tabs .tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.tabs .tab').forEach(b=>b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const target = btn.dataset.tab;
      $$('.tab-panel').forEach(p=>{
        p.style.display = (p.id === 'tab-'+target ? 'block' : 'none');
      });
    });
  });
}

/* ===== Auth ===== */
let currentUser = null;
onAuthStateChanged(auth, (u)=>{
  if(!u){ location.href='index.html'; return; }
  currentUser = u;
  initChamados();
  initArquivados();
});

$('#btnSair')?.addEventListener('click', async ()=>{
  try{ await signOut(auth); }catch{}
  location.href='index.html';
});

/* ===== CHAMADOS (cards) ===== */
let unsubChamados = null;
let _cacheChamados = []; // cache para re-render de filtros

function filtroMatches(t){
  const s  = $('#fSetor')?.value || '';
  const st = $('#fStatus')?.value || '';
  const g  = $('#fGrav')?.value || '';

  if(s && (t.setor||'')!==s) return false;
  if(g && (t.gravidade||'')!==g) return false;

  if(st==='aberto'        && t.status!=='aberto')        return false;
  if(st==='em_andamento'  && t.status!=='em_andamento')  return false;
  if(st==='concluido'     && t.status!=='concluido')     return false;

  return true;
}

function renderChamados(list){
  const host = $('#listaChamados');
  if(!host) return;

  host.innerHTML = list.length ? '' : `<div class="empty">Sem chamados.</div>`;

  list.forEach(t=>{
    const fotoHtml = t.photoUrl
      ? `<img class="thumb" src="${t.photoUrl}" alt="Foto do chamado">`
      : (t.photoBase64 ? `<img class="thumb" src="${t.photoBase64}" alt="Foto do chamado">` : '');

    const canArchive = !t.archivedAt;

    const solicitante = t.userEmail || t.solicitante || t.solicitanteEmail || '';
    const motivo = t.inProgressReason || t.motivoAndamento || t.andamentoMotivo || t.motivo || '';
    const motivoHtml = (t.status==='em_andamento' && motivo)
      ? `<div class="andamento-motivo"><b>Motivo:</b> ${escapeHtml(motivo)}</div>`
      : '';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head">
        <div class="title">${escapeHtml(t.setor || '-')}</div>
        <span class="status ${escapeHtml(t.status||'')}">${String(t.status||'-').toUpperCase()}</span>
      </div>

      <div class="meta-row">
        <div class="meta-item"><span class="k">Gravidade</span><span class="v">${escapeHtml(t.gravidade || '-')}</span></div>
        <div class="meta-item"><span class="k">Sala</span><span class="v">${escapeHtml(t.sala || '-')}</span></div>
        <div class="meta-item"><span class="k">Abertura</span><span class="v">${fmt(t.createdAt)}</span></div>
        <div class="meta-item"><span class="k">Dias</span><span class="v">${daysBetween(t.createdAt, new Date())}</span></div>
        <div class="meta-item"><span class="k">Solicitante</span><span class="v">${escapeHtml(solicitante || '-')}</span></div>
        ${t.assignedTo ? `<div class="meta-item"><span class="k">Executante</span><span class="v">${escapeHtml(t.assignedTo)}</span></div>` : ''}
      </div>

      ${motivoHtml}
<div class="upimg">
      ${fotoHtml}
</div>
      ${t.descricao ? `<p class="desc">${escapeHtml(t.descricao).replace(/\n/g,'<br>')}</p>` : ''}

      <div class="actions">
        <button class="btn" data-act="andamento">Em andamento</button>
        <button class="btn btn-ok" data-act="arquivar" ${canArchive?'':'disabled'}>Concluir & Arquivar</button>
      </div>
    `;

    // Em andamento
    card.querySelector('[data-act="andamento"]').addEventListener('click', async ()=>{
      const executor = prompt('Executante:');
      if(!executor) return;
      const motivo = prompt('Motivo de estar em andamento:') || '';
      await updateDoc(doc(db,'tickets',t.id), {
        status: 'em_andamento',
        assignedTo: executor,
        inProgressReason: motivo,
        startedAt: (t.startedAt || serverTimestamp())
      });
      alert('Marcado como em andamento.');
    });

    // Concluir & Arquivar
    card.querySelector('[data-act="arquivar"]')?.addEventListener('click', async ()=>{
      try{
        // NEW: pergunta o executante no momento do arquivamento
        const executor = prompt('Quem executou? (nome)');
        if (!executor) {
          if (!confirm('Arquivar sem informar executante?')) return;
        }
        await arquivarTicket(t, executor); // NEW: passa executante
        alert('Chamado arquivado e removido do professor.');
      }catch(e){
        alert(e.message||e);
      }
    });

    host.appendChild(card);
  });
}

function initChamados(){
  bindTabs();

  ['#fSetor','#fStatus','#fGrav'].forEach(sel=>{
    $(sel)?.addEventListener('change', ()=>{
      renderChamados(_cacheChamados.filter(filtroMatches));
    });
  });

  const qy = query(collection(db,'tickets'));
  if(unsubChamados) unsubChamados();
  unsubChamados = onSnapshot(qy, snap=>{
    const list=[];
    snap.forEach(d=> list.push({id:d.id, ...d.data()}));
    list.sort((a,b)=> (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
    _cacheChamados = list;
    renderChamados(list.filter(filtroMatches));
  }, err=>{
    console.error(err);
    alert('Erro ao listar chamados: '+(err.message||err));
  });
}

/* ===== ARQUIVADOS ===== */
let unsubArquivados = null;
const selMes = $('#selMesArquivado');

function buildMonthOptions(){
  if(!selMes) return;
  selMes.innerHTML = '';
  const now = new Date();
  for(let i=0;i<18;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = monthKey(d);
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = monthLabel(key);
    if(i===0) opt.selected = true;
    selMes.appendChild(opt);
  }
}

function watchArquivados(key){
  const tbody = $('#tbodyArquivados');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="11" class="muted">Carregando…</td></tr>';
  if(unsubArquivados) unsubArquivados();

  const qy = query(collection(db, `archives/${key}/tickets`), orderBy('closedAt','asc'));
  unsubArquivados = onSnapshot(qy, snap=>{
    const rows=[]; snap.forEach(d=> rows.push({id:d.id, ...d.data()}));

    if(!rows.length){
      tbody.innerHTML = '<tr><td colspan="11" class="muted">Sem chamados arquivados neste mês.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r=>`
      <tr data-id="${r.id}">
        <td>${escapeHtml(r.setor||'-')}</td>
        <td>${escapeHtml(r.gravidade||'-')}</td>
        <td>${escapeHtml(r.sala||'-')}</td>
        <td>${escapeHtml(r.assignedTo||'-')}</td>
        <td>${escapeHtml(r.userEmail || r.solicitante || '')}</td>
        <td class="desc-col">${escapeHtml(r.descricao||'').replace(/\n/g,'<br>')}</td>
        <td>${fmt(r.createdAt)}</td>
        <td>${fmt(r.startedAt)}</td>
        <td>${fmt(r.closedAt)}</td>
        <td>${daysBetween(r.createdAt, r.closedAt)}</td>
        <td class="actions-col">
          <button class="btn is-blue"  data-reopen="${r.id}">Reabrir</button>
          <button class="btn btn-warn" data-del="${r.id}">Excluir</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-reopen]').forEach(btn=>{
      const id = btn.dataset.reopen;
      const r = rows.find(x=>x.id===id);
      btn.addEventListener('click', async ()=>{
        if(!confirm('Reabrir este chamado e colocá-lo novamente na fila?')) return;
        try{
          await reabrirChamadoDoArquivo(key, r);
          alert('Chamado reaberto.');
        }catch(e){
          alert('Erro ao reabrir: ' + (e.message||e));
        }
      });
    });

    tbody.querySelectorAll('[data-del]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const pass = prompt('Senha do admin para excluir:');
        if(pass !== ADMIN_PASS){ alert('Senha inválida.'); return; }
        if(!confirm('Excluir definitivamente este registro arquivado?')) return;
        try{
          await deleteDoc(doc(db, `archives/${key}/tickets/${btn.dataset.del}`));
          alert('Excluído.');
        }catch(e){
          alert('Erro ao excluir: '+(e.message||e));
        }
      });
    });

  }, err=>{
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="11" class="muted">Erro: ${err.message||err}</td></tr>`;
  });
}

function initArquivados(){
  buildMonthOptions();
  if(selMes){
    watchArquivados(selMes.value);
    selMes.addEventListener('change', ()=> watchArquivados(selMes.value));
  }
}

// Reabre: cria novo chamado em 'tickets' e remove do arquivo
async function reabrirChamadoDoArquivo(key, r){
  const newRef = doc(collection(db,'tickets'));
  const payload = {
    userUid:   r.userUid || '',
    userEmail: r.userEmail || '',
    setor:     r.setor || '',
    sala:      r.sala || '',
    descricao: r.descricao || '',
    gravidade: r.gravidade || '',
    assignedTo: '',
    createdAt: r.createdAt || serverTimestamp(),
    status: 'aberto',
    reopenedFrom: r.ticketId || r.id,
    reopenedFromMonth: key
  };
  await setDoc(newRef, payload);
  await deleteDoc(doc(db, `archives/${key}/tickets/${r.id}`));
}

/* ===== Arquivar (grava em archives/ e apaga do professor) ===== */
// NEW: recebe executante opcional
async function arquivarTicket(t, executante){
  if(t.archivedAt) throw new Error('Este chamado já foi arquivado.');
  const tid = t.id;
  const mes = monthKey(new Date());
  const archRef = doc(db, `archives/${mes}/tickets/${tid}`);

  const payload = {
    ticketId:   tid,
    userUid:    t.userUid || '',
    userEmail:  t.userEmail || '', // solicitante
    setor:      t.setor || '',
    sala:       t.sala || '',
    descricao:  t.descricao || '',
    gravidade:  t.gravidade || '',
    // NEW: executante vem do prompt (se não vier, usa o que já estiver no ticket)
    assignedTo: (executante || t.assignedTo || ''),
    createdAt:  t.createdAt || null,
    startedAt:  t.startedAt || null,
    closedAt:   serverTimestamp()
  };

  const existing = await getDoc(archRef);
  if(existing.exists()) throw new Error('Já arquivado.');

  await setDoc(archRef, payload);
  await deleteDoc(doc(db,'tickets',tid)); // remove do app do professor
}
