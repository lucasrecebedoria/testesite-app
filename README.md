# MoveBuss — Relatório de Diferenças (v16)

## Como rodar
1. Suba a pasta `public/` para um servidor estático ou GitHub Pages.
2. Abra `public/login.html` para acessar.
3. Faça cadastro (qualquer matrícula) e login.
4. Matrículas **70029, 6266 e 4144** são administradores automaticamente.

## Firebase usado
- Firestore: coleções `usuarios` e `relatorios`
- Storage: `posConferencia/{matricula}/{relatorioId}/{arquivo}`

## Regras Firestore (recomendadas)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /usuarios/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        (request.resource.data.isAdmin == true); // apenas admins (marcados no app) criam/atualizam
    }

    match /relatorios/{docId} {
      // Admin pode tudo (detectado via documento usuarios/{uid}.isAdmin == true)
      allow create, update, delete, read: if request.auth != null &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.isAdmin == true;

      // Usuário comum pode LER quando o doc for da própria matrícula
      allow read: if request.auth != null &&
        resource.data.matricula == get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.matricula;
    }
  }
}
```
