export interface Client {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  cpf?: string;
  referredBy: string;
  notes?: string;
  documentImage?: string;
  createdAt: string;
  deleted_at?: string | null;
}

export interface AppUser {
  id: string;
  user_id: string;
  role: 'master' | 'user';
  is_admin?: boolean;
  status: 'pendente' | 'ativo' | 'pausado' | 'negado' | 'bloqueado' | 'deletado';
  billing_status: 'free' | 'ok' | 'late' | 'suspended' | 'overdue';
  plan: 'free' | 'mensal' | 'anual';
  expires_at: string | null;
  signup_fee_status?: 'unpaid' | 'paid';
  signup_fee_paid_at?: string | null;
  created_at: string;
  email?: string;
  name?: string;
  phone?: string;
  profile_image?: string;
  approved_at?: string | null;
  approved_by?: string | null;
  webhook_url?: string;
  telegram_chat_id?: string;
}

export interface Installment {
  id: string;
  user_id: string;
  loan_id: string;
  client_id: string;
  number: number;
  capitalValue: number;
  interestValue: number;
  dueDate: string;
  status: 'pendente' | 'pago';
  paid_at?: string | null;
}

export interface Loan {
  id: string;
  user_id: string;
  clientId: string;
  amount: number;
  originalAmount: number;
  interestFixedAmount: number;
  jurosPagoNoCiclo: number;
  loanDate: string;
  dueDate: string;
  status: 'active' | 'paid' | 'overdue';
  loanType: 'recurrent' | 'installments';
  statusBucket?: 'overdue' | 'today' | 'tomorrow' | 'active';
  installments?: Installment[];
}

export interface Payment {
  id: string;
  user_id: string;
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
