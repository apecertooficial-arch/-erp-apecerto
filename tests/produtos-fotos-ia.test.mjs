import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PHOTO_ORGANIZER_MAX_IMAGES,
  buildPhotoOrganizerRequest,
  extractResponseText,
  normalizePropertyType,
  photoOrganizerSchema,
  sanitizeCurrentCategory,
  validatePhotoOrganizerOutput,
} from "../supabase/functions/ia-router/photo-organizer.ts";

const edge = await readFile("supabase/functions/ia-router/index.ts", "utf8");
const component = await readFile("app/features/products/PhotoAiOrganizer.tsx", "utf8");
const api = await readFile("app/api/product/route.ts", "utf8");
const migration = await readFile("supabase/migrations/20260827193000_produtos_organizador_fotos_ia.sql", "utf8");

const tokens = ["img_a", "img_b"];
const validOutput = {
  suggestions: [
    {token:"img_a",category:"Sala",sort_order:0,is_cover:true,display_name:"Sala integrada",alt_text:"Sala integrada iluminada",warning:"nenhum",warning_detail:"",confidence:.94},
    {token:"img_b",category:"Cozinha",sort_order:1,is_cover:false,display_name:"Cozinha planejada",alt_text:"Cozinha planejada com bancada",warning:"qualidade_ruim",warning_detail:"Imagem um pouco escura",confidence:.81},
  ],
};

test("contrato da OpenAI envia somente imagens derivadas e metadados mínimos", () => {
  const request = buildPhotoOrganizerRequest({
    model:"gpt-4o-mini",
    propertyType:"apartamento",
    photos:[
      {token:"img_a",category:"Sala",dataUrl:"data:image/webp;base64,AAAA"},
      {token:"img_b",category:null,dataUrl:"data:image/webp;base64,BBBB"},
    ],
  });
  assert.equal(request.store, false);
  assert.equal(request.background, false);
  assert.equal(request.model, "gpt-4o-mini");
  assert.equal(request.input[0].content.filter((item) => item.type === "input_image").length, 2);
  assert.equal(request.input[0].content.some((item) => "image_url" in item && !String(item.image_url).startsWith("data:image/")), false);
  const serialized = JSON.stringify(request).toLowerCase();
  for (const forbidden of ["proprietario", "captador", "corretor", "telefone", "email", "endereco", "preco", "comissao", "chave", "nota_interna", "uuid"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden));
  }
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.equal(PHOTO_ORGANIZER_MAX_IMAGES, 20);
  assert.equal(normalizePropertyType("Rua Exemplo, 123 - apartamento"), "imóvel residencial");
  assert.equal(normalizePropertyType("Cobertura"), "cobertura");
  assert.equal(sanitizeCurrentCategory("Sala"), "Sala");
  assert.equal(sanitizeCurrentCategory("Chave na portaria"), null);
});

test("saída estruturada rejeita enum, ID, ordem e capa malformados", () => {
  assert.deepEqual(validatePhotoOrganizerOutput(validOutput, tokens), validOutput);
  assert.equal(validatePhotoOrganizerOutput({...validOutput,suggestions:validOutput.suggestions.map((item,index)=>({...item,token:index?"img_externo":item.token}))},tokens), null);
  assert.equal(validatePhotoOrganizerOutput({...validOutput,suggestions:validOutput.suggestions.map((item)=>({...item,is_cover:true}))},tokens), null);
  assert.equal(validatePhotoOrganizerOutput({...validOutput,suggestions:validOutput.suggestions.map((item)=>({...item,sort_order:0}))},tokens), null);
  assert.equal(validatePhotoOrganizerOutput({...validOutput,suggestions:validOutput.suggestions.map((item,index)=>index?{...item,category:"Cobertura secreta"}:item)},tokens), null);
  const schema = photoOrganizerSchema(tokens);
  assert.deepEqual(schema.properties.suggestions.items.properties.token.enum,tokens);
  assert.equal(schema.properties.suggestions.minItems,2);
});

test("parser da Responses API lê somente output_text", () => {
  assert.equal(extractResponseText({output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(validOutput)}]}]}),JSON.stringify(validOutput));
  assert.equal(extractResponseText({output:[{type:"tool_call",content:[]}]}),"");
});

test("endpoint é desligável, autenticado, limitado e não registra conteúdo", () => {
  assert.match(edge,/OPENAI_PHOTO_ORGANIZER_ENABLED/);
  assert.match(edge,/Deno\.env\.get\("OPENAI_API_KEY"\)/);
  assert.match(edge,/OPENAI_PHOTO_ORGANIZER_MODEL/);
  assert.match(edge,/PHOTO_ORGANIZER_MAX_IMAGES/);
  assert.match(edge,/AbortSignal\.timeout\(45_000\)/);
  assert.match(edge,/Idempotency-Key/);
  assert.match(edge,/not_captor/);
  assert.match(edge,/midias_invalidas/);
  assert.match(edge,/input\.userSupabase\.rpc\("produto_midias_versao"/);
  assert.match(edge,/https:\/\/api\.openai\.com\/v1\/responses/);
  assert.doesNotMatch(edge,/photo_organizer[^\n]*(storage_path|signedUrl|prompt|responseData|usuarioId)/);
  assert.doesNotMatch(edge,/agente_execucoes[^\n]*photo_organizer/);
});

test("nenhuma sugestão é persistida antes da confirmação humana", () => {
  const edgeBranch = edge.match(/async function handlePhotoOrganizer[\s\S]*?function segredoIgual/)?.[0] ?? "";
  assert.doesNotMatch(edgeBranch,/\.from\("midias"\)\.update/);
  assert.doesNotMatch(edgeBranch,/produto_midias_aplicar_ia/);
  assert.match(component,/Confirme antes de enviar/);
  assert.match(component,/Nenhum proprietário, contato, endereço privado ou nota interna será enviado/);
  assert.match(component,/Aplicar sugestões aceitas/);
  assert.match(component,/Rejeitar esta sugestão/);
  assert.match(component,/Desfazer aplicação/);
  assert.match(component,/A edição manual continua funcionando/);
});

test("aplicação é atômica, autorizada, versionada e reversível", () => {
  assert.match(migration,/create or replace function public\.produto_midias_aplicar_ia/);
  assert.match(migration,/for update/);
  assert.match(migration,/MEDIA_AI_CONFLICT/);
  assert.match(migration,/public\.is_product_manager\(\)/);
  assert.match(migration,/u\.captador_corretor_id = v_corretor_id/);
  assert.match(migration,/v_quantidade > 20/);
  assert.match(migration,/m\.unidade_id is not distinct from p_unidade_id/);
  assert.match(migration,/p_restaurar/);
  assert.match(migration,/'desfazer', v_antes/);
  assert.match(migration,/revoke all on function public\.produto_midias_aplicar_ia[\s\S]*from public, anon, authenticated/);
  assert.match(api,/applyPhotoAiSuggestions/);
  assert.match(api,/restorePhotoAiSuggestions/);
  assert.match(api,/rpc\("produto_midias_aplicar_ia"/);
  assert.match(api,/status === 409/);
});
