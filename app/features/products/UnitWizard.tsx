"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

type UnitWizardProps = { accessToken: string; onClose: () => void; onSaved: () => void };
type Building = { id: string; nome: string; bairro: string | null; cidade: string | null };

const accessOptions: Array<[string, string]> = [
  ["chave_digital", "Chave digital"],
  ["chave_fisica", "Chave física"],
  ["porteiro", "Porteiro"],
  ["biometria", "Biometria"],
  ["corretor", "Corretor"],
  ["proprietario", "Proprietário"],
];

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

export function UnitWizard({ accessToken, onClose, onSaved }: UnitWizardProps) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [empreendimentoId, setEmpreendimentoId] = useState("");
  const [numero, setNumero] = useState("");
  const [tipologia, setTipologia] = useState("");
  const [area, setArea] = useState("");
  const [vagas, setVagas] = useState("");
  const [valorTabela, setValorTabela] = useState("");
  const [valorPromo, setValorPromo] = useState("");
  const [proprietarioNome, setProprietarioNome] = useState("");
  const [proprietarioContato, setProprietarioContato] = useState("");
  const [acessoTipo, setAcessoTipo] = useState("chave_digital");
  const [acessoCodigo, setAcessoCodigo] = useState("");
  const [acessoInstrucoes, setAcessoInstrucoes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    void supabase.from("empreendimentos").select("id,nome,bairro,cidade").order("nome").then(({ data }) => {
      if (data) setBuildings(data as Building[]);
    });
  }, []);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    if (!list.length) return;
    setPhotos((current) => [...current, ...list]);
  }

  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, i) => i !== index));
  }

  function validate() {
    if (!empreendimentoId) return "Selecione o prédio da unidade.";
    if (!numero.trim()) return "Informe o número da unidade.";
    if (!valorTabela.trim()) return "Informe o valor de tabela da unidade.";
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
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? accessToken;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");

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

      for (let index = 0; index < photos.length; index += 1) {
        const file = photos[index];
        const storagePath = `${created.userId}/${empreendimentoId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("empreendimentos").upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(`Falha ao enviar ${file.name}: ${uploadError.message}`);
        const { error: mediaError } = await supabase.from("midias").insert({
          empreendimento_id: empreendimentoId, unidade_id: created.unidadeId, tipo: "foto",
          storage_path: storagePath, nome: file.name, categoria: "unidade", is_capa: false,
        } as never);
        if (mediaError) {
          await supabase.storage.from("empreendimentos").remove([storagePath]);
          throw new Error(`Falha ao registrar ${file.name}: ${mediaError.message}`);
        }
        setUploadProgress(Math.round(((index + 1) / photos.length) * 100));
      }

      setMessage("Unidade enviada para aprovação.");
      await new Promise((resolve) => setTimeout(resolve, 700));
      onSaved();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível cadastrar a unidade.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Cadastrar unidade">
      <button className="modal-scrim" onClick={onClose} aria-label="Fechar cadastro" type="button" />
      <section className="capture-panel">
        <header className="capture-header">
          <div><span className="eyebrow">CAPTAÇÃO DE UNIDADE</span><h2>Cadastrar unidade</h2><p>Adicione a sua unidade a um prédio já existente.</p></div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Fechar">×</button>
        </header>

        <div className="capture-body">
          <div className="form-section">
            <h3>Prédio</h3>
            <p>Selecione o empreendimento onde fica a unidade.</p>
            <label>Prédio<select value={empreendimentoId} onChange={(event) => setEmpreendimentoId(event.target.value)}><option value="">Selecione...</option>{buildings.map((item) => <option value={item.id} key={item.id}>{item.nome}{item.bairro ? ` · ${item.bairro}` : ""}</option>)}</select></label>
          </div>

          <div className="form-section">
            <h3>Dados da unidade</h3>
            <div className="field-grid">
              <label>Número<input value={numero} onChange={(event) => setNumero(event.target.value)} placeholder="Ex.: 142" /></label>
              <label>Tipologia<input value={tipologia} onChange={(event) => setTipologia(event.target.value)} placeholder="Ex.: HR, 2 dorm." /></label>
              <label>Área (m²)<input type="number" min="0" step="0.01" value={area} onChange={(event) => setArea(event.target.value)} /></label>
              <label>Vagas<input type="number" min="0" value={vagas} onChange={(event) => setVagas(event.target.value)} /></label>
              <label>Valor de tabela<input type="number" min="0" value={valorTabela} onChange={(event) => setValorTabela(event.target.value)} /></label>
              <label>Valor promocional<input type="number" min="0" value={valorPromo} onChange={(event) => setValorPromo(event.target.value)} /></label>
            </div>
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
            <h3>Fotos da unidade</h3>
            <div className="uw-photos">
              <label className="upload-button">＋ Adicionar fotos<input type="file" accept="image/*" multiple onChange={(event) => { addPhotos(event.target.files); event.currentTarget.value = ""; }} /></label>
              <strong className={photos.length ? "ok" : ""}>{photos.length} foto{photos.length === 1 ? "" : "s"} selecionada{photos.length === 1 ? "" : "s"}</strong>
            </div>
            {photos.length > 0 && <div className="uw-photo-list">{photos.map((file, index) => <div className="uw-photo-row" key={`${file.name}-${index}`}><span className="uw-photo-name" title={file.name}>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small><button type="button" aria-label={`Remover ${file.name}`} onClick={() => removePhoto(index)}>×</button></div>)}</div>}
          </div>

          {saving && photos.length > 0 && <div className="upload-progress"><span style={{ width: `${uploadProgress}%` }} /><strong>Enviando fotos · {uploadProgress}%</strong></div>}
          {message && <div className={message.includes("aprovação") ? "form-message success" : "form-message"} role="alert">{message}</div>}
        </div>

        <footer className="capture-footer">
          <button className="ghost-action" onClick={onClose} disabled={saving} type="button">Cancelar</button>
          <button className="primary-action" disabled={saving} onClick={() => void save()} type="button">{saving ? "Cadastrando..." : "Cadastrar unidade"}</button>
        </footer>
      </section>
    </div>
  );
}
