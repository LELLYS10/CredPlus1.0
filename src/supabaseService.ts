import { supabase } from './supabase';
import { Client, Loan, Payment, Installment, AppUser } from './types';
import { brToIso, isoToBr } from './utils';

const ensureNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) || !isFinite(n) ? 0 : n;
};

export const supabaseService = {
  // Profiles
  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return {
      ...data,
      userId: data.user_id,
      isAdmin: data.is_admin,
      billingStatus: data.billing_status,
      expiresAt: data.expires_at,
      signupFeeStatus: data.signup_fee_status,
      signupFeePaidAt: data.signup_fee_paid_at,
      createdAt: data.created_at,
      profileImage: data.profile_image,
      approvedAt: data.approved_at,
      approvedBy: data.approved_by,
      webhookUrl: data.webhook_url,
      telegramChatId: data.telegram_chat_id
    } as AppUser;
  },
  saveProfile: async (profile: Partial<AppUser>) => {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        user_id: profile.userId,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        role: profile.role || 'user',
        status: profile.status || 'pendente',
        plan: profile.plan || 'free',
        billing_status: profile.billingStatus || 'ok',
        expires_at: profile.expiresAt,
        profile_image: profile.profileImage,
        is_admin: profile.isAdmin,
        signup_fee_status: profile.signupFeeStatus,
        signup_fee_paid_at: profile.signupFeePaidAt,
        approved_at: profile.approvedAt,
        approved_by: profile.approvedBy,
        webhook_url: profile.webhookUrl,
        telegram_chat_id: profile.telegramChatId
      }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      isAdmin: data.is_admin,
      billingStatus: data.billing_status,
      expiresAt: data.expires_at,
      signupFeeStatus: data.signup_fee_status,
      signupFeePaidAt: data.signup_fee_paid_at,
      createdAt: data.created_at,
      profileImage: data.profile_image,
      approvedAt: data.approved_at,
      approvedBy: data.approved_by,
      webhookUrl: data.webhook_url,
      telegramChatId: data.telegram_chat_id
    } as AppUser;
  },
  getAllProfiles: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    if (error) throw error;
    return (data as any[]).map(p => ({
      ...p,
      userId: p.user_id,
      isAdmin: p.is_admin,
      billingStatus: p.billing_status,
      expiresAt: p.expires_at,
      signupFeeStatus: p.signup_fee_status,
      signupFeePaidAt: p.signup_fee_paid_at,
      createdAt: p.created_at,
      profileImage: p.profile_image,
      approvedAt: p.approved_at,
      approvedBy: p.approved_by,
      webhookUrl: p.webhook_url,
      telegramChatId: p.telegram_chat_id
    })) as AppUser[];
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
    return (data as any[]).map(client => ({
      ...client,
      userId: client.user_id,
      referredBy: client.referred_by,
      createdAt: client.created_at,
      deletedAt: client.deleted_at,
      documentImage: client.document_image
    })) as Client[];
  },
  saveClient: async (client: Omit<Client, 'id' | 'createdAt'>) => {
    console.log('supabaseService: saveClient called with:', client);
    
    // Validation: Name and Phone are mandatory
    if (!client.name || !client.name.trim()) {
      throw new Error('O NOME do cliente é obrigatório.');
    }
    if (!client.phone || !client.phone.trim()) {
      throw new Error('O WHATSAPP/FONE do cliente é obrigatório.');
    }
    
    // Explicitly map fields to snake_case and avoid sending undefined
    const dbClient: any = {
      user_id: client.userId,
      name: client.name,
      phone: client.phone,
      cpf: client.cpf || null,
      referred_by: client.referredBy || '',
      notes: client.notes || null,
      address: (client as any).address || null,
      document_image: (client as any).documentImage || null
    };
    
    console.log('supabaseService: dbClient to insert:', dbClient);

    const { data, error } = await supabase
      .from('clients')
      .insert(dbClient)
      .select()
      .single();
      
    if (error) {
      console.error('supabaseService: Error saving client:', error);
      
      const errorMsg = error.message || '';
      // If columns don't exist, try without them (resilience for outdated schemas)
      const isMissingColumn = errorMsg.includes('column') && (
        errorMsg.includes('cpf') || 
        errorMsg.includes('referred_by') || 
        errorMsg.includes('document_image') || 
        errorMsg.includes('address')
      );

      if (isMissingColumn || errorMsg.includes('document_image') || errorMsg.includes('address') || errorMsg.includes('cpf') || errorMsg.includes('referred_by')) {
        console.log('supabaseService: Retrying without optional columns...');
        const fallbackClient = { ...dbClient };
        delete fallbackClient.document_image;
        delete fallbackClient.address;
        delete fallbackClient.cpf;
        delete fallbackClient.referred_by;
        
        const { data: retryData, error: retryError } = await supabase
          .from('clients')
          .insert(fallbackClient)
          .select()
          .single();
          
        if (retryError) {
          console.error('supabaseService: Retry error saving client:', retryError);
          throw retryError;
        }
        
        if (!retryData) throw new Error("Erro ao salvar cliente: Nenhum dado retornado após tentativa.");
        
        return {
          ...retryData,
          userId: retryData.user_id,
          referredBy: retryData.referred_by || '',
          createdAt: retryData.created_at,
          deletedAt: retryData.deleted_at,
          documentImage: retryData.document_image || ''
        } as Client;
      }
      throw error;
    }
    
    if (!data) throw new Error("Erro ao salvar cliente: Nenhum dado retornado.");
    
    return {
      ...data,
      userId: data.user_id,
      referredBy: data.referred_by,
      createdAt: data.created_at,
      deletedAt: data.deleted_at,
      documentImage: data.document_image
    } as Client;
  },
  deleteClient: async (id: string) => {
    console.log('supabaseService: deleteClient called for id:', id);
    // Tenta deletar permanentemente para evitar "fantasmas" se o usuário já excluiu no Supabase
    const { error: hardError } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    
    if (hardError) {
      console.warn('supabaseService: Hard delete failed (likely due to foreign keys), falling back to soft delete:', hardError);
      const { error: softError } = await supabase
        .from('clients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (softError) throw softError;
    }
  },
  clearAllData: async (userId: string) => {
    console.log('supabaseService: clearAllData called for userId:', userId);
    
    // Deletar em ordem para respeitar chaves estrangeiras
    const { error: pError } = await supabase.from('payments').delete().eq('user_id', userId);
    if (pError) console.error('Error clearing payments:', pError);
    
    const { error: iError } = await supabase.from('installments').delete().eq('user_id', userId);
    if (iError) console.error('Error clearing installments:', iError);
    
    const { error: lError } = await supabase.from('loans').delete().eq('user_id', userId);
    if (lError) console.error('Error clearing loans:', lError);
    
    const { error: cError } = await supabase.from('clients').delete().eq('user_id', userId);
    if (cError) console.error('Error clearing clients:', cError);
    
    return { success: true };
  },

  // Loans
  getLoans: async (userId: string) => {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    
    return (data as any[]).map(loan => ({
      ...loan,
      userId: loan.user_id,
      clientId: loan.client_id,
      originalAmount: loan.original_amount || loan.amount,
      interestFixedAmount: loan.interest_fixed_amount || 0,
      interestRate: loan.interest_rate || 0,
      jurosPagoNoCiclo: loan.juros_pago_no_ciclo || 0,
      loanDate: isoToBr(loan.loan_date),
      dueDate: isoToBr(loan.due_date || loan.duedate || loan.next_due_date || ''),
      loanType: loan.loan_type || 'recurrent',
      installments: loan.installments?.map((inst: any) => ({
        ...inst,
        userId: inst.user_id,
        loanId: inst.loan_id,
        clientId: inst.client_id,
        capitalValue: inst.capital_value,
        interestValue: inst.interest_value,
        dueDate: isoToBr(inst.due_date || inst.next_due_date || ''),
        paidAt: inst.paid_at ? isoToBr(inst.paid_at) : null
      }))
    })) as Loan[];
  },
  saveLoan: async (loan: Omit<Loan, 'id'> & { installments?: Omit<Installment, 'id' | 'loanId' | 'userId'>[] }) => {
    console.log('supabaseService: saveLoan called with:', loan);
    const { installments, ...loanData } = loan;
    
    // Map camelCase to snake_case for DB
    const dbLoanData: any = {
      user_id: loanData.userId,
      client_id: loanData.clientId,
      amount: ensureNumber(loanData.amount),
      original_amount: ensureNumber(loanData.originalAmount || loanData.amount),
      interest_fixed_amount: ensureNumber(loanData.interestFixedAmount),
      interest_rate: ensureNumber(loanData.interestRate),
      juros_pago_no_ciclo: ensureNumber(loanData.jurosPagoNoCiclo),
      loan_date: brToIso(loanData.loanDate),
      due_date: brToIso(loanData.dueDate),
      status: loanData.status || 'active',
      loan_type: loanData.loanType || 'recurrent',
      total_installments: ensureNumber(loanData.totalInstallments || 1)
    };
    
    console.log('supabaseService: dbLoanData prepared for insert:', JSON.stringify(dbLoanData));

    try {
      const { data: newLoan, error: loanError } = await supabase
        .from('loans')
        .insert(dbLoanData)
        .select()
        .single();
      
      if (loanError) {
        console.error('supabaseService: Error saving loan:', loanError);
        
        const errorMsg = (loanError.message || '').toLowerCase();
        const isMissingColumn = errorMsg.includes('column') || errorMsg.includes('schema cache') || errorMsg.includes('not find');
        
        if (isMissingColumn) {
          console.log('supabaseService: Column/Schema error detected, attempting fallback strategies...');
          const fallbackLoan = { ...dbLoanData };
          
          // Strategy 1: If due_date is missing, try duedate or next_due_date
          if (errorMsg.includes('due_date')) {
            console.log('supabaseService: due_date missing in loans, trying duedate');
            delete fallbackLoan.due_date;
            fallbackLoan.duedate = dbLoanData.due_date;
          }
          
          // Strategy 2: Remove other potentially missing optional columns
          if (errorMsg.includes('original_amount')) delete fallbackLoan.original_amount;
          if (errorMsg.includes('juros_pago_no_ciclo')) delete fallbackLoan.juros_pago_no_ciclo;
          if (errorMsg.includes('loan_type')) delete fallbackLoan.loan_type;
          if (errorMsg.includes('interest_fixed_amount')) delete fallbackLoan.interest_fixed_amount;
          if (errorMsg.includes('interest_rate') && errorMsg.includes('does not exist')) delete fallbackLoan.interest_rate;
          if (errorMsg.includes('total_installments')) delete fallbackLoan.total_installments;
          
          // If it's a generic schema cache error for a specific column, remove it
          const columnsToTryRemoving = ['interest_fixed_amount', 'interest_rate', 'original_amount', 'juros_pago_no_ciclo', 'loan_type', 'total_installments'];
          columnsToTryRemoving.forEach(col => {
            if (errorMsg.includes(col)) {
              console.log(`supabaseService: Removing potentially missing column: ${col}`);
              delete (fallbackLoan as any)[col];
            }
          });
          
          const { data: retryLoan, error: retryError } = await supabase
            .from('loans')
            .insert(fallbackLoan)
            .select()
            .single();
            
          if (retryError) {
            console.error('supabaseService: Retry error saving loan:', retryError);
            const retryErrorMsg = (retryError.message || '').toLowerCase();

            // If duedate also failed, try next_due_date
            if (retryErrorMsg.includes('duedate') && dbLoanData.due_date) {
              const nextFallback = { ...fallbackLoan };
              delete nextFallback.duedate;
              nextFallback.next_due_date = dbLoanData.due_date;
              
              const { data: nextLoan, error: nextError } = await supabase
                .from('loans')
                .insert(nextFallback)
                .select()
                .single();
              
              if (!nextError && nextLoan) {
                return await handleInstallments(nextLoan, installments, loan.userId, loanData.clientId);
              }
              console.error('supabaseService: next_due_date retry failed:', nextError);
            }
            
            // Final desperate attempt: remove EVERYTHING except the bare minimum
            if (retryError.message.includes('column')) {
               console.log('supabaseService: Final retry attempt with minimal columns...');
                const minimalLoan = {
                  user_id: dbLoanData.user_id,
                  client_id: dbLoanData.client_id,
                  amount: ensureNumber(dbLoanData.amount),
                  loan_date: dbLoanData.loan_date,
                  status: dbLoanData.status,
                  interest_rate: ensureNumber(dbLoanData.interest_rate),
                  interest_fixed_amount: ensureNumber(dbLoanData.interest_fixed_amount),
                  total_installments: ensureNumber(dbLoanData.total_installments || 1),
                  loan_type: dbLoanData.loan_type || 'recurrent'
                };
               const { data: finalLoan, error: finalError } = await supabase
                 .from('loans')
                 .insert(minimalLoan)
                 .select()
                 .single();
               if (finalError) throw finalError;
               return await handleInstallments(finalLoan, installments, loan.userId, loanData.clientId);
            }
            throw retryError;
          }
          
          if (!retryLoan) throw new Error("Erro ao salvar empréstimo: Nenhum dado retornado após tentativa.");
          
          console.log('supabaseService: Loan saved successfully (retry), handling installments');
          return await handleInstallments(retryLoan, installments, loan.userId, loanData.clientId);
        }
        throw loanError;
      }
      
      if (!newLoan) throw new Error("Erro ao salvar empréstimo: Nenhum dado retornado.");
      
      console.log('supabaseService: Loan saved successfully, handling installments');
      return await handleInstallments(newLoan, installments, loan.userId, loanData.clientId);
    } catch (err) {
      console.error('supabaseService: Unexpected error in saveLoan:', err);
      throw err;
    }

    async function handleInstallments(loanRecord: any, insts: any[] | undefined, userId: string, clientId: string) {
      if (insts && insts.length > 0) {
        console.log('supabaseService: Saving installments:', insts.length);
        const installmentsToSave = insts.map(inst => {
          const mapped: any = {
            number: inst.number,
            capital_value: inst.capitalValue,
            interest_value: inst.interestValue,
            due_date: brToIso(inst.dueDate),
            status: inst.status,
            paid_at: inst.paidAt ? brToIso(inst.paidAt) : null,
            loan_id: loanRecord.id,
            user_id: userId,
            client_id: clientId
          };
          return mapped;
        });
        
        try {
          const { error: instError } = await supabase
            .from('installments')
            .insert(installmentsToSave);
            
          if (instError) {
            console.error('supabaseService: Error saving installments:', instError);
            const errorMsg = (instError.message || '').toLowerCase();
            
            if (errorMsg.includes('column') || errorMsg.includes('schema cache') || errorMsg.includes('not find') || errorMsg.includes('null value')) {
              console.log('supabaseService: Column/Constraint error in installments, trying fallbacks...');
              let fallbackInsts: any[] = installmentsToSave.map(i => ({ ...i }));
              
              if (errorMsg.includes('amount') || errorMsg.includes('capital_value')) {
                fallbackInsts = fallbackInsts.map(({ capital_value, ...rest }: any) => ({ ...rest, amount: capital_value }));
              }

              if (errorMsg.includes('interest') || errorMsg.includes('interest_value')) {
                fallbackInsts = fallbackInsts.map(({ interest_value, ...rest }: any) => ({ ...rest, interest: interest_value }));
              }
              
              if (errorMsg.includes('due_date') || errorMsg.includes('duedate')) {
                fallbackInsts = fallbackInsts.map(({ due_date, ...rest }: any) => {
                  const newInst = { ...rest };
                  if (errorMsg.includes('duedate')) newInst.duedate = due_date;
                  else newInst.next_due_date = due_date;
                  return newInst;
                });
              }
              
              if (errorMsg.includes('client_id')) {
                fallbackInsts = fallbackInsts.map(({ client_id, ...rest }: any) => rest);
              }

              const { error: retryInstError } = await supabase
                .from('installments')
                .insert(fallbackInsts);
              if (retryInstError) throw retryInstError;
            } else {
              throw instError;
            }
          }
        } catch (err) {
          console.error('supabaseService: Unexpected error in handleInstallments:', err);
          // We don't want to fail the whole loan save if installments fail, but we should log it
          // Actually, for installments it's better to throw so the user knows
          throw err;
        }
      }
      
      return {
        ...loanRecord,
        userId: loanRecord.user_id,
        clientId: loanRecord.client_id,
        originalAmount: loanRecord.original_amount || loanRecord.amount,
        interestFixedAmount: loanRecord.interest_fixed_amount ?? 0,
        interestRate: loanRecord.interest_rate ?? 0,
        jurosPagoNoCiclo: loanRecord.juros_pago_no_ciclo ?? 0,
        loanDate: isoToBr(loanRecord.loan_date),
        dueDate: isoToBr(loanRecord.due_date || loanRecord.next_due_date || ''),
        loanType: loanRecord.loan_type || 'recurrent'
      } as Loan;
    }
  },
  updateLoan: async (id: string, updates: Partial<Loan>) => {
    console.log('supabaseService: updateLoan called for id:', id, 'with updates:', updates);
    // Map camelCase to snake_case for DB
    const dbUpdates: any = {};
    if (updates.userId) dbUpdates.user_id = updates.userId;
    if (updates.clientId) dbUpdates.client_id = updates.clientId;
    if (updates.amount !== undefined) dbUpdates.amount = ensureNumber(updates.amount);
    if (updates.originalAmount !== undefined) dbUpdates.original_amount = ensureNumber(updates.originalAmount);
    if (updates.interestFixedAmount !== undefined) dbUpdates.interest_fixed_amount = ensureNumber(updates.interestFixedAmount);
    if (updates.interestRate !== undefined) dbUpdates.interest_rate = ensureNumber(updates.interestRate);
    if (updates.jurosPagoNoCiclo !== undefined) dbUpdates.juros_pago_no_ciclo = ensureNumber(updates.jurosPagoNoCiclo);
    if (updates.loanDate) dbUpdates.loan_date = brToIso(updates.loanDate);
    if (updates.dueDate) dbUpdates.due_date = brToIso(updates.dueDate);
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.loanType) dbUpdates.loan_type = updates.loanType;
    if ((updates as any).totalInstallments !== undefined) dbUpdates.total_installments = ensureNumber((updates as any).totalInstallments);
    
    try {
      const { error } = await supabase
        .from('loans')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) {
        console.error('supabaseService: Error updating loan:', error);
        const errorMsg = (error.message || '').toLowerCase();
        
        if (errorMsg.includes('column') || errorMsg.includes('schema cache') || errorMsg.includes('not find')) {
          console.log('supabaseService: Column/Schema error during update, attempting fallback...');
          const retryUpdates = { ...dbUpdates };
          
          if (errorMsg.includes('due_date')) {
            delete retryUpdates.due_date;
            // Try 'duedate' first as it's common in some schemas
            retryUpdates.duedate = dbUpdates.due_date;
          }
          
          const columnsToTryRemoving = ['interest_fixed_amount', 'interest_rate', 'original_amount', 'juros_pago_no_ciclo', 'loan_type', 'total_installments'];
          columnsToTryRemoving.forEach(col => {
            if (errorMsg.includes(col)) {
              console.log(`supabaseService: Removing potentially missing column from update: ${col}`);
              delete retryUpdates[col];
            }
          });

          const { error: retryError } = await supabase
            .from('loans')
            .update(retryUpdates)
            .eq('id', id);
          
          if (retryError) {
            console.error('supabaseService: Retry 1 error updating loan:', retryError);
            const retryErrorMsg = (retryError.message || '').toLowerCase();
            
            // If duedate also failed, try next_due_date
            if (retryErrorMsg.includes('duedate') && dbUpdates.due_date) {
              const finalUpdates = { ...retryUpdates };
              delete finalUpdates.duedate;
              finalUpdates.next_due_date = dbUpdates.due_date;
              
              const { error: finalError } = await supabase
                .from('loans')
                .update(finalUpdates)
                .eq('id', id);
              
              if (finalError) {
                console.error('supabaseService: Final retry error updating loan:', finalError);
                // If even that fails, try removing the date update entirely to at least save the status
                const desperateUpdates = { ...finalUpdates };
                delete desperateUpdates.next_due_date;
                const { error: desperateError } = await supabase
                  .from('loans')
                  .update(desperateUpdates)
                  .eq('id', id);
                if (desperateError) throw desperateError;
              }
            } else {
              throw retryError;
            }
          }
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error('supabaseService: Unexpected error in updateLoan:', err);
      throw err;
    }
  },

  // Installments
  getInstallments: async (userId: string) => {
    const { data, error } = await supabase
      .from('installments')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data as any[]).map(inst => ({
      ...inst,
      userId: inst.user_id,
      loanId: inst.loan_id,
      clientId: inst.client_id,
      capitalValue: inst.capital_value !== undefined ? inst.capital_value : (inst.amount !== undefined ? inst.amount : 0),
      interestValue: inst.interest_value !== undefined ? inst.interest_value : (inst.interest !== undefined ? inst.interest : 0),
      dueDate: isoToBr(inst.due_date || inst.duedate || inst.next_due_date || ''),
      paidAt: inst.paid_at ? isoToBr(inst.paid_at) : (inst.paidat ? isoToBr(inst.paidat) : null)
    })) as Installment[];
  },
  updateInstallment: async (id: string, updates: Partial<Installment>) => {
    const dbUpdates: any = { ...updates };
    if (updates.userId) dbUpdates.user_id = updates.userId;
    if (updates.loanId) dbUpdates.loan_id = updates.loanId;
    if (updates.clientId) dbUpdates.client_id = updates.clientId;
    if (updates.capitalValue !== undefined) dbUpdates.capital_value = updates.capitalValue;
    if (updates.interestValue !== undefined) dbUpdates.interest_value = updates.interestValue;
    if (updates.dueDate) dbUpdates.due_date = brToIso(updates.dueDate);
    if (updates.paidAt) dbUpdates.paid_at = brToIso(updates.paidAt);
    
    // Remove ALL camelCase fields to avoid "column not found" errors
    delete dbUpdates.userId;
    delete dbUpdates.loanId;
    delete dbUpdates.clientId;
    delete dbUpdates.capitalValue;
    delete dbUpdates.interestValue;
    delete dbUpdates.dueDate;
    delete dbUpdates.paidAt;

    try {
      const { error } = await supabase
        .from('installments')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) {
        console.error('supabaseService: Error updating installment:', error);
        const errorMsg = (error.message || '').toLowerCase();
        
        if (errorMsg.includes('column') || errorMsg.includes('schema cache') || errorMsg.includes('not find')) {
          console.log('supabaseService: Column error in installments update, trying fallbacks...');
          const retryUpdates = { ...dbUpdates };
          
          if (errorMsg.includes('due_date') || errorMsg.includes('duedate')) {
            if (retryUpdates.due_date) {
              if (errorMsg.includes('duedate')) retryUpdates.duedate = retryUpdates.due_date;
              else retryUpdates.next_due_date = retryUpdates.due_date;
              delete retryUpdates.due_date;
            }
          }
          
          if (errorMsg.includes('capital_value') || errorMsg.includes('amount')) {
            if (retryUpdates.capital_value !== undefined) {
              retryUpdates.amount = retryUpdates.capital_value;
              delete retryUpdates.capital_value;
            }
          }

          if (errorMsg.includes('interest_value') || errorMsg.includes('interest')) {
            if (retryUpdates.interest_value !== undefined) {
              retryUpdates.interest = retryUpdates.interest_value;
              delete retryUpdates.interest_value;
            }
          }
          
          const { error: retryError } = await supabase
            .from('installments')
            .update(retryUpdates)
            .eq('id', id);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error('supabaseService: Unexpected error in updateInstallment:', err);
      throw err;
    }
  },

  // Payments
  getPayments: async (userId: string) => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data as any[]).map(p => ({
      ...p,
      userId: p.user_id,
      loanId: p.loan_id,
      clientId: p.client_id,
      date: p.payment_date ? isoToBr(p.payment_date) : (p.date ? isoToBr(p.date) : ''),
      type: p.payment_type || p.type || '',
      createdAt: p.created_at
    })) as Payment[];
  },
  savePayment: async (payment: Omit<Payment, 'id' | 'createdAt'>) => {
    const isoDate = brToIso(payment.date);
    const dbPayment: any = {
      user_id: payment.userId,
      loan_id: payment.loanId,
      client_id: payment.clientId,
      amount: payment.amount,
      payment_date: isoDate, // Primary column name in DB
      date: isoDate,         // Fallback column name
      payment_type: payment.type, // Primary column name in DB
      type: payment.type          // Fallback column name
    };
    
    try {
      // Try with both columns first, Supabase will ignore the one that doesn't exist if we handle the error
      const { data, error } = await supabase
        .from('payments')
        .insert(dbPayment)
        .select()
        .single();
      
      if (error) {
        console.error('supabaseService: Error saving payment:', error);
        const errorMsg = (error.message || '').toLowerCase();
        
        // If it's a column error, try a more aggressive fallback
        if (errorMsg.includes('column') || errorMsg.includes('schema cache') || errorMsg.includes('not find') || errorMsg.includes('null value')) {
          console.log('supabaseService: Payment column error, attempting fallback...');
          const fallbackPayment = { ...dbPayment };
          
          // Remove columns that might be causing issues based on the error message
          if (errorMsg.includes('client_id')) delete fallbackPayment.client_id;
          if (errorMsg.includes('payment_date')) delete fallbackPayment.payment_date;
          if (errorMsg.includes('date')) delete fallbackPayment.date;
          if (errorMsg.includes('payment_type')) delete fallbackPayment.payment_type;
          if (errorMsg.includes('type')) delete fallbackPayment.type;
          
          // If we deleted payment_date but it's required, we have a problem, 
          // but usually one of 'date' or 'payment_date' should work.
          
          const { data: retryData, error: retryError } = await supabase
            .from('payments')
            .insert(fallbackPayment)
            .select()
            .single();
          
          if (retryError) throw retryError;
          return {
            ...retryData,
            loanId: retryData.loan_id,
            clientId: retryData.client_id,
            date: retryData.payment_date || retryData.date || payment.date,
            type: retryData.payment_type || retryData.type || payment.type,
            createdAt: retryData.created_at
          } as Payment;
        }
        throw error;
      }
      
      return {
        ...data,
        loanId: data.loan_id,
        clientId: data.client_id,
        date: data.payment_date || data.date || payment.date,
        type: data.payment_type || data.type || payment.type,
        createdAt: data.created_at
      } as Payment;
    } catch (err) {
      console.error('supabaseService: Unexpected error in savePayment:', err);
      throw err;
    }
  }
};
