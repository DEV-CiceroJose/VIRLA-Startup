import 'dotenv/config'
import admin from 'firebase-admin'
import { saveDocument } from '../src/services/verificationStorage.js'
import { TERMS_VERSION, PRIVACY_VERSION } from '../src/utils/legal.js'

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'virla-startap'
const PASSWORD = process.env.VIRLA_TEST_PASSWORD ?? 'VirlaTeste#2026'

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Seed bloqueado: configure os emuladores de Auth e Firestore antes de executar.')
}

const app = admin.apps.length ? admin.app() : admin.initializeApp({ projectId: PROJECT_ID })
const auth = app.auth()
const db = app.firestore()

const accounts = [
  {
    uid: 'test-familiar-virla',
    email: 'familiar.teste@virla.local',
    displayName: 'Marina Familiar',
    role: 'FAMILIAR',
  },
  {
    uid: 'test-cuidador-virla',
    email: 'cuidador.teste@virla.local',
    displayName: 'Carlos Cuidador',
    role: 'CUIDADOR',
  },
  {
    uid: 'test-cuidador-pendente',
    email: 'pendente.teste@virla.local',
    displayName: 'Paulo Pendente',
    role: 'CUIDADOR',
  },
  {
    // Equipe VIRLA: revisa as verificações em /admin/verificacoes.
    uid: 'test-admin-virla',
    email: 'admin.teste@virla.local',
    displayName: 'Equipe VIRLA',
    role: 'FAMILIAR',
    admin: true,
  },
]

async function upsertAuthUser(account) {
  try {
    await auth.getUser(account.uid)
    await auth.updateUser(account.uid, {
      email: account.email,
      password: PASSWORD,
      displayName: account.displayName,
      emailVerified: true,
      disabled: false,
    })
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
    await auth.createUser({
      uid: account.uid,
      email: account.email,
      password: PASSWORD,
      displayName: account.displayName,
      emailVerified: true,
    })
  }
  await auth.setCustomUserClaims(account.uid, { role: account.role, ...(account.admin && { admin: true }) })
}

await Promise.all(accounts.map(upsertAuthUser))

const now = admin.firestore.Timestamp.now()
const caregiverDescription = 'Cuidador com experiência em atendimento domiciliar, acompanhamento de idosos, mobilidade assistida e comunicação diária com familiares.'

const legal = { termsAcceptedAt: now, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }

const users = [
  {
    id: 'test-familiar-virla',
    email: 'familiar.teste@virla.local',
    name: 'Marina Familiar',
    role: 'FAMILIAR',
    birthDate: admin.firestore.Timestamp.fromDate(new Date('1987-05-18T00:00:00Z')),
    cpf: '52998224725',
    bio: 'Conta local para testar a jornada da família.',
    city: 'Fortaleza',
    state: 'CE',
    zipCode: '60000000',
    ...legal,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'test-cuidador-virla',
    email: 'cuidador.teste@virla.local',
    name: 'Carlos Cuidador',
    role: 'CUIDADOR',
    birthDate: admin.firestore.Timestamp.fromDate(new Date('1990-03-12T00:00:00Z')),
    cpf: '11144477735',
    bio: 'Atendimento humanizado para idosos e pessoas com mobilidade reduzida.',
    council: 'COREN',
    registerNumber: '123456-CE',
    hourlyRate: 40,
    specialties: ['ALZHEIMER_DEMENCIA', 'MOBILIDADE_REDUZIDA', 'PARKINSON'],
    availableShifts: ['MANHA', 'TARDE'],
    serviceFrequencies: ['DIARIA', 'SEMANAL'],
    approach: 'Cuidado humanizado com atualização diária para a família.',
    verificationStatus: 'APROVADO',
    description: caregiverDescription,
    city: 'Fortaleza',
    state: 'CE',
    zipCode: '60000000',
    ...legal,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'test-cuidadora-ana',
    email: 'ana.perfil@virla.local',
    name: 'Ana Oliveira',
    role: 'CUIDADOR',
    birthDate: admin.firestore.Timestamp.fromDate(new Date('1988-08-20T00:00:00Z')),
    cpf: '39053344705',
    council: 'COREN',
    registerNumber: '654321-CE',
    hourlyRate: 44,
    specialties: ['ALZHEIMER_DEMENCIA', 'ACAMADOS'],
    availableShifts: ['MANHA', 'NOITE'],
    serviceFrequencies: ['SEMANAL', 'MENSAL'],
    approach: 'Rotina estruturada e acolhimento para toda a família.',
    verificationStatus: 'APROVADO',
    description: caregiverDescription,
    city: 'Caucaia',
    state: 'CE',
    ...legal,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'test-cuidadora-carla',
    email: 'carla.perfil@virla.local',
    name: 'Carla Souza',
    role: 'CUIDADOR',
    birthDate: admin.firestore.Timestamp.fromDate(new Date('1992-11-05T00:00:00Z')),
    cpf: '16899535009',
    council: 'COREN',
    registerNumber: '789012-PE',
    hourlyRate: 48,
    specialties: ['POS_CIRURGICO', 'REABILITACAO'],
    availableShifts: ['TARDE', 'NOITE'],
    serviceFrequencies: ['PONTUAL', 'DIARIA'],
    approach: 'Acompanhamento técnico focado em recuperação segura.',
    verificationStatus: 'APROVADO',
    description: caregiverDescription,
    city: 'Recife',
    state: 'PE',
    ...legal,
    createdAt: now,
    updatedAt: now,
  },
]

users.push(
  {
    id: 'test-cuidador-pendente',
    email: 'pendente.teste@virla.local',
    name: 'Paulo Pendente',
    role: 'CUIDADOR',
    birthDate: admin.firestore.Timestamp.fromDate(new Date('1985-01-22T00:00:00Z')),
    cpf: '74682489070',
    hourlyRate: 38,
    specialties: ['ACAMADOS'],
    availableShifts: ['NOITE'],
    serviceFrequencies: ['SEMANAL'],
    approach: 'Plantões noturnos com atenção a quem está acamado.',
    description: caregiverDescription,
    city: 'Fortaleza',
    state: 'CE',
    verificationStatus: 'EM_ANALISE',
    ...legal,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'test-admin-virla',
    email: 'admin.teste@virla.local',
    name: 'Equipe VIRLA',
    role: 'FAMILIAR',
    birthDate: admin.firestore.Timestamp.fromDate(new Date('1990-01-01T00:00:00Z')),
    cpf: '86288366757',
    bio: 'Conta local da equipe para revisar verificações.',
    city: 'Fortaleza',
    state: 'CE',
    ...legal,
    createdAt: now,
    updatedAt: now,
  },
)

// PDF fictício (só no emulador) para a equipe ter o que revisar.
function fakePdf(title) {
  const text = `BT /F1 16 Tf 24 120 Td (${title} - DOCUMENTO FICTICIO, TESTE LOCAL) Tj ET`
  return Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 520 240]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n'
    + `4 0 obj<</Length ${text.length}>>stream\n${text}\nendstream endobj\n`
    + '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  )
}

const pendingDocs = {}
for (const [kind, title] of [['identity', 'RG'], ['selfie', 'Selfie com documento'], ['criminalRecord', 'Certidao de antecedentes']]) {
  pendingDocs[kind] = {
    file: await saveDocument('test-cuidador-pendente', kind, fakePdf(title)),
    mime: 'application/pdf',
    uploadedAt: now,
  }
}

const batch = db.batch()
for (const id of ['test-cuidador-virla', 'test-cuidadora-ana', 'test-cuidadora-carla']) {
  batch.set(db.collection('verifications').doc(id), { status: 'APROVADO', reviewedBy: 'seed', reviewedAt: now, updatedAt: now })
}
batch.set(db.collection('verifications').doc('test-cuidador-pendente'), {
  status: 'EM_ANALISE',
  documents: pendingDocs,
  criminalRecordCode: 'TESTE.1234.5678',
  criminalRecordIssuedAt: new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10),
  declarationAcceptedAt: now,
  submittedAt: now,
  updatedAt: now,
})
for (const user of users) {
  const { id, ...data } = user
  batch.set(db.collection('users').doc(id), data)
}

const requests = [
  ['01', 'Acompanhamento para Alzheimer', ['Alzheimer', 'Mobilidade reduzida'], 'Fortaleza', 'CE', 40, 'MANHA', 'SEMANAL'],
  ['02', 'Apoio para Parkinson', ['Parkinson'], 'Fortaleza', 'CE', 42, 'TARDE', 'DIARIA'],
  ['03', 'Companhia e rotina diária', ['Acompanhamento diurno'], 'Caucaia', 'CE', 40, 'MANHA', 'SEMANAL'],
  ['04', 'Cuidados pós-operatórios', ['Pós-operatório'], 'Recife', 'PE', 30, 'NOITE', 'PONTUAL'],
  ['05', 'Acompanhamento noturno', ['Pernoite'], 'Fortaleza', 'CE', 32, 'NOITE', 'MENSAL'],
  ['06', 'Reabilitação domiciliar', ['Reabilitação'], 'Natal', 'RN', 40, 'MANHA', 'DIARIA'],
  ['07', 'Cuidados paliativos', ['Cuidados paliativos'], 'Salvador', 'BA', 25, 'INTEGRAL', 'QUINZENAL'],
]

requests.forEach(([suffix, titulo, tipoCuidado, cidade, estado, valorHora, turno, frequencia], index) => {
  const createdAt = admin.firestore.Timestamp.fromMillis(Date.now() - index * 60_000)
  batch.set(db.collection('solicitacoes').doc(`test-solicitacao-${suffix}`), {
    familiarId: 'test-familiar-virla',
    titulo,
    descricao: `Solicitação local de teste: ${titulo.toLowerCase()}.`,
    tipoCuidado,
    cidade,
    estado,
    valorHora,
    turno,
    frequencia,
    paymentRecurrence: frequencia === 'DIARIA' ? 'DIARIA' : 'SEMANAL',
    dataInicio: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    urgencia: index < 2 ? 'ALTA' : 'MEDIA',
    status: 'ABERTA',
    viewedByIds: [],
    assignedCaregiverId: null,
    createdAt,
    updatedAt: createdAt,
  })
})

// Histórico financeiro fictício, visível apenas nos emuladores locais.
const dateOnly = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)
batch.set(db.collection('solicitacoes').doc('test-solicitacao-history'), {
  familiarId: 'test-familiar-virla',
  titulo: 'Acompanhamento domiciliar concluído',
  descricao: 'Atendimento fictício para validação do resumo financeiro.',
  tipoCuidado: ['Acompanhamento diurno'],
  cidade: 'Fortaleza',
  estado: 'CE',
  valorHora: 40,
  turno: 'MANHA',
  frequencia: 'DIARIA',
  paymentRecurrence: 'DIARIA',
  dataInicio: dateOnly(10),
  urgencia: 'MEDIA',
  status: 'CONCLUIDA',
  viewedByIds: ['test-cuidador-virla'],
  assignedCaregiverId: 'test-cuidador-virla',
  createdAt: now,
  updatedAt: now,
})
for (const [suffix, daysAgo, status, baseAmount] of [['paid', 3, 'PAID', 16000], ['signed', 1, 'SIGNED', 12000]]) {
  const serviceDate = dateOnly(daysAgo)
  batch.set(db.collection('serviceReports').doc(`test-report-${suffix}`), {
    solicitacaoId: 'test-solicitacao-history',
    caregiverId: 'test-cuidador-virla',
    familiarId: 'test-familiar-virla',
    serviceDate,
    baseAmount,
    totalAmount: baseAmount,
    status,
    createdAt: now,
    updatedAt: now,
  })
}

await batch.commit()

console.log('Dados locais criados com sucesso.')
console.log('Familiar: familiar.teste@virla.local')
console.log('Cuidador: cuidador.teste@virla.local')
console.log('Cuidador em análise: pendente.teste@virla.local')
console.log('Equipe (admin): admin.teste@virla.local')
console.log(`Senha comum: ${PASSWORD}`)
