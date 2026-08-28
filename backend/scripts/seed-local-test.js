import admin from 'firebase-admin'

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
  await auth.setCustomUserClaims(account.uid, { role: account.role })
}

await Promise.all(accounts.map(upsertAuthUser))

const now = admin.firestore.Timestamp.now()
const caregiverDescription = 'Cuidador com experiência em atendimento domiciliar, acompanhamento de idosos, mobilidade assistida e comunicação diária com familiares.'

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
    description: caregiverDescription,
    city: 'Fortaleza',
    state: 'CE',
    zipCode: '60000000',
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
    description: caregiverDescription,
    city: 'Caucaia',
    state: 'CE',
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
    description: caregiverDescription,
    city: 'Recife',
    state: 'PE',
    createdAt: now,
    updatedAt: now,
  },
]

const batch = db.batch()
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

await batch.commit()

console.log('Dados locais criados com sucesso.')
console.log('Familiar: familiar.teste@virla.local')
console.log('Cuidador: cuidador.teste@virla.local')
console.log(`Senha comum: ${PASSWORD}`)
