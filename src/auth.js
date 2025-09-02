import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, ADMIN_MATRICULAS } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function toEmail(matricula){ return `${matricula}@movebuss.local`; }

// --- LOGIN PAGE ---
const loginBtn = document.getElementById('btnLogin');
if (loginBtn){
  loginBtn.addEventListener('click', async () => {
    const matricula = document.getElementById('loginMatricula').value.trim();
    const senha = document.getElementById('loginSenha').value;
    if(!matricula || !senha){ alert('Preencha matrícula e senha'); return; }
    try{
      const cred = await signInWithEmailAndPassword(auth, toEmail(matricula), senha);
      const uid = cred.user.uid;
      const userDoc = await getDoc(doc(db,'usuarios', uid));
      if (!userDoc.exists()){
        // cria doc básico se não existir
        await setDoc(doc(db,'usuarios', uid), {
          uid, matricula, nome: '', email: toEmail(matricula), isAdmin: ADMIN_MATRICULAS.includes(matricula)
        });
      }
      localStorage.setItem('matricula', matricula);
      localStorage.setItem('isAdmin', String(ADMIN_MATRICULAS.includes(matricula)));
      window.location.href = './index.html';
    }catch(e){
      alert('Falha no login: '+e.message);
      console.error(e);
    }
  });
}

// --- REGISTER PAGE ---
const regBtn = document.getElementById('btnRegister');
if (regBtn){
  regBtn.addEventListener('click', async () => {
    const matricula = document.getElementById('regMatricula').value.trim();
    const nome = document.getElementById('regNome').value.trim();
    const senha = document.getElementById('regSenha').value;
    if(!matricula || !nome || !senha){ alert('Preencha todos os campos'); return; }
    try{
      const cred = await createUserWithEmailAndPassword(auth, toEmail(matricula), senha);
      const uid = cred.user.uid;
      await setDoc(doc(db, 'usuarios', uid), {
        uid, matricula, nome, email: toEmail(matricula), isAdmin: ADMIN_MATRICULAS.includes(matricula),
        criadoEm: new Date().toISOString()
      });
      alert('Usuário cadastrado! Faça login.');
      window.location.href = './login.html';
    }catch(e){
      alert('Erro ao cadastrar: '+e.message);
      console.error(e);
    }
  });
}
