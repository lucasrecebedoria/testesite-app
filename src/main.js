// Firebase inicialização
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elementos DOM
const loginSection = document.getElementById("login-section");
const registerSection = document.getElementById("register-section");
const relatoriosSection = document.getElementById("relatorios-section");
const logoutBtn = document.getElementById("logoutBtn");
const gerarRelatorioAdmin = document.getElementById("gerar-relatorio-admin");
const listaRelatorios = document.getElementById("listaRelatorios");

// Mock auth (substituir por Firebase Auth depois)
let currentUser = null;
const admins = ["70029","6266","4144"];

// Navegação login/registro
document.getElementById("showRegister").onclick = () => {
  loginSection.style.display = "none";
  registerSection.style.display = "block";
};
document.getElementById("showLogin").onclick = () => {
  registerSection.style.display = "none";
  loginSection.style.display = "block";
};

// Login fake
document.getElementById("loginBtn").onclick = () => {
  const matricula = document.getElementById("loginMatricula").value;
  const senha = document.getElementById("loginSenha").value;
  if (!matricula || !senha) { alert("Preencha os campos"); return; }
  currentUser = { matricula };
  loginSection.style.display = "none";
  relatoriosSection.style.display = "block";
  logoutBtn.style.display = "block";
  if (admins.includes(matricula)) gerarRelatorioAdmin.style.display = "block";
  carregarRelatorios();
};

// Logout
logoutBtn.onclick = () => {
  currentUser = null;
  relatoriosSection.style.display = "none";
  loginSection.style.display = "block";
  logoutBtn.style.display = "none";
};

// Registro fake (somente demonstração)
document.getElementById("registerBtn").onclick = () => {
  alert("Usuário registrado (mock). Implementar no Firestore.");
  registerSection.style.display = "none";
  loginSection.style.display = "block";
};

// Gerar relatório
document.getElementById("gerarRelatorioBtn").onclick = async () => {
  const dataCaixa = document.getElementById("dataCaixa").value;
  const valorFolha = parseFloat(document.getElementById("valorFolha").value);
  const valorDinheiro = parseFloat(document.getElementById("valorDinheiro").value);
  const matricula = document.getElementById("matriculaSelect").value;
  const sobraFalta = valorDinheiro - valorFolha;
  await addDoc(collection(db, "relatorios"), {
    dataCaixa, valorFolha, valorDinheiro, sobraFalta, matricula
  });
  carregarRelatorios();
};

// Carregar relatórios
async function carregarRelatorios() {
  listaRelatorios.innerHTML = "";
  let q;
  if (admins.includes(currentUser.matricula)) {
    q = query(collection(db, "relatorios"));
  } else {
    q = query(collection(db, "relatorios"), where("matricula","==",currentUser.matricula));
  }
  const snapshot = await getDocs(q);
  snapshot.forEach(doc => {
    const r = doc.data();
    const div = document.createElement("div");
    div.innerHTML = `<b>${r.dataCaixa}</b> - Matrícula ${r.matricula} | Folha: R$${r.valorFolha} | Dinheiro: R$${r.valorDinheiro} | Sobra/Falta: R$${r.sobraFalta}`;
    listaRelatorios.appendChild(div);
  });
}
