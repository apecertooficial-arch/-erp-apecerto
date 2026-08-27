"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { MoneyInput } from "./MoneyInput";
import { PendingMediaClassifier, type PendingMediaItem } from "./PendingMediaClassifier";
import { applyOfficialWatermark } from "./watermark";
import { validateProductPrice } from "./quality";
import { buildMediaAltText } from "./media-editorial";

type UnitWizardProps = { accessToken: string; onClose: () => void; onSaved: () => void; onCreateCondominium?: () => void; onCreateStandalone?: () => void };
type Building = { id: string; nome: string; bairro: string | null; cidade: string | null; finalidade: string | null; origem: string | null; condominio_id: string | null };

const accessOptions: Array<[string, string]> = [
  ["chave_digital", "Chave digital"],
  ["chave_fisica", "Chave física"],
  ["porteiro", "Porteiro"],
  ["biometria", "Biometria"],
  ["corretor", "Corretor"],
  ["proprietario", "Proprietário"],
];
const unitMediaCategories = ["Sala", "Cozinha", "Quarto", "Suíte", "Banheiro", "Varanda", "Vista", "Planta", "Fachada", "Lazer", "Tour", "Outro"];

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

/* Fotos e vídeos vão para a mesma galeria da unidade; o tipo sai do arquivo
   para o registro em `midias` bater com o player certo depois. */
function tipoDaMidia(file: File): "foto" | "video" {
  return (file.type || "").startsWith("video/") ? "video" : "foto";
}

export function UnitWizard({ accessToken, onClose, onSaved, onCreateCondominium, onCreateStandalone }: UnitWizardProps) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingQuery, setBuildingQuery] = useState("");
  const [empreendimentoId, setEmpreendimentoId] = useState("");
  const [numero, setNumero] = useState("");
  const [tipologia, setTipologia] = useState("");
  const [area, setArea] = useState("");
  const [vagas, setVagas] = useState("");
  const [valorTabela, setValorTabela] = useState("");
  const [valorPromo, setValorPromo] = useState("");
  const [condominioValor, setCondominioValor] = useState("");
  const [iptu, setIptu] = useState("");
  const [outrosCustos, setOutrosCustos] = useState("");
  const [compreJaAlugado, setCompreJaAlugado] = useState(false);
  const [proprietarioNome, setProprietarioNome] = useState("");
  const [proprietarioContato, setProprietarioContato] = useState("");
  const [acessoTipo, setAcessoTipo] = useState("chave_digital");
  const [acessoCodigo, setAcessoCodigo] = useState("");
  const [acessoInstrucoes, setAcessoInstrucoes] = useState("");
  const [photos, setPhotos] = useState<PendingMediaItem[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createdUnitId, setCreatedUnitId] = useState<string | null>(null);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [uploadedItemIds, setUploadedItemIds] = useState<string[]>([]);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    void supabase.from("empreendimentos").select("id,nome,bairro,cidade,finalidade,origem,condominio_id").order("nome").then(({ data }) => {
      if (data) setBuildings((data as Building[]).filter((item) => !(item.origem === "terceiros" && !item.condominio_id)));
    });
  }, []);

  const selectedPurpose = buildings.find((item) => item.id === empreendimentoId)?.finalidade ?? "venda";
  const moneyMode = selectedPurpose === "aluguel" ? "reais" : "milhares";
  const visibleBuildings = buildings.filter((item) => {
    const key = buildingQuery.trim().toLocaleLowerCase("pt-BR");
    if (!key || item.id === empreendimentoId) return true;
    return [item.nome, item.bairro, item.cidade].some((value) => value?.toLocaleLowerCase("pt-BR").includes(key));
  }).slice(0, 40);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    if (!list.length) return;
    setPhotos((current) => {
      const hasCover = current.some((item) => item.cover);
      const firstPhotoIndex = list.findIndex((file) => tipoDaMidia(file) === "foto");
      const additions = list.map((file, index) => {
        const kind = tipoDaMidia(file);
        return {
          id: crypto.randomUUID(),
          file,
          kind,
          category: kind === "video" ? "Tour" : "Sala",
          preview: URL.createObjectURL(file),
          cover: kind === "foto" && !hasCover && index === firstPhotoIndex,
          altText: "",
        } satisfies PendingMediaItem;
      });
      return [...current, ...additions];
    });
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      const remaining = current.filter((item) => item.id !== id);
      if (removed?.cover) {
        const nextCover = remaining.find((item) => item.kind === "foto");
        return remaining.map((item) => ({ ...item, cover: item.id === nextCover?.id }));
      }
      return remaining;
    });
  }

  function validate() {
    if (!empreendimentoId) return "Selecione o condomínio ou prédio do apartamento.";
    if (!numero.trim()) return "Informe o número da unidade.";
    if (!tipologia.trim()) return "Informe a tipologia da unidade.";
    if (!area.trim() || Number(area) <= 0) return "Informe a área útil da unidade.";
    if (!valorTabela.trim()) return "Informe o valor de tabela da unidade.";
    const tablePrice = validateProductPrice(Number(valorTabela), "Valor de tabela", selectedPurpose);
    if (tablePrice.error) return tablePrice.error;
    if (valorPromo.trim()) {
      const promoPrice = validateProductPrice(Number(valorPromo), "Valor promocional", selectedPurpose);
      if (promoPrice.error) return promoPrice.error;
    }
    if (!proprietarioNome.trim() || !proprietarioContato.trim()) return "Informe nome e contato do proprietário.";
    if (!acessoTipo || !acessoInstrucoes.trim()) return "Informe o tipo e as instruções de acesso.";
    if (acessoTipo === "chave_digital" && !acessoCodigo.trim()) return "Informe o código da chave digital.";
    if (photos.filter((item) => item.kind === "foto").length < 1) return "Adicione ao menos uma foto da unidade para a aprovação.";
    return "";
  }

  async function save() {
    const validation = validate();
    if (validation) {
      setMessage(validation);
      return;
    }
    setSaving(true);
    setMessage("");
    setUploadProgress(0);
    let unitId = createdUnitId;
    let userId = createdUserId;
    const completed = new Set(uploadedItemIds);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? accessToken;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");

      if (!unitId || !userId) {
        const response = await fetch("/api/product", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            id: empreendimentoId,
            action: "criarUnidade",
            unidade: {
              numero,
              tipologia,
              area_m2: area,
              vagas,
              valor_tabela: valorTabela,
              valor_promo: valorPromo,
              condominio_valor: condominioValor,
              iptu,
              outros_custos: outrosCustos,
              compre_ja_alugado: compreJaAlugado,
              proprietario_nome: proprietarioNome,
              proprietario_contato: proprietarioContato,
              acesso_tipo: acessoTipo,
              acesso_codigo: acessoCodigo,
              acesso_instrucoes: acessoInstrucoes,
            },
          }),
        });
        const created = await response.json() as { unidadeId?: string; userId?: string; error?: string };
        if (!response.ok || !created.unidadeId || !created.userId) {
          throw new Error(created.error ?? "Não foi possível cadastrar a unidade.");
        }
        unitId = created.unidadeId;
        userId = created.userId;
        setCreatedUnitId(unitId);
        setCreatedUserId(userId);
      }

      for (let index = 0; index < photos.length; index += 1) {
        const item = photos[index];
        if (completed.has(item.id)) continue;
        const originalFile = item.file;
        const file = tipoDaMidia(originalFile) === "foto" ? await applyOfficialWatermark(originalFile) : originalFile;
        const storagePath = `${userId}/${empreendimentoId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("empreendimentos").upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(`Falha ao enviar ${file.name}: ${uploadError.message}`);
        const { error: mediaError } = await supabase.from("midias").insert({
          empreendimento_id: empreendimentoId, unidade_id: unitId, tipo: tipoDaMidia(file),
          storage_path: storagePath, nome: file.name, categoria: item.category.toLowerCase(), is_capa: Boolean(item.cover), ordem: index,
          alt_text: tipoDaMidia(file) === "foto" ? (item.altText?.trim() || buildMediaAltText({ category: item.category, propertyName: buildings.find((building) => building.id === empreendimentoId)?.nome, unitNumber: numero })) : null,
        } as never);
        if (mediaError) {
          await supabase.storage.from("empreendimentos").remove([storagePath]);
          throw new Error(`Falha ao registrar ${file.name}: ${mediaError.message}`);
        }
        completed.add(item.id);
        setUploadedItemIds(Array.from(completed));
        setUploadProgress(Math.round((completed.size / photos.length) * 100));
      }

      setMessage("Unidade enviada para aprovação.");
      await new Promise((resolve) => setTimeout(resolve, 700));
      onSaved();
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "Não foi possível cadastrar a unidade.";
      setMessage(unitId
        ? `A unidade foi criada sem duplicar o cadastro, mas nem todas as fotos chegaram. ${detail} Clique em “Enviar fotos restantes” para continuar.`
        : detail);
      setSaving(false);
    }
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Cadastrar apartamento">
      <button className="modal-scrim" onClick={onClose} aria-label="Fechar cadastro" type="button" />
      <section className="capture-panel">
        <header className="capture-header">
          <div><span className="eyebrow">CAPTAÇÃO DE APARTAMENTO</span><h2>Cadastrar apartamento</h2><p>Associe o apartamento captado a um condomínio ou prédio já existente.</p></div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Fechar">×</button>
        </header>

        <div className="capture-body">
          <div className="form-section">
            <h3>Condomínio do apartamento</h3>
            <p>Primeiro encontre o condomínio. O apartamento será um produto próprio no catálogo, sem ficar escondido dentro do prédio.</p>
            {onCreateStandalone && <button className="unit-standalone-action" type="button" onClick={onCreateStandalone}><strong>⌂ Cadastrar imóvel sem condomínio</strong><span>Use para casa, apartamento avulso, sala, terreno ou outro imóvel que não pertence a condomínio.</span></button>}
            <label>Buscar condomínio<input type="search" value={buildingQuery} onChange={(event) => setBuildingQuery(event.target.value)} placeholder="Digite nome, bairro ou cidade" /></label>
            <label>Condomínio ou prédio<select value={empreendimentoId} onChange={(event) => setEmpreendimentoId(event.target.value)}><option value="">Selecione...</option>{visibleBuildings.map((item) => <option value={item.id} key={item.id}>{item.nome}{item.bairro ? ` · ${item.bairro}` : ""}{item.cidade ? ` · ${item.cidade}` : ""}</option>)}</select></label>
            <div className="unit-building-help"><span>{visibleBuildings.length > 0 ? `${visibleBuildings.length} condomínio(s) encontrado(s)` : "Nenhum condomínio encontrado"}</span>{onCreateCondominium && <button className="secondary-action" type="button" onClick={onCreateCondominium}>＋ Cadastrar condomínio novo</button>}</div>
          </div>

          <div className="form-section">
            <h3>Dados do apartamento</h3>
            <div className="field-grid">
              <label>Número<input value={numero} onChange={(event) => setNumero(event.target.value)} placeholder="Ex.: 142" /></label>
              <label>Tipologia<input value={tipologia} onChange={(event) => setTipologia(event.target.value)} placeholder="Ex.: HR, 2 dorm." /></label>
              <label>Área (m²)<input type="number" min="0" step="0.01" value={area} onChange={(event) => setArea(event.target.value)} /></label>
              <label>Vagas<input type="number" min="0" value={vagas} onChange={(event) => setVagas(event.target.value)} /></label>
            </div>
            <div className="unit-money-grid"><MoneyInput key={`tabela-${moneyMode}`} purpose={selectedPurpose} defaultMode={moneyMode} label={selectedPurpose === "aluguel" ? "Aluguel mensal" : "Valor de tabela"} value={valorTabela} onChange={(value) => setValorTabela(value === null ? "" : String(value))} /><MoneyInput key={`promo-${moneyMode}`} purpose={selectedPurpose} defaultMode={moneyMode} label="Valor promocional" value={valorPromo} onChange={(value) => setValorPromo(value === null ? "" : String(value))} /></div>
            <div className="field-grid"><label>Condomínio mensal<input type="number" min="0" value={condominioValor} onChange={(event) => setCondominioValor(event.target.value)} /></label><label>IPTU<input type="number" min="0" value={iptu} onChange={(event) => setIptu(event.target.value)} /></label><label>Outros custos<input type="number" min="0" value={outrosCustos} onChange={(event) => setOutrosCustos(event.target.value)} /></label></div>
            <label className="toggle commercial-toggle"><input type="checkbox" checked={compreJaAlugado} onChange={(event) => setCompreJaAlugado(event.target.checked)} /><span><strong>Compre já alugado</strong><small>O comprador recebe o imóvel com contrato de locação vigente.</small></span></label>
          </div>

          <div className="form-section">
            <h3>Proprietário</h3>
            <div className="field-grid">
              <label>Nome<input value={proprietarioNome} onChange={(event) => setProprietarioNome(event.target.value)} /></label>
              <label>Contato<input value={proprietarioContato} onChange={(event) => setProprietarioContato(event.target.value)} placeholder="(11) 99999-9999" /></label>
            </div>
          </div>

          <div className="form-section">
            <h3>Acesso</h3>
            <div className="field-grid">
              <label>Tipo<select value={acessoTipo} onChange={(event) => setAcessoTipo(event.target.value)}>{accessOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label>Código<input value={acessoCodigo} onChange={(event) => setAcessoCodigo(event.target.value)} placeholder="Código da fechadura / cofre" /></label>
            </div>
            <label>Instruções<textarea value={acessoInstrucoes} onChange={(event) => setAcessoInstrucoes(event.target.value)} placeholder="Como entrar na unidade, portaria, autorização, horários..." rows={4} /></label>
          </div>

          <div className="form-section">
            <h3>Fotos e vídeos da unidade</h3>
            <div className="uw-photos">
              <label className="upload-button">＋ Adicionar fotos ou vídeos<input type="file" accept="image/*,video/*" multiple onChange={(event) => { addPhotos(event.target.files); event.currentTarget.value = ""; }} /></label>
              <strong className={photos.length ? "ok" : ""}>{photos.length} mídia{photos.length === 1 ? "" : "s"} selecionada{photos.length === 1 ? "" : "s"}</strong>
            </div>
            <PendingMediaClassifier items={photos} categories={unitMediaCategories} onCategoryChange={(id, category) => setPhotos((current) => current.map((item) => item.id === id ? { ...item, category } : item))} onAltTextChange={(id, altText) => setPhotos((current) => current.map((item) => item.id === id ? { ...item, altText } : item))} onRemove={removePhoto} onCoverChange={(id) => setPhotos((current) => current.map((item) => ({ ...item, cover: item.id === id })))} />
          </div>

          {saving && photos.length > 0 && <div className="upload-progress"><span style={{ width: `${uploadProgress}%` }} /><strong>Enviando mídias · {uploadProgress}%</strong></div>}
          {message && <div className={message.includes("aprovação") ? "form-message success" : "form-message"} role="alert">{message}</div>}
        </div>

        <footer className="capture-footer">
          <button className="ghost-action" onClick={onClose} disabled={saving} type="button">Cancelar</button>
          <button className="primary-action" disabled={saving} onClick={() => void save()} type="button">{saving ? "Cadastrando..." : createdUnitId ? "Enviar fotos restantes" : "Cadastrar apartamento"}</button>
        </footer>
      </section>
    </div>
  );
}
