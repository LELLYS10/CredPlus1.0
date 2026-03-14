import { Loan } from './types';

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatToInputMask = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const parseBrazilianNumber = (value: string | number): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const onlyDigits = value.toString().replace(/\D/g, '');
  if (!onlyDigits) return 0;
  return parseFloat(onlyDigits) / 100;
};

export function countDigitsBeforeCursor(str: string, cursorPos: number) {
  const left = str.slice(0, cursorPos);
  return (left.match(/\d/g) || []).length;
}

export function cursorPosForDigitIndex(formatted: string, digitIndex: number) {
  if (digitIndex <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) count++;
    if (count >= digitIndex) return i + 1;
  }
  return formatted.length;
}

export function maskDate(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  const dd = d.slice(0, 2);
  const mm = d.slice(2, 4);
  const yyyy = d.slice(4, 8);
  let out = dd;
  if (mm.length) out += "-" + mm;
  if (yyyy.length) out += "-" + yyyy;
  return out;
}

export function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  const a = d.slice(0, 2);
  const b = d.slice(2, 3);
  const c = d.slice(3, 7);
  const e = d.slice(7, 11);
  let out = a;
  if (b.length) out += " " + b;
  if (c.length) out += " " + c;
  if (e.length) out += "-" + e;
  return out;
}

export function maskCPF(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 9);
  const e = d.slice(9, 11);
  let out = a;
  if (b.length) out += "." + b;
  if (c.length) out += "." + c;
  if (e.length) out += "-" + e;
  return out;
}

/**
 * Obtém a data ISO (YYYY-MM-DD) do fuso America/Sao_Paulo agora.
 * Usamos en-CA pois o formato padrão é YYYY-MM-DD.
 */
export const getBrTodayISO = (): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
};

export const hojeBR = () => {
  const iso = getBrTodayISO();
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

export const getTodayStr = hojeBR;

/**
 * Converte DD-MM-YYYY para YYYY-MM-DD sem usar objeto Date.
 */
export const brToIso = (brDate: string): string => {
  if (!brDate || brDate.length < 10) return '';
  const parts = brDate.split('-');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

/**
 * Converte YYYY-MM-DD para DD-MM-YYYY sem usar objeto Date,
 * evitando deslocamentos de fuso horário.
 */
export const isoToBr = (isoDate: string): string => {
  if (!isoDate) return '';
  const datePart = isoDate.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
};

export const addDays = (dateStr: string, days: number): string => {
  const iso = brToIso(dateStr);
  if (!iso) return dateStr;
  const [y, m, d] = iso.split('-').map(Number);
  // Adiciona dias usando o tempo local (meio-dia) para evitar virada de fuso
  const date = new Date(y, m - 1, d, 12, 0, 0);
  date.setDate(date.getDate() + days);
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return isoToBr(formatter.format(date));
};

export const isOverdue = (dueDateBr: string) => {
  if (!dueDateBr) return false;
  const isoDue = brToIso(dueDateBr);
  const isoToday = getBrTodayISO();
  return isoDue < isoToday;
};

export const isDueToday = (dueDateBr: string) => {
  if (!dueDateBr) return false;
  const isoDue = brToIso(dueDateBr);
  const isoToday = getBrTodayISO();
  return isoDue === isoToday;
};

export const isDueTomorrow = (dueDateBr: string) => {
  if (!dueDateBr) return false;
  const isoDue = brToIso(dueDateBr);
  
  const tomorrowDate = new Date();
  // Forçamos o cálculo do "amanhã" também no fuso de SP
  const spToday = new Date(new Intl.DateTimeFormat('en-US', {timeZone: 'America/Sao_Paulo'}).format(new Date()));
  spToday.setDate(spToday.getDate() + 1);
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const isoTomorrow = formatter.format(spToday);
  
  return isoDue === isoTomorrow;
};

export const isThisMonth = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const [_, m, y] = parts;
  const todayISO = getBrTodayISO();
  const [currY, currM] = todayISO.split('-');
  return m === currM && y === currY;
};

export const isLoanPendingForFilter = (loan: Loan, checker: (d: string) => boolean): boolean => {
  if (loan.status === 'paid') return false;
  
  if (loan.loanType === 'recurrent') {
    const juroFaltante = Math.round(((loan.interestFixedAmount || 0) - (loan.jurosPagoNoCiclo || 0)) * 100) / 100;
    // Se já pagou os juros, sai da lista de pendências
    if (juroFaltante <= 0) return false;
    return checker(loan.dueDate);
  } else {
    if (loan.installments && loan.installments.length > 0) {
      // Para parcelados, o contrato só aparece se a parcela pendente bater com o filtro
      return loan.installments.some(inst => inst.status === 'pendente' && checker(inst.dueDate));
    }
    return checker(loan.dueDate);
  }
};

export const addMonthsPreservingDay = (dateStr: string, months: number): string => {
  const iso = brToIso(dateStr);
  if (!iso) return dateStr;
  const [y, m, d] = iso.split('-').map(Number);
  const targetDate = new Date(y, m - 1 + months, d, 12, 0, 0);
  if (targetDate.getDate() !== d) {
    targetDate.setDate(0);
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return isoToBr(formatter.format(targetDate));
};
