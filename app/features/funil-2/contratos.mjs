const STATUS_POR_ERRO = Object.freeze({
  sessao_necessaria: 401,
  sessao_invalida: 401,
  sem_permissao: 403,
  acesso_negado: 403,
  versao_conflito: 409,
  versao_desatualizada: 409,
  dados_invalidos: 422,
  motivo_obrigatorio: 422,
  motivo_invalido: 422,
});

export function statusHttpFunil(chave) {
  return STATUS_POR_ERRO[String(chave ?? "")] ?? 409;
}

export function decisaoConflitoHumano(chave) {
  return {
    repetirAutomaticamente: false,
    recarregarAntesDeRepetir: chave === "versao_conflito" || chave === "versao_desatualizada",
  };
}

export function validarMovimentoSeguro(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, motivo: "selecao_vazia" };
  if (ids.length > 1) return { ok: false, motivo: "lote_sem_contrato_atomico" };
  return { ok: true, id: String(ids[0]) };
}

export function combinarAtividades(tarefas, visitas) {
  const normalizadas = [
    ...(tarefas ?? []).map((item) => ({
      ...item,
      tipo: "tarefa",
      titulo: item.titulo || "Atividade sem título",
      data_em: item.prazo_em ?? null,
    })),
    ...(visitas ?? []).map((item) => ({
      ...item,
      tipo: "visita",
      titulo: `Visita · ${item.imovel || "Imóvel a confirmar"}`,
      data_em: item.inicio_em ?? null,
    })),
  ];
  return normalizadas.sort((a, b) => {
    const esquerda = a.data_em ? new Date(a.data_em).getTime() : Number.MAX_SAFE_INTEGER;
    const direita = b.data_em ? new Date(b.data_em).getTime() : Number.MAX_SAFE_INTEGER;
    return esquerda - direita;
  });
}
