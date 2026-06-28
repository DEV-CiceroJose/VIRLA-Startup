import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// ─── MASSA DE DADOS GERADA (41 PERFIS) ───────────────────────────
const dadosMocks = [
  {
    "name": "Adriana Souza Cavalcanti",
    "email": "adriana.cavalcanti.cuidadora@gmail.com",
    "birthDate": "1986-04-12",
    "bio": "Cuidadora dedicada com 10 anos de experiência. Cuido com amor e responsabilidade.",
    "hourlyRate": 14000,
    "professionalId": "COREN-PE 204371",
    "approach": "Home Care",
    "specialties": ["Alzheimer", "Mobilidade Reduzida", "Higiene e Conforto"],
    "longDescription": "Tenho 10 anos de experiência em cuidados domiciliares para idosos com Alzheimer e limitações motoras severas. Trabalhei por 4 anos em uma clínica de longa permanência no Recife antes de migrar para o home care, onde acredito oferecer um ambiente mais digno e acolhedor. Organizo rotinas diárias com estímulos cognitivos leves, supervisão medicamentosa e comunicação diária com a família. Sou técnica de enfermagem registrada no COREN-PE e me atualizo constantemente em cursos de gerontologia.",
    "city": "Recife",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Wellington Ferreira Barros",
    "email": "wellington.barros.cuidador@outlook.com",
    "birthDate": "1979-11-03",
    "bio": "Técnico de enfermagem com focus em reabilitação. Atendo com ética e cuidado real.",
    "hourlyRate": 19500,
    "professionalId": "COREN-PE 178832",
    "approach": "Acompanhamento Hospitalar",
    "specialties": ["Pós-operatório", "AVC", "Curativos Complexos"],
    "longDescription": "Com 15 anos como técnico de enfermagem, atuei em hospitais de grande porte no Recife e desenvolvi expertise em acompanhamento pós-cirúrgico e recuperação de pacientes com sequelas de AVC. Faço monitoramento de sinais vitais, troca de curativos, posicionamento para prevenção de escaras e comunicação estruturada com a equipe médica. Atendo em regime de plantão de 12 ou 24 horas, com relatório escrito ao final de cada turno. Acredito que presença e atenção são os melhores remédios.",
    "city": "Olinda",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Simone Lúcia Barbosa Ramos",
    "email": "simone.ramos.homecare@gmail.com",
    "birthDate": "1991-07-25",
    "bio": "Gerontóloga apaixonada pelo cuidado humanizado. Cada idoso é único para mim.",
    "hourlyRate": 16000,
    "professionalId": "COREN-PE 219045",
    "approach": "Cuidado Humanizado",
    "specialties": ["Demência", "Alimentação por Sonda", "Estimulação Cognitiva"],
    "longDescription": "Formada em gerontologia e técnica de enfermagem, dedico minha carreira ao cuidado humanizado de idosos com comprometimento cognitivo moderado e severo. Tenho experiência com alimentação enteral, prevenção de aspiração e protocolos de estimulação cognitiva adaptados à história de vida de cada paciente. Trabalho de forma próxima às famílias, orientando sobre como lidar com comportamentos comuns da demência sem perder a ternura. Atuo principalmente em Olinda e Paulista.",
    "city": "Paulista",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Josivaldo Mendes Correia",
    "email": "josivaldo.correia.cuidados@yahoo.com.br",
    "birthDate": "1975-02-17",
    "bio": "Cuidador masculino experiente. Especialista em Parkinson e mobilidade. Honesto e pontual.",
    "hourlyRate": 13000,
    "professionalId": "COREN-PE 155498",
    "approach": "Home Care",
    "specialties": ["Parkinson", "Mobilidade Reduzida", "Prevenção de Quedas"],
    "longDescription": "Há 12 anos cuido de idosos em regime domiciliar no Grande Recife, com foco em pacientes com doença de Parkinson e limitações severas de mobilidade. Tenho treinamento em técnicas de transferência segura, uso correto de andadores e cadeiras de rodas, e prevenção de quedas no ambiente doméstico. Além disso, auxilio em exercícios de fisioterapia orientados por profissionais, garantindo continuidade do tratamento entre as sessões. Sou reconhecido pelas famílias pela pontualidade, discrição e cuidado genuíno.",
    "city": "Jaboatão dos Guararapes",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Tatiane Cristina Alves Moura",
    "email": "tatiane.moura.cuidadora@gmail.com",
    "birthDate": "1993-09-08",
    "bio": "Especialista em cuidados paliativos. Presença serena nos momentos mais difíceis.",
    "hourlyRate": 22000,
    "professionalId": "COREN-PE 231876",
    "approach": "Cuidado Humanizado",
    "specialties": ["Cuidados Paliativos", "Alzheimer", "Controle de Dor"],
    "longDescription": "Sou técnica de enfermagem com especialização em cuidados paliativos pelo Instituto de Medicina Integral Professor Fernando Figueira (IMIP) no Recife. Trabalho com famílias em situações de alta complexidade emocional, oferecendo suporte técnico e humano tanto para o paciente quanto para os cuidadores primários. Tenho formação em comunicação de malas notícias e escuta ativa, e acredito que morrer com dignidade é um direito de todo ser humano. Atendo em plantão diurno ou noturno.",
    "city": "Recife",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Cléberson Augusto Lima Neto",
    "email": "cleberson.lima.cuidador@hotmail.com",
    "birthDate": "1984-05-30",
    "bio": "Cuidador e terapeuta ocupacional. Reabilito com técnica e muito afeto.",
    "hourlyRate": 20000,
    "professionalId": "Crefito-PE 48321",
    "approach": "Home Care",
    "specialties": ["Reabilitação Motora", "AVC", "Atividades da Vida Diária"],
    "longDescription": "Terapeuta ocupacional com 11 anos de experiência em reabilitação domiciliar, minha atuação foca na recuperação da independência funcional de idosos após eventos neurológicos como AVC e TCE. Realizo avaliação do ambiente doméstico para adaptações de acessibilidade, treinamento de AVDs (atividades de vida diária) e uso de tecnologias assistivas. Trabalho em parceria com fisioterapeutas e fonoaudiólogos para oferecer um cuidado verdadeiramente interdisciplinar. Atendo no Recife e cidades vizinhas.",
    "city": "Recife",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Maria das Dores Ferreira Brito",
    "email": "mariadaores.brito@gmail.com",
    "birthDate": "1968-01-22",
    "bio": "30 anos de experiência cuidando de idosos. Confiança e amor em cada plantão.",
    "hourlyRate": 11000,
    "professionalId": "COREN-PE 089234",
    "approach": "Plantão Noturno",
    "specialties": ["Alzheimer avançado", "Higiene e Conforto", "Administração de Medicamentos"],
    "longDescription": "Com três décadas dedicadas ao cuidado de pessoas idosas, construí minha reputação com base na confiança das famílias que atendo. Minha especialidade é o plantão noturno, onde garanto sono seguro, controle de medicamentos noturnos e prevenção de quedas durante a madrugada. Tenho experiência extensa com pacientes em estágio avançado de Alzheimer, sabendo lidar com agitação noturna e desorientação com calma e técnica. Sou referência no bairro de Casa Amarela há mais de 15 anos.",
    "city": "Recife",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Roberval Sousa Pimentel",
    "email": "roberval.pimentel.cuidados@gmail.com",
    "birthDate": "1980-06-14",
    "bio": "Cuidador formado em enfermagem. Atuo com técnica, respeito e presença constante.",
    "hourlyRate": 17000,
    "professionalId": "COREN-PB 134567",
    "approach": "Acompanhamento Hospitalar",
    "specialties": ["Pós-operatório", "Diabetes Avançada", "Insuficiência Renal"],
    "longDescription": "Natural de Campina Grande, me mudei para o Recife há 8 anos para atuar em acompanhamento hospitalar de alta complexidade. Tenho experiência com pacientes idosos com múltiplas comorbidades, especialmente diabetes descompensada e insuficiência renal em estágio avançado. Acompanho consultas, internações, exames e procedimentos, sendo a ponte entre o paciente, a família e a equipe médica. Tenho fluência em leitura de prontuários e sei como perguntar ao médico o que a família mais precisa saber.",
    "city": "Recife",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Débora Patrícia Nascimento Leite",
    "email": "debora.leite.cuidadora@outlook.com",
    "birthDate": "1995-12-01",
    "bio": "Jovem cuidadora com formação em gerontologia. Energia, técnica e muito carinho.",
    "hourlyRate": 12000,
    "professionalId": "COREN-PE 248901",
    "approach": "Cuidado Humanizado",
    "specialties": ["Estimulação Cognitiva", "Parkinson", "Acompanhamento em Atividades Sociais"],
    "longDescription": "Formada em gerontologia pela UFPE e com curso técnico em enfermagem, sou uma das cuidadoras mais jovens da plataforma, mas com preparo técnico sólido e vocação evidente. Acredito que o idoso não deve apenas ser cuidado, mas estimulado a viver. Por isso, incorporo atividades recreativas, passeios assistidos e rodas de conversa na minha rotina de cuidados. Atendo pacientes com Parkinson em fase inicial e moderada, com foco em preservação da autonomia e qualidade de vida.",
    "city": "Igarassu",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Antônio Gilberto Pessoa Rodrigues",
    "email": "gilberto.rodrigues.enfermagem@gmail.com",
    "birthDate": "1972-08-19",
    "bio": "Enfermeiro com 20 anos em geriatria. Segurança técnica e acolhimento humano.",
    "hourlyRate": 24000,
    "professionalId": "COREN-CE 067831",
    "approach": "Home Care",
    "specialties": ["Insuficiência Cardíaca", "Curativos Complexos", "Cateter e Sondas"],
    "longDescription": "Enfermeiro graduado pela UFC com 20 anos de atuação em unidades geriátricas hospitalares de Fortaleza, me especializei nos últimos 5 anos em home care de alta complexidade. Atendo pacientes com insuficiência cardíaca congestiva, DPOC e necessidade de sondas e cateteres permanentes. Realizo procedimentos que normalmente exigiriam internação hospitalar, com todo equipamento e segurança no conforto do lar do paciente. Disponível para Recife, Olinda e Caruaru mediante deslocamento.",
    "city": "Caruaru",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Lucineide Gomes da Silva",
    "email": "lucineide.silva.cuidadora@gmail.com",
    "birthDate": "1983-03-07",
    "bio": "Especialista em idosos acamados. Prevenção de escaras e conforto são minha missão.",
    "hourlyRate": 15000,
    "professionalId": "COREN-AL 112034",
    "approach": "Plantão Noturno",
    "specialties": ["Prevenção de Escaras", "Higiene em Leito", "Posicionamento Terapêutico"],
    "longDescription": "Trabalho há 11 anos com pacientes acamados em regime domiciliar, com ênfase total na prevenção e tratamento de úlceras por pressão. Domino técnicas de reposicionamento programado, uso de coxins e colchões terapêuticos, e realizo higiene no leito com total preservação da dignidade do paciente. Atendo em plantão noturno de 12 horas, garantindo que o idoso passe a noite sem complicações. Vim de Maceió e me fixei no Recife há 6 anos, onde construí uma carteira sólida de famílias que confiam no meu trabalho.",
    "city": "Recife",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Fábio Henrique Queiroz Cavalcante",
    "email": "fabio.queiroz.fisio@gmail.com",
    "birthDate": "1988-10-23",
    "bio": "Fisioterapeuta especializado em geriatria. Movimento é saúde em qualquer idade.",
    "hourlyRate": 21000,
    "professionalId": "Crefito-PE 61204",
    "approach": "Home Care",
    "specialties": ["Reabilitação Pós-AVC", "Parkinson", "Fratura de Fêmur", "Respiratório"],
    "longDescription": "Fisioterapeuta com residência em geriatria pelo IMIP e 9 anos de experiência em reabilitação domiciliar. Atendo pacientes em recuperação de fratura de fêmur, sequelas de AVC e controle motor reduzido pelo Parkinson. Além dos exercícios físicos, trabalho com fisioterapia respiratória em pacientes com DPOC e histórico de pneumonia de repetição. Minha meta é sempre funcionalidade: fazer o idoso voltar a andar, vestir-se ou sentar à mesa com a família são vitórias que me movem todos os dias.",
    "city": "Olinda",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Norma Cecília Tavares Mendonça",
    "email": "norma.mendonca.cuidadora@hotmail.com",
    "birthDate": "1970-07-11",
    "bio": "Cuidadora experiente e discreta. Respeito a privacidade e os limites de cada idoso.",
    "hourlyRate": 13500,
    "professionalId": "COREN-PE 101289",
    "approach": "Cuidado Humanizado",
    "specialties": ["Alzheimer", "Depressão em Idosos", "Acompanhamento Emocional"],
    "longDescription": "Com 22 years de experiência, aprendi que o cuidado emocional é tão importante quanto o físico. Trabalho com idosos que, além das limitações físicas, enfrentam depressão, ansiedade e solidão — condições frequentemente negligenciadas. Tenho formação complementar em psicologia positiva aplicada ao envelhecimento e uso técnicas de reminiscência para fortalecer a autoestima de pacientes com Alzheimer. Sou conhecida pela discrição absoluta e pelo relacionamento respeitoso que construo com cada família.",
    "city": "Camaragibe",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Edenilson Pereira Monteiro",
    "email": "edenilson.monteiro.plantao@gmail.com",
    "birthDate": "1976-12-29",
    "bio": "Especialista em plantão noturno. Cuido da segurança do seu familiar enquanto você descansa.",
    "hourlyRate": 14500,
    "professionalId": "COREN-RN 098412",
    "approach": "Plantão Noturno",
    "specialties": ["Agitação Noturna", "Demência", "Controle de Medicamentos Noturnos"],
    "longDescription": "Natural de Natal, me especializei em plantão noturno há mais de 10 anos, um serviço que considero essencial e frequentemente subestimado. Meu trabalho garante que o idoso durma com segurança e que a família descanse sem culpa. Tenho vasta experiência com agitação noturna típica de demência (sundowning), usando abordagens não farmacológicas antes de qualquer escalada medicamentosa. Mantenho registro detalhado de cada noite e comunico qualquer intercorrência imediatamente ao responsável.",
    "city": "Recife",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Valdirene Santos Pereira",
    "email": "valdirene.pereira.cuidados@gmail.com",
    "birthDate": "1987-04-04",
    "bio": "Cuidadora e nutricionista. Saúde começa no prato: cuido do corpo e da alimentação.",
    "hourlyRate": 18500,
    "professionalId": "CRN-5 034219",
    "approach": "Cuidado Humanizado",
    "specialties": ["Nutrição para Idosos", "Disfagia", "Controle Glicêmico", "Hidratação Assistida"],
    "longDescription": "Nutricionista com especialização em nutrição geriátrica e experiência em cuidados domiciliares para idosos com disfagia, diabetes e desnutrição. Elaboro cardápios individualizados, adapto texturas dos alimentos conforme orientação fonoaudiológica e garanto hidratação adequada — um dos maiores desafios no cuidado de idosos. Trabalho em conjunto com a equipe multidisciplinar e oriento a família sobre como preparar refeições nutritivas e seguras. Atendo no Recife e municípios da RMR.",
    "city": "São Lourenço da Mata",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Benedito Almeida Wanderley",
    "email": "benedito.wanderley.cuidador@gmail.com",
    "birthDate": "1965-09-16",
    "bio": "Cuidador veterano com 25 anos de estrada. Seriedade, fé e dedicação total.",
    "hourlyRate": 11500,
    "professionalId": "COREN-PE 058731",
    "approach": "Plantão Noturno",
    "specialties": ["Alzheimer", "Prevenção de Qias", "Higiene e Conforto"],
    "longDescription": "Com 25 anos de cuidados, já vi de tudo e aprendi com cada família que passei. Sou referência em plantão noturno para idosos com Alzheimer, tendo construído técnicas próprias de abordagem ao paciente desorientado que evitam escalada e promovem tranquilidade. Sou um homem de poucas palavras, mas de ação constante: minha presença transmite segurança às famílias. Trabalho com honestidade e transparência absolutas, pois sei que estou entrando no espaço mais íntimo de uma família.",
    "city": "Cabo de Santo Agostinho",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Renata Oliveira Leal Fonseca",
    "email": "renata.fonseca.gerontologia@gmail.com",
    "birthDate": "1992-02-28",
    "bio": "Gerontóloga e cuidadora. Defendo o envelhecimento ativo com ciência e carinho.",
    "hourlyRate": 16500,
    "professionalId": "COREN-PE 244312",
    "approach": "Cuidado Humanizado",
    "specialties": ["Envelhecimento Ativo", "Estimulação Cognitiva", "Parkinson", "Acompanhamento em Consultas"],
    "longDescription": "Gerontóloga pela UFPE com pós-graduação em neuropsicologia do envelhecimento, acredito que cuidar é também estimular. Desenvolvo programas individualizados de estimulação cognitiva para idosos em risco ou com diagnóstico de comprometimento cognitivo leve, usando jogos, música e reminiscência. Acompanho consultas médicas, interpreto laudos e sirvo de elo entre o paciente e sua equipe de saúde. Trabalho com leveza, mas com rigor técnico que as famílias percebem desde o primeiro dia.",
    "city": "Recife",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Gilmar Rodrigues Fontes",
    "email": "gilmar.fontes.enfermagem@hotmail.com",
    "birthDate": "1977-11-11",
    "bio": "Técnico de enfermagem com experiência em UTI e home care. Alta complexidade com humanidade.",
    "hourlyRate": 20500,
    "professionalId": "COREN-SE 087654",
    "approach": "Acompanhamento Hospitalar",
    "specialties": ["UTI Domiciliar", "Traqueostomia", "Ventilação Mecânica", "Sondas e Cateteres"],
    "longDescription": "Vim de Aracaju com mais de 14 anos de experiência em terapia intensiva para atuar no segmento de UTI domiciliar no Recife. Tenho habilidade comprovada em manejo de traqueostomia, aspiração de vias aéreas, ventilação mecânica não invasiva e controle de acesso venoso. Esses cuidados que antes exigiam internação prolongada podem ser feitos com segurança e qualidade no ambiente familiar, preservando o paciente e reduzindo custos hospitalares. Atendo com profissionalismo de UTI e a sensibilidade que o lar exige.",
    "city": "Recife",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Conceição Maria Araújo Bezerra",
    "email": "conceicao.bezerra.cuidadora@gmail.com",
    "birthDate": "1969-06-03",
    "bio": "Cuidadora cristã com vocação de servir. Trato seu familiar como família mesmo.",
    "hourlyRate": 10000,
    "professionalId": "COREN-PE 072341",
    "approach": "Home Care",
    "specialties": ["Alzheimer", "Higiene e Conforto", "Administração de Medicamentos"],
    "longDescription": "Há 18 anos trabalho com cuidados domiciliares no Grande Recife, movida por vocação genuína e fé. Minha abordagem é simples e eficaz: consistência, carinho e comunicação honesta com a família. Não tenho especialização acadêmica avançada, mas minha experiência prática é meu maior diploma. Já cuidei de mais de 30 idosos em toda minha trajetória, muitos deles por mais de 2 anos. As famílias me descrevem como alguém que entra como funcionária e sai como parte da família.",
    "city": "Paulista",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Thiago Menezes Vasconcelos",
    "email": "thiago.vasconcelos.cuidador@gmail.com",
    "birthDate": "1996-08-15",
    "bio": "Cuidador jovem com formação técnica em enfermagem. Energia, atenção e comprometimento.",
    "hourlyRate": 9500,
    "professionalId": "COREN-PE 261078",
    "approach": "Home Care",
    "specialties": ["Mobilidade Reduzida", "Acompanhamento em Atividades", "Administração de Medicamentos"],
    "longDescription": "Recém-formado em técnico de enfermagem pela Escola Técnica Estadual de Pernambuco, busco construir minha carreira com responsabilidade e aprendizado constante. Tenho experiência prática de 2 anos como cuidador informal para meu avô com sequelas de AVC, o que me ensinou mais do que qualquer sala de aula. Sou pontual, organizado e disponível para plantões diurnos em Igarassu e municípios vizinhos. Estou em constante atualização e aberto ao diálogo com médicos e familiares.",
    "city": "Igarassu",
    "state": "PE",
    "role": "CUIDADOR"
  },
  {
    "name": "Carla Beatriz Melo Wanderley",
    "email": "carla.wanderley.familiar@gmail.com",
    "birthDate": "1979-03-22",
    "bio": "Procuro cuidadora de confiança para minha mãe de 80 anos com Alzheimer em fase moderada.",
    "role": "FAMILIAR"
  },
  {
    "name": "Paulo Roberto Gomes de Souza",
    "email": "paulo.gomes.familiar@hotmail.com",
    "birthDate": "1965-11-07",
    "bio": "Empresário sobrecarregado. Preciso de ajuda para cuidar do meu pai com Parkinson avançado.",
    "role": "FAMILIAR"
  },
  {
    "name": "Isabela Cristina Ferraz Nogueira",
    "email": "isabela.nogueira.familiar@gmail.com",
    "birthDate": "1988-06-14",
    "bio": "Professora com dois filhos. Minha avó de 87 anos precisa de companhia e cuidados diários.",
    "role": "FAMILIAR"
  },
  {
    "name": "Marcos Vinícius Albuquerque Lima",
    "email": "marcos.lima.familiar@outlook.com",
    "birthDate": "1975-09-30",
    "bio": "Meu pai teve um AVC e preciso de um cuidador para acompanhá-lo na reabilitação em casa.",
    "role": "FAMILIAR"
  },
  {
    "name": "Giovana Tavares Cavalcanti",
    "email": "giovana.cavalcanti.familiar@gmail.com",
    "birthDate": "1991-01-18",
    "bio": "Morando no exterior, preciso de cuidadora de confiança para minha mãe em Recife.",
    "role": "FAMILIAR"
  },
  {
    "name": "Raimundo Nonato Pereira Filho",
    "email": "raimundo.pereira.familiar@gmail.com",
    "birthDate": "1960-04-05",
    "bio": "Procuro cuidador noturno para minha esposa de 74 anos com insônia severa e demência.",
    "role": "FAMILIAR"
  },
  {
    "name": "Natália Souza Brito",
    "email": "natalia.brito.familiar@gmail.com",
    "birthDate": "1986-08-23",
    "bio": "Minha mãe está em recuperação pós-cirúrgica. Preciso de suporte qualificado em casa.",
    "role": "FAMILIAR"
  },
  {
    "name": "Edilson Henrique Corrêa Santos",
    "email": "edilson.santos.familiar@hotmail.com",
    "birthDate": "1970-12-12",
    "bio": "Meu sogro de 82 anos mora sozinho e precisa de acompanhamento diário. Busco alguém de confiança.",
    "role": "FAMILIAR"
  },
  {
    "name": "Fernanda Queiroz Maciel",
    "email": "fernanda.maciel.familiar@gmail.com",
    "birthDate": "1983-05-09",
    "bio": "Preciso de cuidadora para minha mãe diabética e com mobilidade bastante reduzida.",
    "role": "FAMILIAR"
  },
  {
    "name": "João Carlos Lins de Barros",
    "email": "joaocarlos.barros.familiar@gmail.com",
    "birthDate": "1958-02-28",
    "bio": "Aposentado cuidando da minha mãe de 96 anos. Preciso de alívio nos fins de semana.",
    "role": "FAMILIAR"
  },
  {
    "name": "Ana Flávia Monteiro Ribeiro",
    "email": "anaflaviamonteiro.familiar@outlook.com",
    "birthDate": "1994-07-17",
    "bio": "Minha avó tem Alzheimer e fica agitada à noite. Preciso urgente de plantão noturno.",
    "role": "FAMILIAR"
  },
  {
    "name": "Sérgio Luís Figueiredo Matos",
    "email": "sergio.matos.familiar@gmail.com",
    "birthDate": "1968-10-01",
    "bio": "Meu pai está em cuidados paliativos. Quero que ele tenha dignidade e conforto até o fim.",
    "role": "FAMILIAR"
  },
  {
    "name": "Priscila Diniz Alves Teixeira",
    "email": "priscila.teixeira.familiar@gmail.com",
    "birthDate": "1985-03-11",
    "bio": "Trabalho em tempo integral. Busco cuidadora para minha mãe com início de Alzheimer.",
    "role": "FAMILIAR"
  },
  {
    "name": "Gustavo Henrique Cardoso Lemos",
    "email": "gustavo.lemos.familiar@hotmail.com",
    "birthDate": "1972-11-25",
    "bio": "Meu pai de 78 anos caiu e fraturou o fêmur. Preciso de cuidador durante a reabilitação.",
    "role": "FAMILIAR"
  },
  {
    "name": "Lídia Aparecida Costa Duarte",
    "email": "lidia.duarte.familiar@gmail.com",
    "birthDate": "1963-08-08",
    "bio": "Cuido da minha mãe há 3 anos sozinha. Preciso de alguém para me ajudar às tardes.",
    "role": "FAMILIAR"
  },
  {
    "name": "Thales Augusto Ferreira Pontes",
    "email": "thales.pontes.familiar@outlook.com",
    "birthDate": "1980-04-19",
    "bio": "Minha mãe está em cadeira de rodas após AVC. Preciso de cuidador com experiência em reabilitação.",
    "role": "FAMILIAR"
  },
  {
    "name": "Cristiane Borges Leal Nunes",
    "email": "cristiane.nunes.familiar@gmail.com",
    "birthDate": "1977-01-30",
    "bio": "Meu avô está com depressão severa após a morte da minha avó. Preciso de cuidador empático.",
    "role": "FAMILIAR"
  },
  {
    "name": "Arnaldo Peixoto Cavalcante",
    "email": "arnaldo.cavalcante.familiar@gmail.com",
    "birthDate": "1955-06-22",
    "bio": "Minha esposa de 71 anos tem Parkinson e eu já não consigo cuidar dela sozinho.",
    "role": "FAMILIAR"
  },
  {
    "name": "Juliana Raquel Vieira Sampaio",
    "email": "juliana.sampaio.familiar@gmail.com",
    "birthDate": "1989-09-04",
    "bio": "Busco cuidadora para minha mãe com disfagia. Experiência em alimentação adaptada é essencial.",
    "role": "FAMILIAR"
  },
  {
    "name": "Eduardo Marcelino Siqueira",
    "email": "eduardo.siqueira.familiar@hotmail.com",
    "birthDate": "1973-12-16",
    "bio": "Meu pai tem 85 anos, mora em Olinda e precisa de acompanhamento diário com qualidade.",
    "role": "FAMILIAR"
  },
  {
    "name": "Mônica Cristina Barbosa Freire",
    "email": "monica.freire.familiar@gmail.com",
    "birthDate": "1966-07-03",
    "bio": "Cuido da minha mãe e do meu pai ao mesmo tempo. Preciso urgente de um suporte profissional.",
    "role": "FAMILIAR"
  }
];

// ─── LÓGICA DE INJEÇÃO (UPSERT) ──────────────────────────────────
async function main() {
  console.log('🚀 Iniciando semeadura de dados (Seed) da Virla...')
  
  for (const usuario of dadosMocks) {
    const birthDateObj = usuario.birthDate ? new Date(usuario.birthDate) : null;

    // Criando um texto rico para a descrição, juntando os dados que o Claude gerou
    let descCompleta = '';
    if (usuario.role === 'CUIDADOR') {
      descCompleta = `📍 Localização: ${usuario.city || ''} - ${usuario.state || ''}\n`;
      descCompleta += `🎯 Abordagem: ${usuario.approach || 'Geral'}\n`;
      descCompleta += `✨ Especialidades: ${usuario.specialties ? usuario.specialties.join(', ') : 'Nenhuma específica'}\n\n`;
      descCompleta += `${usuario.longDescription || ''}`;
    }

    await prisma.user.upsert({
      where: { email: usuario.email },
      update: {}, 
      create: {
        name: usuario.name,
        email: usuario.email,
        birthDate: birthDateObj,
        bio: usuario.bio,
        hourlyRate: usuario.hourlyRate ?? null,
        
        // Mapeando as colunas exatamente como o seu banco Prisma exige:
        registerNumber: usuario.professionalId ?? null, 
        description: descCompleta.trim() !== '' ? descCompleta.trim() : null,
        
        role: usuario.role,
        password: "$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjGsGZJwGq" 
      }
    })
  }
  
  console.log('✅ 41 Perfis verificados/inseridos com sucesso no Banco de Dados!')
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o Seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })