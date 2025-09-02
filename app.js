// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, getDocs, query, where, orderBy, limit, Timestamp, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ===== Config fornecida =====
const firebaseConfig = {
  apiKey: "AIzaSyC4mALGbBqJsJp2Xo5twMImq1hHaSV2HuM",
  authDomain: "caixas18-08.firebaseapp.com",
  projectId: "caixas18-08",
  storageBucket: "caixas18-08.firebasestorage.app",
  messagingSenderId: "41940261133",
  appId: "1:41940261133:web:3d2254aafa02608c2df844",
  measurementId: "G-NF5D2RQYSE"
};

const ADMIN_MATS = ["6266","4144","70029"];
const BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const el = (id)=>document.getElementById(id);
const qsel = (sel)=>document.querySelectorAll(sel);
const page = location.pathname.split('/').pop();

let CURRENT_USER = null;
let CURRENT_USER_DATA = null;
let IS_ADMIN = false;

// ===== Helpers =====
function formatDateBR(ts){
  const d = ts instanceof Date ? ts : ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR');
}
function parseDateInput(value){
  const [y,m,d] = value.split('-').map(Number);
  if(!y||!m||!d) return null;
  return new Date(y, m-1, d);
}
function getMonthRange(year, monthIdx){
  const start = new Date(year, monthIdx, 1, 0,0,0,0);
  const end = new Date(year, monthIdx+1, 0, 23,59,59,999);
  return {start, end};
}
function getCurrentMonthValue(){
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

// ===== Auth Page (index & register) =====
if(page === 'index.html' || page === '' ){
  // Login
  const btnLogin = el('btnLogin');
  if(btnLogin){
    btnLogin.addEventListener('click', async ()=>{
      const matricula = (el('loginMatricula')?.value || '').trim();
      const senha = el('loginSenha')?.value || '';
      if(!matricula || !senha){ alert("Preencha matrícula e senha."); return; }
      const email = `${matricula}@movebuss.local`;
      try{
        await signInWithEmailAndPassword(auth, email, senha);
        location.href = 'dashboard.html';
      }catch(e){ alert("Erro no login: "+e.message); }
    });
  }
}

if(page === 'register.html'){
  const btnCad = el('btnCadastrar');
  if(btnCad){
    btnCad.addEventListener('click', async ()=>{
      const matricula = (el('cadMatricula')?.value || '').trim();
      const nome = (el('cadNome')?.value || '').trim();
      const senha = (el('cadSenha')?.value || '');
      if(!matricula || !nome || !senha){ alert("Preencha todos os campos"); return; }
      const email = `${matricula}@movebuss.local`;
      try{
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        await setDoc(doc(db,'usuarios',cred.user.uid), { matricula, nome, criadoEm: Timestamp.now() });
        alert("Usuário cadastrado! Faça login.");
        location.href = 'index.html';
      }catch(e){ alert("Erro ao cadastrar: "+e.message); }
    });
  }
}

// ===== Dashboard =====
if(page === 'dashboard.html'){
  onAuthStateChanged(auth, async (user)=>{
    if(!user){ location.href = 'index.html'; return; }
    CURRENT_USER = user;
    // Carrega dados do usuario
    const us = await getDoc(doc(db,'usuarios', user.uid));
    if(us.exists()){
      CURRENT_USER_DATA = us.data();
    }else{
      CURRENT_USER_DATA = { matricula: (user.email||'').split('@')[0], nome:"" };
    }
    IS_ADMIN = ADMIN_MATS.includes(CURRENT_USER_DATA.matricula);
    // UI roles
    qsel('.admin-only').forEach(b=> b.hidden = !IS_ADMIN);
    qsel('.user-only').forEach(b=> b.hidden = IS_ADMIN);
    // Carregar select de matrículas
    await popularMatriculasSelects();

    // binds
    el('btnLogout')?.addEventListener('click', async ()=>{ await signOut(auth); location.href='index.html'; });
    el('btnAlterarSenha')?.addEventListener('click', async ()=>{
      const nova = prompt("Nova senha:");
      if(!nova) return;
      try{ await updatePassword(auth.currentUser, nova); alert("Senha alterada."); }catch(e){ alert("Erro: "+e.message); }
    });

    el('btnResumoRecebedor')?.addEventListener('click', ()=> el('resumoWrap').classList.toggle('collapsed'));
    el('btnToggleResumo')?.addEventListener('click', ()=> el('resumoWrap').classList.toggle('collapsed'));
    el('mesResumo').value = getCurrentMonthValue();
    el('btnCarregarResumo')?.addEventListener('click', carregarResumoAdmin);

    // cálculo sobra/falta no form
    ['valorFolha','valorDinheiro'].forEach(id=>{
      const i = el(id); i && i.addEventListener('input', ()=>{
        const vf = parseFloat(el('valorFolha').value||0);
        const vd = parseFloat(el('valorDinheiro').value||0);
        el('sobraFalta').value = BRL.format(vd - vf);
      });
    });

    // Salvar relatório (ADMIN)
    el('btnSalvarRelatorio')?.addEventListener('click', salvarRelatorioAdmin);

    // Filtros
    el('btnAplicarFiltroMatricula')?.addEventListener('click', filtrarPorMatricula);
    el('btnFiltrarPorData')?.addEventListener('click', filtrarPorData);

    // Carregar lista padrão
    await carregarListaPadrao();
  });
}

// ===== Preencher selects com matriculas de usuarios =====
async function popularMatriculasSelects(){
  const snap = await getDocs(collection(db,'usuarios'));
  const users = snap.docs.map(d=> d.data()).sort((a,b)=> (a.matricula||'').localeCompare(b.matricula||''));
  const selForm = el('matriculaForm');
  const selFiltro = el('filtroMatricula');
  const selResumo = el('selectMatriculas');
  const options = users.map(u=> `<option value="${u.matricula}">${u.matricula} — ${u.nome||''}</option>`).join('');
  if(selForm){ selForm.innerHTML = options; }
  if(selFiltro){ selFiltro.innerHTML = '<option value="">Selecione...</option>'+options; }
  if(selResumo){ selResumo.innerHTML = options; }
}

// ===== Salvar Relatório (ADMIN) =====
async function salvarRelatorioAdmin(){
  if(!IS_ADMIN){ alert("Apenas administradores podem criar relatórios."); return; }
  const matricula = el('matriculaForm').value;
  const data = parseDateInput(el('dataCaixa').value);
  const vf = parseFloat(el('valorFolha').value||0);
  const vd = parseFloat(el('valorDinheiro').value||0);
  const obs = el('observacao').value||'';
  if(!matricula || !data){ alert("Preencha matrícula e data."); return; }
  try{
    const sobra = vd - vf;
    await addDoc(collection(db,'relatorios'),{
      matricula,
      dataCaixa: Timestamp.fromDate(data),
      valorFolha: vf,
      valorDinheiro: vd,
      sobraFalta: sobra,
      observacao: obs,
      posTexto: "",
      posEditado: false,
      imagemPath: "",
      criadoEm: Timestamp.now(),
      createdBy: CURRENT_USER.uid
    });
    alert("Relatório salvo.");
    ['dataCaixa','valorFolha','valorDinheiro','observacao','sobraFalta'].forEach(id=> el(id).value="");
    await carregarListaPadrao();
  }catch(e){ alert("Erro ao salvar: "+e.message); }
}

// ===== Listagem padrão =====
async function carregarListaPadrao(){
  let qy;
  if(IS_ADMIN){
    qy = query(collection(db,'relatorios'), orderBy('dataCaixa','desc'), limit(10));
  }else{
    qy = query(collection(db,'relatorios'),
      where('matricula','==', CURRENT_USER_DATA.matricula),
      orderBy('dataCaixa','desc'), limit(10));
  }
  const snap = await getDocs(qy);
  renderLista(snap.docs.map(d=> ({id:d.id, ...d.data()})));
}

// ===== Filtros =====
async function filtrarPorMatricula(){
  if(!IS_ADMIN) return;
  const mat = el('filtroMatricula').value;
  if(!mat){ alert("Selecione uma matrícula."); return; }
  const qy = query(collection(db,'relatorios'), where('matricula','==',mat), orderBy('dataCaixa','desc'), limit(10));
  const snap = await getDocs(qy);
  renderLista(snap.docs.map(d=> ({id:d.id, ...d.data()})));
  el('selectMatriculas').value = mat;
}

async function filtrarPorData(){
  const val = el('filtroDataGlobal').value;
  if(!val){ alert("Escolha uma data."); return; }
  const d = parseDateInput(val);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);
  const qy = query(collection(db,'relatorios'),
    where('dataCaixa','>=', Timestamp.fromDate(start)),
    where('dataCaixa','<=', Timestamp.fromDate(end)),
    orderBy('dataCaixa','desc'));
  const snap = await getDocs(qy);
  let docs = snap.docs.map(d=> ({id:d.id, ...d.data()}));
  if(!IS_ADMIN){ docs = docs.filter(r=> r.matricula === CURRENT_USER_DATA.matricula); }
  renderLista(docs);
}

// ===== Resumo (ADMIN) =====
async function carregarResumoAdmin(){
  if(!IS_ADMIN) return;
  const mat = el('selectMatriculas').value;
  const [y,m] = (el('mesResumo').value || getCurrentMonthValue()).split('-').map(Number);
  const {start,end} = getMonthRange(y, m-1);
  const qy = query(collection(db,'relatorios'),
    where('matricula','==',mat),
    where('dataCaixa','>=', Timestamp.fromDate(start)),
    where('dataCaixa','<=', Timestamp.fromDate(end)),
    orderBy('dataCaixa','desc'));
  const snap = await getDocs(qy);
  const rows = snap.docs.map(d=> ({id:d.id, ...d.data()}));
  const totalFolha = rows.reduce((acc,r)=> acc + (r.valorFolha||0), 0);
  const saldo = rows.reduce((acc,r)=> acc + ((r.valorDinheiro||0)-(r.valorFolha||0)), 0);
  el('resumoTotalFolha').textContent = BRL.format(totalFolha);
  el('resumoSaldo').textContent = BRL.format(saldo);
  el('resumoSituacao').textContent = saldo>=0 ? "POSITIVO" : "NEGATIVO";

  const tipo = el('filtroPositivosNegativos').value;
  const filtrados = rows.filter(r=>{
    const sf = (r.valorDinheiro||0)-(r.valorFolha||0);
    if(tipo==='positivos') return sf>0;
    if(tipo==='negativos') return sf<0;
    return true;
  });
  const cont = el('resumoLista'); cont.innerHTML = "";
  filtrados.forEach(r=>{
    const sf = (r.valorDinheiro||0)-(r.valorFolha||0);
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="item-header">
        <div class="item-title">${formatDateBR(r.dataCaixa)} — Matrícula ${r.matricula}</div>
        <span class="badge">${BRL.format(r.valorFolha||0)} | ${BRL.format(r.valorDinheiro||0)} | <strong>${BRL.format(sf)}</strong></span>
      </div>`;
    cont.appendChild(div);
  });
}

// ===== Render Lista =====
function renderLista(rows){
  const lista = el('listaRelatorios'); lista.innerHTML = "";
  rows.forEach(r=>{
    const wrap = document.createElement('div');
    wrap.className = 'item';
    const hasPos = r.posTexto && r.posTexto.trim().length>0;
    const warn = hasPos ? '<span class="badge warn">⚠️ verificar pós conferência</span>' : '';
    wrap.innerHTML = `
      <div class="item-header">
        <div class="item-title">${formatDateBR(r.dataCaixa)} — Matrícula ${r.matricula} ${warn}</div>
        <div class="controls">
          <button class="btn outline btnToggle">Esconder/Exibir</button>
          <button class="btn outline btnPos">Pós Conferência</button>
          ${IS_ADMIN ? '<button class="btn outline btnEdit">Editar Relatório</button>' : ''}
          ${IS_ADMIN ? '<button class="btn danger btnDelete">Excluir Relatório</button>' : ''}
        </div>
      </div>
      <div class="item-body collapsed">
        <div class="field"><div>Data do Caixa</div><div>${formatDateBR(r.dataCaixa)}</div></div>
        <div class="field"><div>Valor Folha</div><div class="money">${BRL.format(r.valorFolha||0)}</div></div>
        <div class="field"><div>Valor em Dinheiro</div><div class="money">${BRL.format(r.valorDinheiro||0)}</div></div>
        <div class="field"><div>Sobra/Falta</div><div class="money">${BRL.format((r.valorDinheiro||0)-(r.valorFolha||0))}</div></div>
        <div class="field"><div>Observação</div><div>${(r.observacao||'').replace(/[<>&]/g,'')}</div></div>
      </div>
    `;
    const body = wrap.querySelector('.item-body');
    wrap.querySelector('.btnToggle').addEventListener('click', ()=> body.classList.toggle('collapsed'));
    wrap.querySelector('.btnPos').addEventListener('click', ()=> openPosModal(r));
    if(IS_ADMIN){
      wrap.querySelector('.btnEdit').addEventListener('click', ()=> editRelatorio(r));
      wrap.querySelector('.btnDelete').addEventListener('click', ()=> deleteRelatorio(r));
    }
    lista.appendChild(wrap);
  });
}

// ===== Editar / Excluir (ADMIN) =====
async function editRelatorio(r){
  if(!IS_ADMIN) return;
  const novaFolha = prompt("Valor Folha (R$)", r.valorFolha);
  if(novaFolha===null) return;
  const novoDinheiro = prompt("Valor em Dinheiro (R$)", r.valorDinheiro);
  if(novoDinheiro===null) return;
  const novaObs = prompt("Observação", r.observacao||"");
  const sobra = parseFloat(novoDinheiro||0) - parseFloat(novaFolha||0);
  await updateDoc(doc(db,'relatorios', r.id), {
    valorFolha: parseFloat(novaFolha||0),
    valorDinheiro: parseFloat(novoDinheiro||0),
    observacao: novaObs||"",
    sobraFalta: sobra
  });
  await carregarListaPadrao();
}

async function deleteRelatorio(r){
  if(!IS_ADMIN) return;
  if(!confirm("Excluir este relatório?")) return;
  if(r.imagemPath){
    try{ await deleteObject(ref(storage, r.imagemPath)); }catch(e){}
  }
  await deleteDoc(doc(db,'relatorios', r.id));
  await carregarListaPadrao();
}

// ===== Pós Conferência =====
let POS_RELATORIO_ATUAL = null;

function openPosModal(r){
  POS_RELATORIO_ATUAL = r;
  const modal = el('posModal');
  el('posTexto').value = r.posTexto || "";
  el('posTexto').disabled = !IS_ADMIN;
  el('btnAnexarImagem').hidden = !IS_ADMIN;
  el('btnSalvarPos').hidden = !IS_ADMIN;
  el('btnExcluirImagem').hidden = !IS_ADMIN;
  el('previewImagem').hidden = true;
  modal.showModal();
}

el('btnFecharPos')?.addEventListener('click', ()=> el('posModal').close());
el('btnAnexarImagem')?.addEventListener('click', ()=> el('posImagemInput').click());

el('posImagemInput')?.addEventListener('change', async (ev)=>{
  if(!IS_ADMIN || !POS_RELATORIO_ATUAL) return;
  const file = ev.target.files[0];
  if(!file) return;
  // path inclui matricula para reforçar regras de storage
  const path = `posConferencia/${POS_RELATORIO_ATUAL.matricula}/${POS_RELATORIO_ATUAL.id}/${file.name}`;
  await uploadBytes(ref(storage, path), file);
  await updateDoc(doc(db,'relatorios', POS_RELATORIO_ATUAL.id), {
    imagemPath: path,
    posEditado: true
  });
  alert("Imagem anexada.");
  POS_RELATORIO_ATUAL.imagemPath = path;
});

el('btnVerImagem')?.addEventListener('click', async ()=>{
  if(!POS_RELATORIO_ATUAL) return;
  if(!POS_RELATORIO_ATUAL.imagemPath){ alert("Nenhuma imagem anexada."); return; }
  const url = await getDownloadURL(ref(storage, POS_RELATORIO_ATUAL.imagemPath));
  const prev = el('previewImagem');
  prev.src = url;
  prev.hidden = false;
});

el('btnExcluirImagem')?.addEventListener('click', async ()=>{
  if(!IS_ADMIN || !POS_RELATORIO_ATUAL?.imagemPath) return;
  if(!confirm("Excluir imagem anexada?")) return;
  await deleteObject(ref(storage, POS_RELATORIO_ATUAL.imagemPath));
  await updateDoc(doc(db,'relatorios', POS_RELATORIO_ATUAL.id), { imagemPath: "" });
  POS_RELATORIO_ATUAL.imagemPath = "";
  el('previewImagem').hidden = true;
  alert("Imagem excluída.");
});

el('btnSalvarPos')?.addEventListener('click', async ()=>{
  if(!IS_ADMIN || !POS_RELATORIO_ATUAL) return;
  const texto = el('posTexto').value || "";
  await updateDoc(doc(db,'relatorios', POS_RELATORIO_ATUAL.id), { posTexto: texto, posEditado: true });
  alert("Pós conferência salvo.");
  el('posModal').close();
  await carregarListaPadrao();
});
