export interface Client {
  id: string;
  userId: string;
  name: string;
  phone: string;
  cpf?: string;
  referredBy: string;
  address?: string;
  notes?: string;
  documentImage?: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface AppUser {
  id: string;
  userId: string;
  role: 'master' | 'user';
  isAdmin?: boolean;
  status: 'pendente' | 'ativo' | 'pausado' | 'negado' | 'bloqueado' | 'deletado';
  billingStatus: 'free' | 'ok' | 'late' | 'suspended' | 'overdue';
  plan: 'free' | 'mensal' | 'anual';
  expiresAt: string | null;
  signupFeeStatus?: 'unpaid' | 'paid';
  signupFeePaidAt?: string | null;
  createdAt: string;
  email?: string;
  name?: string;
  phone?: string;
  profileImage?: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  webhookUrl?: string;
  telegramChatId?: string;
}

export interface Installment {
  id: string;
  userId: string;
  loanId: string;
  clientId: string;
  number: number;
  capitalValue: number;
  interestValue: number;
  dueDate: string;
  status: 'pendente' | 'pago';
  paidAt?: string | null;
}

export interface Loan {
  id: string;
  userId: string;
  clientId: string;
  amount: number;
  originalAmount: number;
  interestFixedAmount: number;
  jurosPagoNoCiclo: number;
  loanDate: string;
  dueDate: string;
  status: 'active' | 'paid' | 'overdue';
  loanType: 'recurrent' | 'installments';
  interestRate: number;
  totalInstallments?: number;
  statusBucket?: 'overdue' | 'today' | 'tomorrow' | 'active';
  installments?: Installment[];
}

export interface Payment {
  id: string;
  userId: string;
  loanId: string;
  clientId: string;
  amount: number;
  date: string;
  type: 'interest' | 'capital';
  createdAt: string;
}

export interface DashboardStats {
  totalActiveCapital: number;
  overdueCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  totalInterestAccumulated: number;
  activeClientsCount: number;
  inactiveClientsCount: number;
}

export interface AppData {
  clients: Client[];
  loans: Loan[];
  payments: Payment[];
  profileImage?: string;
  stats?: DashboardStats;
  settings?: {
    webhook_url?: string;
    telegram_enabled: boolean;
  };
}
