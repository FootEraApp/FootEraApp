function numberOrZero(
  value: unknown
) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
}

export function sanitizePublicUser(
  user: any
) {
  if (!user) return null;

  return {
    id: user.id ?? null,

    nome:
      user.nome ?? null,

    nomeDeUsuario:
      user.nomeDeUsuario ?? null,

    foto:
      user.foto ?? null,

    tipo:
      user.tipo ?? null,

    verified:
      user.verified === true,

    destaque:
      user.destaque === true,
  };
}

function sanitizePublicComment(
  comment: any
) {
  if (
    !comment ||
    comment.oculto === true
  ) {
    return null;
  }

  return {
    id:
      comment.id ?? null,

    conteudo:
      comment.conteudo ?? "",

    dataCriacao:
      comment.dataCriacao ??
      null,

    usuarioId:
      comment.usuario?.id ??
      comment.usuarioId ??
      null,

    usuario:
      sanitizePublicUser(
        comment.usuario
      ),
  };
}

export function sanitizePublicPost(
  post: any
): any {
  if (
    !post ||
    post.oculto === true
  ) {
    return null;
  }

  const comentarios =
    Array.isArray(
      post.comentarios
    )
      ? post.comentarios
          .map(
            sanitizePublicComment
          )
          .filter(Boolean)
      : [];

  return {
    id: post.id ?? null,

    conteudo:
      post.conteudo ?? "",

    imagemUrl:
      post.imagemUrl ?? null,

    videoUrl:
      post.videoUrl ?? null,

    tipoMidia:
      post.tipoMidia ?? null,

    dataCriacao:
      post.dataCriacao ?? null,

    compartilhamentos:
      numberOrZero(
        post.compartilhamentos
      ),

    reposts:
      numberOrZero(
        post.reposts
      ),

    usuario:
      sanitizePublicUser(
        post.usuario
      ),

    curtidas: [],

    totalCurtidas:
      Array.isArray(post.curtidas)
        ? post.curtidas.length
        : numberOrZero(
            post?._count
              ?.curtidas
          ),

    comentarios,

    repostOf:
      post.repostOf
        ? sanitizePublicPost(
            post.repostOf
          )
        : null,
  };
}

export function sanitizePublicOrganization(
  organization: any
) {
  if (!organization) {
    return null;
  }

  return {
    id:
      organization.id ?? null,

    nome:
      organization.nome ?? null,

    logo:
      organization.logo ??
      organization.foto ??
      null,

    descricao:
      organization.descricao ??
      null,

    siteOficial:
      organization.siteOficial ??
      null,

    sede:
      organization.sede ?? null,

    estadio:
      organization.estadio ??
      null,

    cidade:
      organization.cidade ??
      null,

    estado:
      organization.estado ??
      null,

    pais:
      organization.pais ??
      null,

    categorias:
      Array.isArray(
        organization.categorias
      )
        ? organization.categorias
        : [],
  };
}

export function sanitizePublicProfile(
  payload: any
) {
  if (!payload) return null;

  const tipo =
    String(
      payload.tipo || ""
    );

  const tipoNormalizado =
    tipo.toLowerCase();

  const dados =
    payload.dadosEspecificos ||
    {};

  let dadosPublicos: any = {};

  switch (tipoNormalizado) {
    case "atleta":
      dadosPublicos = {
        nome:
          dados.nome ?? null,

        sobrenome:
          dados.sobrenome ??
          null,

        foto:
          dados.foto ?? null,

        posicao:
          dados.posicao ?? null,

        categoria:
          dados.categoria ?? [],

        seloQualidade:
          dados.seloQualidade ??
          null,

        escola:
          dados.escola ?? null,

        clube:
          dados.clube ?? null,

        professor:
          dados.professor ?? null,
      };
      break;

    case "professor":
      dadosPublicos = {
        nome:
          dados.nome ?? null,

        foto:
          dados.foto ?? null,

        areaFormacao:
          dados.areaFormacao ??
          null,

        escola:
          dados.escola ?? null,

        qualificacoes:
          dados.qualificacoes ??
          null,

        certificacoes:
          dados.certificacoes ??
          null,
      };
      break;

    case "clube":
    case "escolinha":
    case "federacao":
    case "marca":
      dadosPublicos =
        sanitizePublicOrganization(
          dados
        );
      break;

    case "olheiro":
      dadosPublicos = {
        id:
          dados.id ?? null,

        foto:
          dados.foto ?? null,

        headline:
          dados.headline ?? null,

        areaAtuacao:
          dados.areaAtuacao ??
          null,

        anosExperiencia:
          dados.anosExperiencia ??
          null,

        descricao:
          dados.descricao ??
          null,

        colaboracaoClube:
          dados.colaboracaoClube
            ? {
                id:
                  dados
                    .colaboracaoClube
                    .id ?? null,

                nome:
                  dados
                    .colaboracaoClube
                    .nome ?? null,

                logo:
                  dados
                    .colaboracaoClube
                    .logo ?? null,
              }
            : null,
      };
      break;

    case "learning":
      dadosPublicos = {
        bio:
          dados.bio ?? null,

        objetivo:
          dados.objetivo ??
          null,

        interesses:
          Array.isArray(
            dados.interesses
          )
            ? dados.interesses
            : [],
      };
      break;

    default:
      dadosPublicos = {};
  }

  return {
    tipo:
      payload.tipo ?? null,

    usuario:
      sanitizePublicUser(
        payload.usuario
      ),

    dadosEspecificos:
      dadosPublicos,

    pontuacaoTotal:
      tipoNormalizado ===
      "atleta"
        ? numberOrZero(
            payload
              .pontuacaoTotal
          )
        : 0,
  };
}