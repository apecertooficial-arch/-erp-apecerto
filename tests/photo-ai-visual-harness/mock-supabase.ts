const suggestions = [
  { media_id: "photo-1", category: "Sala", sort_order: 0, is_cover: true, display_name: "Sala integrada", alt_text: "Sala integrada e iluminada", warning: "nenhum", warning_detail: "", confidence: 0.94 },
  { media_id: "photo-2", category: "Cozinha", sort_order: 1, is_cover: false, display_name: "Cozinha planejada", alt_text: "Cozinha planejada com bancada", warning: "qualidade_ruim", warning_detail: "Imagem um pouco escura", confidence: 0.81 },
  { media_id: "photo-3", category: "Varanda", sort_order: 2, is_cover: false, display_name: "Varanda social", alt_text: "Varanda social com vista", warning: "nenhum", warning_detail: "", confidence: 0.89 },
];

export function getBrowserSupabaseClient() {
  return {
    functions: {
      invoke: async () => ({
        data: { ok: true, set_version: "0123456789abcdef0123456789abcdef", suggestions },
        error: null,
      }),
    },
  };
}
