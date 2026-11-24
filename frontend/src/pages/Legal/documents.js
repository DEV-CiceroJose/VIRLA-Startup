import { CONTACT_EMAIL, LEGAL_UPDATED_LABEL } from '../../constants/legal'

/**
 * Texto dos Termos de Uso e da Política de Privacidade.
 *
 * IMPORTANTE: minuta preparada para o MVP. Antes de publicar, um(a)
 * advogado(a) deve revisar e os campos entre colchetes ([RAZÃO SOCIAL],
 * [CNPJ], [ENDEREÇO], [ENCARREGADO]) precisam ser preenchidos. Ao mudar o
 * texto, atualize TERMS_VERSION (frontend e backend).
 *
 * Formato: seções com parágrafos (`p`) e listas (`list`).
 */

const company = '[RAZÃO SOCIAL], inscrita no CNPJ sob o nº [CNPJ], com sede em [ENDEREÇO] ("VIRLA")'

export const TERMS = {
  slug: 'termos',
  title: 'Termos de Uso',
  updated: LEGAL_UPDATED_LABEL,
  intro: `Estes Termos regulam o uso da plataforma VIRLA, oferecida por ${company}. Ao criar uma conta, você declara que leu, entendeu e concorda com eles e com a Política de Privacidade.`,
  sections: [
    {
      title: '1. O que a VIRLA faz',
      p: [
        'A VIRLA é uma plataforma digital que aproxima famílias que procuram cuidado domiciliar e cuidadores que oferecem esse serviço. Disponibilizamos busca, perfis, compatibilidade (match), chat, solicitações, relatórios de atendimento e meios de pagamento.',
        'A VIRLA não é empregadora, agência de empregos nem prestadora de serviços de saúde. O serviço de cuidado é combinado e prestado diretamente entre a família e o cuidador, que é profissional independente.',
      ],
    },
    {
      title: '2. Quem pode usar',
      list: [
        'Pessoas maiores de 18 anos, com capacidade civil, que informem dados verdadeiros e atualizados.',
        'Cada pessoa pode ter uma única conta, vinculada ao próprio CPF. É proibido criar conta em nome de terceiros.',
        'Você é responsável por manter sua senha em segredo e por toda atividade feita na sua conta. Avise-nos se suspeitar de uso indevido.',
      ],
    },
    {
      title: '3. Verificação de cuidadores',
      p: [
        'Para a segurança das famílias, de quem recebe o cuidado e da própria plataforma, todo cuidador precisa passar pela verificação antes de aparecer nas buscas e de receber solicitações.',
      ],
      list: [
        'O cuidador envia: documento oficial com foto (RG, CNH ou equivalente), uma selfie segurando esse documento e a certidão de antecedentes criminais emitida há no máximo 90 dias, com o respectivo código de validação.',
        'O cuidador declara, sob as penas da lei, que as informações e os documentos enviados são verdadeiros. Documento falso ou adulterado leva ao encerramento da conta e pode ser comunicado às autoridades.',
        'A equipe VIRLA confere os documentos, inclusive a autenticidade da certidão no site do órgão emissor, e aprova ou reprova a verificação, informando o motivo da reprovação.',
        'A VIRLA pode pedir uma nova verificação a qualquer momento (por exemplo, quando a certidão ficar desatualizada ou houver denúncia) e pode suspender o perfil enquanto ela não for concluída.',
      ],
      note: 'A verificação reduz riscos, mas não garante a conduta futura de ninguém. Recomendamos que a família converse, faça entrevista e confira referências antes de contratar.',
    },
    {
      title: '4. Regras de convivência',
      p: ['Ao usar a VIRLA, você se compromete a não:'],
      list: [
        'informar dados falsos, se passar por outra pessoa ou usar documentos de terceiros;',
        'assediar, ameaçar, discriminar ou desrespeitar qualquer pessoa;',
        'publicar conteúdo ilegal, ofensivo ou que exponha dados de terceiros sem autorização;',
        'usar a plataforma para fraudes, golpes ou para tirar o contato de outra pessoa com o objetivo de prejudicá-la;',
        'negociar ou receber pagamentos por fora da plataforma para serviços combinados nela;',
        'tentar acessar áreas restritas, copiar dados em massa ou interferir no funcionamento do sistema.',
      ],
    },
    {
      title: '5. Pagamentos',
      list: [
        'Os pagamentos são processados por parceiros (como Stripe e AbacatePay). Valores, taxas e prazos aparecem antes da confirmação.',
        'A VIRLA não reconhece nem se responsabiliza por pagamentos realizados fora da plataforma.',
        'Os relatórios de atendimento registram o serviço prestado e servem de base para cobranças e repasses.',
      ],
    },
    {
      title: '6. Responsabilidades',
      list: [
        'O cuidador responde pela qualidade, pela segurança e pela legalidade do serviço que presta.',
        'A família responde pelas informações sobre a pessoa assistida e pelo ambiente onde o cuidado acontece.',
        'A VIRLA responde pelo funcionamento da plataforma e pela verificação descrita nestes Termos. Não respondemos por atos praticados pelos usuários fora dela, nos limites da lei e sem afastar direitos garantidos pelo Código de Defesa do Consumidor.',
      ],
    },
    {
      title: '7. Suspensão e encerramento',
      p: [
        'Podemos advertir, suspender ou encerrar contas que descumpram estes Termos, que apresentem risco à segurança de outras pessoas ou por determinação legal. Você pode encerrar sua conta quando quiser, pelo perfil.',
      ],
    },
    {
      title: '8. Propriedade intelectual',
      p: [
        'A marca, o nome, o design e o software da VIRLA são protegidos. O conteúdo que você publica continua seu; você nos autoriza a exibi-lo na plataforma para que ela funcione.',
      ],
    },
    {
      title: '9. Mudanças nestes Termos',
      p: [
        'Podemos atualizar estes Termos. Quando a mudança for relevante, avisaremos e pediremos um novo aceite antes que você continue usando a plataforma.',
      ],
    },
    {
      title: '10. Lei aplicável e foro',
      p: [
        'Estes Termos seguem as leis brasileiras. Fica eleito o foro do domicílio do consumidor para resolver qualquer questão.',
      ],
    },
    {
      title: '11. Contato',
      p: [`Dúvidas, denúncias ou pedidos: ${CONTACT_EMAIL}.`],
    },
  ],
}

export const PRIVACY = {
  slug: 'privacidade',
  title: 'Política de Privacidade',
  updated: LEGAL_UPDATED_LABEL,
  intro: `Esta Política explica como ${company}, na qualidade de controladora, trata os seus dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).`,
  sections: [
    {
      title: '1. Quem cuida dos seus dados',
      p: [
        `Controladora: ${company}. Encarregado(a) pelo tratamento de dados (DPO): [ENCARREGADO], contato ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: '2. Quais dados coletamos',
      list: [
        'Cadastro: nome, e-mail, CPF, data de nascimento, tipo de conta e foto de perfil (opcional).',
        'Perfil profissional (cuidadores): conselho e número de registro, especialidades, valor por hora, disponibilidade, cidade, estado e CEP, apresentação.',
        'Verificação (cuidadores): documento oficial com foto, selfie segurando o documento, certidão de antecedentes criminais e seu código de validação, data de emissão e a declaração de veracidade.',
        'Uso da plataforma: solicitações de cuidado, mensagens do chat, relatórios de atendimento, notificações e status de presença.',
        'Informações de saúde da pessoa assistida que a família decide incluir na solicitação (dados sensíveis), usadas só para encontrar o cuidado adequado.',
        'Pagamentos: valores e status das transações. Dados completos de cartão são tratados pelos parceiros de pagamento, não pela VIRLA.',
        'Dados técnicos: endereço IP, data e hora de acesso, registros de segurança e informações do navegador.',
      ],
    },
    {
      title: '3. Para que usamos e com qual base legal',
      list: [
        'Criar e manter sua conta, exibir perfis, calcular a compatibilidade e permitir conversas e contratações — execução do contrato (art. 7º, V).',
        'Verificar a identidade e os antecedentes de cuidadores, prevenir fraudes e proteger famílias e pessoas assistidas — legítimo interesse e prevenção à fraude e à segurança do titular (art. 7º, IX, e art. 11, II, "g").',
        'Processar pagamentos, emitir comprovantes e cumprir obrigações fiscais — execução do contrato e cumprimento de obrigação legal (art. 7º, II e V).',
        'Guardar registros de acesso — obrigação legal do Marco Civil da Internet (art. 15 da Lei nº 12.965/2014).',
        'Tratar dados de saúde informados pela família — consentimento específico, dado ao publicar a solicitação (art. 11, I).',
      ],
      note: 'A selfie é conferida visualmente pela equipe. Não fazemos reconhecimento facial automatizado. A compatibilidade (match) é uma sugestão automática: você pode pedir a revisão de qualquer decisão automatizada (art. 20).',
    },
    {
      title: '4. Com quem compartilhamos',
      list: [
        'Com outros usuários: o perfil público mostra nome, foto, cidade, especialidades, valor e o status de verificação. CPF, e-mail e documentos nunca aparecem.',
        'Com prestadores que nos ajudam a operar: Google Firebase (login, banco de dados e chat), Render (hospedagem), Stripe e AbacatePay (pagamentos).',
        'Com autoridades públicas, quando houver obrigação legal ou ordem judicial.',
      ],
      note: 'Não vendemos seus dados pessoais.',
    },
    {
      title: '5. Transferência internacional',
      p: [
        'Alguns prestadores mantêm servidores fora do Brasil. Nesses casos, exigimos garantias adequadas de proteção, conforme o art. 33 da LGPD.',
      ],
    },
    {
      title: '6. Por quanto tempo guardamos',
      list: [
        'Dados da conta: enquanto ela estiver ativa.',
        'Documentos da verificação: enquanto o cuidador estiver ativo e por até 30 dias depois de uma reprovação não contestada ou do encerramento da conta, salvo obrigação legal.',
        'Registros de acesso: 6 meses. Dados de pagamento e fiscais: pelo prazo exigido em lei (em geral, 5 anos).',
      ],
    },
    {
      title: '7. Como protegemos',
      list: [
        'Comunicação criptografada (HTTPS) e senhas gerenciadas pelo Firebase Authentication.',
        'Documentos da verificação guardados criptografados, fora de qualquer pasta pública, acessíveis só ao próprio cuidador e à equipe autorizada, com registro de cada acesso.',
        'Mensagens do chat criptografadas e acesso restrito por perfil.',
      ],
    },
    {
      title: '8. Seus direitos',
      p: ['Você pode, a qualquer momento e sem custo (art. 18):'],
      list: [
        'confirmar se tratamos seus dados e acessá-los;',
        'corrigir dados incompletos, inexatos ou desatualizados;',
        'pedir anonimização, bloqueio ou eliminação de dados desnecessários;',
        'pedir a portabilidade dos seus dados;',
        'saber com quem compartilhamos seus dados;',
        'revogar o consentimento, quando ele for a base do tratamento;',
        'pedir a revisão de decisões automatizadas.',
      ],
      note: `Para exercer seus direitos, escreva para ${CONTACT_EMAIL}. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).`,
    },
    {
      title: '9. Pessoas assistidas e menores',
      p: [
        'A plataforma é para maiores de 18 anos. Quando a família descreve a pessoa que vai receber o cuidado, pedimos que informe só o necessário para encontrar o profissional adequado.',
      ],
    },
    {
      title: '10. Armazenamento no navegador',
      p: [
        'Usamos o armazenamento local do navegador para manter sua sessão e lembrar preferências, como o tema claro ou escuro. Não usamos cookies de publicidade.',
      ],
    },
    {
      title: '11. Mudanças nesta Política',
      p: [
        'Podemos atualizar esta Política. Mudanças relevantes serão avisadas e, quando necessário, pediremos um novo aceite.',
      ],
    },
  ],
}

export const LEGAL_DOCUMENTS = { termos: TERMS, privacidade: PRIVACY }
