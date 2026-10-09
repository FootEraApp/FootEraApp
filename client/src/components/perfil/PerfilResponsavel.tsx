import {
  useEffect,
  useState,
} from "react";
import {
  Switch,
} from "../ui/switch.js";
import {
  useLocation,
} from "wouter";
import {
  UserRound,
  ShieldCheck,
  Loader2,
  Pencil,
  MapPin,
  ChevronUp,
  Trash2,
  FileText,
  KeyRound,
  LogOut,
  Link2Off,
  RotateCcw,
  Settings
} from "lucide-react";
import Storage from "../../utils/storage.js";
import {
  API,
} from "../../config.js";

type PerfilResponsavelBasico = {
  id: string;
  nome: string;
  nomeDeUsuario: string;
  foto?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

type AtletaResponsavel = {
  id: string;

  atletaId:
    string;

  status:
    "PENDENTE" |
    "ATIVO" |
    "REVOGADO";

  origemSolicitacao?:
    | "ATLETA"
    | "RESPONSAVEL"
    | "CADASTRO_MENOR"
    | null;

  principal:
    boolean;

  podeEditarPerfil:
    boolean;

    podeGerenciarPrivacidade:
    boolean;

    podeGerenciarTreinos:
    boolean;

    podeGerenciarConteudo:
    boolean;

  parentesco?:
    string | null;

  atleta: {
    id: string;
    usuarioId: string;
    nome: string;
    nomeDeUsuario:
      string;
    foto?:
      string | null;
    idade?:
      number | null;
    deletedAt?:
      string | null;

    deleteScheduledAt?:
      string | null;

    googleLinked?:
      boolean;

    localLoginEnabled?:
      boolean;
  };
};

type SolicitacaoNovoResponsavel = {
  id: string;

  atletaId:
    string;

  criadoEm:
    string;

  responsavelSolicitante: {
    id: string;

    nome:
      string;

    nomeDeUsuario?:
      string | null;

    foto?:
      string | null;
  };

  atleta: {
    id: string;

    usuarioId:
      string;

    nome:
      string;

    nomeDeUsuario?:
      string | null;

    foto?:
      string | null;
  };
};

type ResponsavelSecundario = {
  id: string;

  atletaId: string;

  responsavelUsuarioId: string;

  parentesco?: string | null;

  podeEditarPerfil: boolean;

  podeGerenciarPrivacidade: boolean;

  podeGerenciarTreinos: boolean;

  podeGerenciarConteudo: boolean;

  responsavel: {
    id: string;

    nome: string;

    nomeDeUsuario?: string | null;

    foto?: string | null;
  };
};

type SupervisaoAtleta = {
  aberto: boolean;
  carregado: boolean;
  carregando: boolean;
  salvando: boolean;

  permitirPerfilPublico:
    boolean;

  permitirMensagensDiretas:
    boolean;

  permitirMostrarEmail:
    boolean;
};

type PostagemAtletaGerenciado = {
  id: string;

  conteudo:
    string | null;

  imagemUrl?:
    string | null;

  videoUrl?:
    string | null;

  dataCriacao:
    string;

  visibilidade?:
    string | null;

  repostOfId?:
    string | null;

  compartilhamentos:
    number;

  reposts:
    number;

  curtidas:
    number;

  comentarios:
    number;
};

type AtividadeAtleta = {
  aberto: boolean;
  carregado: boolean;
  carregando: boolean;

  items:
    PostagemAtletaGerenciado[];
};

export default function PerfilResponsavel() {
  const [, navigate] =
    useLocation();

  const [items, setItems] =
    useState<
      AtletaResponsavel[]
    >([]);

  const [loading, setLoading] =
    useState(true);

  const [
    ativandoId,
    setAtivandoId,
  ] =
    useState<
      string | null
    >(null);

  const [
    recusandoId,
    setRecusandoId,
  ] =
    useState<
        string | null
    >(null);

  const [
    solicitacoesNovosResponsaveis,
    setSolicitacoesNovosResponsaveis,
    ] =
    useState<
        SolicitacaoNovoResponsavel[]
    >([]);

    const [
    processandoNovoResponsavelId,
    setProcessandoNovoResponsavelId,
    ] =
    useState<
        string | null
    >(null);

  const [
    supervisoes,
    setSupervisoes,
  ] =
    useState<
        Record<
        string,
        SupervisaoAtleta
        >
    >({});

const [
  atividades,
  setAtividades,
] =
  useState<
    Record<
      string,
      AtividadeAtleta
    >
  >({});

  const [
    apagandoPostId,
    setApagandoPostId,
    ] =
    useState<
        string | null
    >(null);

  const [
    perfil,
    setPerfil,
  ] =
    useState<PerfilResponsavelBasico | null>(
        null
   );

   const [
    excluindoAtletaId,
    setExcluindoAtletaId,
   ] =
    useState<
        string | null
    >(null);

  const [
    salvandoPermissoesAtletaId,
    setSalvandoPermissoesAtletaId,
  ] =
    useState<
      string | null
    >(null);

  const [
    responsaveisSecundarios,
    setResponsaveisSecundarios,
  ] =
    useState<
      Record<
        string,
        ResponsavelSecundario[]
      >
    >({});

  const [
    carregandoResponsaveisAtletaId,
    setCarregandoResponsaveisAtletaId,
  ] =
    useState<
      string | null
    >(null);

  const [removendoSecundarioId, setRemovendoSecundarioId] = useState<string | null>(null);

  const [
    salvandoPermissaoVinculoId,
    setSalvandoPermissaoVinculoId,
  ] =
    useState<
      string | null
    >(null);
    
  const [
    desvinculandoAtletaId,
    setDesvinculandoAtletaId,
  ] =
    useState<
      string | null
    >(null);

  const [
    acaoSeguranca,
    setAcaoSeguranca,
  ] =
    useState<
      string | null
    >(null);
  const token =
    Storage.token;

  function atualizarSupervisaoLocal(
    atletaId: string,
    patch:
        Partial<SupervisaoAtleta>
    ) {
    setSupervisoes(
        (atual) => ({
        ...atual,

        [atletaId]: {
            aberto:
            atual[atletaId]
                ?.aberto ??
            false,

            carregado:
            atual[atletaId]
                ?.carregado ??
            false,

            carregando:
            atual[atletaId]
                ?.carregando ??
            false,

            salvando:
            atual[atletaId]
                ?.salvando ??
            false,

            permitirPerfilPublico:
            atual[atletaId]
                ?.permitirPerfilPublico ??
            false,

            permitirMensagensDiretas:
            atual[atletaId]
                ?.permitirMensagensDiretas ??
            false,

            permitirMostrarEmail:
            atual[atletaId]
                ?.permitirMostrarEmail ??
            false,

            ...patch,
        },
        })
    );
    }

    function atualizarAtividadeLocal(
    atletaId: string,
    patch:
        Partial<AtividadeAtleta>
    ) {
    setAtividades(
        (atual) => ({
        ...atual,

        [atletaId]: {
            aberto:
            atual[atletaId]
                ?.aberto ??
            false,

            carregado:
            atual[atletaId]
                ?.carregado ??
            false,

            carregando:
            atual[atletaId]
                ?.carregando ??
            false,

            items:
            atual[atletaId]
                ?.items ??
            [],

            ...patch,
        },
        })
    );
    }

  async function carregar() {
    if (!token) {
      return;
    }

    try {
      setLoading(true);

      const [
        respostaPerfil,
        resposta,
        respostaSolicitacoes,
        ] =
        await Promise.all([
            fetch(
            `${API.BASE_URL}/api/responsaveis/me`,
            {
                headers: {
                Authorization:
                    `Bearer ${token}`,
                },
            }
            ),

            fetch(
            `${API.BASE_URL}/api/responsaveis/me/atletas`,
            {
                headers: {
                Authorization:
                    `Bearer ${token}`,
                },
            }
            ),

            fetch(
            `${API.BASE_URL}/api/responsaveis/me/solicitacoes-responsaveis`,
            {
                headers: {
                Authorization:
                    `Bearer ${token}`,
                },
            }
            ),
        ]);

      const data =
        await resposta.json();

      const dataPerfil =
        await respostaPerfil
            .json()
            .catch(() => null);

      const dataSolicitacoes =
        await respostaSolicitacoes
            .json()
            .catch(() => ({
            items: [],
            }));

        if (
        respostaPerfil.ok &&
        dataPerfil?.usuario
        ) {
        setPerfil(
            dataPerfil.usuario
        );
        }

      if (!resposta.ok) {
        throw new Error(
          data?.message ||
          "Erro ao carregar atletas."
        );
      }

      setItems(
        Array.isArray(
          data?.items
        )
          ? data.items
          : []
      );

      setSolicitacoesNovosResponsaveis(
        respostaSolicitacoes.ok &&
        Array.isArray(
            dataSolicitacoes?.items
        )
            ? dataSolicitacoes.items
            : []
        );
    } catch (error) {
      console.error(
        "[PerfilResponsavel] erro:",
        error
      );

      setItems([]);
      setSolicitacoesNovosResponsaveis(
        []
        );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [token]);


  useEffect(() => {
    if (!token) {
      return;
    }

    const atletasPrincipais =
      items.filter(
        (item) =>
          item.status ===
            "ATIVO" &&
          item.principal ===
            true
      );

    for (
      const item of
      atletasPrincipais
    ) {
      if (
        responsaveisSecundarios[
          item.atletaId
        ] !== undefined
      ) {
        continue;
      }

      void carregarResponsaveisSecundarios(
        item.atletaId
      );
    }
  }, [
    token,
    items,
  ]);

  async function carregarSupervisao(
    atletaId: string
    ) {
    if (!token) {
        return;
    }

    atualizarSupervisaoLocal(
        atletaId,
        {
        carregando:
            true,
        }
    );

    try {
        const resposta =
        await fetch(
            `${API.BASE_URL}/api/configuracoes-perfil/privacidade/atletas/${encodeURIComponent(
            atletaId
            )}`,
            {
            headers: {
                Authorization:
                `Bearer ${token}`,
            },
            }
        );

        const data =
        await resposta
            .json()
            .catch(() => ({}));

        if (!resposta.ok) {
        throw new Error(
            data?.message ||
            "Não foi possível carregar a supervisão."
        );
        }

        atualizarSupervisaoLocal(
        atletaId,
        {
            carregado:
            true,

            carregando:
            false,

            permitirPerfilPublico:
            Boolean(
                data
                ?.supervisao
                ?.permitirPerfilPublico
            ),

            permitirMensagensDiretas:
            Boolean(
                data
                ?.supervisao
                ?.permitirMensagensDiretas
            ),

            permitirMostrarEmail:
            Boolean(
                data
                ?.supervisao
                ?.permitirMostrarEmail
            ),
        }
        );
    } catch (error: any) {
        atualizarSupervisaoLocal(
        atletaId,
        {
            carregando:
            false,
        }
        );

        alert(
        error?.message ||
        "Não foi possível carregar a supervisão."
        );
    }
    }

    async function salvarSupervisao(
    atletaId: string,
    patch: {
        permitirPerfilPublico?:
        boolean;

        permitirMensagensDiretas?:
        boolean;

        permitirMostrarEmail?:
        boolean;
    }
    ) {
    if (!token) {
        return;
    }

    const anterior =
        supervisoes[
        atletaId
        ];

    atualizarSupervisaoLocal(
        atletaId,
        {
        ...patch,

        salvando:
            true,
        }
    );

    try {
        const resposta =
        await fetch(
            `${API.BASE_URL}/api/configuracoes-perfil/privacidade/atletas/${encodeURIComponent(
            atletaId
            )}`,
            {
            method:
                "PATCH",

            headers: {
                "Content-Type":
                "application/json",

                Authorization:
                `Bearer ${token}`,
            },

            body:
                JSON.stringify(
                patch
                ),
            }
        );

        const data =
        await resposta
            .json()
            .catch(() => ({}));

        if (!resposta.ok) {
        throw new Error(
            data?.message ||
            "Não foi possível alterar a supervisão."
        );
        }

        atualizarSupervisaoLocal(
        atletaId,
        {
            salvando:
            false,

            carregado:
            true,

            permitirPerfilPublico:
            Boolean(
                data
                ?.supervisao
                ?.permitirPerfilPublico
            ),

            permitirMensagensDiretas:
            Boolean(
                data
                ?.supervisao
                ?.permitirMensagensDiretas
            ),

            permitirMostrarEmail:
            Boolean(
                data
                ?.supervisao
                ?.permitirMostrarEmail
            ),
        }
        );
    } catch (error: any) {
        /*
        * Volta ao estado anterior
        * caso o backend rejeite.
        */
        if (anterior) {
        atualizarSupervisaoLocal(
            atletaId,
            {
            permitirPerfilPublico:
                anterior
                .permitirPerfilPublico,

            permitirMensagensDiretas:
                anterior
                .permitirMensagensDiretas,

            permitirMostrarEmail:
                anterior
                .permitirMostrarEmail,

            salvando:
                false,
            }
        );
        }

        alert(
        error?.message ||
        "Não foi possível alterar a supervisão."
        );
    }
    }

    async function alternarSupervisao(
    atletaId: string
    ) {
    const atual =
        supervisoes[
        atletaId
        ];

    if (
        atual?.aberto
    ) {
        atualizarSupervisaoLocal(
        atletaId,
        {
            aberto:
            false,
        }
        );

        return;
    }

    atualizarSupervisaoLocal(
        atletaId,
        {
        aberto:
            true,
        }
    );

    if (
        !atual?.carregado
    ) {
        await carregarSupervisao(
        atletaId
        );
    }
    }

    async function carregarAtividade(
    atletaId: string
    ) {
    if (!token) {
        return;
    }

    atualizarAtividadeLocal(
        atletaId,
        {
        carregando:
            true,
        }
    );

    try {
        const resposta =
        await fetch(
            `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
            atletaId
            )}/postagens`,
            {
            headers: {
                Authorization:
                `Bearer ${token}`,
            },
            }
        );

        const data =
        await resposta
            .json()
            .catch(() => ({}));

        if (!resposta.ok) {
        throw new Error(
            data?.message ||
            "Não foi possível carregar a atividade."
        );
        }

        atualizarAtividadeLocal(
        atletaId,
        {
            carregado:
            true,

            carregando:
            false,

            items:
            Array.isArray(
                data?.items
            )
                ? data.items
                : [],
        }
        );
    } catch (
        error: any
    ) {
        console.error(
        "[PerfilResponsavel] atividade:",
        error
        );

        atualizarAtividadeLocal(
        atletaId,
        {
            carregando:
            false,
        }
        );

        alert(
        error?.message ||
        "Não foi possível carregar a atividade do atleta."
        );
    }
    }

    async function alternarAtividade(
    atletaId: string
    ) {
    const atual =
        atividades[
        atletaId
        ];

    if (
        atual?.aberto
    ) {
        atualizarAtividadeLocal(
        atletaId,
        {
            aberto:
            false,
        }
        );

        return;
    }

    atualizarAtividadeLocal(
        atletaId,
        {
        aberto:
            true,
        }
    );

    if (
        !atual?.carregado
    ) {
        await carregarAtividade(
        atletaId
        );
    }
    }

async function removerPostagemAtleta(
  atletaId: string,
  postId: string
) {
  if (!token) {
    return;
  }

  const confirmar =
    window.confirm(
      "Tem certeza que deseja remover esta postagem do atleta supervisionado?"
    );

  if (!confirmar) {
    return;
  }

  try {
    setApagandoPostId(
      postId
    );

    const resposta =
      await fetch(
        `${API.BASE_URL}/api/feed/posts/${encodeURIComponent(
          postId
        )}`,
        {
          method:
            "DELETE",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    const data =
      await resposta
        .json()
        .catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        data?.mensagem ||
        data?.message ||
        "Não foi possível remover a postagem."
      );
    }

    setAtividades(
      (atual) => {
        const atividade =
          atual[
            atletaId
          ];

        if (!atividade) {
          return atual;
        }

        return {
          ...atual,

          [atletaId]: {
            ...atividade,

            items:
              atividade
                .items
                .filter(
                  (post) =>
                    post.id !==
                    postId
                ),
          },
        };
      }
    );
  } catch (
    error: any
  ) {
    alert(
      error?.message ||
      "Não foi possível remover a postagem."
    );
  } finally {
    setApagandoPostId(
      null
    );
  }
}

async function excluirContaAtleta(
  item: AtletaResponsavel
) {
  if (!token) {
    return;
  }

  if (
    !item.principal
  ) {
    alert(
      "Somente o responsável principal pode excluir esta conta."
    );

    return;
  }

  const username =
    String(
      item.atleta
        .nomeDeUsuario ??
      ""
    ).trim();

  if (!username) {
    alert(
      "Este atleta não possui nome de usuário válido."
    );

    return;
  }

  const confirmacao =
    window.prompt(
      `Esta ação moverá a conta de ${item.atleta.nome} para a lixeira por 30 dias.\n\nDigite exatamente "${username}" para confirmar.`
    );

  if (
    confirmacao ===
    null
  ) {
    return;
  }

  if (
    confirmacao.trim() !==
    username
  ) {
    alert(
      `Digite exatamente "${username}".`
    );

    return;
  }

  try {
    setExcluindoAtletaId(
      item.atletaId
    );

    const resposta =
      await fetch(
        `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
          item.atletaId
        )}/conta`,
        {
          method:
            "DELETE",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body:
            JSON.stringify({
              confirm:
                username,
            }),
        }
      );

    const data =
      await resposta
        .json()
        .catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        data?.message ||
        "Não foi possível excluir a conta."
      );
    }

    alert(
      data?.message ||
      "Conta movida para a lixeira por 30 dias."
    );

    await carregar();
  } catch (
    error: any
  ) {
    alert(
      error?.message ||
      "Não foi possível excluir a conta."
    );
  } finally {
    setExcluindoAtletaId(
      null
    );
  }
}

async function carregarResponsaveisSecundarios(
  atletaId: string
) {
  if (!token) {
    return;
  }

  try {
    setCarregandoResponsaveisAtletaId(
      atletaId
    );

    const resposta =
      await fetch(
        `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
          atletaId
        )}/responsaveis`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    const data =
      await resposta
        .json()
        .catch(() => ({
          items: [],
        }));

    if (!resposta.ok) {
      throw new Error(
        data?.message ||
        "Não foi possível carregar os responsáveis."
      );
    }

    setResponsaveisSecundarios(
      (atual) => ({
        ...atual,

        [atletaId]:
          Array.isArray(
            data?.items
          )
            ? data.items
            : [],
      })
    );
  } catch (
    error: any
  ) {
    console.error(
      "[PerfilResponsavel] responsáveis secundários:",
      error
    );

    alert(
      error?.message ||
      "Não foi possível carregar os responsáveis."
    );
  } finally {
    setCarregandoResponsaveisAtletaId(
      null
    );
  }
}

async function removerResponsavelSecundario(
  atletaId: string,
  responsavel: ResponsavelSecundario
) {
  if (!token || removendoSecundarioId) return;
  const nome = responsavel.responsavel.nome || responsavel.responsavel.nomeDeUsuario || "este responsável";
  if (!window.confirm(`Deseja encerrar o vínculo de ${nome} com este atleta?`)) return;
  try {
    setRemovendoSecundarioId(responsavel.id);
    const resposta = await fetch(
      `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(atletaId)}/responsaveis/${encodeURIComponent(responsavel.id)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(data?.message || "Não foi possível desvincular.");
    setResponsaveisSecundarios(atual => ({
      ...atual,
      [atletaId]: (atual[atletaId] ?? []).filter(v => v.id !== responsavel.id),
    }));
  } catch (error: any) {
    window.alert(error?.message || "Não foi possível desvincular.");
  } finally {
    setRemovendoSecundarioId(null);
  }
}

async function atualizarPermissaoResponsavelSecundario(
  atletaId: string,
  responsavel: ResponsavelSecundario,
  campo:
    | "podeEditarPerfil"
    | "podeGerenciarPrivacidade"
    | "podeGerenciarTreinos"
    | "podeGerenciarConteudo",
  valor: boolean
) {
  if (!token) {
    return;
  }

  const anterior =
    responsavel[campo];

  setResponsaveisSecundarios(
    (atual) => ({
      ...atual,

      [atletaId]:
        (
          atual[atletaId] ??
          []
        ).map(
          (item) =>
            item.id ===
            responsavel.id
              ? {
                  ...item,
                  [campo]:
                    valor,
                }
              : item
        ),
    })
  );

  try {
    setSalvandoPermissaoVinculoId(
      responsavel.id
    );

    const resposta =
      await fetch(
        `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
          atletaId
        )}/responsaveis/${encodeURIComponent(
          responsavel.id
        )}/permissoes`,
        {
          method:
            "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body:
            JSON.stringify({
              [campo]:
                valor,
            }),
        }
      );

    const data =
      await resposta
        .json()
        .catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        data?.message ||
        "Não foi possível alterar a permissão."
      );
    }

    const permissoes =
      data?.permissoes;

    if (permissoes) {
      setResponsaveisSecundarios(
        (atual) => ({
          ...atual,

          [atletaId]:
            (
              atual[atletaId] ??
              []
            ).map(
              (item) =>
                item.id ===
                responsavel.id
                  ? {
                      ...item,

                      podeEditarPerfil:
                        Boolean(
                          permissoes
                            .podeEditarPerfil
                        ),

                      podeGerenciarPrivacidade:
                        Boolean(
                          permissoes
                            .podeGerenciarPrivacidade
                        ),

                      podeGerenciarTreinos:
                        Boolean(
                          permissoes
                            .podeGerenciarTreinos
                        ),

                      podeGerenciarConteudo:
                        Boolean(
                          permissoes
                            .podeGerenciarConteudo
                        ),
                    }
                  : item
            ),
        })
      );
    }
  } catch (
    error: any
  ) {
    setResponsaveisSecundarios(
      (atual) => ({
        ...atual,

        [atletaId]:
          (
            atual[atletaId] ??
            []
          ).map(
            (item) =>
              item.id ===
              responsavel.id
                ? {
                    ...item,
                    [campo]:
                      anterior,
                  }
                : item
          ),
      })
    );

    alert(
      error?.message ||
      "Não foi possível alterar a permissão."
    );
  } finally {
    setSalvandoPermissaoVinculoId(
      null
    );
  }
}

async function desvincularDoAtleta(
  item: AtletaResponsavel
) {
  if (!token) {
    return;
  }

  if (
    item.status !==
    "ATIVO"
  ) {
    return;
  }

  const confirmar =
    window.confirm(
      `Deseja remover seu vínculo com ${item.atleta.nome}?`
    );

  if (!confirmar) {
    return;
  }

  try {
    setDesvinculandoAtletaId(
      item.atletaId
    );

    let resposta =
      await fetch(
        `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
          item.atletaId
        )}/vinculo`,
        {
          method:
            "DELETE",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    let data =
      await resposta
        .json()
        .catch(
          () => ({})
        );

    /*
     * Se este usuário é o principal
     * e existem 2 ou mais outros
     * responsáveis ativos, o backend
     * exige que ele escolha o sucessor.
     */
    if (
      resposta.status ===
        409 &&
      data?.code ===
        "NEW_PRIMARY_GUARDIAN_REQUIRED"
    ) {
      const opcoes =
        Array.isArray(
          data?.opcoes
        )
          ? data.opcoes
          : [];

      if (
        opcoes.length ===
        0
      ) {
        throw new Error(
          data?.message ||
          "Não foi possível escolher um novo responsável principal."
        );
      }

      const texto =
        opcoes
          .map(
            (
              opcao: any,
              indice: number
            ) => {
              const nome =
                opcao
                  ?.responsavel
                  ?.nome ??
                opcao
                  ?.responsavel
                  ?.nomeDeUsuario ??
                "Responsável";

              return `${indice + 1} - ${nome}`;
            }
          )
          .join(
            "\n"
          );

      const escolha =
        window.prompt(
          `Antes de remover seu vínculo, escolha quem será o novo responsável principal:\n\n${texto}\n\nDigite o número da opção.`
        );

      if (
        escolha ===
        null
      ) {
        return;
      }

      const indice =
        Number(
          escolha
        ) - 1;

      const escolhido =
        opcoes[
          indice
        ];

      if (!escolhido) {
        window.alert(
          "Opção inválida."
        );

        return;
      }

      const confirmarTransferencia =
        window.confirm(
          `Deseja definir ${
            escolhido
              ?.responsavel
              ?.nome ??
            escolhido
              ?.responsavel
              ?.nomeDeUsuario ??
            "este responsável"
          } como novo responsável principal e remover seu vínculo?`
        );

      if (
        !confirmarTransferencia
      ) {
        return;
      }

      resposta =
        await fetch(
          `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
            item.atletaId
          )}/vinculo`,
          {
            method:
              "DELETE",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                novoPrincipalVinculoId:
                  escolhido.id,
              }),
          }
        );

      data =
        await resposta
          .json()
          .catch(
            () => ({})
          );
    }

    if (!resposta.ok) {
      throw new Error(
        data?.message ||
        "Não foi possível remover o vínculo."
      );
    }

    /*
     * Remove imediatamente da tela.
     */
    setItems(
      (atuais) =>
        atuais.filter(
          (atual) =>
            atual.atletaId !==
            item.atletaId
        )
    );

    /*
     * Limpa caches locais daquele
     * atleta para não deixar informações
     * supervisionadas na tela.
     */
    setResponsaveisSecundarios(
      (atual) => {
        const proximo = {
          ...atual,
        };

        delete proximo[
          item.atletaId
        ];

        return proximo;
      }
    );

    setSupervisoes(
      (atual) => {
        const proximo = {
          ...atual,
        };

        delete proximo[
          item.atletaId
        ];

        return proximo;
      }
    );

    setAtividades(
      (atual) => {
        const proximo = {
          ...atual,
        };

        delete proximo[
          item.atletaId
        ];

        return proximo;
      }
    );

    window.alert(
      data?.message ||
      "Vínculo removido com sucesso."
    );
  } catch (
    error: any
  ) {
    window.alert(
      error?.message ||
      "Não foi possível remover o vínculo."
    );
  } finally {
    setDesvinculandoAtletaId(
      null
    );
  }
}

  async function redefinirSenhaAtleta(
    item: AtletaResponsavel
  ) {
    if (
      !token ||
      !item.principal
    ) {
      return;
    }

    const senhaNova =
      window.prompt(
        `Digite a nova senha de ${item.atleta.nome}.\n\nA senha deve ter pelo menos 8 caracteres.`
      );

    if (senhaNova === null) {
      return;
    }

    if (
      senhaNova.length < 8
    ) {
      alert(
        "A senha deve ter pelo menos 8 caracteres."
      );

      return;
    }

    const repetir =
      window.prompt(
        "Digite novamente a nova senha."
      );

    if (
      repetir !== senhaNova
    ) {
      alert(
        "As senhas não conferem."
      );

      return;
    }

    const username =
      String(
        item.atleta
          .nomeDeUsuario ??
        ""
      ).trim();

    const confirmacao =
      window.prompt(
        `Para confirmar, digite exatamente "${username}".`
      );

    if (
      confirmacao === null
    ) {
      return;
    }

    try {
      setAcaoSeguranca(
        `${item.atletaId}:senha`
      );

      const resposta =
        await fetch(
          `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
            item.atletaId
          )}/seguranca/senha`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                senhaNova,

                confirm:
                  confirmacao.trim(),
              }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          data?.message ||
          "Não foi possível redefinir a senha."
        );
      }

      alert(
        data?.message ||
        "Senha redefinida com sucesso."
      );
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
        "Não foi possível redefinir a senha."
      );
    } finally {
      setAcaoSeguranca(
        null
      );
    }
  }

  async function encerrarSessoesAtleta(
    item: AtletaResponsavel
  ) {
    if (
      !token ||
      !item.principal
    ) {
      return;
    }

    const confirmar =
      window.confirm(
        `Deseja encerrar todas as sessões de ${item.atleta.nome}?`
      );

    if (!confirmar) {
      return;
    }

    try {
      setAcaoSeguranca(
        `${item.atletaId}:sessoes`
      );

      const resposta =
        await fetch(
          `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
            item.atletaId
          )}/seguranca/encerrar-sessoes`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          data?.message ||
          "Não foi possível encerrar as sessões."
        );
      }

      alert(
        data?.message ||
        "Sessões encerradas."
      );
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
        "Não foi possível encerrar as sessões."
      );
    } finally {
      setAcaoSeguranca(
        null
      );
    }
  }

async function desvincularGoogleAtleta(
  item: AtletaResponsavel
) {
  if (
    !token ||
    !item.principal
  ) {
    return;
  }

  if (
    !item.atleta
      .localLoginEnabled
  ) {
    alert(
      "Antes de remover o Google, defina uma senha FootEra para este atleta."
    );

    return;
  }

  const username =
    String(
      item.atleta
        .nomeDeUsuario ??
      ""
    ).trim();

  const confirmacao =
    window.prompt(
      `Esta ação removerá o login Google de ${item.atleta.nome}.\n\nDigite exatamente "${username}" para confirmar.`
    );

  if (
    confirmacao === null
  ) {
    return;
  }

  try {
    setAcaoSeguranca(
      `${item.atletaId}:google`
    );

    const resposta =
      await fetch(
        `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
          item.atletaId
        )}/seguranca/google`,
        {
          method:
            "DELETE",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body:
            JSON.stringify({
              confirm:
                confirmacao.trim(),
            }),
        }
      );

    const data =
      await resposta
        .json()
        .catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        data?.message ||
        "Não foi possível desvincular o Google."
      );
    }

    alert(
      data?.message ||
      "Google desvinculado."
    );

    await carregar();
  } catch (
    error: any
  ) {
    alert(
      error?.message ||
      "Não foi possível desvincular o Google."
    );
  } finally {
    setAcaoSeguranca(
      null
    );
  }
}

async function restaurarContaAtleta(
  item: AtletaResponsavel
) {
  if (
    !token ||
    !item.principal
  ) {
    return;
  }

  const username =
    String(
      item.atleta
        .nomeDeUsuario ??
      ""
    ).trim();

  const confirmacao =
    window.prompt(
      `Deseja restaurar a conta de ${item.atleta.nome}?\n\nDigite exatamente "${username}" para confirmar.`
    );

  if (
    confirmacao === null
  ) {
    return;
  }

  try {
    setAcaoSeguranca(
      `${item.atletaId}:restaurar`
    );

    const resposta =
      await fetch(
        `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
          item.atletaId
        )}/conta/restaurar`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body:
            JSON.stringify({
              confirm:
                confirmacao.trim(),
            }),
        }
      );

    const data =
      await resposta
        .json()
        .catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        data?.message ||
        "Não foi possível restaurar a conta."
      );
    }

    alert(
      data?.message ||
      "Conta restaurada."
    );

    await carregar();
  } catch (
    error: any
  ) {
    alert(
      error?.message ||
      "Não foi possível restaurar a conta."
    );
  } finally {
    setAcaoSeguranca(
      null
    );
  }
}

  async function ativar(
    atletaId: string
  ) {
    if (!token) {
      return;
    }

    try {
      setAtivandoId(
        atletaId
      );

      const resposta =
        await fetch(
          `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
            atletaId
          )}/ativar`,
          {
            method:
              "PATCH",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          data?.message ||
            "Não foi possível aceitar a solicitação."
        );
      }

      await carregar();
    } catch (error: any) {
      alert(
        error?.message ||
        "Não foi possível aceitar a solicitação."
      );
    } finally {
      setAtivandoId(
        null
      );
    }
  }

  async function recusar(
    atletaId: string,
    nomeAtleta: string
    ) {
    if (!token) {
        return;
    }

    const confirmar =
        window.confirm(
        `Deseja recusar a solicitação de vínculo de ${nomeAtleta}?`
        );

    if (!confirmar) {
        return;
    }

    try {
        setRecusandoId(
        atletaId
        );

        const resposta =
        await fetch(
            `${API.BASE_URL}/api/responsaveis/me/atletas/${encodeURIComponent(
            atletaId
            )}/recusar`,
            {
            method:
                "PATCH",

            headers: {
                Authorization:
                `Bearer ${token}`,
            },
            }
        );

        const data =
        await resposta
            .json()
            .catch(() => ({}));

        if (!resposta.ok) {
        throw new Error(
            data?.message ||
            "Não foi possível recusar a solicitação."
        );
        }

        await carregar();
    } catch (
        error: any
    ) {
        alert(
        error?.message ||
        "Não foi possível recusar a solicitação."
        );
    } finally {
        setRecusandoId(
        null
        );
    }
    }

  async function responderNovoResponsavel(
    vinculoId: string,
    acao:
        | "aceitar"
        | "recusar"
    ) {
    if (!token) {
        return;
    }

    const verbo =
        acao === "aceitar"
        ? "aceitar"
        : "recusar";

    const confirmar =
        window.confirm(
        `Deseja ${verbo} esta solicitação de novo responsável?`
        );

    if (!confirmar) {
        return;
    }

    try {
        setProcessandoNovoResponsavelId(
        vinculoId
        );

        const resposta =
        await fetch(
            `${API.BASE_URL}/api/responsaveis/me/solicitacoes-responsaveis/${encodeURIComponent(
            vinculoId
            )}/${acao}`,
            {
            method:
                "PATCH",

            headers: {
                Authorization:
                `Bearer ${token}`,
            },
            }
        );

        const data =
        await resposta
            .json()
            .catch(() => ({}));

        if (!resposta.ok) {
        throw new Error(
            data?.message ||
            `Não foi possível ${verbo} a solicitação.`
        );
        }

        setSolicitacoesNovosResponsaveis(
        (atual) =>
            atual.filter(
            (item) =>
                item.id !==
                vinculoId
            )
        );

        alert(
        acao === "aceitar"
            ? "Novo responsável aprovado."
            : "Solicitação recusada."
        );
    } catch (
        error: any
    ) {
        alert(
        error?.message ||
        `Não foi possível ${verbo} a solicitação.`
        );
    } finally {
        setProcessandoNovoResponsavelId(
        null
        );
    }
    }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4">
      <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
            <img
            src={
                perfil?.foto ||
                "/assets/usuarios/default-user.png"
            }
            alt={
                perfil?.nome ||
                "Responsável"
            }
            className="h-16 w-16 rounded-full border object-cover"
            />

            <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold text-green-950">
                {perfil?.nome ||
                    "Responsável"}
                </h1>

                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                Responsável
                </span>
            </div>

            {perfil?.nomeDeUsuario && (
                <p className="mt-1 text-sm text-gray-500">
                @{perfil.nomeDeUsuario}
                </p>
            )}

            {(perfil?.cidade ||
                perfil?.estado) && (
                <div className="mt-2 flex items-center gap-1 text-sm text-gray-600">
                <MapPin size={14} />

                <span>
                    {[
                    perfil?.cidade,
                    perfil?.estado,
                    ]
                    .filter(Boolean)
                    .join(" - ")}
                </span>
                </div>
            )}
            </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              navigate(
                "/perfil/editar"
              )
            }
            className="flex items-center justify-center gap-2 rounded-xl border border-green-700 px-4 py-2.5 text-sm font-semibold text-green-800"
          >
            <Pencil
              size={16}
            />

            Editar perfil
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/configuracoes"
              )
            }
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
          >
            <Settings
              size={16}
            />

            Configurações
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-gray-500">
            No editar perfil você também pode adicionar ou ativar outros papéis da sua conta.
        </p>
        </section>

      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-950">
              Meus atletas
            </h2>

            <p className="text-sm text-gray-500">
            Atletas vinculados e solicitações aguardando sua confirmação.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-green-700">
            <Loader2
              className="animate-spin"
              size={22}
            />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-gray-50 px-4 py-6 text-center">
            <UserRound
              className="mx-auto mb-2 text-gray-400"
              size={30}
            />

            <p className="font-semibold text-gray-700">
              Nenhum atleta vinculado
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Na próxima etapa você poderá criar ou vincular o perfil da criança.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(
              (item) => {
                const ativo =
                  item.status ===
                  "ATIVO";

                return (
                  <div
                    key={
                      item.id
                    }
                    className="rounded-xl border border-gray-200 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          item.atleta
                            .foto ||
                          "/assets/usuarios/default-user.png"
                        }
                        alt={
                          item.atleta
                            .nome
                        }
                        className="h-11 w-11 rounded-full object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-950">
                          {
                            item.atleta
                              .nome
                          }
                        </p>

                        <p className="text-xs text-gray-500">
                          {typeof item
                            .atleta
                            .idade ===
                          "number"
                            ? `${item.atleta.idade} anos`
                            : "Idade não informada"}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className={
                            ativo
                              ? "rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700"
                              : "rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"
                          }
                        >
                          {ativo
                            ? item.principal
                              ? "Principal"
                              : "Ativo"
                            : "Pendente"}
                        </span>

                        {ativo && (
                          <button
                            type="button"
                            disabled={
                              desvinculandoAtletaId ===
                              item.atletaId
                            }
                            onClick={() =>
                              void desvincularDoAtleta(
                                item
                              )
                            }
                            className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {desvinculandoAtletaId ===
                            item.atletaId ? (
                              <>
                                <Loader2
                                  size={13}
                                  className="animate-spin"
                                />

                                Removendo...
                              </>
                            ) : (
                              <>
                                <Link2Off
                                  size={13}
                                />

                                Desvincular
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {!ativo && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-sm font-semibold text-amber-900">
                        Solicitação de vínculo
                        </p>

                        <p className="mt-1 text-xs leading-relaxed text-amber-800">
                        Este atleta solicitou que você seja responsável pelo perfil dele.
                        Aceite somente se você realmente for responsável por esta criança.
                        </p>
                    </div>
                    )}

                    <div
                      className={`mt-3 grid grid-cols-1 gap-2 ${
                        ativo
                          ? "sm:grid-cols-2"
                          : "sm:grid-cols-2"
                      }`}
                    >
                    {ativo ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/perfil/${encodeURIComponent(
                                item.atleta
                                  .usuarioId
                              )}?papel=Atleta`
                            )
                          }
                          className="flex-1 rounded-xl bg-green-700 px-3 py-2.5 text-sm font-semibold text-white"
                        >
                          Ver perfil
                        </button>

                        {(
                          item.principal ||
                          item.podeGerenciarConteudo
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              alternarAtividade(
                                item.atletaId
                              )
                            }
                            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-green-700 px-3 py-2.5 text-sm font-semibold text-green-800"
                          >
                            <FileText
                              size={15}
                            />

                            Atividade
                          </button>
                        )}

                        {(
                          item.principal ||
                          item.podeGerenciarPrivacidade
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              alternarSupervisao(
                                item.atletaId
                              )
                            }
                            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-green-700 px-3 py-2.5 text-sm font-semibold text-green-800"
                          >
                            <ShieldCheck
                              size={15}
                            />

                            Supervisão
                          </button>
                        )}

                        {(
                          item.principal ||
                          item.podeEditarPerfil
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/perfil/editar?usuarioId=${encodeURIComponent(
                                  item.atleta.usuarioId
                                )}&papel=Atleta&gerenciado=1&returnTo=${encodeURIComponent(
                                  "/perfil"
                                )}`
                              )
                            }
                            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-green-700 px-3 py-2.5 text-sm font-semibold text-green-800"
                          >
                            <Pencil
                              size={15}
                            />

                            Editar perfil
                          </button>
                        )}
                      </>
                    ) : (
                    <>
                        <button
                        type="button"
                        disabled={
                            ativandoId ===
                            item.atletaId ||
                            recusandoId ===
                            item.atletaId
                        }
                        onClick={() =>
                            ativar(
                            item.atletaId
                            )
                        }
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                        {ativandoId ===
                        item.atletaId ? (
                            <>
                            <Loader2
                                size={15}
                                className="animate-spin"
                            />

                            Aceitando...
                            </>
                        ) : (
                            "Aceitar solicitação"
                        )}
                        </button>

                        <button
                        type="button"
                        disabled={
                            ativandoId ===
                            item.atletaId ||
                            recusandoId ===
                            item.atletaId
                        }
                        onClick={() =>
                            recusar(
                            item.atletaId,
                            item.atleta.nome
                            )
                        }
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                        >
                        {recusandoId ===
                        item.atletaId ? (
                            <>
                            <Loader2
                                size={15}
                                className="animate-spin"
                            />

                            Recusando...
                            </>
                        ) : (
                            "Recusar"
                        )}
                        </button>
                    </>
                    )}
                    </div>
                    {ativo &&
                      (
                        item.principal ||
                        item.podeGerenciarConteudo
                      ) &&
                      atividades[
                        item.atletaId
                      ]?.aberto && (
                            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                <div className="flex items-center gap-2">
                                    <FileText
                                    size={18}
                                    className="text-green-700"
                                    />

                                    <h3 className="font-semibold text-gray-950">
                                    Atividade recente
                                    </h3>
                                </div>

                                <p className="mt-1 text-xs text-gray-500">
                                    Postagens feitas por este atleta.
                                </p>
                                </div>

                                <button
                                type="button"
                                onClick={() =>
                                    alternarAtividade(
                                    item.atletaId
                                    )
                                }
                                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                                aria-label="Fechar atividade"
                                >
                                <ChevronUp
                                    size={18}
                                />
                                </button>
                            </div>

                            {atividades[
                                item.atletaId
                            ]?.carregando ? (
                                <div className="flex items-center justify-center py-6">
                                <Loader2
                                    size={20}
                                    className="animate-spin text-green-700"
                                />
                                </div>
                            ) : atividades[
                                item.atletaId
                                ]?.items
                                ?.length === 0 ? (
                                <div className="mt-4 rounded-xl bg-white px-4 py-5 text-center">
                                <p className="text-sm font-medium text-gray-600">
                                    Nenhuma postagem recente.
                                </p>
                                </div>
                            ) : (
                                <div className="mt-4 space-y-3">
                                {atividades[
                                    item.atletaId
                                ]?.items
                                    ?.slice(
                                    0,
                                    5
                                    )
                                    .map(
                                    (post) => (
                                        <div
                                        key={
                                            post.id
                                        }
                                        className="rounded-xl border border-gray-200 bg-white p-3"
                                        >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                            <p className="text-xs text-gray-400">
                                                {new Date(
                                                post.dataCriacao
                                                ).toLocaleString(
                                                "pt-BR",
                                                {
                                                    day:
                                                    "2-digit",

                                                    month:
                                                    "2-digit",

                                                    hour:
                                                    "2-digit",

                                                    minute:
                                                    "2-digit",
                                                }
                                                )}
                                            </p>

                                            {post.repostOfId && (
                                                <p className="mt-1 text-xs font-semibold text-green-700">
                                                Republicação
                                                </p>
                                            )}

                                            {post.conteudo && (
                                                <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-gray-800">
                                                {
                                                    post.conteudo
                                                }
                                                </p>
                                            )}

                                            {post.imagemUrl && (
                                                <img
                                                src={
                                                    post.imagemUrl
                                                }
                                                alt="Postagem do atleta"
                                                className="mt-3 max-h-48 w-full rounded-lg object-cover"
                                                />
                                            )}

                                            {post.videoUrl && (
                                                <div className="mt-2 text-xs font-medium text-gray-500">
                                                🎥 Publicação com vídeo
                                                </div>
                                            )}

                                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                                                <span>
                                                ❤️{" "}
                                                {
                                                    post.curtidas
                                                }
                                                </span>

                                                <span>
                                                💬{" "}
                                                {
                                                    post.comentarios
                                                }
                                                </span>

                                                <span>
                                                🔁{" "}
                                                {
                                                    post.reposts
                                                }
                                                </span>
                                            </div>
                                            </div>

                                            <button
                                            type="button"
                                            disabled={
                                                apagandoPostId ===
                                                post.id
                                            }
                                            onClick={() =>
                                                removerPostagemAtleta(
                                                item.atletaId,
                                                post.id
                                                )
                                            }
                                            className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                            title="Remover postagem"
                                            aria-label="Remover postagem"
                                            >
                                            {apagandoPostId ===
                                            post.id ? (
                                                <Loader2
                                                size={16}
                                                className="animate-spin"
                                                />
                                            ) : (
                                                <Trash2
                                                size={16}
                                                />
                                            )}
                                            </button>
                                        </div>
                                        </div>
                                    )
                                    )}

                                <button
                                    type="button"
                                    onClick={() =>
                                    navigate(
                                      `/perfil/${encodeURIComponent(
                                        item.atleta
                                          .usuarioId
                                      )}?papel=Atleta`
                                    )
                                    }
                                    className="w-full rounded-xl border border-green-700 bg-white px-4 py-2.5 text-sm font-semibold text-green-800"
                                >
                                    Ver todas as postagens
                                </button>
                                </div>
                            )}
                            </div>
                        )}

                    {ativo &&
                      (
                        item.principal ||
                        item.podeGerenciarPrivacidade
                      ) &&
                      supervisoes[
                        item.atletaId
                      ]?.aberto && (
                            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck
                                size={18}
                                className="text-blue-700"
                                />

                                <h3 className="font-semibold text-blue-950">
                                Supervisão da conta
                                </h3>
                            </div>

                            <p className="mt-1 text-xs leading-relaxed text-blue-800">
                                Defina quais recursos mais sensíveis este atleta pode ativar.
                                Ele continuará podendo usar a FootEra normalmente.
                            </p>

                            {supervisoes[
                                item.atletaId
                            ]?.carregando ? (
                                <div className="flex items-center justify-center py-6">
                                <Loader2
                                    size={20}
                                    className="animate-spin text-blue-700"
                                />
                                </div>
                            ) : (
                                <div className="mt-4 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                        Perfil público
                                    </p>

                                    <p className="mt-0.5 text-xs text-gray-500">
                                        Permite que o atleta deixe o perfil visível para qualquer pessoa.
                                    </p>
                                    </div>

                                    <Switch
                                    checked={
                                        supervisoes[
                                        item.atletaId
                                        ]
                                        ?.permitirPerfilPublico ??
                                        false
                                    }
                                    disabled={
                                        supervisoes[
                                        item.atletaId
                                        ]?.salvando
                                    }
                                    onCheckedChange={(
                                        valor
                                    ) =>
                                        salvarSupervisao(
                                        item.atletaId,
                                        {
                                            permitirPerfilPublico:
                                            valor,
                                        }
                                        )
                                    }
                                    />
                                </div>

                                <div className="border-t border-blue-100 pt-4">
                                    <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">
                                        Mensagens diretas
                                        </p>

                                        <p className="mt-0.5 text-xs text-gray-500">
                                        Permite que o atleta ative o recebimento de mensagens diretas.
                                        </p>
                                    </div>

                                    <Switch
                                        checked={
                                        supervisoes[
                                            item.atletaId
                                        ]
                                            ?.permitirMensagensDiretas ??
                                        false
                                        }
                                        disabled={
                                        supervisoes[
                                            item.atletaId
                                        ]?.salvando
                                        }
                                        onCheckedChange={(
                                        valor
                                        ) =>
                                        salvarSupervisao(
                                            item.atletaId,
                                            {
                                            permitirMensagensDiretas:
                                                valor,
                                            }
                                        )
                                        }
                                    />
                                    </div>
                                </div>

                                <div className="border-t border-blue-100 pt-4">
                                    <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">
                                        Exibir e-mail
                                        </p>

                                        <p className="mt-0.5 text-xs text-gray-500">
                                        Permite que o atleta escolha exibir o próprio e-mail para usuários da FootEra.
                                        </p>
                                    </div>

                                    <Switch
                                        checked={
                                        supervisoes[
                                            item.atletaId
                                        ]
                                            ?.permitirMostrarEmail ??
                                        false
                                        }
                                        disabled={
                                        supervisoes[
                                            item.atletaId
                                        ]?.salvando
                                        }
                                        onCheckedChange={(
                                        valor
                                        ) =>
                                        salvarSupervisao(
                                            item.atletaId,
                                            {
                                            permitirMostrarEmail:
                                                valor,
                                            }
                                        )
                                        }
                                    />
                                    </div>
                                </div>

                                {supervisoes[
                                    item.atletaId
                                ]?.salvando && (
                                    <div className="flex items-center gap-2 text-xs font-medium text-blue-700">
                                    <Loader2
                                        size={14}
                                        className="animate-spin"
                                    />

                                    Salvando alteração...
                                    </div>
                                )}
                                </div>
                            )}
                            </div>
                        )}
                        {ativo &&
                          item.principal && (
                            <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-4">
                              <div className="flex items-center gap-2">
                                <ShieldCheck
                                  size={18}
                                  className="text-green-700"
                                />

                                <h3 className="font-semibold text-green-950">
                                  Permissões dos responsáveis
                                </h3>
                              </div>

                              <p className="mt-1 text-xs leading-relaxed text-green-800">
                                Como responsável principal, você pode definir quais ações os responsáveis secundários podem realizar em nome deste atleta.
                              </p>

                              {carregandoResponsaveisAtletaId ===
                              item.atletaId ? (
                                <div className="mt-4 flex items-center gap-2 text-sm text-green-700">
                                  <Loader2
                                    size={16}
                                    className="animate-spin"
                                  />

                                  Carregando responsáveis...
                                </div>
                              ) : (
                                <div className="mt-4 space-y-3">
                                  {(
                                    responsaveisSecundarios[
                                      item.atletaId
                                    ] ??
                                    []
                                  ).length ===
                                  0 ? (
                                    <div className="rounded-lg border border-green-100 bg-white p-3">
                                      <p className="text-sm text-gray-600">
                                        Nenhum responsável secundário ativo neste atleta.
                                      </p>

                                      <p className="mt-1 text-xs text-gray-500">
                                        Quando outro responsável for aprovado, as permissões dele aparecerão aqui.
                                      </p>
                                    </div>
                                  ) : (
                                    (
                                      responsaveisSecundarios[
                                        item.atletaId
                                      ] ??
                                      []
                                    ).map(
                                      (
                                        responsavelSecundario
                                      ) => (
                                        <div
                                          key={
                                            responsavelSecundario.id
                                          }
                                          className="rounded-xl border border-green-100 bg-white p-4"
                                        >
                                          <div className="flex items-center gap-3">
                                            {responsavelSecundario
                                              .responsavel
                                              .foto ? (
                                              <img
                                                src={
                                                  responsavelSecundario
                                                    .responsavel
                                                    .foto
                                                }
                                                alt={
                                                  responsavelSecundario
                                                    .responsavel
                                                    .nome
                                                }
                                                className="h-10 w-10 rounded-full object-cover"
                                              />
                                            ) : (
                                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                                                <UserRound
                                                  size={20}
                                                  className="text-gray-500"
                                                />
                                              </div>
                                            )}

                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-semibold text-gray-900">
                                                {
                                                  responsavelSecundario
                                                    .responsavel
                                                    .nome
                                                }
                                              </p>

                                              {responsavelSecundario
                                                .responsavel
                                                .nomeDeUsuario && (
                                                <p className="truncate text-xs text-gray-500">
                                                  @
                                                  {
                                                    responsavelSecundario
                                                      .responsavel
                                                      .nomeDeUsuario
                                                  }
                                                </p>
                                              )}

                                              {responsavelSecundario
                                                .parentesco && (
                                                <p className="mt-0.5 text-xs text-gray-500">
                                                  {
                                                    responsavelSecundario
                                                      .parentesco
                                                  }
                                                </p>
                                              )}
                                            </div>
                                          </div>

                                          <div className="mt-4 space-y-4">
                                            <div className="flex items-center justify-between gap-4">
                                              <div>
                                                <p className="text-sm font-semibold text-gray-900">
                                                  Editar perfil
                                                </p>

                                                <p className="mt-0.5 text-xs text-gray-500">
                                                  Permite editar informações autorizadas do atleta.
                                                </p>
                                              </div>

                                              <Switch
                                                checked={
                                                  responsavelSecundario
                                                    .podeEditarPerfil
                                                }
                                                disabled={
                                                  salvandoPermissaoVinculoId ===
                                                  responsavelSecundario.id
                                                }
                                                onCheckedChange={(
                                                  valor
                                                ) =>
                                                  atualizarPermissaoResponsavelSecundario(
                                                    item.atletaId,
                                                    responsavelSecundario,
                                                    "podeEditarPerfil",
                                                    valor
                                                  )
                                                }
                                              />
                                            </div>

                                            <div className="border-t border-green-100 pt-4">
                                              <div className="flex items-center justify-between gap-4">
                                                <div>
                                                  <p className="text-sm font-semibold text-gray-900">
                                                    Gerenciar privacidade
                                                  </p>

                                                  <p className="mt-0.5 text-xs text-gray-500">
                                                    Permite controlar as configurações de privacidade do atleta.
                                                  </p>
                                                </div>

                                                <Switch
                                                  checked={
                                                    responsavelSecundario
                                                      .podeGerenciarPrivacidade
                                                  }
                                                  disabled={
                                                    salvandoPermissaoVinculoId ===
                                                    responsavelSecundario.id
                                                  }
                                                  onCheckedChange={(
                                                    valor
                                                  ) =>
                                                    atualizarPermissaoResponsavelSecundario(
                                                      item.atletaId,
                                                      responsavelSecundario,
                                                      "podeGerenciarPrivacidade",
                                                      valor
                                                    )
                                                  }
                                                />
                                              </div>
                                            </div>

                                            <div className="border-t border-green-100 pt-4">
                                              <div className="flex items-center justify-between gap-4">
                                                <div>
                                                  <p className="text-sm font-semibold text-gray-900">
                                                    Gerenciar treinos
                                                  </p>

                                                  <p className="mt-0.5 text-xs text-gray-500">
                                                    Permite visualizar, salvar, agendar, iniciar e finalizar treinos do atleta.
                                                  </p>
                                                </div>

                                                <Switch
                                                  checked={
                                                    responsavelSecundario
                                                      .podeGerenciarTreinos
                                                  }
                                                  disabled={
                                                    salvandoPermissaoVinculoId ===
                                                    responsavelSecundario.id
                                                  }
                                                  onCheckedChange={(
                                                    valor
                                                  ) =>
                                                    atualizarPermissaoResponsavelSecundario(
                                                      item.atletaId,
                                                      responsavelSecundario,
                                                      "podeGerenciarTreinos",
                                                      valor
                                                    )
                                                  }
                                                />
                                              </div>
                                            </div>

                                            <div className="border-t border-green-100 pt-4">
                                              <div className="flex items-center justify-between gap-4">
                                                <div>
                                                  <p className="text-sm font-semibold text-gray-900">
                                                    Gerenciar conteúdo
                                                  </p>

                                                  <p className="mt-0.5 text-xs text-gray-500">
                                                    Permite acompanhar e moderar conteúdos do atleta.
                                                  </p>
                                                </div>

                                                <Switch
                                                  checked={
                                                    responsavelSecundario
                                                      .podeGerenciarConteudo
                                                  }
                                                  disabled={
                                                    salvandoPermissaoVinculoId ===
                                                    responsavelSecundario.id
                                                  }
                                                  onCheckedChange={(
                                                    valor
                                                  ) =>
                                                    atualizarPermissaoResponsavelSecundario(
                                                      item.atletaId,
                                                      responsavelSecundario,
                                                      "podeGerenciarConteudo",
                                                      valor
                                                    )
                                                  }
                                                />
                                              </div>
                                            </div>

                                            <button
                                              type="button"
                                              disabled={removendoSecundarioId !== null || salvandoPermissaoVinculoId === responsavelSecundario.id}
                                              onClick={() => void removerResponsavelSecundario(item.atletaId, responsavelSecundario)}
                                              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                            >
                                              <Link2Off size={16} />
                                              {removendoSecundarioId === responsavelSecundario.id ? "Desvinculando..." : "Desvincular responsável"}
                                            </button>

                                            {salvandoPermissaoVinculoId ===
                                              responsavelSecundario.id && (
                                              <div className="flex items-center gap-2 text-xs font-medium text-green-700">
                                                <Loader2
                                                  size={14}
                                                  className="animate-spin"
                                                />

                                                Salvando permissões...
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        {ativo &&
                          item.principal && (
                            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                              <div className="flex items-center gap-2">
                                <ShieldCheck
                                  size={18}
                                  className="text-gray-700"
                                />

                                <h3 className="font-semibold text-gray-950">
                                  Segurança da conta
                                </h3>
                              </div>

                              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                                Como responsável principal, você pode proteger o acesso desta conta.
                              </p>

                              {item.atleta.deletedAt ? (
                                <div className="mt-4">
                                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                    <p className="text-sm font-semibold text-amber-900">
                                      Conta na lixeira
                                    </p>

                                    <p className="mt-1 text-xs text-amber-700">
                                      Esta conta está aguardando exclusão definitiva.
                                    </p>

                                    {item.atleta.deleteScheduledAt && (
                                      <p className="mt-1 text-xs text-amber-700">
                                        Exclusão prevista para{" "}
                                        {new Date(
                                          item.atleta.deleteScheduledAt
                                        ).toLocaleDateString(
                                          "pt-BR"
                                        )}
                                        .
                                      </p>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    disabled={
                                      acaoSeguranca ===
                                      `${item.atletaId}:restaurar`
                                    }
                                    onClick={() =>
                                      restaurarContaAtleta(
                                        item
                                      )
                                    }
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-700 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 disabled:opacity-50"
                                  >
                                    {acaoSeguranca ===
                                    `${item.atletaId}:restaurar` ? (
                                      <Loader2
                                        size={16}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <RotateCcw
                                        size={16}
                                      />
                                    )}

                                    Restaurar conta
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <button
                                    type="button"
                                    disabled={
                                      acaoSeguranca !==
                                      null
                                    }
                                    onClick={() =>
                                      redefinirSenhaAtleta(
                                        item
                                      )
                                    }
                                    className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 disabled:opacity-50"
                                  >
                                    {acaoSeguranca ===
                                    `${item.atletaId}:senha` ? (
                                      <Loader2
                                        size={16}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <KeyRound
                                        size={16}
                                      />
                                    )}

                                    Redefinir senha
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      acaoSeguranca !==
                                      null
                                    }
                                    onClick={() =>
                                      encerrarSessoesAtleta(
                                        item
                                      )
                                    }
                                    className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 disabled:opacity-50"
                                  >
                                    {acaoSeguranca ===
                                    `${item.atletaId}:sessoes` ? (
                                      <Loader2
                                        size={16}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <LogOut
                                        size={16}
                                      />
                                    )}

                                    Encerrar sessões
                                  </button>

                                  {item.atleta.googleLinked && (
                                    <button
                                      type="button"
                                      disabled={
                                        acaoSeguranca !==
                                        null
                                      }
                                      onClick={() =>
                                        desvincularGoogleAtleta(
                                          item
                                        )
                                      }
                                      className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 disabled:opacity-50 sm:col-span-2"
                                    >
                                      {acaoSeguranca ===
                                      `${item.atletaId}:google` ? (
                                        <Loader2
                                          size={16}
                                          className="animate-spin"
                                        />
                                      ) : (
                                        <Link2Off
                                          size={16}
                                        />
                                      )}

                                      Desvincular Google
                                    </button>
                                  )}

                                  {item.atleta.googleLinked &&
                                    !item.atleta
                                      .localLoginEnabled && (
                                    <p className="text-xs text-amber-700 sm:col-span-2">
                                      Para remover o Google, primeiro redefina uma senha FootEra para este atleta.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        {ativo &&
                          item.principal &&
                          !item.atleta.deletedAt && (
                            <div className="mt-4 border-t border-gray-100 pt-4">
                            <button
                                type="button"
                                disabled={
                                excluindoAtletaId ===
                                item.atletaId
                                }
                                onClick={() =>
                                excluirContaAtleta(
                                    item
                                )
                                }
                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                            >
                                {excluindoAtletaId ===
                                item.atletaId ? (
                                <Loader2
                                    size={16}
                                    className="animate-spin"
                                />
                                ) : (
                                <Trash2
                                    size={16}
                                />
                                )}

                                Excluir conta do atleta
                            </button>

                            <p className="mt-2 text-center text-xs text-gray-500">
                                A conta ficará na lixeira por 30 dias antes da exclusão definitiva.
                            </p>
                            </div>
                        )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>
      {solicitacoesNovosResponsaveis.length >
        0 && (
        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
            <h2 className="font-bold text-gray-950">
                Solicitações de novos responsáveis
            </h2>

            <p className="mt-1 text-sm text-gray-500">
                Pessoas que querem se vincular como responsáveis de atletas pelos quais você é o responsável principal.
            </p>
            </div>

            <div className="space-y-3">
            {solicitacoesNovosResponsaveis.map(
                (solicitacao) => {
                const processando =
                    processandoNovoResponsavelId ===
                    solicitacao.id;

                return (
                    <div
                    key={
                        solicitacao.id
                    }
                    className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                    >
                    <div className="flex items-center gap-3">
                        <img
                        src={
                            solicitacao
                            .responsavelSolicitante
                            .foto ||
                            "/assets/usuarios/default-user.png"
                        }
                        alt={
                            solicitacao
                            .responsavelSolicitante
                            .nome
                        }
                        className="h-11 w-11 rounded-full border object-cover"
                        />

                        <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-950">
                            {
                            solicitacao
                                .responsavelSolicitante
                                .nome
                            }
                        </p>

                        {solicitacao
                            .responsavelSolicitante
                            .nomeDeUsuario && (
                            <p className="text-xs text-gray-500">
                            @
                            {
                                solicitacao
                                .responsavelSolicitante
                                .nomeDeUsuario
                            }
                            </p>
                        )}
                        </div>

                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                        Pendente
                        </span>
                    </div>

                    <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm text-gray-700">
                        Quer se tornar responsável de{" "}
                        <strong>
                        {
                            solicitacao
                            .atleta
                            .nome
                        }
                        </strong>
                        .
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                        type="button"
                        disabled={
                            processando
                        }
                        onClick={() =>
                            responderNovoResponsavel(
                            solicitacao.id,
                            "aceitar"
                            )
                        }
                        className="flex items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                        {processando ? (
                            <Loader2
                            size={15}
                            className="animate-spin"
                            />
                        ) : null}

                        Aceitar
                        </button>

                        <button
                        type="button"
                        disabled={
                            processando
                        }
                        onClick={() =>
                            responderNovoResponsavel(
                            solicitacao.id,
                            "recusar"
                            )
                        }
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-60"
                        >
                        Recusar
                        </button>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-amber-800">
                        Ao aceitar, esta pessoa poderá supervisionar o atleta, mas você continuará sendo o responsável principal.
                    </p>
                    </div>
                );
                }
            )}
            </div>
        </section>
        )}
    </main>
  );
}