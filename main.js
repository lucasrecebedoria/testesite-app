// Firebase Configuração
const firebaseConfig = {
  apiKey: "AIzaSyC4mALGbBqJsJp2Xo5twMImq1hHaSV2HuM",
  authDomain: "caixas18-08.firebaseapp.com",
  projectId: "caixas18-08",
  storageBucket: "caixas18-08.firebasestorage.app",
  messagingSenderId: "41940261133",
  appId: "1:41940261133:web:3d2254aafa02608c2df844",
  measurementId: "G-NF5D2RQYSE"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Função para login
document.getElementById("btnLogin").addEventListener("click", async () => {
  const matricula = document.getElementById("matricula").value;
  const senha = document.getElementById("senha").value;
  const email = matricula + "@movebuss.local";
  try {
    await auth.signInWithEmailAndPassword(email, senha);
  } catch (e) {
    alert("Erro no login: " + e.message);
  }
});

// Mostrar container de cadastro
document.getElementById("btnShowCadastro").addEventListener("click", () => {
  document.getElementById("cadastro-container").style.display = "block";
});

// Cadastrar novo usuário
document.getElementById("btnCadastrar").addEventListener("click", async () => {
  const matricula = document.getElementById("novaMatricula").value;
  const nome = document.getElementById("novoNome").value;
  const senha = document.getElementById("novaSenha").value;
  const email = matricula + "@movebuss.local";

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, senha);
    await db.collection("usuarios").doc(cred.user.uid).set({
      matricula,
      nome
    });
    alert("Usuário cadastrado com sucesso!");
  } catch (e) {
    alert("Erro ao cadastrar: " + e.message);
  }
});

// Observa login
auth.onAuthStateChanged(async (user) => {
  if (user) {
    document.getElementById("login-container").style.display = "none";
    document.getElementById("relatorios-container").style.display = "block";
    document.getElementById("btnLogout").style.display = "inline-block";
    document.getElementById("btnAlterarSenha").style.display = "inline-block";

    const userDoc = await db.collection("usuarios").doc(user.uid).get();
    const dados = userDoc.data();

    const isAdmin = ["6266", "4144", "70029"].includes(dados.matricula);

    if (isAdmin) {
      document.getElementById("btnResumoRecebedor").style.display = "inline-block";
      document.querySelectorAll(".admin-only").forEach(el => el.style.display = "block");
    } else {
      document.getElementById("btnResumoRecebedor").style.display = "none";
      document.querySelectorAll(".admin-only").forEach(el => el.style.display = "none");
    }
  }
});

// Logout
document.getElementById("btnLogout").addEventListener("click", async () => {
  await auth.signOut();
  location.reload();
});
