import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, query, where, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { firebaseConfig, ADMIN_MATRICULAS } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const $ = (id)=>document.getElementById(id);
const fmtBRL = (n)=> (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const toBRDate = (val)=>{
  if(!val) return '';
  const d = new Date(val);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - (off*60000));
  return local.toISOString().slice(0,10).split('-').reverse().join('/');
};
const inputDateToBR = (value)=>{
  if(!value) return '';
  const [y,m,d] = value.split('-');
  return `${d}/${m}/${y}`;
};

const btnLogout = $('btnLogout');
const btnChangePassword = $('btnChangePassword');
const adminLeft = $('adminLeft');
const adminRight = $('adminRight');
const userNotice = $('userNotice');
const reportsList = $('reportsList');
const listaRelatorios = $('listaRelatorios');
const selectMatriculaDestino = $('selectMatriculaDestino');
const selectMatriculaResumo = $('selectMatriculaResumo');
const resumoBox = $('resumoBox');
const resumoHeader = $('resumoHeader');
const resumoContent = $('resumoContent');
const btnResumo = $('btnResumo');
const btnFiltrarDia = $('btnFiltrarDia');
const filtroData = $('filtroData');

// Pós-conferência modal elements
const posModal = $('posModal');
const posClose = $('posClose');
const posAdminArea = $('posAdminArea');
const posTexto = $('posTexto');
const posImagem = $('posImagem');
const posUpload = $('posUpload');
const posSalvar = $('posSalvar');
const posVerImagem = $('posVerImagem');
const posExcluirImagem = $('posExcluirImagem');
let posCurrent = { id:null, matricula:null };

resumoHeader?.addEventListener('click', ()=>{
  const content = resumoHeader.nextElementSibling;
  if (!content) return;
  content.style.display = content.style.display === 'block' ? 'none' : 'block';
});

btnLogout?.addEventListener('click', async ()=>{
  try{
    await signOut(auth);
  }catch(e){ console.error(e); }
  localStorage.clear();
  window.location.href = './login.html';
});

btnChangePassword?.addEventListener('click', async ()=>{
  const nova = prompt('Digite a nova senha:');
  if(!nova) return;
  try{
    await updatePassword(auth.currentUser, nova);
    alert('Senha alterada com sucesso!');
  }catch(e){
    alert('Erro ao alterar senha: '+e.message);
  }
});

// Init
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.href = './login.html';
    return;
  }
  btnLogout.style.display = 'inline-block';
  btnChangePassword.style.display = 'inline-block';

  // carrega doc do usuário para obter matrícula e admin
  const udoc = await getDoc(doc(db,'usuarios', user.uid));
  if (!udoc.exists()){
    alert('Seu cadastro não está completo. Faça login novamente.');
    await signOut(auth); window.location.href='./login.html'; return;
  }
  const u = udoc.data();
  const isAdmin = !!u.isAdmin;
  const matricula = u.matricula;

  if(isAdmin){
    adminLeft.style.display = 'block';
    adminRight.style.display = 'block';
  }else{
    userNotice.style.display = 'block';
  }
  reportsList.style.display = 'block';

  await popularSelects(isAdmin);
  await carregarRelatoriosDefault(isAdmin, matricula);

  // Eventos admin
  $('btnSalvarRelatorio')?.addEventListener('click', ()=>salvarRelatorio(user, isAdmin));
  btnResumo?.addEventListener('click', ()=>mostrarResumo());
  btnFiltrarDia?.addEventListener('click', ()=>filtrarPorDia(isAdmin, matricula));
});

async function popularSelects(isAdmin){
  selectMatriculaDestino.innerHTML = '';
  selectMatriculaResumo.innerHTML = '';
  const snap = await getDocs(collection(db,'usuarios'));
  const opts = [];
  snap.forEach(d=>{
    const u = d.data();
    if(!u.matricula) return;
    opts.push({matricula:u.matricula, nome:u.nome||''});
  });
  opts.sort((a,b)=> a.matricula.localeCompare(b.matricula,'pt-BR', {numeric:true}));
  const makeOption = (o)=>{
    const opt = document.createElement('option');
    opt.value = o.matricula;
    opt.textContent = `${o.matricula} - ${o.nome}`.trim();
    return opt;
  };
  if (selectMatriculaDestino) opts.forEach(o=> selectMatriculaDestino.appendChild(makeOption(o)));
  if (selectMatriculaResumo) opts.forEach(o=> selectMatriculaResumo.appendChild(makeOption(o)));
}

async function carregarRelatoriosDefault(isAdmin, matricula){
  listaRelatorios.innerHTML='';
  if(isAdmin){
    // últimos 20 sem filtro
    const q = query(collection(db,'relatorios'), orderBy('createdAt','desc'), limit(20));
    renderRelatorios(await getDocs(q), isAdmin);
  }else{
    // últimos 15 para a matrícula do usuário
    const q = query(collection(db,'relatorios'), where('matricula','==', matricula), orderBy('createdAt','desc'), limit(15));
    renderRelatorios(await getDocs(q), isAdmin);
  }
}

function renderRelatorios(snap, isAdmin){
  listaRelatorios.innerHTML='';
  snap.forEach(docu=>{
    const r = docu.data();
    const id = docu.id;
    const sobra = (Number(r.valorDinheiro||0) - Number(r.valorFolha||0));
    const item = document.createElement('div');
    item.className = 'item';
    const header = document.createElement('div');
    header.className = 'item-header';
    const title = document.createElement('div');
    title.innerHTML = `<strong>${r.dataCaixa}</strong> — Matrícula ${r.matricula}`;
    const badge = document.createElement('span');
    badge.className = 'badge' + (r.posEditado ? ' warn': '');
    badge.textContent = r.posEditado ? 'verificar pós conferência' : 'ok';
    header.appendChild(title);
    header.appendChild(badge);

    const body = document.createElement('div');
    body.className = 'card hidden';
    body.innerHTML = `
      <div><b>Valor Folha:</b> ${fmtBRL(r.valorFolha)}</div>
      <div><b>Valor em Dinheiro:</b> ${fmtBRL(r.valorDinheiro)}</div>
      <div><b>Sobra/Falta:</b> ${fmtBRL(sobra)}</div>
      <div><b>Observação:</b> ${r.observacao || '-'}</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'actions';
    const btnToggle = document.createElement('button');
    btnToggle.className = 'btn metal'; btnToggle.textContent = 'Esconder/Exibir';
    btnToggle.addEventListener('click', ()=>{
      body.classList.toggle('hidden');
    });
    actions.appendChild(btnToggle);

    const btnPos = document.createElement('button');
    btnPos.className = 'btn metal'; btnPos.textContent = 'Pós conferência';
    btnPos.addEventListener('click', ()=> abrirPosConferencia(id, r.matricula, isAdmin));
    actions.appendChild(btnPos);

    if(isAdmin){
      const btnEditar = document.createElement('button');
      btnEditar.className='btn metal'; btnEditar.textContent='Editar relatório';
      btnEditar.addEventListener('click', ()=> editarRelatorio(id, r));
      const btnExcluir = document.createElement('button');
      btnExcluir.className='btn metal danger'; btnExcluir.textContent='Excluir relatório';
      btnExcluir.addEventListener('click', ()=> excluirRelatorio(id));
      actions.appendChild(btnEditar);
      actions.appendChild(btnExcluir);
    }

    item.appendChild(header);
    item.appendChild(actions);
    item.appendChild(body);
    listaRelatorios.appendChild(item);
  });
}

async function salvarRelatorio(user, isAdmin){
  if(!isAdmin){ alert('Somente administradores!'); return; }
  const dataInput = document.getElementById('dataCaixa').value;
  const dataBR = inputDateToBR(dataInput);
  const valorFolha = Number(document.getElementById('valorFolha').value||0);
  const valorDinheiro = Number(document.getElementById('valorDinheiro').value||0);
  const matricula = document.getElementById('selectMatriculaDestino').value;
  if(!dataInput || !matricula){ alert('Preencha data e matrícula'); return; }
  try{
    await addDoc(collection(db,'relatorios'), {
      dataCaixa: dataBR,
      valorFolha, valorDinheiro,
      sobraFalta: valorDinheiro - valorFolha,
      matricula,
      criadoPor: user.uid,
      createdAt: serverTimestamp(),
      posEditado: false
    });
    alert('Relatório salvo!');
    await carregarRelatoriosDefault(true, '');
  }catch(e){
    alert('Erro ao salvar: '+e.message);
    console.error(e);
  }
}

async function editarRelatorio(id, r){
  const novoFolha = Number(prompt('Novo Valor Folha:', r.valorFolha) || r.valorFolha);
  const novoDin = Number(prompt('Novo Valor Dinheiro:', r.valorDinheiro) || r.valorDinheiro);
  const ref = doc(db,'relatorios', id);
  await addDoc; // placeholder to satisfy syntax highlighter
  await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js").then(async m=>{
    await m.updateDoc(ref, {
      valorFolha: novoFolha,
      valorDinheiro: novoDin,
      sobraFalta: novoDin - novoFolha
    });
  });
  alert('Relatório atualizado.');
  location.reload();
}

async function excluirRelatorio(id){
  if(!confirm('Excluir relatório?')) return;
  await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js").then(async m=>{
    await m.deleteDoc(doc(db,'relatorios', id));
  });
  alert('Excluído.');
  location.reload();
}

function abrirPosConferencia(id, matricula, isAdmin){
  posCurrent = { id, matricula };
  posModal.style.display='flex';
  posAdminArea.style.display = isAdmin ? 'block':'none';
  posExcluirImagem.style.display = isAdmin ? 'inline-block':'none';
}

posClose?.addEventListener('click', ()=> posModal.style.display='none');

posUpload?.addEventListener('click', async ()=>{
  if(!posImagem.files[0]){ alert('Escolha uma imagem'); return; }
  const file = posImagem.files[0];
  const path = `posConferencia/${posCurrent.matricula}/${posCurrent.id}/${file.name}`;
  try{
    const r = ref(storage, path);
    await uploadBytes(r, file);
    alert('Imagem anexada.');
  }catch(e){
    alert('Erro ao anexar: '+e.message);
  }
});

posVerImagem?.addEventListener('click', async ()=>{
  try{
    const listUrl = `posConferencia/${posCurrent.matricula}/${posCurrent.id}`;
    // para simplicidade, tenta abrir arquivo padrão "anexo.jpg/png"
    const tryNames = ['anexo.jpg','anexo.png','anexo.jpeg'];
    for (const name of tryNames){
      try{
        const url = await getDownloadURL(ref(storage, `${listUrl}/${name}`));
        window.open(url, '_blank');
        return;
      }catch(e){}
    }
    alert('Nenhuma imagem padrão encontrada (anexo.jpg/png/jpeg).');
  }catch(e){
    alert('Erro: '+e.message);
  }
});

posExcluirImagem?.addEventListener('click', async ()=>{
  const nome = prompt('Digite o nome exato do arquivo para excluir (ex.: anexo.jpg)');
  if(!nome) return;
  try{
    await deleteObject(ref(storage, `posConferencia/${posCurrent.matricula}/${posCurrent.id}/${nome}`));
    alert('Imagem excluída.');
  }catch(e){
    alert('Erro ao excluir: '+e.message);
  }
});

posSalvar?.addEventListener('click', async ()=>{
  const txt = posTexto.value.trim();
  if(!txt){ alert('Digite um texto.'); return; }
  await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js").then(async m=>{
    await m.updateDoc(doc(db,'relatorios', posCurrent.id), {
      posTexto: txt,
      posEditado: true
    });
  });
  alert('Pós conferência salva.');
  posModal.style.display='none';
  location.reload();
});

async function mostrarResumo(){
  const matricula = selectMatriculaResumo.value;
  if(!matricula){ alert('Selecione uma matrícula'); return; }
  const now = new Date();
  const month = now.getMonth(); const year = now.getFullYear();
  const start = new Date(year, month, 1);
  const end = new Date(year, month+1, 0, 23,59,59,999);
  // Busca todos da matrícula (filtragem por mês pode ser client-side pois dataCaixa é string BR)
  const q = query(collection(db,'relatorios'), where('matricula','==',matricula), orderBy('createdAt','desc'));
  const snap = await getDocs(q);
  let totalFolha=0, saldo=0;
  const detalhesPos=[], detalhesNeg=[];
  snap.forEach(d=>{
    const r=d.data();
    // tenta parsear dd/mm/yyyy
    const [dd,mm,yyyy] = (r.dataCaixa||'').split('/');
    const dt = (dd&&mm&&yyyy)? new Date(`${yyyy}-${mm}-${dd}T12:00:00`): null;
    if(dt && dt>=start && dt<=end){
      const vf= Number(r.valorFolha||0), vd= Number(r.valorDinheiro||0);
      totalFolha += vf;
      const diff = vd - vf;
      saldo += diff;
      (diff>=0 ? detalhesPos : detalhesNeg).push(`${r.dataCaixa}: ${fmtBRL(diff)}`);
    }
  });
  resumoContent.innerHTML = `
    <div class="card"><b>Valor geral recebido (mês):</b> ${fmtBRL(totalFolha)}</div>
    <div class="card"><b>Saldo do mês:</b> ${fmtBRL(saldo)} (${saldo>=0?'Positivo':'Negativo'})</div>
    <div class="card"><details><summary>Dias com sobra</summary><div>${detalhesPos.join('<br>')||'-'}</div></details></div>
    <div class="card"><details><summary>Dias com falta</summary><div>${detalhesNeg.join('<br>')||'-'}</div></details></div>
  `;
  resumoContent.style.display='block';
}

async function filtrarPorDia(isAdmin, userMatricula){
  const dia = filtroData.value.trim(); // dd/mm/yyyy
  if(!dia){ alert('Informe a data (DD/MM/AAAA)'); return; }
  let q;
  if(isAdmin){
    q = query(collection(db,'relatorios'), where('dataCaixa','==', dia), orderBy('createdAt','desc'));
  }else{
    q = query(collection(db,'relatorios'), where('dataCaixa','==', dia), where('matricula','==', userMatricula), orderBy('createdAt','desc'));
  }
  const snap = await getDocs(q);
  renderRelatorios(snap, isAdmin);
}
