"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { MoneyInput } from "./MoneyInput";
import { applyOfficialWatermark } from "./watermark";
import { validateProductPrice } from "./quality";

const steps = ["Tipo", "Localização", "Proprietário", "Imóvel", "Acesso", "Mídia", "Revisão"];
const visibleStepIndexes = [0, 1, 3, 4, 5, 6];
const mediaCategories = ["Fachada", "Sala", "Cozinha", "Quarto", "Suíte", "Banheiro", "Varanda", "Piscina", "Lazer", "Planta", "Vista", "Tour", "Outro"];
const unitTypologies = ["HR", "HIS", "HMP", "R2V"];

type CaptureWizardProps = { onClose: () => void; onSaved: () => void };
type Condominium = { id: string; nome: string; cep: string | null; endereco: string; numero: string | null; complemento: string | null; bairro: string | null; cidade: string; uf: string };
type Owner = { id: string; nome: string; email: string; telefone: string };
type Unit = { id: string; number: string; type: string; area: string; parking: string; price: string; promotionalPrice: string };
type MediaItem = { id: string; file: File; kind: "foto" | "video"; category: string; cover: boolean; preview: string };

const emptyCondominium = { name: "", zipCode: "", address: "", number: "", complement: "", neighborhood: "", city: "São Paulo", state: "SP" };
const emptyOwner = { name: "", email: "", phone: "" };
const emptyProperty = { name: "", title: "", slogan: "", description: "", purpose: "venda", amenities: "", differentiators: "", developer: "", status: "pronto" as const, price: "", condominiumFee: "", propertyTax: "", otherCosts: "", area: "", bedrooms: "", suites: "", bathrooms: "", parking: "" };

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function newUnit(): Unit {
  return { id: crypto.randomUUID(), number: "", type: "", area: "", parking: "0", price: "", promotionalPrice: "" };
}

export function CaptureWizard({ onClose, onSaved }: CaptureWizardProps) {
  const [step, setStep] = useState(0);
  // Este wizard cadastra SEMPRE um empreendimento/prédio. Imóvel de terceiro (indicação)
  // agora entra pelo fluxo "Cadastrar apartamento" (UnitWizard), evitando prédios duplicados.
  const [propertyType] = useState<"terceiro" | "construtora">("construtora");
  // O nome do condomínio é busca com seleção: bateu com um existente, a captação entra nele.
  const [condominiumId, setCondominiumId] = useState("");
  const [semCondominio, setSemCondominio] = useState(false);
  const condominiumMode: "existing" | "new" = condominiumId ? "existing" : "new";
  const [ownerMode, setOwnerMode] = useState<"existing" | "new">("new");
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [condominium, setCondominium] = useState(emptyCondominium);
  const [owner, setOwner] = useState(emptyOwner);
  const [property, setProperty] = useState(emptyProperty);
  const [accessType, setAccessType] = useState<"chave_fisica" | "chave_digital" | "proprietario" | "portaria" | "outro">("chave_fisica");
  const [accessCode, setAccessCode] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");
  const [units, setUnits] = useState<Unit[]>([newUnit()]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaUrl, setMediaUrl] = useState("");

  const photos = media.filter((item) => item.kind === "foto");
  const videos = media.filter((item) => item.kind === "video");
  const visibleStepPosition = Math.max(0, visibleStepIndexes.indexOf(step));
  const progress = useMemo(() => `${Math.round(((visibleStepPosition + 1) / visibleStepIndexes.length) * 100)}%`, [visibleStepPosition]);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    void Promise.all([
      supabase.from("condominios").select("id,nome,cep,endereco,numero,complemento,bairro,cidade,uf").order("nome"),
      supabase.from("proprietarios").select("id,nome,email,telefone").order("nome"),
    ]).then(([condominiumResult, ownerResult]) => {
      if (condominiumResult.data) setCondominiums(condominiumResult.data);
      if (ownerResult.data) setOwners(ownerResult.data);
    });
  }, []);

  function selectedCondominium() {
    return condominiums.find((item) => item.id === condominiumId) ?? null;
  }

  function selectedOwner() {
    return owners.find((item) => item.id === ownerId) ?? null;
  }

  function validateCurrentStep() {
    if (step === 1 && semCondominio && (!condominium.address.trim() || !condominium.neighborhood.trim() || !condominium.city.trim())) return "Preencha endereço, bairro e cidade do imóvel.";
    if (step === 1 && !semCondominio && condominiumMode === "existing" && !condominiumId) return "Selecione um condomínio ou cadastre um novo.";
    if (step === 1 && !semCondominio && condominiumMode === "new" && !condominium.name.trim()) return "Dê o nome do condomínio ou marque a opção de imóvel sem condomínio.";
    if (step === 1 && !semCondominio && condominiumMode === "new" && (!condominium.address.trim() || !condominium.neighborhood.trim() || !condominium.city.trim())) return "Preencha endereço, bairro e cidade para o imóvel chegar completo ao site.";
    if (step === 2 && propertyType === "terceiro" && ownerMode === "existing" && !ownerId) return "Selecione um proprietário ou cadastre um novo.";
    if (step === 2 && propertyType === "terceiro" && ownerMode === "new" && (!owner.name.trim() || !owner.phone.trim() || !owner.email.trim())) return "Nome, telefone e e-mail do proprietário são obrigatórios.";
    if (step === 3 && (!property.name.trim() || !property.price || !property.area || !property.purpose)) return "Informe nome, finalidade, preço e área do imóvel.";
    if (step === 3 && property.price) { const precoCheck = validateProductPrice(numberValue(property.price), property.purpose === "aluguel" ? "Aluguel mensal" : "Preço de venda", property.purpose); if (precoCheck.error) return precoCheck.error; }
    if (step === 3 && property.description.trim().length < 80) return "A descrição comercial precisa ter pelo menos 80 caracteres.";
    if (step === 3 && propertyType === "construtora" && (!units.length || units.some((unit) => !unit.number.trim() || !unit.type.trim() || !unit.area || !unit.price))) return "Preencha número, tipologia, área e preço de cada unidade.";
    if (step === 4 && !accessInstructions.trim()) return "Descreva todas as instruções para entrar no imóvel.";
    if (step === 4 && accessType === "chave_digital" && !accessCode.trim()) return "Informe o código da chave digital.";
    if (step === 5 && photos.length < 1) return "Adicione pelo menos 1 foto do imóvel. Com menos de 6, ele ficará marcado para correção antes da aprovação.";
    if (step === 5 && media.some((item) => !item.category)) return "Classifique todas as mídias.";
    return "";
  }

  function next() {
    const validation = validateCurrentStep();
    if (validation) {
      setMessage(validation);
      return;
    }
    setMessage("");
    setStep((value) => {
      const alvo = Math.min(value + 1, steps.length - 1);
      return alvo === 2 && propertyType === "construtora" ? Math.min(alvo + 1, steps.length - 1) : alvo;
    });
  }

  function back() {
    setMessage("");
    setStep((value) => {
      const alvo = Math.max(value - 1, 0);
      return alvo === 2 && propertyType === "construtora" ? Math.max(alvo - 1, 0) : alvo;
    });
  }

  function addFiles(files: FileList | File[] | null, kind: "foto" | "video") {
    if (!files) return;
    // Captura os File AGORA — se deixar pro updater do setMedia, o reset do input
    // (event.currentTarget.value = "") esvazia o FileList antes de a gente ler.
    const list = Array.from(files as ArrayLike<File>);
    if (!list.length) return;
    setMedia((current) => {
      const hasCover = current.some((item) => item.cover);
      const additions = list.map((file, index) => ({
        id: crypto.randomUUID(), file, kind, category: kind === "video" ? "Tour" : "Sala", cover: kind === "foto" && !hasCover && index === 0, preview: URL.createObjectURL(file),
      }));
      return [...current, ...additions];
    });
  }

  // Roteia por tipo (colar / arrastar / link podem trazer foto e vídeo juntos)
  function ingestFiles(list: File[]) {
    const fotos = list.filter((f) => (f.type || "").startsWith("image/"));
    const vids = list.filter((f) => (f.type || "").startsWith("video/"));
    if (fotos.length) addFiles(fotos, "foto");
    if (vids.length) addFiles(vids, "video");
    if (!fotos.length && !vids.length) setMessage("Cole ou selecione arquivos de imagem ou vídeo.");
  }

  async function addByUrl(url: string) {
    const clean = url.trim();
    if (!clean) return;
    setMessage("");
    try {
      const res = await fetch(clean);
      if (!res.ok) throw new Error("resposta inválida");
      const blob = await res.blob();
      if (!/^image\/|^video\//.test(blob.type)) throw new Error("o link não é imagem nem vídeo");
      const base = (clean.split("/").pop() || "").split("?")[0] || `midia-${Date.now()}`;
      const ext = blob.type.startsWith("video/") ? "mp4" : "jpg";
      const name = /\.[a-z0-9]+$/i.test(base) ? base : `${base}.${ext}`;
      ingestFiles([new File([blob], name, { type: blob.type })]);
      setMediaUrl("");
    } catch {
      setMessage("Não foi possível baixar a mídia desse link (o site pode bloquear por segurança/CORS). Baixe o arquivo e use Adicionar/Colar.");
    }
  }

  function removeMedia(id: string) {
    setMedia((current) => {
      const removedCover = current.find((item) => item.id === id)?.cover;
      const remaining = current.filter((item) => item.id !== id);
      if (removedCover) {
        const firstPhoto = remaining.find((item) => item.kind === "foto");
        if (firstPhoto) return remaining.map((item) => ({ ...item, cover: item.id === firstPhoto.id }));
      }
      return remaining;
    });
  }

  // Colar (Ctrl+V) imagem/vídeo direto do clipboard no passo de mídia
  useEffect(() => {
    if (step !== 5) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (files && files.length) { event.preventDefault(); ingestFiles(Array.from(files)); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function safeFileName(name: string) {
    return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setUploadProgress(0);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Sua sessão expirou. Entre novamente.");

      const chosenCondominium = selectedCondominium();
      const chosenOwner = selectedOwner();
      const condominiumPayload = condominiumMode === "existing" && chosenCondominium ? {
        id: chosenCondominium.id, name: chosenCondominium.nome, zipCode: chosenCondominium.cep ?? "", address: chosenCondominium.endereco,
        number: chosenCondominium.numero ?? "", complement: chosenCondominium.complemento ?? "", neighborhood: chosenCondominium.bairro ?? "",
        city: chosenCondominium.cidade, state: chosenCondominium.uf,
      } : { id: null, ...condominium };
      const ownerPayload = propertyType === "terceiro" ? (ownerMode === "existing" && chosenOwner ? {
        id: chosenOwner.id, name: chosenOwner.nome, email: chosenOwner.email, phone: chosenOwner.telefone,
      } : { id: null, ...owner }) : null;

      const createResponse = await fetch("/api/capture", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create", propertyType, semCondominio, condominium: semCondominio ? { id: null, ...condominium, name: "" } : condominiumPayload, owner: ownerPayload,
          property: {
            name: property.name, title: property.title, slogan: property.slogan, description: property.description,
            purpose: property.purpose, amenities: property.amenities.split(",").map((item) => item.trim()).filter(Boolean),
            differentiators: property.differentiators.split(",").map((item) => item.trim()).filter(Boolean),
            developer: property.developer, status: property.status,
            price: numberValue(property.price), condominiumFee: numberValue(property.condominiumFee), propertyTax: numberValue(property.propertyTax),
            otherCosts: numberValue(property.otherCosts), area: numberValue(property.area), bedrooms: numberValue(property.bedrooms),
            suites: numberValue(property.suites), bathrooms: numberValue(property.bathrooms), parking: numberValue(property.parking),
          },
          access: { type: accessType, code: accessCode, instructions: accessInstructions },
          units: units.map((unit) => ({ number: unit.number, type: unit.type, area: numberValue(unit.area), parking: numberValue(unit.parking), price: numberValue(unit.price), promotionalPrice: unit.promotionalPrice ? numberValue(unit.promotionalPrice) : null })),
        }),
      });
      const created = await createResponse.json() as { id?: string; userId?: string; error?: string };
      if (!createResponse.ok || !created.id || !created.userId) throw new Error(created.error ?? "Não foi possível criar o rascunho.");

      // A capa é sempre a primeira foto na ordem definida na revisão.
      const coverPhotoId = media.find((entry) => entry.kind === "foto")?.id;
      for (let index = 0; index < media.length; index += 1) {
        const item = media[index];
        const uploadFile = item.kind === "foto" ? await applyOfficialWatermark(item.file) : item.file;
        const storagePath = `${created.userId}/${created.id}/${crypto.randomUUID()}-${safeFileName(uploadFile.name)}`;
        const { error: uploadError } = await supabase.storage.from("empreendimentos").upload(storagePath, uploadFile, { contentType: uploadFile.type, upsert: false });
        if (uploadError) throw new Error(`Falha ao enviar ${item.file.name}: ${uploadError.message}`);

        const { error: mediaError } = await supabase.from("midias").insert({
          empreendimento_id: created.id, tipo: item.kind, storage_path: storagePath, nome: item.file.name,
          categoria: item.category.toLowerCase(), is_capa: item.id === coverPhotoId,
        });
        if (mediaError) {
          await supabase.storage.from("empreendimentos").remove([storagePath]);
          throw new Error(`Falha ao registrar ${item.file.name}: ${mediaError.message}`);
        }
        setUploadProgress(Math.round(((index + 1) / media.length) * 100));
      }

      const finalizeResponse = await fetch("/api/capture", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize", id: created.id }),
      });
      const finalized = await finalizeResponse.json() as { error?: string };
      if (!finalizeResponse.ok) throw new Error(finalized.error ?? "O produto ficou salvo como rascunho, mas não foi finalizado.");

      setMessage("Produto cadastrado e conectado ao Supabase com sucesso.");
      await new Promise((resolve) => setTimeout(resolve, 700));
      onSaved();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar o produto.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Cadastrar condomínio">
      <button className="modal-scrim" onClick={onClose} aria-label="Fechar cadastro" type="button" />
      <section className="capture-panel">
        <header className="capture-header">
          <div><span className="eyebrow">CADASTRO DO PRÉDIO</span><h2>Cadastrar condomínio</h2><p>Cadastre o prédio, lançamento ou estoque da construtora. Apartamentos individuais usam o outro fluxo.</p></div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Fechar">×</button>
        </header>
        <div className="progress-track"><span style={{ width: progress }} /></div>
        <div className="step-list" aria-label="Etapas do cadastro">
          {visibleStepIndexes.map((index, position) => <span className={index === step ? "current" : index < step ? "done" : ""} key={steps[index]}>{index < step ? "✓" : position + 1}<small>{steps[index]}</small></span>)}
        </div>

        <div className="capture-body">
          {step === 0 && <div className="form-section"><h3>Cadastrar condomínio (prédio)</h3><p>Este cadastro cria um <strong>condomínio/prédio</strong> no catálogo — com unidades, plantas e preços individuais.</p><div className="notice"><strong>Só quer cadastrar um apartamento?</strong><span>Feche aqui e use o botão laranja <strong>“＋ Cadastrar apartamento”</strong> no catálogo. Ele vincula o apê a um prédio já existente, sem criar um condomínio duplicado.</span></div></div>}

          {step === 1 && <div className="form-section"><h3>Localização do empreendimento</h3><label className="toggle toggle-sem-condominio"><input type="checkbox" checked={semCondominio} onChange={(event) => { setSemCondominio(event.target.checked); if (event.target.checked) { setCondominiumId(""); setCondominium({ ...condominium, name: "" }); } }} /> Imóvel avulso — não faz parte de condomínio ou prédio</label>{semCondominio ? <p className="hint-inline">Sem condomínio: preencha só o endereço do imóvel abaixo e siga em frente.</p> : <p>Digite o nome do condomínio: se ele <strong>já existir</strong>, selecione na lista e a captação entra nele. Para um prédio novo, endereço, bairro e cidade são obrigatórios porque alimentam a busca do site.</p>}{!semCondominio && <label>Nome do condomínio<input list="cw-condominios" value={condominium.name} onChange={(event) => { const nome = event.target.value; setCondominium({ ...condominium, name: nome }); const achado = condominiums.find((c) => c.nome.trim().toLowerCase() === nome.trim().toLowerCase()); setCondominiumId(achado?.id ?? ""); }} placeholder="Digite para buscar ou criar" /><datalist id="cw-condominios">{condominiums.map((c) => <option key={c.id} value={c.nome}>{[c.bairro, c.cidade].filter(Boolean).join(" · ")}</option>)}</datalist></label>}{!semCondominio && (condominiumId ? <p className="notice" style={{marginTop:6}}><strong>Condomínio já cadastrado</strong><span> — a unidade entra nele; endereço e fotos do prédio já existem.</span></p> : <p className="hint-inline">Novo condomínio: complete os campos de localização abaixo antes de continuar.</p>)}<div className="field-grid"><label>CEP<input value={condominium.zipCode} onChange={(event) => setCondominium({ ...condominium, zipCode: event.target.value })} placeholder="00000-000" /></label><label>Endereço *<input value={condominium.address} onChange={(event) => setCondominium({ ...condominium, address: event.target.value })} placeholder="Rua, avenida..." /></label><label>Número<input value={condominium.number} onChange={(event) => setCondominium({ ...condominium, number: event.target.value })} /></label><label>Complemento<input value={condominium.complement} onChange={(event) => setCondominium({ ...condominium, complement: event.target.value })} /></label><label>Bairro *<input value={condominium.neighborhood} onChange={(event) => setCondominium({ ...condominium, neighborhood: event.target.value })} /></label><label>Cidade *<input value={condominium.city} onChange={(event) => setCondominium({ ...condominium, city: event.target.value })} /></label><label>UF<input value={condominium.state} maxLength={2} onChange={(event) => setCondominium({ ...condominium, state: event.target.value.toUpperCase() })} /></label></div></div>}

          {step === 2 && <div className="form-section"><h3>{propertyType === "terceiro" ? "Proprietário responsável" : "Responsável pelo produto"}</h3>{propertyType === "construtora" ? <div className="notice"><strong>Empreendimento de construtora</strong><span>O responsável comercial será identificado pela incorporadora na próxima etapa; proprietário não é obrigatório.</span></div> : <><p>Todo imóvel de terceiro fica associado a um proprietário cadastrado.</p><div className="mode-switch"><button className={ownerMode === "existing" ? "active" : ""} onClick={() => setOwnerMode("existing")} type="button">Selecionar existente</button><button className={ownerMode === "new" ? "active" : ""} onClick={() => setOwnerMode("new")} type="button">＋ Novo proprietário</button></div>{ownerMode === "existing" ? <label>Proprietário<select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Selecione...</option>{owners.map((item) => <option value={item.id} key={item.id}>{item.nome} · {item.telefone}</option>)}</select></label> : <><label>Nome completo<input value={owner.name} onChange={(event) => setOwner({ ...owner, name: event.target.value })} /></label><div className="field-grid"><label>Telefone<input value={owner.phone} onChange={(event) => setOwner({ ...owner, phone: event.target.value })} placeholder="(11) 99999-9999" /></label><label>E-mail<input type="email" value={owner.email} onChange={(event) => setOwner({ ...owner, email: event.target.value })} placeholder="nome@email.com" /></label></div></>}</>}</div>}

          {step === 3 && <div className="form-section">
            <h3>Conteúdo comercial e valores</h3>
            <p>Estas informações alimentam a ficha do ERP e a apresentação do imóvel no site.</p>
            <div className="field-grid"><label>Nome interno do produto<input value={property.name} onChange={(event) => setProperty({ ...property, name: event.target.value })} /></label><label>Título comercial<input value={property.title} onChange={(event) => setProperty({ ...property, title: event.target.value })} placeholder="Título que o cliente verá" /></label><label>Incorporadora<input value={property.developer} onChange={(event) => setProperty({ ...property, developer: event.target.value })} /></label><label>Finalidade<select value={property.purpose} onChange={(event) => setProperty({ ...property, purpose: event.target.value })}><option value="venda">Venda</option><option value="aluguel">Aluguel</option><option value="lancamento">Lançamento</option></select></label><label>Situação<select value={property.status} onChange={(event) => setProperty({ ...property, status: event.target.value as typeof property.status })}><option value="pronto">Pronto</option><option value="em_obras">Em obras</option><option value="lancamento">Lançamento</option></select></label></div>
            <label>Chamada curta<input value={property.slogan} onChange={(event) => setProperty({ ...property, slogan: event.target.value })} placeholder="Uma frase curta e convincente" /></label>
            <label>Descrição comercial<textarea rows={5} minLength={80} value={property.description} onChange={(event) => setProperty({ ...property, description: event.target.value })} placeholder="Descreva ambientes, estado do imóvel, localização e benefícios para o comprador." /><small>{property.description.trim().length}/80 caracteres mínimos</small></label>
            <div className="field-grid"><label>Lazer (separe por vírgulas)<input value={property.amenities} onChange={(event) => setProperty({ ...property, amenities: event.target.value })} placeholder="Piscina, academia, salão" /></label><label>Diferenciais (separe por vírgulas)<input value={property.differentiators} onChange={(event) => setProperty({ ...property, differentiators: event.target.value })} placeholder="Vista livre, reformado, varanda" /></label></div>
            <MoneyInput key={`principal-${property.purpose}`} defaultMode={property.purpose === "aluguel" ? "reais" : "milhares"} label={property.purpose === "aluguel" ? "Aluguel mensal" : "Preço de venda"} value={property.price} onChange={(value) => setProperty({ ...property, price: value === null ? "" : String(value) })} />
            <div className="field-grid"><label>Condomínio mensal<input type="number" min="0" value={property.condominiumFee} onChange={(event) => setProperty({ ...property, condominiumFee: event.target.value })} /></label><label>IPTU mensal<input type="number" min="0" value={property.propertyTax} onChange={(event) => setProperty({ ...property, propertyTax: event.target.value })} /></label><label>Outros custos<input type="number" min="0" value={property.otherCosts} onChange={(event) => setProperty({ ...property, otherCosts: event.target.value })} /></label><label>Área privativa<input type="number" min="0" step="0.01" value={property.area} onChange={(event) => setProperty({ ...property, area: event.target.value })} /></label><label>Dormitórios<input type="number" min="0" value={property.bedrooms} onChange={(event) => setProperty({ ...property, bedrooms: event.target.value })} /></label><label>Suítes<input type="number" min="0" value={property.suites} onChange={(event) => setProperty({ ...property, suites: event.target.value })} /></label><label>Banheiros<input type="number" min="0" value={property.bathrooms} onChange={(event) => setProperty({ ...property, bathrooms: event.target.value })} /></label><label>Vagas<input type="number" min="0" value={property.parking} onChange={(event) => setProperty({ ...property, parking: event.target.value })} /></label></div>
            {propertyType === "construtora" && <div className="unit-editor"><div className="section-row"><div><strong>Unidades do empreendimento</strong><small>{property.purpose === "aluguel" ? "Aluguel mensal em valor cheio, com confirmação antes de salvar." : "Preço em milhares por padrão, com confirmação do valor final."}</small></div><button className="secondary-action" onClick={() => setUnits([...units, newUnit()])} type="button">＋ Adicionar unidade</button></div>{units.map((unit, index) => <div className="unit-row professional" key={unit.id}><span>{index + 1}</span><input aria-label="Número da unidade" value={unit.number} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, number: event.target.value } : item))} placeholder="Unidade" /><select aria-label="Tipologia" value={unit.type} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, type: event.target.value } : item))}><option value="">Tipologia</option>{unitTypologies.map((t) => <option key={t} value={t}>{t}</option>)}</select><input aria-label="Área" type="number" min="0" value={unit.area} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, area: event.target.value } : item))} placeholder="m²" /><input aria-label="Vagas" type="number" min="0" value={unit.parking} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, parking: event.target.value } : item))} placeholder="Vagas" /><MoneyInput compact defaultMode={property.purpose === "aluguel" ? "reais" : "milhares"} label={`Preço da unidade ${unit.number || index + 1}`} value={unit.price} onChange={(value) => setUnits(units.map((item) => item.id === unit.id ? { ...item, price: value === null ? "" : String(value) } : item))} /><MoneyInput compact defaultMode={property.purpose === "aluguel" ? "reais" : "milhares"} label={`Preço promocional da unidade ${unit.number || index + 1}`} value={unit.promotionalPrice} onChange={(value) => setUnits(units.map((item) => item.id === unit.id ? { ...item, promotionalPrice: value === null ? "" : String(value) } : item))} /><button aria-label="Remover unidade" disabled={units.length === 1} onClick={() => setUnits(units.filter((item) => item.id !== unit.id))} type="button">×</button></div>)}</div>}
          </div>}

          {step === 4 && <div className="form-section"><h3>Como entrar no imóvel?</h3><div className="choice-grid compact access-grid">{([['chave_fisica','Chave física'],['chave_digital','Chave digital'],['proprietario','Com proprietário'],['portaria','Portaria'],['outro','Outro']] as const).map(([value, label]) => <button className={accessType === value ? "selected" : ""} onClick={() => setAccessType(value)} type="button" key={value}>{label}</button>)}</div>{accessType === "chave_digital" && <label>Código de acesso<input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Código da fechadura" /></label>}<label>Instruções completas<textarea value={accessInstructions} onChange={(event) => setAccessInstructions(event.target.value)} placeholder="Local da chave, portaria, autorização, horários e todas as instruções..." rows={6} /></label></div>}

          {step === 5 && <div className="form-section media-section"><h3>Fotos, vídeo e identificação</h3><p>Mínimo de 1 foto para salvar, mas o site exige 6 fotos para publicar o anúncio. Vídeo e capa são opcionais — quanto mais material, melhor o anúncio.</p><div className="media-dropzone" onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("dragging"); }} onDragLeave={(event) => event.currentTarget.classList.remove("dragging")} onDrop={(event) => { event.preventDefault(); event.currentTarget.classList.remove("dragging"); if (event.dataTransfer.files?.length) ingestFiles(Array.from(event.dataTransfer.files)); }}><div className="media-dz-head"><span className="media-dz-icon">⬆</span><div><strong>Arraste aqui, cole (Ctrl+V) ou selecione</strong><small>Fotos e vídeos — ou adicione por link abaixo</small></div></div><div className="media-upload-actions"><label className="upload-button">＋ Adicionar fotos<input type="file" accept="image/*" multiple onChange={(event) => { addFiles(event.target.files, "foto"); event.currentTarget.value = ""; }} /></label><label className="upload-button secondary">＋ Adicionar vídeo<input type="file" accept="video/*" multiple onChange={(event) => { addFiles(event.target.files, "video"); event.currentTarget.value = ""; }} /></label></div><div className="media-link-row"><input type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addByUrl(mediaUrl); } }} placeholder="Cole o link de uma imagem ou vídeo (https://...)" /><button type="button" className="secondary-action" onClick={() => void addByUrl(mediaUrl)} disabled={!mediaUrl.trim()}>Adicionar por link</button></div><div className="media-totals"><strong className={photos.length >= 1 ? "ok" : ""}>{photos.length} foto{photos.length === 1 ? "" : "s"}{photos.length >= 6 ? " · pronto p/ site" : ` · faltam ${6 - photos.length} p/ publicar no site`}</strong><strong className={videos.length >= 1 ? "ok" : ""}>{videos.length} vídeo{videos.length === 1 ? "" : "s"} (opcional)</strong></div></div><div className="media-list">{media.map((item) => <div className="media-row" key={item.id}><span className={`media-kind ${item.kind}`}>{item.kind === "foto" ? "FOTO" : "VÍDEO"}</span><div className="media-name"><strong>{item.file.name}</strong><small>{(item.file.size / 1024 / 1024).toFixed(1)} MB</small></div><select aria-label={`Classificar ${item.file.name}`} value={item.category} onChange={(event) => setMedia(media.map((entry) => entry.id === item.id ? { ...entry, category: event.target.value } : entry))}>{mediaCategories.map((category) => <option key={category}>{category}</option>)}</select>{item.kind === "foto" ? <label className="cover-choice"><input type="radio" name="cover" checked={item.cover} onChange={() => setMedia(media.map((entry) => ({ ...entry, cover: entry.id === item.id })))} /> Capa</label> : <span className="cover-placeholder" />}<button aria-label={`Remover ${item.file.name}`} onClick={() => removeMedia(item.id)} type="button">×</button></div>)}</div></div>}

          {step === 6 && <div className="form-section"><h3>Revisão antes de salvar</h3><div className="review-list"><span className="complete">Condomínio e endereço completo</span><span className={propertyType === "construtora" || Boolean(ownerId || owner.name) ? "complete" : ""}>Proprietário associado</span><span className="complete">Preço, custos e características</span><span className="complete">Instruções de acesso</span><span className={photos.length >= 1 ? "complete" : ""}>{photos.length} foto(s) e {videos.length} vídeo(s)</span><span className={photos.length ? "complete" : ""}>Capa: a primeira foto da ordem abaixo</span>{propertyType === "construtora" && <span className={units.length ? "complete" : ""}>{units.length} unidade(s) cadastrada(s)</span>}</div>{media.length > 0 && <ReviewMedia media={media} setMedia={setMedia} />}<div className="notice"><strong>Gravação segura</strong><span>O produto será criado como rascunho, os arquivos serão enviados e somente então a captação será finalizada.</span></div>{saving && <div className="upload-progress"><span style={{ width: `${uploadProgress}%` }} /><strong>Enviando mídias · {uploadProgress}%</strong></div>}</div>}

          {message && <div className={message.includes("sucesso") ? "form-message success" : "form-message"} role="alert">{message}</div>}
        </div>

        <footer className="capture-footer"><button className="ghost-action" onClick={back} disabled={step === 0 || saving} type="button">Voltar</button><span>Etapa {visibleStepPosition + 1} de {visibleStepIndexes.length}</span>{step < steps.length - 1 ? <button className="primary-action" onClick={next} type="button">Continuar</button> : <button className="primary-action" disabled={saving} onClick={() => void save()} type="button">{saving ? "Salvando..." : "Cadastrar condomínio"}</button>}</footer>
      </section>
    </div>
  );
}

function ReviewMedia({ media, setMedia }: { media: MediaItem[]; setMedia: (value: MediaItem[] | ((cur: MediaItem[]) => MediaItem[])) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const reorder = (fromId: string, toId: string) => setMedia((cur) => {
    if (fromId === toId) return cur;
    const arr = [...cur];
    const from = arr.findIndex((m) => m.id === fromId);
    const to = arr.findIndex((m) => m.id === toId);
    if (from < 0 || to < 0) return arr;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    return arr;
  });
  const makeCover = (id: string) => setMedia((cur) => {
    const arr = [...cur];
    const idx = arr.findIndex((m) => m.id === id);
    if (idx < 0) return arr;
    const [moved] = arr.splice(idx, 1);
    arr.unshift(moved);
    return arr;
  });
  const firstPhotoId = media.find((m) => m.kind === "foto")?.id;
  return <div className="review-media">
    <div className="review-media-head"><strong>Mídias e ordem de exibição</strong><small>Arraste para reordenar. A primeira foto é a capa do produto.</small></div>
    <div className="review-media-grid">
      {media.map((item, index) => {
        const isCover = item.id === firstPhotoId;
        return <div className={`rm-tile ${isCover ? "is-cover" : ""} ${dragId === item.id ? "dragging" : ""}`} key={item.id}
          draggable onDragStart={() => setDragId(item.id)} onDragEnd={() => setDragId(null)}
          onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragId) reorder(dragId, item.id); setDragId(null); }}>
          <div className="rm-thumb">
            {item.kind === "foto" ? <img src={item.preview} alt={item.file.name} /> : <video src={item.preview} muted playsInline preload="metadata" />}
            <span className="rm-pos">{index + 1}</span>
            {isCover && <span className="rm-cover-badge">★ Capa</span>}
            {item.kind === "video" && <span className="rm-video-badge">▶ Vídeo</span>}
          </div>
          <div className="rm-meta"><small title={item.file.name}>{item.category}</small>{item.kind === "foto" && !isCover && <button type="button" onClick={() => makeCover(item.id)}>Tornar capa</button>}</div>
        </div>;
      })}
    </div>
  </div>;
}
