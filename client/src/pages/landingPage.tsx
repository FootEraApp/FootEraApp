// client/src/pages/landingPage.tsx
import React from "react";
import { Link, useLocation } from "wouter";
import { Instagram, Facebook } from "lucide-react";

// ✅ Liga/desliga redes sociais
const SHOW_SOCIALS = true;

// ✅ Ajuste se sua logo estiver em outro caminho
const LOGO_SRC = "/assets/usuarios/footera-logo.png";

type LandingPageProps = {
  showSocials?: boolean;
  logoSrc?: string;
  heroImageSrc?: string | null;
};

export default function LandingPage({
  showSocials = SHOW_SOCIALS,
  logoSrc = LOGO_SRC,
  heroImageSrc = null,
}: LandingPageProps) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#F6F1E7]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_18px_50px_rgba(0,0,0,0.12)] border border-black/5">
          {/* HEADER */}
          <header className="bg-green-900 text-white">
            <div className="flex items-center justify-between px-5 py-4 md:px-8">
              {/* LOGO */}
              <button
                type="button"
                onClick={() => navigate("/")}
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

              {/* MENU DESKTOP */}
              <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold">
                <Link href="/" className="hover:text-green-200 transition">
                  Home
                </Link>

                <Link href="/sobre" className="hover:text-green-200 transition">
                  Sobre
                </Link>

                <Link href="/termos" className="hover:text-green-200 transition">
                  Termos de Uso &amp; Política de Privacidade
                </Link>

                <Link href="/contatos" className="hover:text-green-200 transition">
                  Contatos
                </Link>
              </nav>

              {/* AÇÕES */}
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

            {/* MENU MOBILE/TABLET */}
            <div className="lg:hidden px-5 pb-4 md:px-8">
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/"
                  className="px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-medium"
                >
                  Home
                </Link>

                <Link
                  href="/sobre"
                  className="px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-medium"
                >
                  Sobre
                </Link>

                <Link
                  href="/termos"
                  className="px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-medium"
                >
                  Termos &amp; Privacidade
                </Link>

                <Link
                  href="/contatos"
                  className="px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-medium"
                >
                  Contatos
                </Link>
              </div>
            </div>
          </header>

          {/* HERO */}
          <section className="relative overflow-hidden bg-[#F6F1E7]">
            {/* marca d'água */}
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

            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 items-center px-6 py-12 md:px-10 md:py-16 lg:px-14 lg:py-20">
              {/* TEXTO */}
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

              {/* CARD VISUAL DIREITO */}
              <div className="relative">
                <div className="rounded-3xl bg-green-900 p-4 md:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
                  <div className="rounded-2xl bg-white p-5 md:p-6">
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

                      <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-green-100 items-center justify-center">
                        <img
                          src={logoSrc}
                          alt="FootEra"
                          className="w-8 h-8 object-contain"
                        />
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-[#F6F1E7] p-4 border border-green-100">
                        <div className="text-2xl font-extrabold text-green-900">+ Treinos</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Organize rotinas e acompanhe o progresso.
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#F6F1E7] p-4 border border-green-100">
                        <div className="text-2xl font-extrabold text-green-900">+ Desafios</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Participe, envie vídeos e pontue.
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#F6F1E7] p-4 border border-green-100">
                        <div className="text-2xl font-extrabold text-green-900">+ Perfil</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Mostre evolução, badges e mídia.
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#F6F1E7] p-4 border border-green-100">
                        <div className="text-2xl font-extrabold text-green-900">+ Visibilidade</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Conecte-se com clubes e profissionais.
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl overflow-hidden border border-green-100 bg-[#F6F1E7] min-h-[220px] md:min-h-[260px] flex items-center justify-center">
                      {heroImageSrc ? (
                        <img
                          src={heroImageSrc}
                          alt="Destaque FootEra"
                          className="w-full h-[220px] md:h-[260px] object-cover"
                        />
                      ) : (
                        <div className="text-center px-6 py-10">
                          <img
                            src={logoSrc}
                            alt="FootEra"
                            className="w-20 h-20 object-contain mx-auto opacity-90"
                          />
                          <p className="mt-4 text-green-900 font-semibold">
                            Área para imagem principal
                          </p>
                          <p className="mt-2 text-sm text-gray-600">
                            Você pode colocar uma arte, jogador(a), mockup ou
                            banner da FootEra aqui.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => navigate("/cadastro")}
                        className="flex-1 min-w-[160px] px-5 py-3 rounded-xl bg-green-900 text-white font-semibold hover:bg-green-800 transition"
                      >
                        Começar agora
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate("/sobre")}
                        className="flex-1 min-w-[160px] px-5 py-3 rounded-xl border border-green-900 text-green-900 font-semibold hover:bg-green-50 transition"
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

          {/* RODAPÉ */}
          <footer className="border-t border-gray-200 bg-white px-6 py-5 md:px-10">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-gray-600">
                © {new Date().getFullYear()} FootEra. Todos os direitos reservados.
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <Link href="/" className="text-green-900 hover:text-green-700">
                  Home
                </Link>
                <Link href="/sobre" className="text-green-900 hover:text-green-700">
                  Sobre
                </Link>
                <Link href="/termos" className="text-green-900 hover:text-green-700">
                  Termos &amp; Privacidade
                </Link>
                <Link href="/contatos" className="text-green-900 hover:text-green-700">
                  Contatos
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}