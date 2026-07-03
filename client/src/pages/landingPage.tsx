// client/src/pages/landingPage.tsx
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Instagram, Facebook } from "lucide-react";
import Atualizacoes from "../components/Atualizacoes";

const SHOW_SOCIALS = false;
const LOGO_SRC = "/assets/usuarios/footera-logo.png"; 
const LOGOV_SRC = "/assets/usuarios/footera-logo-fundo-verde.png"; 
const LOGO_LANDING_VERDE = "/assets/usuarios/2.png";
const LOGO_LANDING_PRETO = "/assets/usuarios/3.png";

const HERO_SLIDES = [
  {
    src: LOGO_LANDING_VERDE,
    alt: "FootEra",
    title: "Conheça a FootEra",
    subtitle: "Treinos, desafios, pontuação e visibilidade em um só lugar.",
    href: "/cadastro",
  },
  {
    src: LOGO_LANDING_PRETO,
    alt: "Content Lab",
    title: "Nova parceria",
    subtitle: "Em breve novidades e conteúdos especiais para a comunidade.",
    href: "/content-lab",
  },
];

const SLIDE_BG_FALLBACK = "#003c24";

function corBordaFromImagem(r: number, g: number, b: number) {
  const brilho = (r * 299 + g * 587 + b * 114) / 1000;
  const fator = brilho > 180 ? 0.55 : 0.85;

  return `rgb(${Math.round(r * fator)}, ${Math.round(g * fator)}, ${Math.round(
    b * fator
  )})`;
}

type LandingPageProps = {
  showSocials?: boolean;
  logoSrc?: string;
  logoVSrc?: string;
  heroImageSrc?: string | null;
};

type AbaAtiva = "home" | "sobre" | "novidades";

function getInitialLandingTab(): AbaAtiva {
  try {
    const qs = new URLSearchParams(window.location.search);
    const q = (qs.get("tab") || "").toLowerCase();

    if (q === "sobre") return "sobre";
    if (q === "novidades") return "novidades";
    return "home";
  } catch {
    return "home";
  }
}

export default function LandingPage({
  showSocials = SHOW_SOCIALS,
  logoSrc = LOGO_SRC,
  logoVSrc = LOGOV_SRC,
  heroImageSrc = null,
}: LandingPageProps) {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<AbaAtiva>(getInitialLandingTab());
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideBgColor, setSlideBgColor] = useState(SLIDE_BG_FALLBACK);

  const currentHeroSrc = heroImageSrc || HERO_SLIDES[currentSlide]?.src || LOGO_LANDING_VERDE;

  useEffect(() => {
    if (activeTab !== "home") return;

    const interval = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    const onPopState = () => setActiveTab(getInitialLandingTab());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!currentHeroSrc) {
      setSlideBgColor(SLIDE_BG_FALLBACK);
      return;
    }

    let cancelado = false;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentHeroSrc;

    img.onload = () => {
      if (cancelado) return;

      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, 24, 24);

        const data = ctx.getImageData(0, 0, 24, 24).data;

        let r = 0;
        let g = 0;
        let b = 0;
        let total = 0;

        for (let y = 0; y < 24; y++) {
          for (let x = 0; x < 24; x++) {
            const isBorda = x < 4 || x > 19 || y < 4 || y > 19;
            if (!isBorda) continue;

            const i = (y * 24 + x) * 4;
            const alpha = data[i + 3];

            if (alpha < 20) continue;

            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            total++;
          }
        }

        if (!total) {
          setSlideBgColor(SLIDE_BG_FALLBACK);
          return;
        }

        setSlideBgColor(
          corBordaFromImagem(r / total, g / total, b / total)
        );
      } catch {
        setSlideBgColor(SLIDE_BG_FALLBACK);
      }
    };

    img.onerror = () => {
      if (!cancelado) setSlideBgColor(SLIDE_BG_FALLBACK);
    };

    return () => {
      cancelado = true;
    };
  }, [currentHeroSrc]);

  const changeTab = (tab: AbaAtiva) => {
    setActiveTab(tab);

    if (tab === "home") {
      setCurrentSlide(0);
    }

    const url = tab === "home" ? "/" : `/?tab=${tab}`;
    window.history.replaceState({}, "", url);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSlideClick = (href?: string) => {
    if (!href) return;

    if (href.startsWith("/?tab=")) {
      const tab = href.replace("/?tab=", "") as AbaAtiva;
      changeTab(tab);
      return;
    }

    navigate(href);
  };

  const menuBtnClass = (tab: AbaAtiva) =>
    `transition ${
      activeTab === tab ? "text-green-200" : "hover:text-green-200"
    }`;

  const mobileMenuBtnClass = (tab: AbaAtiva) =>
    `px-3 py-1.5 rounded-full border text-xs font-medium transition ${
      activeTab === tab
        ? "border-white/30 bg-white/20 text-white"
        : "border-white/20 bg-white/10 text-white"
    }`;

  return (
    <div className="min-h-screen bg-[#F6F1E7]">
      <div className="mx-auto w-full max-w-7xl px-2 py-3 sm:px-4 sm:py-6 md:px-6 md:py-8">
        <div className="overflow-hidden rounded-2xl md:rounded-3xl bg-white shadow-[0_18px_50px_rgba(0,0,0,0.12)] border border-black/5">
          <header className="bg-green-900 text-white">
            <div className="flex items-center justify-between px-5 py-4 md:px-8">
              <button
                type="button"
                onClick={() => changeTab("home")}
                className="flex items-center gap-3"
                aria-label="Ir para Home"
              >
                <img
                  src={logoSrc}
                  alt="Logo FootEra"
                  className="w-11 h-11 md:w-14 md:h-14 object-contain"
                />

                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-lg md:text-xl font-extrabold">FootEra</div>
                  <div className="text-[11px] md:text-xs text-white/80">
                    A metodologia dos profissionais
                  </div>
                </div>
              </button>

              <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => changeTab("home")}
                  className={menuBtnClass("home")}
                >
                  Home
                </button>

                <button
                  type="button"
                  onClick={() => changeTab("sobre")}
                  className={menuBtnClass("sobre")}
                >
                  Sobre
                </button>

                <Link href="/termos" className="hover:text-green-200 transition">
                  Termos de Uso &amp; Política de Privacidade
                </Link>

                <button
                  type="button"
                  onClick={() => changeTab("novidades")}
                  className={menuBtnClass("novidades")}
                >
                  Novidades
                </button>
              </nav>

              <div className="flex items-center gap-2 md:gap-3">
                {showSocials && (
                  <div className="hidden md:flex items-center gap-2 mr-1">
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="h-9 w-9 rounded-full border border-white/20 bg-white/10 flex items-center justify-center hover:bg-white/15 transition"
                      aria-label="Instagram"
                    >
                      <Instagram className="w-4 h-4" />
                    </a>

                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="h-9 w-9 rounded-full border border-white/20 bg-white/10 flex items-center justify-center hover:bg-white/15 transition"
                      aria-label="Facebook"
                    >
                      <Facebook className="w-4 h-4" />
                    </a>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="px-4 py-2 rounded-full border border-white/25 bg-white/10 text-white text-sm font-semibold hover:bg-white/15 transition"
                >
                  Login
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/cadastro")}
                  className="px-4 py-2 rounded-full bg-white text-green-900 text-sm font-bold hover:bg-[#f3f3f3] transition"
                >
                  Cadastro
                </button>
              </div>
            </div>

            <div className="lg:hidden px-5 pb-4 md:px-8">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => changeTab("home")}
                  className={mobileMenuBtnClass("home")}
                >
                  Home
                </button>

                <button
                  type="button"
                  onClick={() => changeTab("sobre")}
                  className={mobileMenuBtnClass("sobre")}
                >
                  Sobre
                </button>

                <Link
                  href="/termos"
                  className="px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-medium"
                >
                  Termos &amp; Privacidade
                </Link>

                <button
                  type="button"
                  onClick={() => changeTab("novidades")}
                  className={mobileMenuBtnClass("novidades")}
                >
                  Novidades
                </button>
              </div>
            </div>
          </header>

          {activeTab === "home" && (
            <section className="relative overflow-hidden bg-[#F6F1E7]">
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute right-[-60px] top-1/2 -translate-y-1/2 w-[320px] h-[320px] md:w-[500px] md:h-[500px] opacity-[0.05] rounded-full"
                  style={{
                    backgroundImage: "url('/assets/usuarios/footera-logo.png')",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    backgroundSize: "contain",
                    filter: "grayscale(100%)",
                  }}
                />
              </div>

              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-center px-3 py-8 sm:px-6 sm:py-12 md:px-10 md:py-16 lg:px-14 lg:py-20">
                <div>
                  <span className="inline-flex items-center rounded-full bg-green-100 text-green-900 px-3 py-1 text-xs md:text-sm font-semibold">
                    Plataforma para quem vive futebol
                  </span>

                  <h1 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-green-900">
                    Evolua no futebol
                    <br />
                    com a <span className="text-green-700">FootEra</span>
                  </h1>

                  <p className="mt-5 max-w-xl text-sm md:text-base text-gray-700 leading-relaxed">
                    Treine, participe de desafios, acompanhe sua pontuação,
                    organize atletas, compartilhe vídeos e ganhe visibilidade com
                    a metodologia de profissionais.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate("/cadastro")}
                      className="px-5 py-3 rounded-xl bg-green-900 text-white font-semibold hover:bg-green-800 transition active:scale-[0.98]"
                    >
                      Criar conta
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="px-5 py-3 rounded-xl border border-green-900 text-green-900 font-semibold hover:bg-green-50 transition active:scale-[0.98]"
                    >
                      Fazer login
                    </button>
                  </div>

                  <div className="mt-8 flex flex-wrap gap-2">
                    {[
                      "Treinos",
                      "Desafios",
                      "Pontuação",
                      "Perfil com vídeos",
                      "Visibilidade",
                    ].map((item) => (
                      <span
                        key={item}
                        className="px-3 py-1.5 rounded-full bg-white border border-green-100 text-green-900 text-xs md:text-sm font-medium"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <div className="rounded-3xl bg-green-900 p-3 sm:p-4 md:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
                    <div className="rounded-2xl bg-white p-4 sm:p-5 md:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-xl md:text-2xl font-bold text-green-900">
                            Seu futebol mais organizado
                          </h2>
                          <p className="mt-2 text-sm text-gray-600">
                            Uma plataforma para atletas, professores, clubes e
                            escolinhas acompanharem evolução e desempenho.
                          </p>
                        </div>

                        <div className="hidden sm:flex shrink-0 w-14 h-14 min-w-14 min-h-14 items-center justify-center rounded-full overflow-hidden bg-white p-1">
                          <img
                            src={logoVSrc}
                            alt="FootEra"
                            className="w-full h-full object-cover rounded-full "
                          />
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
                        <div className="rounded-2xl bg-[#F6F1E7] p-3 sm:p-4 border border-green-100 min-w-0">
                          <div className="text-[18px] sm:text-2xl leading-tight font-extrabold text-green-900 break-words">
                            + Treinos
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            Organize rotinas e acompanhe o progresso.
                          </div>
                        </div>

                        <div className="rounded-2xl bg-[#F6F1E7] p-3 sm:p-4 border border-green-100 min-w-0">
                          <div className="text-[18px] sm:text-2xl leading-tight font-extrabold text-green-900 break-words">
                            + Desafios
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            Participe, envie vídeos e pontue.
                          </div>
                        </div>

                        <div className="rounded-2xl bg-[#F6F1E7] p-3 sm:p-4 border border-green-100 min-w-0">
                          <div className="text-[18px] sm:text-2xl leading-tight font-extrabold text-green-900 break-words">
                            + Perfil
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            Mostre evolução, badges e mídia.
                          </div>
                        </div>

                        <div className="rounded-2xl bg-[#F6F1E7] p-3 sm:p-4 border border-green-100 min-w-0">
                          <div className="text-[18px] sm:text-2xl leading-tight font-extrabold text-green-900 break-words">
                            + Visibilidade
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            Conecte-se com clubes e profissionais.
                          </div>
                        </div>
                      </div>

                    <div className="mt-6">
                        <div
                          className="relative h-[180px] sm:h-[220px] md:h-[260px] rounded-2xl overflow-hidden border-4 transition-colors duration-300"
                          style={{
                            backgroundColor: slideBgColor,
                            borderColor: slideBgColor,
                          }}
                        >
                          {heroImageSrc ? (
                            <img
                              src={heroImageSrc}
                              alt="Destaque FootEra"
                              className="absolute inset-0 block w-full h-full object-contain object-center"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSlideClick(HERO_SLIDES[currentSlide]?.href)}
                              className="absolute inset-0 block w-full h-full overflow-hidden group p-0"
                              style={{ backgroundColor: slideBgColor }}
                            >
                              <img
                                src={HERO_SLIDES[currentSlide]?.src}
                                alt={HERO_SLIDES[currentSlide]?.alt || "Slide FootEra"}
                                className="absolute inset-0 block w-full h-full object-contain object-center transition duration-300"
                              />
                            </button>
                          )}

                          {!heroImageSrc && HERO_SLIDES.length > 1 && (
                            <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 flex items-center gap-2">
                              {HERO_SLIDES.map((_, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => setCurrentSlide(index)}
                                  className={`h-2.5 rounded-full ring-1 ring-black/20 shadow-sm transition-all ${
                                    currentSlide === index
                                      ? "w-6 bg-white"
                                      : "w-2.5 bg-white/70 hover:bg-white"
                                  }`}
                                  aria-label={`Ir para slide ${index + 1}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => navigate("/cadastro")}
                          className="w-full sm:flex-1 sm:min-w-[160px] px-5 py-3 rounded-xl  bg-green-900 text-white font-semibold hover:bg-green-800 transition"
                        >
                          Começar agora
                        </button>

                        <button
                          type="button"
                          onClick={() => changeTab("sobre")}
                          className="w-full sm:flex-1 sm:min-w-[160px] px-5 py-3 rounded-xl  border border-green-900 text-green-900 font-semibold hover:bg-green-50 transition"
                        >
                          Saiba mais
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="absolute -bottom-4 left-6 right-6 h-8 rounded-full bg-green-950/10 blur-xl" />
                </div>
              </div>
            </section>
          )}

          {activeTab === "sobre" && (
            <section className="bg-[#F6F1E7] px-6 py-12 md:px-10 md:py-16 lg:px-14 lg:py-20">
              <div className="mx-auto max-w-5xl">
                <div className="text-center">
                  <span className="inline-flex items-center rounded-full bg-green-100 text-green-900 px-3 py-1 text-xs md:text-sm font-semibold">
                    Sobre a FootEra
                  </span>

                  <h1 className="mt-5 text-3xl md:text-5xl font-extrabold leading-tight text-green-900">
                    A plataforma para quem vive o futebol todos os dias
                  </h1>

                  <p className="mt-5 text-sm md:text-base text-gray-700 leading-relaxed max-w-3xl mx-auto">
                    A FootEra foi criada para conectar atletas, professores,
                    clubes e escolinhas em um só lugar, facilitando o
                    desenvolvimento esportivo, o acompanhamento de desempenho e a
                    visibilidade dentro do futebol.
                  </p>
                </div>

                <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-green-900">
                      Para atletas
                    </h3>
                    <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                      Participe de treinos e desafios, envie vídeos, acompanhe
                      sua pontuação, evolução e fortaleça seu perfil esportivo.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-green-900">
                      Para professores
                    </h3>
                    <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                      Organize treinos, acompanhe atletas, publique conteúdos,
                      trabalhe com turmas e use metodologias de forma mais
                      estruturada.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-green-900">
                      Para clubes e escolinhas
                    </h3>
                    <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                      Gerencie atletas, professores, conteúdos e desempenho em um
                      ambiente único, pensado para organização esportiva.
                    </p>
                  </div>
                </div>

                <div className="mt-8 rounded-3xl border border-green-100 bg-white p-6 md:p-8 shadow-sm">
                  <h2 className="text-2xl font-extrabold text-green-900">
                    O que a FootEra entrega
                  </h2>

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      "Criação e organização de treinos",
                      "Desafios com envio de vídeos e pontuação",
                      "Perfis esportivos com mídia e visibilidade",
                      "Acompanhamento de evolução e desempenho",
                      "Gestão de atletas, professores e turmas",
                      "Metodologias com aulas, semanas e progressão",
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl bg-[#F6F1E7] border border-green-100 px-4 py-3 text-sm font-medium text-green-900"
                      >
                        {item}
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate("/cadastro")}
                      className="px-5 py-3 rounded-xl bg-green-900 text-white font-semibold hover:bg-green-800 transition"
                    >
                      Criar conta
                    </button>

                    <button
                      type="button"
                      onClick={() => changeTab("novidades")}
                      className="px-5 py-3 rounded-xl border border-green-900 text-green-900 font-semibold hover:bg-green-50 transition"
                    >
                      Ver novidades
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "novidades" && (
            <section className="bg-[#F6F1E7] px-6 py-12 md:px-10 md:py-16 lg:px-14 lg:py-20">
              <div className="mx-auto max-w-5xl">
                <div className="text-center mb-8">
                  <span className="inline-flex items-center rounded-full bg-green-100 text-green-900 px-3 py-1 text-xs md:text-sm font-semibold">
                    Novidades da plataforma
                  </span>

                  <h1 className="mt-5 text-3xl md:text-5xl font-extrabold leading-tight text-green-900">
                    Atualizações e correções da FootEra
                  </h1>

                  <p className="mt-5 text-sm md:text-base text-gray-700 leading-relaxed max-w-3xl mx-auto">
                    Acompanhe aqui as melhorias mais recentes, novas
                    funcionalidades e correções de bugs da plataforma.
                  </p>
                </div>

                <Atualizacoes />
              </div>
            </section>
          )}

          <footer className="border-t border-gray-200 bg-white px-6 py-5 md:px-10">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-gray-600">
                © {new Date().getFullYear()} FootEra. Todos os direitos reservados.
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => changeTab("home")}
                  className="text-green-900 hover:text-green-700"
                >
                  Home
                </button>

                <button
                  type="button"
                  onClick={() => changeTab("sobre")}
                  className="text-green-900 hover:text-green-700"
                >
                  Sobre
                </button>

                <Link href="/termos" className="text-green-900 hover:text-green-700">
                  Termos &amp; Privacidade
                </Link>

                <button
                  type="button"
                  onClick={() => changeTab("novidades")}
                  className="text-green-900 hover:text-green-700"
                >
                  Novidades
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}