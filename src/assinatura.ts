// ============================================================================
// Regra unica da assinatura do CredPlus.
// Usada pela tela de bloqueio, pelo painel admin e pelo robo de avisos.
// Mudou a regra? Muda aqui e vale para todos.
//
// Linha do tempo a partir do vencimento:
//   D-1  avisa (vence amanha)
//   D0   avisa (vence hoje)
//   D+1..D+4  avisa todo dia, acesso ainda liberado (carencia)
//   D+5  corta o acesso
// ============================================================================

export const CARENCIA_DIAS = 5;

/** Mensalidade do CredPlus. Preco unico para todos os assinantes. */
export const VALOR_MENSALIDADE = 79.90;

export const formatarReal = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const CONTATO_WHATSAPP = '63 99263-5525';
export const CONTATO_EMAIL = 'credplusemp@gmail.com';

export type SituacaoAssinatura =
  | 'sem_vencimento'
  | 'em_dia'
  | 'vence_amanha'
  | 'vence_hoje'
  | 'atrasado'
  | 'cortado';

const MS_DIA = 86400000;
const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Dias ate vencer. Negativo = venceu ha N dias. null = sem vencimento definido. */
export const diasParaVencer = (expiresAt?: string | null): number | null => {
  if (!expiresAt) return null;
  const venc = new Date(expiresAt);
  if (isNaN(venc.getTime())) return null;
  return Math.round((meiaNoite(venc) - meiaNoite(new Date())) / MS_DIA);
};

export const situacaoAssinatura = (expiresAt?: string | null): SituacaoAssinatura => {
  const d = diasParaVencer(expiresAt);
  if (d === null) return 'sem_vencimento';
  if (d > 1) return 'em_dia';
  if (d === 1) return 'vence_amanha';
  if (d === 0) return 'vence_hoje';
  return -d >= CARENCIA_DIAS ? 'cortado' : 'atrasado';
};

/** Perdeu o acesso: passou da carencia. Sem vencimento definido nunca bloqueia. */
export const assinaturaBloqueada = (expiresAt?: string | null): boolean =>
  situacaoAssinatura(expiresAt) === 'cortado';

/** Precisa aparecer na aba VENCIDOS do painel. */
export const precisaCobranca = (expiresAt?: string | null): boolean =>
  ['vence_hoje', 'atrasado', 'cortado'].includes(situacaoAssinatura(expiresAt));

export const rotuloSituacao = (expiresAt?: string | null): { texto: string; cor: string } => {
  const d = diasParaVencer(expiresAt);
  switch (situacaoAssinatura(expiresAt)) {
    case 'sem_vencimento':
      return { texto: 'SEM VENCIMENTO', cor: 'text-white/25' };
    case 'em_dia':
      return { texto: `EM DIA · ${d} DIAS`, cor: 'text-emerald-400' };
    case 'vence_amanha':
      return { texto: 'VENCE AMANHÃ', cor: 'text-amber-400' };
    case 'vence_hoje':
      return { texto: 'VENCE HOJE', cor: 'text-amber-400' };
    case 'atrasado':
      return { texto: `ATRASADO ${-(d as number)}D · CORTA EM ${CARENCIA_DIAS + (d as number)}D`, cor: 'text-orange-400' };
    case 'cortado':
      return { texto: `ACESSO CORTADO · ${-(d as number)} DIAS`, cor: 'text-red-500' };
  }
};

/**
 * Renova somando meses. Parte do vencimento atual quando ele ainda esta no
 * futuro, para o cliente nao perder os dias que ja pagou.
 */
export const renovar = (expiresAt: string | null | undefined, meses: number): string => {
  const hoje = new Date();
  const atual = expiresAt ? new Date(expiresAt) : null;
  const base = atual && !isNaN(atual.getTime()) && atual > hoje ? atual : hoje;
  const nova = new Date(base);
  nova.setMonth(nova.getMonth() + meses);
  nova.setHours(23, 59, 59, 0);
  return nova.toISOString();
};

/** ISO -> yyyy-mm-dd no fuso local (input type="date"). */
export const isoParaInputDate = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** yyyy-mm-dd -> ISO no fim do dia, para o vencimento valer o dia inteiro. */
export const inputDateParaIso = (v: string): string | null =>
  v ? new Date(`${v}T23:59:59`).toISOString() : null;

export const dataBR = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};
