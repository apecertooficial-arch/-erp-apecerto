"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

/**
 * Campo de valor em real, com máscara enquanto digita.
 *
 * O usuário digita só números e a máscara monta o valor da direita para a
 * esquerda (os dois últimos dígitos são os centavos): 1 → 0,01 · 150000 → 1.500,00.
 * Não há como digitar letra, ponto ou vírgula fora de lugar.
 *
 * `onChange` devolve número puro (1500) ou "" quando o campo está vazio —
 * é o mesmo formato que os formulários já usavam com type="number", então
 * a troca não mexe no que é enviado para a API.
 */

const fmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function paraTexto(valor: number | string | null | undefined): string {
  if (valor === "" || valor === null || valor === undefined) return "";
  const n = Number(valor);
  return Number.isFinite(n) ? fmt.format(n) : "";
}

/** Lê os dígitos como centavos: "12345" → 123.45 */
export function paraNumero(texto: string): number | "" {
  const digitos = texto.replace(/\D/g, "").slice(0, 15);
  if (!digitos) return "";
  return Number(digitos) / 100;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | string | null | undefined;
  onChange: (valor: number | "") => void;
  /** Some com o prefixo "R$" quando o rótulo já deixa claro que é dinheiro. */
  semPrefixo?: boolean;
};

export function MoneyInput({ value, onChange, semPrefixo, className, disabled, ...rest }: Props) {
  const [texto, setTexto] = useState(() => paraTexto(value));
  // Guarda o último valor que este campo emitiu, para distinguir uma mudança
  // vinda de fora (carregou do banco, limpou o formulário) da própria digitação.
  const emitido = useRef<number | "">(value === "" || value === null || value === undefined ? "" : Number(value));

  useEffect(() => {
    const externo = value === "" || value === null || value === undefined ? "" : Number(value);
    if (externo !== emitido.current) {
      emitido.current = externo;
      setTexto(paraTexto(externo));
    }
  }, [value]);

  const digitar = (bruto: string) => {
    const numero = paraNumero(bruto);
    emitido.current = numero;
    setTexto(numero === "" ? "" : fmt.format(numero));
    onChange(numero);
  };

  return (
    <div className={`money-input ${disabled ? "off" : ""} ${className ?? ""}`.trim()}>
      {!semPrefixo && <span>R$</span>}
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={texto}
        placeholder={rest.placeholder ?? "0,00"}
        onChange={(event) => digitar(event.target.value)}
        onFocus={(event) => event.target.select()}
      />
    </div>
  );
}

/** Versão para percentual: aceita casas decimais e mostra o sufixo %. */
export function PercentInput({ value, onChange, className, disabled, ...rest }: Omit<Props, "semPrefixo">) {
  const [texto, setTexto] = useState(() => (value === "" || value === null || value === undefined ? "" : String(value).replace(".", ",")));
  const emitido = useRef<number | "">(value === "" || value === null || value === undefined ? "" : Number(value));

  useEffect(() => {
    const externo = value === "" || value === null || value === undefined ? "" : Number(value);
    if (externo !== emitido.current) {
      emitido.current = externo;
      setTexto(externo === "" ? "" : String(externo).replace(".", ","));
    }
  }, [value]);

  const digitar = (bruto: string) => {
    // Aceita dígitos e uma vírgula; corta em duas casas.
    const limpo = bruto.replace(/[^\d,]/g, "").replace(/,{2,}/g, ",");
    const [inteiro, decimal] = limpo.split(",");
    const texto2 = decimal === undefined ? inteiro : `${inteiro},${decimal.slice(0, 2)}`;
    setTexto(texto2);
    const numero = texto2 === "" || texto2 === "," ? "" : Number(texto2.replace(",", "."));
    emitido.current = Number.isFinite(numero as number) ? (numero as number) : "";
    onChange(emitido.current);
  };

  return (
    <div className={`money-input pct ${disabled ? "off" : ""} ${className ?? ""}`.trim()}>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={texto}
        placeholder={rest.placeholder ?? "0"}
        onChange={(event) => digitar(event.target.value)}
        onFocus={(event) => event.target.select()}
      />
      <span>%</span>
    </div>
  );
}
