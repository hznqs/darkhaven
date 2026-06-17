export function normalizePhoneBR(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function formatPhoneBR(value: string) {
  const digits = normalizePhoneBR(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function parseCurrencyBR(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  if (digits.length <= 2) return Number(digits);
  return Number(digits) / 100;
}

export function formatCurrencyBR(value: string | number) {
  const amount = typeof value === "number" ? value : parseCurrencyBR(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(amount);
}

export function normalizeCpfCnpj(value: string) {
  return value.replace(/\D/g, "").slice(0, 14);
}

export function formatCpfCnpj(value: string) {
  const digits = normalizeCpfCnpj(value);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

export function normalizeCep(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatCep(value: string) {
  const digits = normalizeCep(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
