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
  if (!raw) return "";
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
  if (!raw) return "";
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
  if (!raw) return "";
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
  const parts = brDate.includes('-') ? brDate.split('-') : brDate.split('/');
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
  // Calcula amanha a partir do hoje em SP (evita problemas de fuso)
  const todayISO = getBrTodayISO();
  const [y, m, d] = todayISO.split('-').map(Number);
  const tomorrow = new Date(y, m - 1, d + 1, 12, 0, 0);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const isoTomorrow = formatter.format(tomorrow);
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

/**
 * Próxima data (DD-MM-YYYY) que cai no dia-do-mês informado, a partir de hoje.
 * Se o dia já passou (ou é hoje) neste mês, pula pro mês seguinte.
 */
export const proximaDataComDia = (dia: number): string => {
  const hoje = hojeBR();
  const [, mm, yyyy] = hoje.split('-');
  const maxDay = new Date(Number(yyyy), Number(mm), 0).getDate();
  const clampedDay = Math.min(Math.max(dia, 1), maxDay);
  const pad = (n: number) => String(n).padStart(2, '0');
  const candidato = `${pad(clampedDay)}-${mm}-${yyyy}`;
  if (brToIso(candidato) <= getBrTodayISO()) {
    return addMonthsPreservingDay(candidato, 1);
  }
  return candidato;
};

/**
 * Data de vencimento da parcela N, dado a 1ª data e a frequência.
 * Mensal: soma meses preservando o dia. Semanal: soma 7 dias por parcela.
 */
export const dataParcela = (primeiraData: string, indiceZeroBased: number, frequencia: 'monthly' | 'weekly'): string => {
  return frequencia === 'weekly'
    ? addDays(primeiraData, 7 * indiceZeroBased)
    : addMonthsPreservingDay(primeiraData, indiceZeroBased);
};

/**
 * Juros fixo por parcela: a taxa é sempre mensal. Semanal reparte esse juros
 * mensal pelas ~4 semanas do mês, mas o valor repete IGUAL em toda parcela
 * (não divide de novo pelo total de parcelas do contrato).
 */
export const jurosFixoPorParcela = (jurosMensal: number, frequencia: 'monthly' | 'weekly'): number => {
  return frequencia === 'weekly' ? jurosMensal / 4 : jurosMensal;
};

export interface ParcelaCalculada {
  number: number;
  capitalValue: number;
  interestValue: number;
  dueDate: string;
  status: 'pendente';
}

/**
 * Distribui o capital total em N parcelas (centavos extras nas primeiras,
 * pra fechar exato) com o juros fixo repetindo em cada uma.
 */
export const distribuirParcelas = (
  capitalTotal: number,
  jurosMensal: number,
  numParcelas: number,
  primeiraData: string,
  frequencia: 'monthly' | 'weekly'
): ParcelaCalculada[] => {
  const juros = jurosFixoPorParcela(jurosMensal, frequencia);
  const totalCents = Math.round(capitalTotal * 100);
  const n = Math.max(1, numParcelas);
  const basePerInst = Math.floor(totalCents / n);
  const extraCents = totalCents - basePerInst * n;

  const parcelas: ParcelaCalculada[] = [];
  for (let i = 1; i <= n; i++) {
    const instCents = i <= extraCents ? basePerInst + 1 : basePerInst;
    parcelas.push({
      number: i,
      capitalValue: Math.round(instCents) / 100,
      interestValue: juros,
      dueDate: dataParcela(primeiraData, i - 1, frequencia),
      status: 'pendente'
    });
  }
  return parcelas;
};

/**
 * Menor número de parcelas cujo valor (capital/n + juros fixo) cabe no limite
 * que o cliente pode pagar por período.
 */
export const calcularNumParcelasPorLimite = (
  capitalTotal: number,
  jurosMensal: number,
  limiteMaximoPorParcela: number,
  frequencia: 'monthly' | 'weekly'
): number => {
  const juros = jurosFixoPorParcela(jurosMensal, frequencia);
  const capitalMaxPorParcela = limiteMaximoPorParcela - juros;
  if (capitalMaxPorParcela <= 0) return 0;
  return Math.max(1, Math.ceil(capitalTotal / capitalMaxPorParcela));
};

export const addMonthsPreservingDay = (dateStr: string, months: number): string => {
  const iso = brToIso(dateStr);
  if (!iso) return dateStr;
  const [y, m, d] = iso.split('-').map(Number);
  // Aritmetica pura em meses para evitar problemas de DST e fuso
  const totalMonths = (y * 12 + (m - 1)) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1; // 1-based
  // Clamp: ultimo dia do mes alvo via dia 0 do proximo mes
  const maxDay = new Date(targetYear, targetMonth, 0).getDate();
  const clampedDay = Math.min(d, maxDay);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(clampedDay)}-${pad(targetMonth)}-${targetYear}`;
};


/**
 * A partir de quantos dias de atraso um contrato vira CRITICO.
 * Mudar aqui muda a regra em todo o app.
 */
export const DIAS_PARA_CRITICO = 5;

/**
 * Dias de atraso de uma data BR (DD-MM-YYYY) em relacao a hoje em Sao Paulo.
 * Positivo = vencida ha N dias | 0 = vence hoje | negativo = ainda vai vencer.
 */
export const diasDeAtraso = (dueDateBr: string): number | null => {
  const iso = brToIso(dueDateBr);
  if (!iso) return null;
  const d1 = new Date(iso + 'T12:00:00');
  const d2 = new Date(getBrTodayISO() + 'T12:00:00');
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
};

/** Vencido ha DIAS_PARA_CRITICO dias ou mais. */
export const isCritico = (dueDateBr: string): boolean => {
  const d = diasDeAtraso(dueDateBr);
  return d !== null && d >= DIAS_PARA_CRITICO;
};

/** Vencido ha 1 ate DIAS_PARA_CRITICO-1 dias. */
export const isVencidoRecente = (dueDateBr: string): boolean => {
  const d = diasDeAtraso(dueDateBr);
  return d !== null && d >= 1 && d < DIAS_PARA_CRITICO;
};
