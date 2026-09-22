export type ProfileBroker = { id: number; nome: string | null; email: string | null; telefone: string | null; creci: string | null; foto_path: string | null; ativo: boolean; online: boolean; notif_leads: boolean; notif_mensagens: boolean; notif_som: boolean };
export type ProfileUser = { id: string; nome: string | null; role: string; ativo: boolean; email: string | null; telefone: string | null; superior_id: string | null; endereco_cep: string | null; endereco_logradouro: string | null; endereco_numero: string | null; endereco_complemento: string | null; endereco_bairro: string | null; endereco_cidade: string | null; endereco_uf: string | null };
export type BankData = { titular_nome: string | null; titular_cpf: string | null; banco_nome: string | null; banco_codigo: string | null; agencia: string | null; conta: string | null; conta_tipo: string | null; pix_tipo: string | null; pix_chave: string | null };
export type ProfileData = {
  usuario: ProfileUser | null;
  corretor: ProfileBroker | null;
  instancias: Array<{ id: number; nome: string | null; telefone: string | null; conectada: boolean; ativa: boolean }>;
  dados_bancarios: BankData | null;
};

export function interpretarProfileData(value: unknown): ProfileData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const profile = value as Partial<ProfileData>;
  const usuario = profile.usuario;
  if (!usuario || typeof usuario !== "object" || typeof usuario.id !== "string" || typeof usuario.role !== "string" || typeof usuario.ativo !== "boolean") return null;
  const corretor = profile.corretor;
  if (corretor !== null && (!corretor || typeof corretor !== "object"
    || !Number.isSafeInteger(corretor.id) || typeof corretor.ativo !== "boolean"
    || typeof corretor.online !== "boolean" || typeof corretor.notif_leads !== "boolean"
    || typeof corretor.notif_mensagens !== "boolean" || typeof corretor.notif_som !== "boolean")) return null;
  if (!Array.isArray(profile.instancias) || !profile.instancias.every((item) => item && typeof item === "object"
    && Number.isSafeInteger(item.id) && typeof item.conectada === "boolean" && typeof item.ativa === "boolean")) return null;
  if (profile.dados_bancarios !== null && (!profile.dados_bancarios || typeof profile.dados_bancarios !== "object" || Array.isArray(profile.dados_bancarios))) return null;
  return profile as ProfileData;
}
