import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowForward, FavoriteBorder, ForumOutlined, SearchOutlined, ShieldOutlined, Menu, Close } from '@mui/icons-material'
import './comfort-landing.css'

const steps = [
  { number: '01', title: 'Conte o que sua família precisa', text: 'Descreva a rotina, os horários e os cuidados importantes para quem você ama.' },
  { number: '02', title: 'Conheça os profissionais', text: 'Explore os perfis, as experiências e as especialidades com calma.' },
  { number: '03', title: 'Converse antes de decidir', text: 'Tire dúvidas diretamente pelo chat e escolha no seu tempo.' },
]

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  return (
    <div className="comfort-landing">
      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label="VIRLA, página inicial"><span className="landing-brand-mark">♥</span> VIRLA</Link>
        <button className="landing-menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen}>{menuOpen ? <Close /> : <Menu />}</button>
        <nav className={menuOpen ? 'landing-nav is-open' : 'landing-nav'} aria-label="Navegação principal">
          <a href="#como-funciona" onClick={closeMenu}>Como funciona</a>
          <a href="#cuidado" onClick={closeMenu}>Nosso cuidado</a>
          <a href="#para-cuidadores" onClick={closeMenu}>Sou cuidador</a>
          <Link to="/login" onClick={closeMenu}>Entrar</Link>
          <Link className="landing-nav-cta" to="/cadastro" onClick={closeMenu}>Começar <ArrowForward fontSize="small" /></Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow"><FavoriteBorder fontSize="small" /> Cuidado que aproxima</span>
            <h1 id="landing-title">Mais conforto para quem precisa. <em>Mais tranquilidade para você.</em></h1>
            <p>Encontre quem pode estar ao lado da sua família com atenção, respeito e carinho. Um espaço para conhecer, conversar e construir confiança.</p>
            <div className="landing-hero-actions"><Link className="landing-button" to="/cadastro">Encontrar um cuidador <ArrowForward fontSize="small" /></Link><a className="landing-text-link" href="#como-funciona">Entenda como funciona</a></div>
            <div className="landing-hero-foot"><span className="landing-foot-icon"><ShieldOutlined fontSize="small" /></span><span>Uma escolha importante merece tempo e informação.</span></div>
          </div>
          <div className="landing-hero-visual"><img src="/virla-care-hero.png" alt="Mulher idosa e filha sentadas juntas em casa, sorrindo" /><span className="landing-photo-note"><FavoriteBorder fontSize="small" /> O cuidado começa com uma conversa.</span></div>
        </section>

        <section className="landing-intro" id="cuidado"><div><span className="landing-eyebrow">Um jeito mais humano de cuidar</span><h2>Estar perto faz toda a diferença.</h2></div><p>Sabemos que confiar o cuidado de alguém querido é uma decisão muito pessoal. A VIRLA reúne informações e conversas em um só lugar para ajudar você a escolher com serenidade.</p></section>

        <section className="landing-features" aria-label="O que você encontra na VIRLA">
          <article><span className="landing-feature-icon"><SearchOutlined /></span><h3>Perfis para conhecer</h3><p>Veja a apresentação, a experiência e as especialidades de cada profissional.</p></article>
          <article><span className="landing-feature-icon"><ForumOutlined /></span><h3>Conversas sem pressa</h3><p>Fale diretamente com o cuidador e alinhe suas expectativas antes de seguir.</p></article>
          <article><span className="landing-feature-icon"><FavoriteBorder /></span><h3>Cuidado no seu ritmo</h3><p>Organize as necessidades da família e encontre apoio para a rotina de cuidado.</p></article>
        </section>

        <section className="landing-how" id="como-funciona"><div className="landing-section-top"><span className="landing-eyebrow">Simples, do começo ao encontro</span><h2>Um caminho mais leve para encontrar cuidado.</h2></div><div className="landing-steps">{steps.map(step => <article key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>

        <section className="landing-caregivers" id="para-cuidadores"><div><span className="landing-eyebrow">Para quem cuida</span><h2>Seu trabalho merece ser visto com respeito.</h2><p>Crie seu perfil, apresente sua experiência e encontre famílias que procuram o seu cuidado.</p><Link className="landing-button landing-button-light" to="/cadastro">Quero fazer parte <ArrowForward fontSize="small" /></Link></div><div className="landing-caregivers-art" aria-hidden="true"><span>cuidar</span><span>escutar</span><span>acolher</span></div></section>

        <section className="landing-end"><span className="landing-eyebrow">Acolhimento em cada etapa</span><h2>Vamos encontrar o cuidado certo para a sua família?</h2><p>Comece contando o que é importante para você.</p><Link className="landing-button" to="/cadastro">Começar agora <ArrowForward fontSize="small" /></Link></section>
      </main>
      <footer className="landing-footer"><strong>♥ VIRLA</strong><span>Cuidado que aproxima.</span><Link to="/login">Acessar minha conta</Link></footer>
    </div>
  )
}
