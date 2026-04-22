// client/src/pages/landingPageContentLab
import React from "react";

const servicos = [
  {
    numero: "01",
    titulo: "Diagnóstico de posicionamento",
    descricao:
      "Entendemos quem você é, o que você carrega de relevante e onde existe espaço real para sua voz no mercado. O trabalho começa daqui.",
  },
  {
    numero: "02",
    titulo: "Estratégia editorial",
    descricao:
      "Construímos a linha editorial junto com você: pilares, tom, cadência e formatos. Tudo alinhado com quem você é de verdade, sem forçar nada que não seja seu.",
  },
  {
    numero: "03",
    titulo: "Roteiros e pautas",
    descricao:
      "Estruturamos episódios, entrevistas, aulas e posts para que você chegue preparado em qualquer formato. A voz é sempre sua, o contexto e a profundidade são o que construímos juntos.",
  },
  {
    numero: "04",
    titulo: "Assessoria de marca pessoal",
    descricao:
      "Para executivos, gestores e profissionais do futebol que querem ser reconhecidos pela consistência, não pelo volume. Presença construída com identidade.",
  },
  {
    numero: "05",
    titulo: "Estruturação de produtos educacionais",
    descricao:
      "Transformamos metodologia e conhecimento acumulado em cursos, trilhas e certificações com jornada real. Seu saber vira produto, sem perder a sua assinatura.",
  },
  {
    numero: "06",
    titulo: "Ativos institucionais",
    descricao:
      "Para federações, ligas e entidades que precisam transformar credibilidade em produto estruturado: academy, selo de formação e trilhas com identidade própria.",
  },
];

const personas = [
  {
    numero: "01",
    titulo: "Especialistas e executivos",
    descricao:
      "Gestores, treinadores, analistas e executivos de clube com repertório real. Sabem muito, mas ainda não encontraram a forma de comunicar isso com consistência e intenção.",
    tags: ["Programa de mídia", "Posicionamento", "Roteiros"],
  },
  {
    numero: "02",
    titulo: "Federações e entidades",
    descricao:
      "Instituições com credibilidade consolidada que precisam transformar o que já fazem bem em produto educacional com identidade, jornada e distribuição.",
    tags: ["Academy oficial", "Trilhas", "Certificação"],
  },
  {
    numero: "03",
    titulo: "Atletas em transição",
    descricao:
      "Jogadores construindo relevância além das quatro linhas com o que viveram dentro delas. O Content Lab estrutura essa história antes que o momento passe.",
    tags: ["Marca pessoal", "Estratégia editorial", "Bastidor"],
  },
  {
    numero: "04",
    titulo: "Marcas e patrocinadores",
    descricao:
      "Empresas que querem estar no futebol com substância, não só com logo. Branded content com editorial real, construído com quem entende o ecossistema por dentro.",
    tags: ["Branded content", "Parceria editorial"],
  },
];

const etapas = [
  {
    numero: "1",
    titulo: "Diagnóstico",
    descricao:
      "Conversamos sobre sua trajetória, sua autoridade e onde você quer chegar. O posicionamento nasce desse entendimento, não de um template.",
    entregas: [
      "Mapa de autoridade",
      "Análise de posicionamento",
      "Oportunidades editoriais",
    ],
  },
  {
    numero: "2",
    titulo: "Estratégia editorial",
    descricao:
      "Construímos junto a linha editorial: pilares, tom, formatos e cadência. Tudo validado com você antes de qualquer passo seguinte.",
    entregas: [
      "Linha editorial",
      "Pilares e tom de voz",
      "Calendário de conteúdo",
    ],
  },
  {
    numero: "3",
    titulo: "Roteiros e pautas",
    descricao:
      "Cada episódio, entrevista ou aula chega estruturado para você. O contexto e a profundidade são nossos: a autenticidade e a voz são sempre suas.",
    entregas: ["Roteiros completos", "Pautas e perguntas", "Guias de abordagem"],
  },
  {
    numero: "4",
    titulo: "Acompanhamento",
    descricao:
      "Revisão do que vai ao ar, ajuste de narrativa quando necessário e orientação contínua. O posicionamento se consolida com consistência ao longo do tempo.",
    entregas: [
      "Revisão editorial",
      "Ajustes de narrativa",
      "Orientação contínua",
    ],
  },
  {
    numero: "5",
    titulo: "Expansão",
    descricao:
      "Com presença validada, abrimos novos formatos, novos produtos e novas verticais. A estrutura que construímos juntos escala junto com você.",
    entregas: [
      "Novos formatos",
      "Produtos educacionais",
      "Parcerias institucionais",
    ],
  },
];

export default function FooteraContentLab() {
  const logoSrc = "/assets/usuarios/Footera-Content-Lab-LP-BGR.png";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

        :root {
          --bg: #f6f3ee;
          --bg2: #efeae1;
          --white: #ffffff;
          --ink: #141210;
          --ink70: rgba(20,18,16,0.70);
          --ink45: rgba(20,18,16,0.45);
          --ink20: rgba(20,18,16,0.20);
          --ink08: rgba(20,18,16,0.08);
          --gold: #b8922a;
          --gold2: #d4aa4a;
          --gold-bg: rgba(184,146,42,0.08);
          --gold-ln: rgba(184,146,42,0.28);
          --green: #2a6e40;
          --line: rgba(20,18,16,0.10);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body {
          background: var(--bg);
          color: var(--ink45);
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          line-height: 1.75;
          overflow-x: hidden;
        }

        nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 60px;
          background: rgba(246,243,238,0.93);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--line);
        }

        .nav-logo,
        .foot-logo {
          display: block;
          width: auto;
          object-fit: contain;
        }

        .nav-logo { height: 40px; }
        .foot-logo { height: 32px; }

        .nav-links {
          display: flex;
          gap: 32px;
          list-style: none;
        }

        .nav-links a {
          text-decoration: none;
          font-size: 11px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--ink45);
          transition: color .2s;
        }

        .nav-links a:hover { color: var(--ink); }

        .nav-cta {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--gold);
          text-decoration: none;
          border: 1px solid var(--gold-ln);
          padding: 8px 20px;
          transition: all .2s;
        }

        .nav-cta:hover { background: var(--gold-bg); }

        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 0 60px 100px;
          position: relative;
          overflow: hidden;
        }

        .hero-topline {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg,var(--green),var(--gold),transparent);
        }

        .hero-eyebrow {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 30px;
          animation: up .8s ease both;
        }

        .ey-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green);
        }

        .ey-text {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: var(--green);
        }

        .ey-div {
          width: 1px;
          height: 14px;
          background: var(--ink20);
        }

        .ey-sub {
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--ink45);
        }

        h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(52px, 7.5vw, 104px);
          font-weight: 600;
          color: var(--ink);
          line-height: 1;
          letter-spacing: -1px;
          max-width: 880px;
          animation: up .8s .08s ease both;
        }

        h1 em,
        h2 em,
        .cta-h em {
          font-style: italic;
          color: var(--gold);
        }

        .hero-sub {
          margin-top: 28px;
          max-width: 460px;
          font-family: 'Playfair Display', serif;
          font-size: clamp(16px,1.8vw,19px);
          font-style: italic;
          color: var(--ink45);
          line-height: 1.65;
          animation: up .8s .16s ease both;
        }

        .hero-actions {
          display: flex;
          align-items: center;
          gap: 24px;
          margin-top: 48px;
          animation: up .8s .24s ease both;
        }

        .btn-p {
          display: inline-flex;
          align-items: center;
          background: var(--gold);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          text-decoration: none;
          padding: 13px 28px;
          transition: background .2s;
        }

        .btn-p:hover { background: var(--gold2); }

        .btn-s {
          font-size: 11px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--ink45);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: color .2s;
        }

        .btn-s:hover { color: var(--ink); }
        .btn-s::after { content: '↓'; }

        .hero-yr {
          position: absolute;
          right: 60px;
          bottom: 100px;
          writing-mode: vertical-rl;
          font-size: 9px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--ink20);
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .hero-yr::before {
          content: '';
          width: 1px;
          height: 48px;
          background: var(--ink20);
        }

        .s,
        .jv-wrap,
        .cta-wrap,
        .quote-wrap {
          max-width: 1120px;
          margin: 0 auto;
          border-top: 1px solid var(--line);
        }

        .s { padding: 120px 60px; }
        .jv-wrap { padding: 120px 60px; }
        .cta-wrap {
          padding: 120px 60px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 80px;
          align-items: center;
        }
        .quote-wrap { padding: 80px 60px; }

        .lbl {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: var(--gold);
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .lbl::before {
          content: '';
          width: 20px;
          height: 1px;
          background: var(--gold);
        }

        h2,
        .cta-h {
          font-family: 'Playfair Display', serif;
          font-size: clamp(32px,4vw,52px);
          font-weight: 600;
          color: var(--ink);
          line-height: 1.08;
          letter-spacing: -.3px;
        }

        .intro,
        .cta-sub {
          font-size: 15px;
          color: var(--ink45);
          line-height: 1.85;
        }

        .intro {
          max-width: 520px;
          margin-top: 16px;
        }

        .cta-sub {
          margin-top: 14px;
          max-width: 400px;
          font-size: 14px;
          line-height: 1.8;
        }

        .servicos,
        .personas,
        .etapas {
          margin-top: 72px;
        }

        .servico {
          display: grid;
          grid-template-columns: 48px 1fr 280px;
          padding: 32px 0;
          border-bottom: 1px solid var(--line);
          gap: 32px;
          align-items: start;
          transition: all .2s;
        }

        .servico:first-child,
        .etapa:first-child {
          border-top: 1px solid var(--line);
        }

        .servico:hover .sn { color: var(--gold); }
        .servico:hover .st { color: var(--ink); }

        .sn,
        .en {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          line-height: 1;
        }

        .sn {
          font-size: 13px;
          color: var(--ink20);
          padding-top: 3px;
          transition: color .2s;
        }

        .st {
          font-family: 'Playfair Display', serif;
          font-size: 21px;
          font-weight: 600;
          color: var(--ink70);
          line-height: 1.2;
          transition: color .2s;
        }

        .sb,
        .pd,
        .edesc,
        .jv-desc,
        .jv-pt {
          color: var(--ink45);
          line-height: 1.75;
        }

        .sb,
        .pd,
        .edesc { font-size: 13px; }

        .quote {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 80px;
          align-items: end;
        }

        .qt {
          font-family: 'Playfair Display', serif;
          font-size: clamp(22px,3vw,34px);
          font-weight: 400;
          font-style: italic;
          color: var(--ink);
          line-height: 1.45;
        }

        .qt em {
          font-style: normal;
          color: var(--gold);
        }

        .qa {
          font-size: 10px;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: var(--ink20);
          white-space: nowrap;
          writing-mode: vertical-rl;
          transform: rotate(180deg);
        }

        .personas {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-top: 1px solid var(--line);
        }

        .persona {
          padding: 48px 60px 48px 0;
          border-bottom: 1px solid var(--line);
        }

        .persona:nth-child(even) {
          padding-left: 60px;
          padding-right: 0;
          border-left: 1px solid var(--line);
        }

        .pn,
        .eout-lbl,
        .jv-pn {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
        }

        .pn { color: var(--ink20); margin-bottom: 16px; }

        .pt,
        .etitle {
          font-family: 'Playfair Display', serif;
          font-size: 21px;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 12px;
          line-height: 1.2;
        }

        .tags,
        .jv-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tag,
        .jv-tag {
          font-size: 10px;
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid var(--gold-ln);
          color: var(--gold);
          background: var(--gold-bg);
        }

        .etapa {
          display: grid;
          grid-template-columns: 60px 1fr 240px;
          gap: 40px;
          padding: 32px 0;
          border-bottom: 1px solid var(--line);
          align-items: start;
        }

        .en {
          font-size: 36px;
          font-weight: 400;
          color: var(--ink08);
        }

        .eout-lbl {
          color: var(--gold);
          margin-bottom: 10px;
        }

        .eout-item {
          font-size: 12px;
          color: var(--ink45);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
        }

        .eout-item::before {
          content: '';
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: var(--gold);
          flex-shrink: 0;
        }

        .jv-card {
          border: 1px solid var(--gold-ln);
          background: var(--white);
          position: relative;
          overflow: hidden;
          transition: border-color .25s;
        }

        .jv-card:hover { border-color: rgba(184,146,42,.5); }

        .jv-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg,var(--gold),rgba(184,146,42,.1),transparent);
        }

        .jv-inner { padding: 48px 52px; }

        .jv-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid var(--gold-ln);
          background: var(--gold-bg);
          padding: 5px 12px;
          margin-bottom: 32px;
        }

        .jv-star {
          color: var(--gold);
          font-size: 8px;
        }

        .jv-blbl,
        .jv-sub,
        .jv-sl {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
        }

        .jv-blbl { color: var(--gold); }
        .jv-sub { color: var(--ink45); margin-bottom: 22px; }
        .jv-sl { color: var(--ink20); font-size: 8px; letter-spacing: 2px; }

        .jv-main {
          display: grid;
          grid-template-columns: 1fr 148px;
          gap: 48px;
          align-items: start;
        }

        .jv-h {
          font-family: 'Playfair Display', serif;
          font-size: clamp(28px,4vw,46px);
          font-weight: 600;
          line-height: 1;
          letter-spacing: -.3px;
          margin-bottom: 8px;
        }

        .jv-hw { color: var(--ink); }
        .jv-hs { color: var(--ink20); font-weight: 300; }
        .jv-hg { color: var(--gold); }

        .jv-desc {
          font-size: 14px;
          max-width: 580px;
          margin-bottom: 26px;
          line-height: 1.8;
        }

        .jv-stats {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .jv-stat {
          background: var(--bg);
          border: 1px solid var(--line);
          padding: 22px 20px;
          text-align: center;
        }

        .jv-sv {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 600;
          color: var(--gold);
          line-height: 1;
          margin-bottom: 6px;
        }

        .jv-partners {
          display: grid;
          grid-template-columns: 1fr 1px 1fr;
          border-top: 1px solid var(--line);
        }

        .jv-p { padding: 28px 52px; }
        .jv-pd { background: var(--line); }
        .jv-pn { color: var(--gold); margin-bottom: 8px; }
        .jv-pt { font-size: 12px; line-height: 1.7; }

        .cta-btns {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-shrink: 0;
        }

        footer {
          border-top: 1px solid var(--line);
          padding: 30px 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg);
        }

        .foot-note {
          font-size: 11px;
          color: var(--ink20);
        }

        @keyframes up {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 860px) {
          nav { padding: 14px 24px; }
          .nav-links { display: none; }
          .hero { padding: 0 24px 72px; }
          .hero-yr { display: none; }
          .s,
          .jv-wrap,
          .cta-wrap,
          .quote-wrap { padding: 80px 24px; }
          .servico { grid-template-columns: 36px 1fr; }
          .sb { display: none; }
          .personas { grid-template-columns: 1fr; }
          .persona:nth-child(even) {
            border-left: none;
            padding-left: 0;
          }
          .etapa { grid-template-columns: 48px 1fr; }
          .etapa > div:last-child { display: none; }
          .quote { grid-template-columns: 1fr; }
          .qa {
            writing-mode: horizontal-tb;
            transform: none;
            margin-top: 20px;
          }
          .jv-main { grid-template-columns: 1fr; }
          .jv-stats { flex-direction: row; }
          .jv-stat { flex: 1; }
          .jv-inner { padding: 32px 24px; }
          .jv-partners { grid-template-columns: 1fr; }
          .jv-p { padding: 24px; }
          .jv-pd { display: none; }
          .cta-wrap { grid-template-columns: 1fr; gap: 40px; }
          footer {
            flex-direction: column;
            gap: 12px;
            text-align: center;
            padding: 24px;
          }
        }
      `}</style>

      <nav>
        <img className="nav-logo" src={logoSrc} alt="Footera Content Lab" />
        <ul className="nav-links">
          <li><a href="#servicos">O que fazemos</a></li>
          <li><a href="#para-quem">Para quem</a></li>
          <li><a href="#como">Como funciona</a></li>
          <li><a href="#jv">Sportainment</a></li>
        </ul>
        <a href="#contato" className="nav-cta">Conversar</a>
      </nav>

      <div className="hero">
        <div className="hero-topline" />
        <div className="hero-eyebrow">
          <span className="ey-dot" />
          <span className="ey-text">Footera</span>
          <span className="ey-div" />
          <span className="ey-sub">Content Lab</span>
        </div>

        <h1>
          Autoridade
          <br />
          que já <em>existe.</em>
          <br />
          Nós estruturamos.
        </h1>

        <p className="hero-sub">
          Transformamos o que você já sabe em presença, narrativa e posicionamento real dentro do futebol.
        </p>

        <div className="hero-actions">
          <a href="#contato" className="btn-p">Falar com a equipe</a>
          <a href="#servicos" className="btn-s">Ver o que fazemos</a>
        </div>

        <div className="hero-yr">2026</div>
      </div>

      <div className="s" id="servicos">
        <div className="lbl">O que fazemos</div>
        <h2>
          O repertório é seu.
          <br />
          A estrutura <em>é nossa.</em>
        </h2>
        <p className="intro">
          O Content Lab trabalha com o que você já tem: experiência, história e autoridade.
          Nossa função é organizar isso em conteúdo que comunica, posiciona e gera valor
          de forma consistente.
        </p>

        <div className="servicos">
          {servicos.map((item) => (
            <div className="servico" key={item.numero}>
              <div className="sn">{item.numero}</div>
              <div className="st">{item.titulo}</div>
              <div className="sb">{item.descricao}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="quote-wrap">
        <div className="quote">
          <p className="qt">
            &quot;Quem trabalha no futebol
            <br />
            tem muito mais a dizer
            <br />
            do que o mercado <em>escuta hoje.</em>&quot;
          </p>
          <span className="qa">Footera Content Lab · 2026</span>
        </div>
      </div>

      <div className="s" id="para-quem">
        <div className="lbl">Para quem é</div>
        <h2>
          Quatro perfis,
          <br />
          um <em>ponto em comum.</em>
        </h2>
        <p className="intro">
          Cada cliente chega com autoridade construída ao longo de anos. O Content Lab ajuda
          a transformar isso em presença consistente e produto real.
        </p>

        <div className="personas">
          {personas.map((item) => (
            <div className="persona" key={item.numero}>
              <div className="pn">{item.numero}</div>
              <div className="pt">{item.titulo}</div>
              <div className="pd">{item.descricao}</div>
              <div className="tags">
                {item.tags.map((tag) => (
                  <span className="tag" key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="s" id="como">
        <div className="lbl">Como funciona</div>
        <h2>
          Cinco etapas,
          <br />
          <em>um processo vivo.</em>
        </h2>
        <p className="intro">
          O processo é modular e começa sempre pelo que você já tem. Cada etapa constrói sobre
          a anterior sem apressar nada.
        </p>

        <div className="etapas">
          {etapas.map((item) => (
            <div className="etapa" key={item.numero}>
              <div className="en">{item.numero}</div>
              <div>
                <div className="etitle">{item.titulo}</div>
                <div className="edesc">{item.descricao}</div>
              </div>
              <div>
                <div className="eout-lbl">Entrega</div>
                {item.entregas.map((entrega) => (
                  <div className="eout-item" key={entrega}>{entrega}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="jv-wrap" id="jv">
        <div className="lbl">O ecossistema</div>
        <h2>
          Footera Content Lab
          <br />
          e <em>AZRD Ventures.</em>
        </h2>
        <p className="intro" style={{ marginBottom: 48 }}>
          O Content Lab opera dentro de uma joint venture que une o ecossistema digital do futebol
          com conexões estratégicas e desenvolvimento de marcas no esporte.
        </p>

        <div className="jv-card">
          <div className="jv-top" />
          <div className="jv-inner">
            <div className="jv-badge">
              <span className="jv-star">✦</span>
              <span className="jv-blbl">Joint Venture em Destaque</span>
            </div>

            <div className="jv-main">
              <div>
                <div className="jv-h">
                  <span className="jv-hw">FOOTERA</span>
                  <span className="jv-hs"> / </span>
                  <span className="jv-hg">AZRD</span>
                </div>
                <div className="jv-sub">Footera Sportainment · AZRD Ventures</div>
                <p className="jv-desc">
                  A FOOTERA e a AZRD formam a joint venture no universo do sportainment:
                  a intersecção entre esporte, entretenimento e negócios. Um projeto que une
                  estratégia editorial, conexões de mercado e desenvolvimento de marcas dentro
                  do ecossistema esportivo brasileiro.
                </p>

                <div className="jv-tags">
                  {["Sportainment", "Esporte", "Entretenimento", "Marcas", "Joint Venture"].map((tag) => (
                    <span className="jv-tag" key={tag}>{tag}</span>
                  ))}
                </div>
              </div>

              <div className="jv-stats">
                <div className="jv-stat">
                  <div className="jv-sv">JV</div>
                  <div className="jv-sl">Joint Venture</div>
                </div>
                <div className="jv-stat">
                  <div className="jv-sv">2025</div>
                  <div className="jv-sl">Em operação</div>
                </div>
              </div>
            </div>
          </div>

          <div className="jv-partners">
            <div className="jv-p">
              <div className="jv-pn">Footera Content Lab</div>
              <div className="jv-pt">
                Estratégia editorial, posicionamento e estruturação de conteúdo no ecossistema do futebol
              </div>
            </div>
            <div className="jv-pd" />
            <div className="jv-p">
              <div className="jv-pn">AZRD Ventures</div>
              <div className="jv-pt">
                Conexões estratégicas, desenvolvimento de marcas e expansão de negócios no esporte
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cta-wrap" id="contato">
        <div>
          <h2 className="cta-h">
            O que você já construiu
            <br />
            merece ser <em>ouvido.</em>
          </h2>
          <p className="cta-sub">
            O primeiro passo é uma conversa. Entendemos o que você tem, mapeamos o espaço
            e construímos o caminho juntos.
          </p>
        </div>

        <div className="cta-btns">
          <a href="mailto:contato@footera.com.br" className="btn-p">
            Falar com a equipe
          </a>
          <a
            href="https://footera.app.br"
            className="btn-s"
            target="_blank"
            rel="noreferrer"
          >
            Conhecer a Footera
          </a>
        </div>
      </div>

      <footer>
        <img className="foot-logo" src={logoSrc} alt="Footera Content Lab" />
        <span className="foot-note">© 2026 Footera Content Lab · footera.com.br</span>
      </footer>
    </>
  );
}