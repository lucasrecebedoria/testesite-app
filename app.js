// ===== Firebase SDKs =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, updatePassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, collection, doc, setDoc, getDoc, addDoc, getDocs, 
  query, where, orderBy, limit, Timestamp, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ===== Config Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyC4mALGbBqJsJp2Xo5twMImq1hHaSV2HuM",
  authDomain: "caixas18-08.firebaseapp.com",
  projectId: "caixas18-08",
  storageBucket: "caixas18-08.appspot.com", // 🔥 corrigido
  messagingSenderId: "41940261133",
  appId: "1:41940261133:web:3d2254aafa02608c2df844",
  measurementId: "G-NF5D2RQYSE"
};

// ===== Variáveis globais =====
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

// ===== Página de Login =====
if(page === 'index.html' || page === '' ){
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

// ===== Página de Cadastro =====
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

// ===== Página de Dashboard =====
if(page === 'dashboard.html'){
  onAuthStateChanged(auth, async (user)=>{
    if(!user){ location.href = 'index.html'; return; }
    CURRENT_USER = user;

    // Carrega dados do usuário
    const us = await getDoc(doc(db,'usuarios', user.uid));
    if(us.exists()){
      CURRENT_USER_DATA = us.data();
    }else{
      CURRENT_USER_DATA = { matricula: (user.email||'').split('@')[0], nome:"" };
    }

    IS_ADMIN = ADMIN_MATS.includes(CURRENT_USER_DATA.matricula);

    // Mostra/oculta áreas conforme perfil
    qsel('.admin-only').forEach(b=> b.hidden = !IS_ADMIN);
    qsel('.user-only').forEach(b=> b.hidden = IS_ADMIN);

    // Preenche selects
    await popularMatriculasSelects();

    // Bind botões principais
    el('btnLogout')?.addEventListener('click', async ()=>{ await signOut(auth); location.href='index.html'; });
    el('btnAlterarSenha')?.addEventListener('click', async ()=>{
      const nova = prompt("Nova senha:");
      if(!nova) return;
      try{ await updatePassword(auth.currentUser, nova); alert("Senha alterada."); }catch(e){ alert("Erro: "+e.message); }
    });

    // Resumo admin
    el('btnResumoRecebedor')?.addEventListener('click', ()=> el('resumoWrap').classList.toggle('collapsed'));
    el('btnToggleResumo')?.addEventListener('click', ()=> el('resumoWrap').classList.toggle('collapsed'));
    if(el('mesResumo')) el('mesResumo').value = getCurrentMonthValue();
    el('btnCarregarResumo')?.addEventListener('click', carregarResumoAdmin);

    // Calcula sobra/falta em tempo real
    ['valorFolha','valorDinheiro'].forEach(id=>{
      const i = el(id); 
      if(i) i.addEventListener('input', ()=>{
        const vf = parseFloat(el('valorFolha').value||0);
        const vd = parseFloat(el('valorDinheiro').value||0);
        el('sobraFalta').value = BRL.format(vd - vf);
      });
    });

    // Salvar relatório (admin)
    el('btnSalvarRelatorio')?.addEventListener('click', salvarRelatorioAdmin);

    // Filtros
    el('btnAplicarFiltroMatricula')?.addEventListener('click', filtrarPorMatricula);
    el('btnFiltrarPorData')?.addEventListener('click', filtrarPorData);

    // Carregar lista inicial
    await carregarListaPadrao();
  });
}

// ====== Demais funções (iguais ao seu código) =====
// (popularMatriculasSelects, salvarRelatorioAdmin, carregarListaPadrao,
// filtrarPorMatricula, filtrarPorData, carregarResumoAdmin, renderLista, 
// editRelatorio, deleteRelatorio, pós-conferência)
// ====== Função para preencher selects com as matrículas ======
async function popularMatriculasSelects(){
  try {
    const snapshot = await getDocs(collection(db, "usuarios"));
    const usuarios = snapshot.docs.map(doc => doc.data());

    // Pega todos os <select> que devem receber as matrículas
    const selects = document.querySelectorAll(".matriculas-select");
    selects.forEach(select => {
      select.innerHTML = "<option value=''>-- Selecione --</option>"; // limpa antes
      usuarios.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.matricula;
        opt.textContent = `${u.matricula} - ${u.nome}`;
        select.appendChild(opt);
      });
    });

  } catch (err) {
    console.error("Erro ao carregar matrículas:", err);
  }
}

