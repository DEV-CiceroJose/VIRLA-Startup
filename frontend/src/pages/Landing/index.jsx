import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css'; 
import {
  VolunteerActivism, Face, CheckCircle, WarningAmber,
  MoodBad, Chat, AccountBalanceWallet,
  AttachMoney, MedicalServices, RocketLaunch, Favorite,
  Security, Search, Shield, Groups, VpnKey, TrendingUp
} from '@mui/icons-material';

function Landing() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loadingBtn, setLoadingBtn] = useState(null); 

  // ── Dados do Carrossel Principal ──
  const carouselItems = [
    { 
      icon: <Shield sx={{ fontSize: '4.5rem', color: 'var(--purple)' }} />, 
      title: "Confiança Verificada", 
      text: "Nossa prioridade número um. Todos os cuidadores passam por uma rigorosa checagem de antecedentes e validação de documentos antes de entrarem na plataforma." 
    },
    { 
      icon: <AccountBalanceWallet sx={{ fontSize: '4.5rem', color: 'var(--purple)' }} />, 
      title: "Pagamento Seguro", 
      text: "Acabe com a insegurança. O valor do serviço fica retido de forma segura (Sistema Escrow) e o cuidador só recebe após a conclusão e aprovação do atendimento." 
    },
    { 
      icon: <MedicalServices sx={{ fontSize: '4.5rem', color: 'var(--purple)' }} />, 
      title: "Especialistas em Saúde", 
      text: "Não somos um app de serviços gerais. Focamos 100% em saúde, oferecendo filtros precisos para necessidades específicas como Alzheimer, Parkinson e Pós-operatório." 
    },
    { 
      icon: <Chat sx={{ fontSize: '4.5rem', color: 'var(--purple)' }} />, 
      title: "Comunicação Transparente", 
      text: "Acompanhe a rotina de quem você ama direto pelo nosso chat integrado. Todo o histórico de mensagens fica registrado para a sua segurança e tranquilidade." 
    }
  ];

  // ── Dados dos Cards Flutuantes ──
  const floatingStatsLeft = [
    { num: "33 M", label: "Idosos no Brasil", icon: <Face sx={{ fontSize: 24, color: '#92400e' }} />, bg: "bg-yellow-100" },
    { num: "Seguro", label: "Sistema Escrow", icon: <AttachMoney sx={{ fontSize: 24, color: '#166534' }} />, bg: "bg-green-100" },
    { num: "Saúde", label: "Foco Exclusivo", icon: <MedicalServices sx={{ fontSize: 24, color: '#0369a1' }} />, bg: "bg-blue-100" },
    { num: "100%", label: "Transparência", icon: <Groups sx={{ fontSize: 24, color: '#6b21a8' }} />, bg: "bg-purple-100" }
  ];

  const floatingStatsRight = [
    { num: "Verificado", label: "Perfis Confiáveis", icon: <CheckCircle sx={{ fontSize: 24, color: '#16a34a' }} />, bg: "bg-green-100" },
    { num: "1 em 3", label: "Sofre Risco Atual", icon: <WarningAmber sx={{ fontSize: 24, color: '#b91c1c' }} />, bg: "bg-red-100" },
    { num: "Rápido", label: "Busca Inteligente", icon: <Search sx={{ fontSize: 24, color: '#c2410c' }} />, bg: "bg-orange-100" },
    { num: "24/7", label: "Histórico Salvo", icon: <Chat sx={{ fontSize: 24, color: '#be185d' }} />, bg: "bg-pink-100" }
  ];

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    const revealEls = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => revealObserver.observe(el));

    const sliderTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselItems.length);
    }, 4500);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      revealEls.forEach(el => revealObserver.unobserve(el));
      clearInterval(sliderTimer);
    };
  }, [carouselItems.length]);

  const handleNavigate = (path, actionName) => {
    setLoadingBtn(actionName);
    setTimeout(() => {
      navigate(path);
    }, 600);
  };

  return (
    <div className='w-full overflow-hidden'>
      {/* ══════════════════════════════
          HEADER
      ══════════════════════════════ */}
      <header id="mainHeader" className={isScrolled ? 'scrolled' : ''}>
        <div className="header-inner">
          <a href="#" className="logo">
            <div className="logo-icon" style={{ background: 'transparent', boxShadow: 'none' }}>
              <img src="/favicon.ico" alt="VIRLA Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
            </div>
            <span className="logo-text" style={{ color: 'var(--purple)' }}>VIRLA</span>
          </a>

          <nav>
            <a href="#historia">Para Quem É?</a>
            <a href="#solucao">A Solução</a>
            <a href="#diferenciais">Diferenciais</a>
            <a href="#trajetoria">Nossa História</a>
          </nav>

          <div className="header-actions flex gap-3">
            <button 
              onClick={() => handleNavigate('/login', 'login')} 
              disabled={loadingBtn !== null}
              className="btn-ghost flex items-center justify-center min-w-[110px]"
            >
              {loadingBtn === 'login' ? (
                <div className="w-5 h-5 border-2 border-virla-roxo border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Fazer Login"
              )}
            </button>
            <button 
              onClick={() => handleNavigate('/cadastro', 'cadastro')} 
              disabled={loadingBtn !== null}
              className="btn-primary flex items-center justify-center min-w-[160px]"
            >
              {loadingBtn === 'cadastro' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <VpnKey sx={{ fontSize: 18 }} />
                  Acessar Sistema
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════
          HERO SECTION
      ══════════════════════════════ */}
      <section className="hero">
        <div className="hero-bg-blob blob-1"></div>
        <div className="hero-bg-blob blob-2"></div>

        <div className="hero-inner">
          <div className="hero-content relative z-10">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              Validação Aberta - MVP
            </div>

            <h1>Conectando <em>Cuidado</em> com Segurança.</h1>
            
            <div className="flex flex-wrap gap-2 md:gap-3 items-center mt-2 mb-4 font-bold text-xs md:text-sm text-[var(--purple)] bg-[var(--purple-light)] py-2 px-4 rounded-full border border-[var(--border)] w-fit">
              <span>Vida</span> <span className="opacity-40">•</span>
              <span>Inclusão</span> <span className="opacity-40">•</span>
              <span>Respeito</span> <span className="opacity-40">•</span>
              <span>Ligação</span> <span className="opacity-40">•</span>
              <span>Amparo</span>
            </div>

            <p>Muito além de uma plataforma, somos um compromisso. Tecnologia a serviço da dignidade humana, sem mensalidades e sem barreiras.</p>

            <div className="hero-ctas mt-4">
              <a href="https://docs.google.com/forms/d/e/1FAIpQLSdg2-oStG8HFtxq_pqtrWM2AxX7SM19qb-XRSLSdjZjOJEjHA/viewform?usp=header" target="_blank" rel="noreferrer" className="cta-btn cta-familiar">
                <div className="cta-icon">
                  <Search sx={{ color: 'white' }} />
                </div>
                <div className="cta-text">
                  <span className="cta-label">Para Famílias</span>
                  <span className="cta-title">Preencher Formulário de Validação</span>
                </div>
              </a>

              <a href="https://docs.google.com/forms/d/e/1FAIpQLSfCOVa-Q2v5y6MVE51wa5nZoGLngZInV8AtfARog98jun1F_g/viewform?usp=header" target="_blank" rel="noreferrer" className="cta-btn cta-cuidador">
                <div className="cta-icon">
                  <VolunteerActivism sx={{ color: 'var(--purple)' }} />
                </div>
                <div className="cta-text">
                  <span className="cta-label" style={{ color: 'var(--purple)', opacity: 0.7 }}>Para Cuidadores</span>
                  <span className="cta-title">Preencher Formulário de Validação</span>
                </div>
              </a>
            </div>
          </div>

          <div className="hero-visual relative z-0">
            <div className="hero-card-main relative">
              <div 
                key={currentSlide} 
                className="hero-img-placeholder flex flex-col items-center justify-center p-8 text-center gap-4 transition-opacity duration-500 ease-in-out animate-[fadeIn_0.5s_ease-in-out]"
              >
                {carouselItems[currentSlide].icon}
                <div className="font-serif text-2xl text-[var(--purple)] font-black px-2">
                  {carouselItems[currentSlide].title}
                </div>
                <div className="text-sm text-gray-600 leading-relaxed max-w-sm px-2">
                  {carouselItems[currentSlide].text}
                </div>
              </div>
              
              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
                {carouselItems.map((_, i) => (
                  <span key={i} className={`h-2 w-2 rounded-full transition-all duration-300 ${i === currentSlide ? 'bg-[var(--purple)] w-4' : 'bg-gray-300'}`}></span>
                ))}
              </div>
            </div>

            <div className="float-card float-card-1 animate-[fadeIn_0.5s_ease-in-out] hidden md:flex" key={`fl-${currentSlide}`}>
              <div className={`float-icon ${floatingStatsLeft[currentSlide].bg} flex items-center justify-center`}>
                {floatingStatsLeft[currentSlide].icon}
              </div>
              <div>
                <div className="float-num">{floatingStatsLeft[currentSlide].num}</div>
                <div className="float-label">{floatingStatsLeft[currentSlide].label}</div>
              </div>
            </div>

            <div className="float-card float-card-2 animate-[fadeIn_0.5s_ease-in-out] hidden md:flex" key={`fr-${currentSlide}`} style={{ top: '2rem', right: '-2.5rem', bottom: 'auto', left: 'auto' }}>
              <div className={`float-icon ${floatingStatsRight[currentSlide].bg} flex items-center justify-center`}>
                {floatingStatsRight[currentSlide].icon}
              </div>
              <div>
                <div className="float-num">{floatingStatsRight[currentSlide].num}</div>
                <div className="float-label">{floatingStatsRight[currentSlide].label}</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          STORYTELLING
      ══════════════════════════════ */}
      <section id="historia" className="py-24 bg-white relative">
        <div className="container mx-auto px-6 max-w-6xl reveal">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-6">
              <div className="section-label mb-2">Para quem é a VIRLA?</div>
              <h2 className="text-4xl md:text-5xl font-serif font-black text-gray-900 leading-tight">Conheça a Márcia.</h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Márcia tem 45 anos, é mãe de dois filhos e trabalha como analista administrativa. Ela cuida do pai, o Sr. Jorge, de 78 anos, que apresenta os primeiros sinais de Alzheimer.
              </p>
              
              <blockquote className="border-l-4 border-[var(--purple)] pl-6 py-2 my-8 bg-[var(--purple-light)] rounded-r-lg">
                <p className="italic text-xl text-gray-800 font-medium">
                  "Como posso trabalhar tranquila sabendo que meu pai está sozinho ou com alguém que eu não conheço?"
                </p>
              </blockquote>

              <p className="text-md text-gray-600">
                Márcia não está sozinha. Como ela, existem milhões de famílias enfrentando o <strong>"apagão do cuidado"</strong>. A rede de apoio familiar está diminuindo, e a demanda por cuidado profissional explode.
              </p>
            </div>

            <div className="flex-1 w-full bg-gray-50 rounded-3xl p-8 border border-gray-100 shadow-xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-pink-200 rounded-bl-full opacity-20"></div>
               <div className="flex items-center gap-4 mb-6">
                 <TrendingUp sx={{ fontSize: 40, color: 'var(--purple)' }} />
                 <h3 className="text-2xl font-bold text-gray-800">A Realidade do Mercado</h3>
               </div>
               <div className="space-y-6">
                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50">
                    <div className="text-3xl font-black text-[var(--purple)] mb-1">33 Milhões</div>
                    <div className="text-sm text-gray-500 font-medium uppercase tracking-wide">De idosos no Brasil hoje</div>
                 </div>
                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50">
                    <div className="text-3xl font-black text-pink-500 mb-1">1 em cada 3</div>
                    <div className="text-sm text-gray-500 font-medium uppercase tracking-wide">Brasileiros será idoso até 2070</div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          O PROBLEMA
      ══════════════════════════════ */}
      <section className="problema py-24 bg-gray-50">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="reveal text-center max-w-3xl mx-auto mb-16">
            <div className="section-label">O Medo do Invisível</div>
            <h2 className="section-title">A Barreira da Contratação</h2>
            <p className="section-subtitle mx-auto">Onde famílias buscam ajuda hoje? Em grupos informais de WhatsApp e indicações sem filtro técnico, gerando riscos e insegurança financeira.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="pain-card reveal reveal-delay-1 flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-md border border-red-100">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <WarningAmber sx={{ fontSize: 32, color: '#EF4444' }} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">1 em cada 3</h3>
              <p className="text-gray-600">Idosos sofre algum tipo de negligência ou abandono, muitas vezes por falta de preparo do profissional não verificado.</p>
            </div>

            <div className="pain-card reveal reveal-delay-2 flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-md border border-orange-100">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-6">
                <MoodBad sx={{ fontSize: 32, color: '#F97316' }} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Falta de Histórico</h3>
              <p className="text-gray-600">Como saber se o cuidador é realmente bom sem avaliações reais e centralizadas de outras famílias?</p>
            </div>

            <div className="pain-card reveal reveal-delay-3 flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-md border border-purple-100">
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-6">
                <AttachMoney sx={{ fontSize: 32, color: 'var(--purple)' }} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Insegurança Financeira</h3>
              <p className="text-gray-600">O medo constante: "E se eu pagar adiantado e o cuidador não aparecer?". O mercado informal não oferece garantias.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          A SOLUÇÃO
      ══════════════════════════════ */}
      <section id="solucao" className="solucao py-24 bg-[var(--surface-alt)] border-y border-[var(--border)]">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="reveal text-center max-w-3xl mx-auto mb-16">
            <div className="section-label">A Solução</div>
            <h2 className="section-title">O Porto Seguro da Márcia</h2>
            <p className="section-subtitle mx-auto">A ponte entre a necessidade e a confiança. Centralizamos busca, comunicação e pagamentos com total transparência.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-purple-100 flex flex-col sm:flex-row gap-6 reveal reveal-delay-1 hover:-translate-y-1 transition-transform">
               <div className="flex-shrink-0 w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <Search sx={{ color: 'var(--purple)', fontSize: 28 }} />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Busca Inteligente</h3>
                  <p className="text-gray-600">Filtros precisos por especialidade (ex: Alzheimer, Pós-operatório) e localização para encontrar o match perfeito.</p>
               </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-purple-100 flex flex-col sm:flex-row gap-6 reveal reveal-delay-2 hover:-translate-y-1 transition-transform">
               <div className="flex-shrink-0 w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                  <Security sx={{ color: '#16A34A', fontSize: 28 }} />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Perfis Verificados</h3>
                  <p className="text-gray-600">Checagem ativa de antecedentes e currículo. Detalhes técnicos e avaliações reais de outras famílias.</p>
               </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-purple-100 flex flex-col sm:flex-row gap-6 reveal reveal-delay-3 hover:-translate-y-1 transition-transform">
               <div className="flex-shrink-0 w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <Chat sx={{ color: '#2563EB', fontSize: 28 }} />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Chat Seguro</h3>
                  <p className="text-gray-600">Comunicação direta, rápida e totalmente registrada dentro da plataforma para a segurança de ambas as partes.</p>
               </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-md border-2 border-pink-200 flex flex-col sm:flex-row gap-6 reveal reveal-delay-4 hover:-translate-y-1 transition-transform relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-pink-50 rounded-bl-full -z-10"></div>
               <div className="flex-shrink-0 w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center z-10">
                  <AccountBalanceWallet sx={{ color: '#DB2777', fontSize: 28 }} />
               </div>
               <div className="z-10">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Pagamento 100% Garantido</h3>
                  <p className="text-gray-600 mb-4 text-sm">
                    Sistema Escrow via <strong>AbacatePay</strong>. O dinheiro fica retido e o profissional só recebe ao finalizar. Cobramos apenas uma taxa transparente de <strong className="text-pink-600">7% + R$ 0,80</strong> por transação.
                  </p>
                  <div className="flex items-start gap-2 bg-red-50 p-3 rounded-xl border border-red-100 text-xs text-red-700 font-medium">
                    <WarningAmber sx={{ fontSize: 16 }} className="flex-shrink-0 mt-0.5" />
                    <p>Atenção: A Virla não reconhece nem se responsabiliza por pagamentos realizados fora da plataforma.</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          DIFERENCIAIS E MERCADO
      ══════════════════════════════ */}
      <section id="diferenciais" className="py-24 bg-gradient-to-br from-purple-900 via-[var(--purple)] to-purple-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="container mx-auto px-6 max-w-6xl relative z-10 reveal">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1 rounded-full bg-white/20 text-white font-bold text-xs tracking-wider uppercase mb-4">Por que a VIRLA?</div>
            <h2 className="text-4xl md:text-5xl font-serif font-black text-white">Nosso lugar no mercado.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20">
               <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><CheckCircle fontSize="small" /> Sem Mensalidades</h3>
               <p className="text-purple-100">Diferente do Famyle, não cobramos para você "olhar". Ganhamos apenas no sucesso do cuidado com a taxa de 7%.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20">
               <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><MedicalServices fontSize="small" /> Especialistas</h3>
               <p className="text-purple-100">Diferente do Getninjas, somos especialistas exclusivos em saúde e cuidado domiciliar, não em serviços gerais.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20">
               <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Shield fontSize="small" /> Proteção Total</h3>
               <p className="text-purple-100">Diferente do mercado informal, oferecemos verificação ativa de documentos e garantia financeira ponta a ponta.</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 md:p-12 text-center shadow-2xl flex flex-col md:flex-row items-center justify-around gap-8 text-gray-900">
             <div>
               <div className="text-4xl md:text-5xl font-black text-[var(--purple)] mb-2">R$ 12,3 Bi</div>
               <div className="text-sm font-bold text-gray-500 uppercase tracking-wide">Mercado Anual no Brasil</div>
             </div>
             
             <div className="hidden md:block w-px h-20 bg-gray-200"></div>
             
             <div>
               <div className="text-4xl md:text-5xl font-black text-blue-500 mb-2">300 mil</div>
               <div className="text-sm font-bold text-gray-500 uppercase tracking-wide">Pacientes em Home Care</div>
             </div>

             <div className="hidden md:block w-px h-20 bg-gray-200"></div>

             <div>
               <div className="text-4xl md:text-5xl font-black text-pink-500 mb-2">840 mil</div>
               <div className="text-sm font-bold text-gray-500 uppercase tracking-wide">Cuidadores na informalidade</div>
             </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          LINHA DO TEMPO (Com Imagens Responsivas)
      ══════════════════════════════ */}
      <section id="trajetoria" className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-5xl reveal text-center">
          <div className="section-label">Nossa Trajetória</div>
          <h2 className="section-title mb-16">Uma jornada de conquistas.</h2>
          
          <div className="space-y-8 text-left">
            {[
              {
                step: "01",
                title: "O Nascimento",
                desc: "A ideia inicial e o protótipo nasceram durante uma intensa maratona de Hackathon, unindo tecnologia e propósito.",
                img: "Nascimento.jpeg"
              },
              {
                step: "02",
                title: "Reconhecimento",
                desc: "Apresentações aclamadas no IgaraLOL e na Semana de Tecnologia, validando a dor do mercado local.",
                img: "IgaraLOL.jpeg"
              },
              {
                step: "03",
                title: "Validação Técnica",
                desc: "Participação no Projeto do Dr. Danilo no edital Compet Médiotec e sucesso no Projeto Centelha (Pontuação 4,1 na 1ª fase).",
                img: "Capyvara Company.jpeg"
              },
              {
                step: "04",
                title: "Visibilidade Estadual",
                desc: "Destaque durante o Startup Day, com direito a cobertura e reconhecimento na TV Globo.",
                img: "StartupDay.jpeg"
              },
              {
                step: "05",
                title: "Quintas de Inovação",
                desc: "Apresentação da nossa ideia e proposta de valor no evento Quintas de Inovação, marcando o início da nossa validação pública com o ecossistema.",
                img: "",
                highlight: false
              },
              {
                step: "06",
                title: "Banca do Bootcamp (28/05/2026)",
                desc: "O grande marco: Apresentação do MVP funcional para a banca do Bootcamp da Tascom. Contaremos com a presença de representantes do IFPE de Igarassu e Secretários Municipais de Igarassu.",
                img: "",
                highlight: true
              }
            ].map((item, idx) => (
              <div key={idx} className={`flex flex-col md:flex-row gap-6 p-6 rounded-2xl border transition-colors ${item.highlight ? 'bg-purple-50 border-[var(--purple)] shadow-md relative overflow-hidden' : 'bg-gray-50 border-gray-100 hover:border-purple-200'}`}>
                {item.highlight && <div className="absolute right-0 top-0 w-24 h-24 bg-[var(--purple)] opacity-10 rounded-bl-full"></div>}
                
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-xl ${item.highlight ? 'bg-[var(--purple)] text-white' : 'bg-purple-100 text-[var(--purple)]'}`}>
                  {item.step}
                </div>
                
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h4>
                  <p className={`${item.highlight ? 'text-gray-700 font-medium' : 'text-gray-600'}`}>{item.desc}</p>
                </div>

                {/* AQUI ESTÁ A CORREÇÃO DE RESPONSIVIDADE!
                  Substituí as classes antigas por `aspect-video`, `relative` e `absolute inset-0` 
                  para garantir que as imagens nunca vazem ou distorçam no telemóvel. 
                */}
                {item.img && (
                  <div className="w-full md:w-64 aspect-video md:aspect-auto md:h-40 rounded-xl overflow-hidden flex-shrink-0 shadow-sm border border-gray-200 relative bg-gray-200 mt-4 md:mt-0">
                    <img src={item.img} alt={`Validação - ${item.title}`} className="absolute inset-0 w-full h-full object-cover object-center" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          TIME (Sócios e Colaboradores)
      ══════════════════════════════ */}
      <section id="time" className="py-24 bg-gray-50">
        <div className="container mx-auto px-6 max-w-5xl reveal text-center">
           <div className="section-label">Quem Faz Acontecer</div>
           <h2 className="section-title">O Time por trás da VIRLA</h2>
           <p className="section-subtitle mx-auto mb-16">Uma equipe multidisciplinar unida pelo propósito de transformar o cuidado no Brasil.</p>

           <h3 className="text-2xl font-bold text-[var(--purple)] mb-8 text-left border-b-2 border-purple-100 pb-2">Sócios</h3>
           <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mb-16">
              {[
                { name: "Fabio Henrique", role: "CEO", initials: "FH", image: "Fabio.jpg" },
                { name: "Miguel Alves", role: "COO", initials: "MA", image: "Miguel.jpg" },
                { name: "Alissomberg Domingos", role: "CTO", initials: "AD", image: "Berg.jpg" },
                { name: "Argeu Vitor", role: "Co-CTO", initials: "AV", image: "Argeu.jpg" },
                { name: "Kauã Soares", role: "CMO", initials: "KS", image: "Kaua.jpg" },
                { name: "Vitor Gabriel", role: "CDO", initials: "VG", image: "Vitor.jpg" },
              ].map((member, i) => (
                <div key={i} className="flex flex-col items-center p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
                  {member.image ? (
                    <img src={member.image} alt={member.name} className="w-24 h-24 rounded-full object-cover mb-4 shadow-sm border-2 border-purple-100" />
                  ) : (
                    <div className="w-24 h-24 bg-purple-100 rounded-full mb-4 flex items-center justify-center text-[var(--purple)] font-bold text-2xl shadow-sm border-2 border-purple-100">
                      {member.initials}
                    </div>
                  )}
                  <h4 className="font-bold text-gray-900 text-center">{member.name}</h4>
                  <span className="text-sm text-purple-600 font-medium mt-1">{member.role}</span>
                </div>
              ))}
           </div>

           <h3 className="text-2xl font-bold text-pink-500 mb-8 text-left border-b-2 border-pink-100 pb-2">Colaboradores de Tecnologia</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {[
                { name: "Luiz Guilherme", role: "Colaborador", initials: "LZ", image: "Luiz.jpeg" },
                { name: "Vinicius Gabriel", role: "Colaborador", initials: "VN", image: "Vinicius.jpeg" },
                { name: "Cicero José", role: "Colaborador", initials: "CC", image: "Cicero.jpeg" },
                { name: "Joéverton Paulo", role: "Colaborador", initials: "JV", image: "Jojo.png" },
              ].map((member, i) => (
                <div key={i} className="flex flex-col items-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
                  {member.image ? (
                    <img src={member.image} alt={member.name} className="w-20 h-20 rounded-full object-cover mb-3 shadow-sm border-2 border-pink-100" />
                  ) : (
                    <div className="w-20 h-20 bg-pink-50 rounded-full mb-3 flex items-center justify-center text-pink-500 font-bold text-xl shadow-sm border-2 border-pink-100">
                      {member.initials}
                    </div>
                  )}
                  <h4 className="font-bold text-gray-900 text-sm text-center">{member.name}</h4>
                  <span className="text-xs text-pink-500 font-medium mt-1">{member.role}</span>
                </div>
              ))}
           </div>
        </div>
      </section>

      {/* ══════════════════════════════
          FINAL CTA
      ══════════════════════════════ */}
      <section id="contato" className="final-cta pb-12 pt-0">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="cta-box reveal">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <RocketLaunch sx={{ fontSize: '3.5rem', color: 'var(--purple)' }} />
            </div>
            <h2>Ajude-nos a construir o futuro.</h2>
            <p>Seja parte da nossa base de testes. Preencha os formulários de validação e tenha acesso antecipado à plataforma quando lançarmos.</p>
            <div className="cta-btns mt-8">
              <a href="https://docs.google.com/forms/d/e/1FAIpQLSdg2-oStG8HFtxq_pqtrWM2AxX7SM19qb-XRSLSdjZjOJEjHA/viewform?usp=header" target="_blank" rel="noreferrer" className="cta-lg cta-lg-primary">
                <Search sx={{ fontSize: 20 }} />
                Formulário para Famílias
              </a>
              <a href="https://docs.google.com/forms/d/e/1FAIpQLSfCOVa-Q2v5y6MVE51wa5nZoGLngZInV8AtfARog98jun1F_g/viewform?usp=header" target="_blank" rel="noreferrer" className="cta-lg cta-lg-secondary">
                <VolunteerActivism sx={{ fontSize: 20 }} />
                Formulário para Cuidadores
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          FOOTER
      ══════════════════════════════ */}
      <footer>
        <div className="footer-grid px-6">
          <div className="footer-brand">
            <a href="#" className="logo">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <span className="logo-text">VIRLA</span>
            </a>
            <p>Democratizando o acesso a cuidadores confiáveis e garantindo segurança e dignidade às famílias brasileiras.</p>
            <div className="social-links mt-4">
              <a href="https://instagram.com/virlaoficial" target="_blank" rel="noreferrer" className="social-link" title="Instagram">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a href="https://wa.me/5581991401898" target="_blank" rel="noreferrer" className="social-link" title="WhatsApp">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </a>
              <a href="mailto:startup.virla@gmail.com" className="social-link" title="E-mail">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </a>
            </div>
          </div>

          <div className="footer-col">
            <h4>Contato</h4>
            <ul>
              <li><a href="mailto:startup.virla@gmail.com">startup.virla@gmail.com</a></li>
              <li><a href="https://instagram.com/virlaoficial" target="_blank" rel="noreferrer">@virlaoficial</a></li>
              <li><a href="https://wa.me/5581991401898" target="_blank" rel="noreferrer">+55 (81) 99140-1898</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Privacidade</a></li>
              <li><a href="#">Termos de Uso</a></li>
              <li><a href="#">FAQ</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom px-6">
          <span>&copy; 2026 VIRLA — Todos os direitos reservados.</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            Feito com <Favorite sx={{ fontSize: 16, color: '#FE91FE' }} /> para o Brasil
          </span>
        </div>
      </footer>
    </div>
  );
}

export default Landing;