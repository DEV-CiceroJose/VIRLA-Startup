import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AccountBalanceWalletOutlined,
  ArrowForward,
  ChatOutlined,
  CheckCircleOutlined,
  Close,
  Favorite,
  FavoriteBorder,
  Instagram,
  MailOutlined,
  ManageSearchOutlined,
  MedicalServicesOutlined,
  Menu,
  RocketLaunchOutlined,
  SentimentDissatisfiedOutlined,
  ShieldOutlined,
  TrendingUp,
  VerifiedUserOutlined,
  VolunteerActivismOutlined,
  WarningAmberOutlined,
  WhatsApp,
} from '@mui/icons-material'
import Marquee from './components/Marquee'
import NumberTicker from './components/NumberTicker'
import HoverCards from './components/HoverCards'
import { BentoGrid, BentoCell } from './components/BentoGrid'
import ScrollTimeline from './components/ScrollTimeline'
import InkThemeToggle from './components/InkThemeToggle'
import './landing.css'

const FORM_FAMILIAS = 'https://docs.google.com/forms/d/e/1FAIpQLSdg2-oStG8HFtxq_pqtrWM2AxX7SM19qb-XRSLSdjZjOJEjHA/viewform?usp=header'
const FORM_CUIDADORES = 'https://docs.google.com/forms/d/e/1FAIpQLSfCOVa-Q2v5y6MVE51wa5nZoGLngZInV8AtfARog98jun1F_g/viewform?usp=header'

const img = (name) => `/landing/${name}.jpg`

// Onde a VIRLA já esteve — tirado da própria trajetória.
const PATH = [
  'Hackathon', 'IgaraLOL', 'Semana de Tecnologia', 'Projeto Centelha', 'Startup Day na TV Globo',
  'Quintas de Inovação', 'Bootcamp Tascom Academy', 'Feira do Empreendedor', 'SEBRAE PE',
  'Missão NEON', 'Hub Canoa Grande', 'FOZ · FPS · IMIP',
]

const PAINS = [
  { Icon: WarningAmberOutlined, tone: 'red', title: '1 em cada 3', text: 'Idosos sofre algum tipo de negligência ou abandono, muitas vezes por falta de preparo do profissional não verificado.' },
  { Icon: SentimentDissatisfiedOutlined, tone: 'orange', title: 'Falta de histórico', text: 'Como saber se o cuidador é realmente bom sem avaliações reais e centralizadas de outras famílias?' },
  { Icon: AccountBalanceWalletOutlined, tone: 'purple', title: 'Insegurança financeira', text: 'O medo constante: “E se eu pagar adiantado e o cuidador não aparecer?”. O mercado informal não oferece garantias.' },
]

const DIFFERENTIALS = [
  { Icon: CheckCircleOutlined, title: 'Sem mensalidades', text: 'Não cobramos para você visualizar profissionais e não acrescentamos taxa VIRLA ao valor do contrato.' },
  { Icon: MedicalServicesOutlined, title: 'Especialistas', text: 'Diferente do Getninjas, somos especialistas exclusivos em saúde e cuidado domiciliar, não em serviços gerais.' },
  { Icon: ShieldOutlined, title: 'Proteção total', text: 'Diferente do mercado informal, oferecemos verificação ativa de documentos e garantia financeira de ponta a ponta.' },
]

const JOURNEY = [
  { title: 'O Nascimento', text: 'A ideia inicial e o protótipo nasceram durante uma intensa maratona de Hackathon, unindo tecnologia e propósito.', img: img('nascimento') },
  { title: 'Reconhecimento', text: 'Apresentações aclamadas no IgaraLOL e na Semana de Tecnologia, validando a dor do mercado local.', img: img('igaralol'), position: 'center 25%' },
  { title: 'Validação Técnica', text: 'Participação no Projeto do Dr. Danilo no edital Compet Médiotec e sucesso no Projeto Centelha (pontuação 4,1 na 1ª fase).', img: img('centelha') },
  { title: 'Visibilidade Estadual', text: 'Destaque durante o Startup Day, com direito a cobertura e reconhecimento na TV Globo.', img: img('startup-day') },
  { title: 'Quintas de Inovação', text: 'Apresentação da nossa ideia e proposta de valor no evento Quintas de Inovação, marcando o início da nossa validação pública com o ecossistema.' },
  { title: 'Banca do Bootcamp Tascom', text: 'Apresentamos a VIRLA como projeto final no Bootcamp da Tascom Academy. O processo aconteceu em conjunto com a ETE Jurandir Bezerra Lins, que forneceu o espaço para o programa.', img: img('bootcamp') },
  { title: 'Feira do Empreendedor', text: 'Participamos da caravana da ETE Jurandir Bezerra Lins para a Feira do Empreendedor, com o suporte do SEBRAE PE. Lá aprendemos como transformar a VIRLA em uma potência tecnológica, além de fazermos várias conexões.', img: img('empreendedor') },
  { title: 'Missão NEON', text: 'Saímos de Igarassu (PE) para Maceió (AL) com inúmeras conexões, parcerias e conhecimentos, um passo mais perto de mudar como as conexões ocorrem no Brasil, com o apoio do SEBRAE PE, da ETE Jurandir Bezerra Lins e do Hub Canoa Grande.', img: img('neon') },
  { title: 'Reunião Semestral do Hub Canoa Grande', text: 'Participamos da reunião de alinhamento semestral do Hub Canoa Grande, o hub de inovação de Igarassu, junto com as startups e gestores da cidade para definir o futuro da inovação local.', img: img('hub') },
  { title: 'Pré-Incubação na FOZ', text: 'Agora estamos na pré-incubação da FOZ, centro de inovação especializado em saúde e educação criado em 2019 pela Faculdade Pernambucana de Saúde (FPS), com sólida relação de pesquisa com o IMIP. Conseguimos entrar graças a Nayara Melo, do SEBRAE PE, que sempre vem nos ajudando nessa caminhada.', img: img('foz'), alt: 'FOZ, centro de inovação em saúde e educação da FPS e do IMIP', contain: true, current: true },
].map((item, i) => ({ ...item, step: String(i + 1).padStart(2, '0') }))

const PARTNERS = [
  { name: 'Fabio Henrique', role: 'CEO', img: 'time-fabio' },
  { name: 'Miguel Alves', role: 'COO', img: 'time-miguel' },
  { name: 'Alissomberg Domingos', role: 'CTO', img: 'time-berg' },
  { name: 'Cicero José', role: 'Co-CTO', img: 'time-cicero' },
  { name: 'Kauã Soares', role: 'CMO', img: 'time-kaua' },
  { name: 'Vitor Gabriel', role: 'CDO', img: 'time-vitor' },
]

const COLLABORATORS = [
  { name: 'Luiz Guilherme', img: 'time-luiz' },
  { name: 'Vinicius Gabriel', img: 'time-vinicius' },
  { name: 'Joéverton Paulo', img: 'time-jojo' },
]

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="comfort-landing">
      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label="VIRLA, página inicial">
          <img className="landing-brand-logo" src="/icon-192.png" alt="" width="34" height="34" /> VIRLA
        </Link>
        <button
          className="landing-menu-button"
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <Close /> : <Menu />}
        </button>
        <nav className={menuOpen ? 'landing-nav is-open' : 'landing-nav'} aria-label="Navegação principal">
          <a href="#historia" onClick={closeMenu}>Para quem é</a>
          <a href="#solucao" onClick={closeMenu}>A solução</a>
          <a href="#diferenciais" onClick={closeMenu}>Diferenciais</a>
          <a href="#trajetoria" onClick={closeMenu}>Nossa história</a>
          <Link to="/login" onClick={closeMenu}>Entrar</Link>
          <Link className="landing-nav-cta" to="/cadastro" onClick={closeMenu}>Começar <ArrowForward fontSize="small" /></Link>
        </nav>
        <InkThemeToggle />
      </header>

      <main>
        {/* Hero — modelo novo aprovado */}
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <h1 id="landing-title">Mais conforto para quem precisa. <em>Mais tranquilidade para você.</em></h1>
            <div className="landing-hero-actions">
              <Link className="landing-button" to="/cadastro">Encontrar um cuidador <ArrowForward fontSize="small" /></Link>
              <a className="landing-text-link" href="#solucao">Entenda como funciona</a>
            </div>
          </div>
          <div className="landing-hero-visual">
            <img src={img('hero')} alt="Mulher idosa e a filha sentadas juntas no sofá de casa, sorrindo" width="1600" height="819" fetchpriority="high" />
            <span className="landing-photo-note"><FavoriteBorder fontSize="small" /> O cuidado começa com uma conversa.</span>
          </div>
        </section>

        {/* Marquee (21st.dev) */}
        <section className="o-path" aria-labelledby="path-title">
          <h2 id="path-title" className="o-path-title">Por onde a VIRLA já passou</h2>
          <Marquee items={PATH} label="Eventos e instituições da trajetória da VIRLA" />
        </section>

        {/* Para quem é */}
        <section id="historia" className="o-section o-white">
          <div className="o-container o-story">
            <div className="o-story-copy">
              <span className="o-label">Para quem é a VIRLA?</span>
              <h2 className="o-title">Conheça a Márcia.</h2>
              <p className="o-lead">Márcia tem 45 anos, é mãe de dois filhos e trabalha como analista administrativa. Ela cuida do pai, o Sr. Jorge, de 78 anos, que apresenta os primeiros sinais de Alzheimer.</p>
              <blockquote className="o-quote">“Como posso trabalhar tranquila sabendo que meu pai está sozinho ou com alguém que eu não conheço?”</blockquote>
              <p className="o-text">Márcia não está sozinha. Como ela, existem milhões de famílias enfrentando o <strong>“apagão do cuidado”</strong>. A rede de apoio familiar está diminuindo, e a demanda por cuidado profissional explode.</p>
            </div>
            <aside className="o-reality" aria-labelledby="reality-title">
              <div className="o-reality-head">
                <TrendingUp aria-hidden />
                <h3 id="reality-title">A realidade do mercado</h3>
              </div>
              <div className="o-reality-stat">
                <strong><NumberTicker value={33} suffix=" milhões" /></strong>
                <span>de idosos no Brasil hoje</span>
              </div>
              <div className="o-reality-stat is-pink">
                <strong>1 em cada <NumberTicker value={3} /></strong>
                <span>brasileiros será idoso até 2070</span>
              </div>
            </aside>
          </div>
        </section>

        {/* O problema — Card Hover Effect (21st.dev) */}
        <section className="o-section o-gray" aria-labelledby="pain-title">
          <div className="o-container">
            <div className="o-head">
              <span className="o-label">O medo do invisível</span>
              <h2 id="pain-title" className="o-title">A barreira da contratação</h2>
              <p className="o-subtitle">Onde famílias buscam ajuda hoje? Em grupos informais de WhatsApp e indicações sem filtro técnico, gerando riscos e insegurança financeira.</p>
            </div>
            <HoverCards items={PAINS} />
          </div>
        </section>

        {/* A solução — Bento Grid (21st.dev) */}
        <section id="solucao" className="o-section o-soft" aria-labelledby="solution-title">
          <div className="o-container">
            <div className="o-head">
              <span className="o-label">A solução</span>
              <h2 id="solution-title" className="o-title">O porto seguro da Márcia</h2>
              <p className="o-subtitle">A ponte entre a necessidade e a confiança. Centralizamos busca, comunicação e pagamentos com total transparência.</p>
            </div>
            <BentoGrid>
              <BentoCell Icon={ManageSearchOutlined} title="Busca inteligente" tone="purple">
                <p>Filtros precisos por especialidade (ex.: Alzheimer, pós-operatório) e localização para encontrar o match perfeito.</p>
              </BentoCell>
              <BentoCell Icon={VerifiedUserOutlined} title="Perfis verificados" tone="green">
                <p>Checagem ativa de antecedentes e currículo. Detalhes técnicos e avaliações reais de outras famílias.</p>
              </BentoCell>
              <BentoCell Icon={AccountBalanceWalletOutlined} title="Pagamento 100% garantido" tone="pink" span="is-tall" featured>
                <p>Pagamento protegido pela confirmação do relatório. O familiar paga o valor definido no contrato, <strong>sem taxa adicional da VIRLA</strong>.</p>
                <p className="bento-warning">
                  <WarningAmberOutlined fontSize="small" aria-hidden />
                  Atenção: a VIRLA não reconhece nem se responsabiliza por pagamentos realizados fora da plataforma.
                </p>
              </BentoCell>
              <BentoCell Icon={ChatOutlined} title="Chat seguro" tone="blue" span="is-wide">
                <p>Comunicação direta, rápida e totalmente registrada dentro da plataforma para a segurança de ambas as partes.</p>
              </BentoCell>
            </BentoGrid>
          </div>
        </section>

        {/* Diferenciais e mercado — Number Ticker (21st.dev) */}
        <section id="diferenciais" className="o-section o-why" aria-labelledby="why-title">
          <div className="o-dots" aria-hidden="true" />
          <div className="o-container">
            <div className="o-head is-center">
              <span className="o-label is-glass">Por que a VIRLA?</span>
              <h2 id="why-title" className="o-title">Nosso lugar no mercado.</h2>
            </div>
            <div className="o-why-grid">
              {DIFFERENTIALS.map(({ Icon, title, text }) => (
                <article key={title}>
                  <h3><Icon fontSize="small" aria-hidden /> {title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
            <dl className="o-market">
              <div><dt className="is-purple"><NumberTicker value={12.3} decimals={1} prefix="R$ " suffix=" bi" /></dt><dd>Mercado anual no Brasil</dd></div>
              <div><dt className="is-blue"><NumberTicker value={300} suffix=" mil" /></dt><dd>Pacientes em home care</dd></div>
              <div><dt className="is-pink"><NumberTicker value={840} suffix=" mil" /></dt><dd>Cuidadores na informalidade</dd></div>
            </dl>
          </div>
        </section>

        {/* Trajetória — Timeline (21st.dev) */}
        <section id="trajetoria" className="o-section o-white" aria-labelledby="journey-title">
          <div className="o-container">
            <div className="o-head is-center">
              <span className="o-label">Nossa trajetória</span>
              <h2 id="journey-title" className="o-title">Uma jornada de conquistas.</h2>
              <p className="o-subtitle">Cada marco nos aproximou de transformar o cuidado no Brasil.</p>
            </div>
            <ScrollTimeline items={JOURNEY} />
          </div>
        </section>

        {/* Time */}
        <section id="time" className="o-section o-gray" aria-labelledby="team-title">
          <div className="o-container is-narrow">
            <div className="o-head is-center">
              <span className="o-label">Quem faz acontecer</span>
              <h2 id="team-title" className="o-title">O time por trás da VIRLA</h2>
              <p className="o-subtitle">Uma equipe multidisciplinar unida pelo propósito de transformar o cuidado no Brasil.</p>
            </div>
            <h3 className="o-team-group">Sócios</h3>
            <ul className="o-team">
              {PARTNERS.map((p) => (
                <li key={p.name}>
                  <img src={img(p.img)} alt="" loading="lazy" />
                  <strong>{p.name}</strong>
                  <span>{p.role}</span>
                </li>
              ))}
            </ul>
            <h3 className="o-team-group is-pink">Colaboradores de tecnologia</h3>
            <ul className="o-team is-small">
              {COLLABORATORS.map((p) => (
                <li key={p.name}>
                  <img src={img(p.img)} alt="" loading="lazy" />
                  <strong>{p.name}</strong>
                  <span>Colaborador</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Chamada final */}
        <section id="contato" className="o-section o-white" aria-labelledby="end-title">
          <div className="o-container is-narrow">
            <div className="o-cta">
              <RocketLaunchOutlined className="o-cta-icon" aria-hidden />
              <h2 id="end-title">Ajude-nos a construir o futuro.</h2>
              <p>Seja parte da nossa base de testes. Preencha os formulários de validação e tenha acesso antecipado à plataforma quando lançarmos.</p>
              <div className="o-cta-btns">
                <a className="o-btn is-primary" href={FORM_FAMILIAS} target="_blank" rel="noreferrer">
                  <ManageSearchOutlined fontSize="small" aria-hidden /> Formulário para Famílias
                </a>
                <a className="o-btn is-secondary" href={FORM_CUIDADORES} target="_blank" rel="noreferrer">
                  <VolunteerActivismOutlined fontSize="small" aria-hidden /> Formulário para Cuidadores
                </a>
              </div>
              <p className="o-cta-alt">Já quer usar a plataforma? <Link to="/cadastro">Crie sua conta</Link></p>
            </div>
          </div>
        </section>
      </main>

      <footer className="o-footer">
        <div className="o-footer-grid">
          <div className="o-footer-brand">
            <strong><img className="landing-brand-logo" src="/icon-192.png" alt="" width="34" height="34" /> VIRLA</strong>
            <p>Democratizando o acesso a cuidadores confiáveis e garantindo segurança e dignidade às famílias brasileiras.</p>
            <div className="o-social">
              <a href="https://instagram.com/virlaoficial" target="_blank" rel="noreferrer" aria-label="Instagram da VIRLA"><Instagram fontSize="small" /></a>
              <a href="https://wa.me/5581991401898" target="_blank" rel="noreferrer" aria-label="WhatsApp da VIRLA"><WhatsApp fontSize="small" /></a>
              <a href="mailto:startup.virla@gmail.com" aria-label="E-mail da VIRLA"><MailOutlined fontSize="small" /></a>
            </div>
          </div>
          <div>
            <h2>Contato</h2>
            <ul>
              <li><a href="mailto:startup.virla@gmail.com">startup.virla@gmail.com</a></li>
              <li><a href="https://instagram.com/virlaoficial" target="_blank" rel="noreferrer">@virlaoficial</a></li>
              <li><a href="https://wa.me/5581991401898" target="_blank" rel="noreferrer">+55 (81) 99140-1898</a></li>
            </ul>
          </div>
          <div>
            <h2>Plataforma</h2>
            <ul>
              <li><Link to="/login">Acessar minha conta</Link></li>
              <li><Link to="/cadastro">Criar conta</Link></li>
              <li><a href="#solucao">Como funciona</a></li>
            </ul>
          </div>
        </div>
        <div className="o-footer-bottom">
          <span>© 2026 VIRLA. Todos os direitos reservados.</span>
          <span>Feito com <Favorite fontSize="inherit" aria-label="amor" /> para o Brasil</span>
        </div>
      </footer>
    </div>
  )
}
