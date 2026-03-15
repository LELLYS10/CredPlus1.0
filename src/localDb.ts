import { Client, Loan, Payment, Installment, AppUser } from './types';

const STORAGE_KEYS = {
  CLIENTS: 'dilsinho_clients',
  LOANS: 'dilsinho_loans',
  PAYMENTS: 'dilsinho_payments',
  INSTALLMENTS: 'dilsinho_installments',
  USERS: 'dilsinho_users',
  SESSION: 'dilsinho_session'
};

const get = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const set = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const localDb = {
  getClients: () => get<Client[]>(STORAGE_KEYS.CLIENTS, []),
  saveClient: (client: Omit<Client, 'id' | 'createdAt'>) => {
    const clients = localDb.getClients();
    const newClient: Client = {
      ...client,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    set(STORAGE_KEYS.CLIENTS, [...clients, newClient]);
    return newClient;
  },
  deleteClient: (id: string) => {
    const clients = localDb.getClients();
    set(STORAGE_KEYS.CLIENTS, clients.map(c => c.id === id ? { ...c, deletedAt: new Date().toISOString() } : c));
  },

  getLoans: () => get<Loan[]>(STORAGE_KEYS.LOANS, []),
  saveLoan: (loan: Omit<Loan, 'id'> & { installments?: Omit<Installment, 'id' | 'loanId' | 'userId'>[] }) => {
    const loans = localDb.getLoans();
    const newLoan: Loan = {
      ...loan,
      id: crypto.randomUUID(),
    };
    set(STORAGE_KEYS.LOANS, [...loans, newLoan]);

    if (loan.installments) {
      const installments = localDb.getInstallments();
      const newInstallments = loan.installments.map(inst => ({
        ...inst,
        id: crypto.randomUUID(),
        loanId: newLoan.id,
        userId: newLoan.userId
      }));
      set(STORAGE_KEYS.INSTALLMENTS, [...installments, ...newInstallments]);
    }
    return newLoan;
  },
  updateLoan: (id: string, updates: Partial<Loan>) => {
    const loans = localDb.getLoans();
    set(STORAGE_KEYS.LOANS, loans.map(l => l.id === id ? { ...l, ...updates } : l));
  },

  getPayments: () => get<Payment[]>(STORAGE_KEYS.PAYMENTS, []),
  savePayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => {
    const payments = localDb.getPayments();
    const newPayment: Payment = {
      ...payment,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    set(STORAGE_KEYS.PAYMENTS, [...payments, newPayment]);
    return newPayment;
  },

  getInstallments: () => get<Installment[]>(STORAGE_KEYS.INSTALLMENTS, []),
  updateInstallment: (id: string, updates: Partial<Installment>) => {
    const installments = localDb.getInstallments();
    set(STORAGE_KEYS.INSTALLMENTS, installments.map(i => i.id === id ? { ...i, ...updates } : i));
  },

  getUsers: () => get<AppUser[]>(STORAGE_KEYS.USERS, []),
  saveUser: (user: AppUser) => {
    const users = localDb.getUsers();
    set(STORAGE_KEYS.USERS, [...users.filter(u => u.userId !== user.userId), user]);
  },
  updateUser: (userId: string, updates: Partial<AppUser>) => {
    const users = localDb.getUsers();
    set(STORAGE_KEYS.USERS, users.map(u => u.userId === userId ? { ...u, ...updates } : u));
  },

  getSession: () => get<any>(STORAGE_KEYS.SESSION, null),
  setSession: (session: any) => set(STORAGE_KEYS.SESSION, session),
  
  clearAll: () => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }
};
