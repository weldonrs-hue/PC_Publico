import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import readline from 'readline';

// Configurações
const prodConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf-8'));
const devConfig = {
  apiKey: "AIzaSyCg0NSiwCB88o2hNDmkvbtztLOohGBTI-U",
  authDomain: "progcir-web.firebaseapp.com",
  projectId: "progcir-web",
  storageBucket: "progcir-web.firebasestorage.app",
  messagingSenderId: "471177116888",
  appId: "1:471177116888:web:742c44e06a79f9f542abad"
};

// Inicialização das instâncias
const prodApp = initializeApp(prodConfig, 'prod');
const prodAuth = getAuth(prodApp);
const prodDb = getFirestore(prodApp, prodConfig.firestoreDatabaseId);

const devApp = initializeApp(devConfig, 'dev');
const devAuth = getAuth(devApp);
const devDb = getFirestore(devApp);

function askQuestion(queryText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(queryText, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function run() {
  console.log('\n======================================================');
  console.log('   CLONAGEM DE DADOS: PRODUÇÃO ➔ DESENVOLVIMENTO LOCAL');
  console.log('======================================================\n');
  console.log('Como o banco de produção é protegido, precisamos do seu');
  console.log('login do sistema para autenticar e baixar seus dados.\n');

  let usuario = process.argv[2];
  let senha = process.argv[3];

  if (!usuario) {
    usuario = await askQuestion('Digite seu número pessoal de login (ex: 2283701): ');
  }
  if (!senha) {
    senha = await askQuestion('Digite sua senha: ');
  }

  const cleanUsuario = usuario.replace(/\D/g, '');
  const emailApp = `${cleanUsuario}@progcir.app`;
  const emailCom = `${cleanUsuario}@progcir.com`;

  console.log(`\n1. Autenticando em PRODUÇÃO como ${emailApp}...`);
  let prodUserCred;
  try {
    prodUserCred = await signInWithEmailAndPassword(prodAuth, emailApp, senha);
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        prodUserCred = await signInWithEmailAndPassword(prodAuth, emailCom, senha);
      } catch (err2) {
        console.error('❌ Falha ao autenticar em produção:', err2.message);
        process.exit(1);
      }
    } else {
      console.error('❌ Falha ao autenticar em produção:', err.message);
      process.exit(1);
    }
  }

  const prodUid = prodUserCred.user.uid;
  console.log(`✔ Conectado com sucesso em Produção! (UID: ${prodUid})`);

  console.log(`\n2. Configurando seu usuário no banco de DESENVOLVIMENTO...`);
  let devUid = null;
  try {
    const cred = await createUserWithEmailAndPassword(devAuth, emailApp, senha);
    await updateProfile(cred.user, { displayName: cleanUsuario });
    devUid = cred.user.uid;
    console.log(`✔ Novo usuário criado em Dev com sucesso! (UID: ${devUid})`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(devAuth, emailApp, senha);
      devUid = cred.user.uid;
      console.log(`✔ Usuário já existia em Dev. Conectado com sucesso! (UID: ${devUid})`);
    } else {
      console.error('❌ Erro ao configurar usuário em Dev:', err.message);
      process.exit(1);
    }
  }

  console.log(`\n3. Copiando seus dados para o banco local...`);

  // Coleções vinculadas ao usuário
  const userCollections = [
    'personal_data',
    'congregations',
    'itineraries',
    'substitutes',
    'weekly_expenses',
    'pioneer_school_invitations',
    'regional_convention_invitations',
    'circuit_assembly_supt_invitations',
    'circuit_assembly_branch_invitations'
  ];

  // Copiar documento de perfil 'users'
  try {
    const userDocs = await getDocs(query(collection(prodDb, 'users'), where('__name__', '==', prodUid)));
    if (!userDocs.empty) {
      const userData = userDocs.docs[0].data();
      await setDoc(doc(devDb, 'users', devUid), {
        ...userData,
        uid: devUid,
        email: emailApp,
        usuario: cleanUsuario,
        updatedAt: new Date().toISOString()
      });
      console.log(`   ✔ Perfil do usuário (role: ${userData.role || 'user'}) copiado.`);
    } else {
      await setDoc(doc(devDb, 'users', devUid), {
        email: emailApp,
        usuario: cleanUsuario,
        role: 'admin',
        updatedAt: new Date().toISOString()
      });
      console.log(`   ✔ Perfil criado com role: admin em Dev.`);
    }
  } catch (e) {
    console.log(`   ⚠ Aviso no perfil: ${e.message}`);
  }

  // Copiar coleções baseadas no userId
  for (const colName of userCollections) {
    try {
      const snap = await getDocs(query(collection(prodDb, colName), where('userId', '==', prodUid)));
      let count = 0;
      for (const d of snap.docs) {
        const data = d.data();
        data.userId = devUid; // Mapeia para o novo UID de dev para vincular ao seu login local
        await setDoc(doc(devDb, colName, d.id), data);
        count++;
      }
      console.log(`   ✔ Coleção [${colName}]: ${count} documentos copiados.`);
    } catch (e) {
      console.log(`   ⚠ Coleção [${colName}]: Ignorada ou sem permissão (${e.message})`);
    }
  }

  // Copiar coleções gerais/compartilhadas
  const sharedCollections = [
    'circuit_assembly_supt_speakers',
    'circuit_assembly_branch_speakers',
    'pioneer_school_info',
    'document_templates'
  ];

  for (const colName of sharedCollections) {
    try {
      const snap = await getDocs(collection(prodDb, colName));
      let count = 0;
      for (const d of snap.docs) {
        const data = d.data();
        if (data.ownerId === prodUid) {
          data.ownerId = devUid;
        }
        await setDoc(doc(devDb, colName, d.id), data);
        count++;
      }
      console.log(`   ✔ Coleção compartilhada [${colName}]: ${count} documentos copiados.`);
    } catch (e) {
      console.log(`   ⚠ Coleção compartilhada [${colName}]: Ignorada (${e.message})`);
    }
  }

  console.log('\n======================================================');
  console.log('   🎉 CÓPIA CONCLUÍDA COM SUCESSO!');
  console.log('======================================================');
  console.log(`Seu ambiente local agora tem uma cópia completa dos seus dados.`);
  console.log(`Você pode rodar 'npm run dev' e fazer login com seu número pessoal!`);
  console.log('Todas as alterações que fizer ficarão 100% no seu banco de teste.\n');
  process.exit(0);
}

run().catch(err => {
  console.error('\nErro inesperado:', err);
  process.exit(1);
});
