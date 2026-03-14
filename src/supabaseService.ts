import { supabase } from './supabase';
import { Client, Loan, Payment, Installment, AppUser } from './types';

export const supabaseService = {
  // Profiles
  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data as AppUser | null;
  },
  saveProfile: async (profile: Partial<AppUser>) => {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        user_id: profile.user_id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        role: profile.role || 'user',
        status: profile.status || 'pendente',
        plan: profile.plan || 'free',
        billing_status: profile.billing_status || 'ok',
        expires_at: profile.expires_at,
        profile_image: profile.profile_image
      }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  getAllProfiles: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    if (error) throw error;
    return data as AppUser[];
  },
  updateProfileStatus: async (userId: string, status: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('user_id', userId);
    if (error) throw error;
  },

  // Clients
  getClients: async (userId: string) => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);
    if (error) throw error;
    return data as Client[];
  },
  saveClient: async (client: Omit<Client, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('clients')
      .insert(client)
      .select()
      .single();
    if (error) throw error;
    return data as Client;
  },
  deleteClient: async (id: string) => {
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // Loans
  getLoans: async (userId: string) => {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data as Loan[];
  },
  saveLoan: async (loan: Omit<Loan, 'id'> & { installments?: Omit<Installment, 'id' | 'loan_id' | 'user_id'>[] }) => {
    const { installments, ...loanData } = loan;
    const { data: newLoan, error: loanError } = await supabase
      .from('loans')
      .insert(loanData)
      .select()
      .single();
    
    if (loanError) throw loanError;

    if (installments && installments.length > 0) {
      const installmentsToSave = installments.map(inst => ({
        ...inst,
        loan_id: newLoan.id,
        user_id: loan.user_id
      }));
      const { error: instError } = await supabase
        .from('installments')
        .insert(installmentsToSave);
      if (instError) throw instError;
    }

    return newLoan as Loan;
  },
  updateLoan: async (id: string, updates: Partial<Loan>) => {
    // Remove installments from updates if present to avoid DB error
    const { installments, ...cleanUpdates } = updates as any;
    const { error } = await supabase
      .from('loans')
      .update(cleanUpdates)
      .eq('id', id);
    if (error) throw error;
  },

  // Installments
  getInstallments: async (userId: string) => {
    const { data, error } = await supabase
      .from('installments')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data as Installment[];
  },
  updateInstallment: async (id: string, updates: Partial<Installment>) => {
    const { error } = await supabase
      .from('installments')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  // Payments
  getPayments: async (userId: string) => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data as Payment[];
  },
  savePayment: async (payment: Omit<Payment, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('payments')
      .insert(payment)
      .select()
      .single();
    if (error) throw error;
    return data as Payment;
  }
};
