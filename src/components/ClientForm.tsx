import React, { useState, useEffect, useRef } from 'react';
import { Client } from '../types';
import { maskPhone, maskCPF, countDigitsBeforeCursor, cursorPosForDigitIndex } from '../utils';

interface ClientFormProps {
  theme: 'rubro' | 'bw' | 'emerald';
  onSave: (client: Omit<Client, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
  onCancel: () => void;
  existingClients: Client[];
}

const ClientForm: React.FC<ClientFormProps> = ({ theme, onSave, onCancel, existingClients }) => {
  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    referredBy: '',
    notes: ''
  });
  
  const [telefone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const phoneRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  
  const [showError, setShowError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (showError || errorMessage) {
      const timer = setTimeout(() => {
        setShowError(false);
        setErrorMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showError, errorMessage]);

  const normalizeText = (text: string) => {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  };

  const cleanPhone = (phone: string) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  };

  const handleMaskedChange = (e: React.ChangeEvent<HTMLInputElement>, ref: React.RefObject<HTMLInputElement>, masker: (v: string) => string, setter: (v: string) => void) => {
    const input = e.target;
    const oldValue = input.value;
    const cursor = input.selectionStart ?? oldValue.length;
    const digitIndex = countDigitsBeforeCursor(oldValue, cursor);
    const formatted = masker(oldValue);
    setter(formatted);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const newPos = cursorPosForDigitIndex(formatted, digitIndex);
      el.setSelectionRange(newPos, newPos);
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    console.log("ClientForm: handleSubmit called");
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (isSubmitting) return;

    const normalizedNewName = normalizeText(formData.name);
    const cleanedNewPhone = cleanPhone(telefone);
    
    if (!normalizedNewName) {
      setErrorMessage("O NOME é obrigatório para realizar o cadastro.");
      return;
    }

    if (!cleanedNewPhone || cleanedNewPhone.length < 10) {
      setErrorMessage("O WHATSAPP é obrigatório para realizar o cadastro.");
      return;
    }

    const isDuplicate = existingClients.some(client => {
      const nameMatch = normalizeText(client.name) === normalizedNewName;
      const phoneMatch = cleanPhone(client.phone) === cleanedNewPhone && cleanedNewPhone !== '';
      return nameMatch || phoneMatch;
    });

    if (isDuplicate) { 
      setShowError(true); 
      setErrorMessage("⚠️ ESTE CLIENTE JÁ ESTÁ CADASTRADO (NOME OU TELEFONE DUPLICADO)");
      return; 
    }

    setIsSubmitting(true);
    // alert("DEBUG: Iniciando cadastro...");
    console.log("ClientForm: Submitting client data...", {
      name: formData.name.trim(),
      phone: telefone,
      cpf: cpf,
      referredBy: formData.referredBy.trim(),
      notes: formData.notes.trim()
    });
    
    try {
      setErrorMessage(null);
      await onSave({
        name: formData.name.trim(),
        phone: telefone,
        cpf: cpf,
        referredBy: formData.referredBy.trim(),
        notes: formData.notes.trim()
      });
      console.log("ClientForm: Registration successful");
    } catch (err: any) {
      console.error("ClientForm: Error during registration:", err);
      setErrorMessage(err.message || "Erro desconhecido ao salvar");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative max-w-lg mx-auto bg-white/5 backdrop-blur-3xl p-5 md:p-8 rounded-[32px] md:rounded-[40px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-500 text-white">
      {errorMessage && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce w-full px-4">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center gap-3 border-2 border-white/20 mx-auto max-w-xs">
            <span className="text-lg shrink-0">❌</span>
            <span className="font-black uppercase tracking-widest text-[9px] italic leading-tight">{errorMessage}</span>
          </div>
        </div>
      )}

      {showError && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-red-600 text-white px-6 py-2 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center gap-3 border-2 border-white/20">
            <span className="text-lg">⚠️</span>
            <span className="font-black uppercase tracking-widest text-[10px] whitespace-nowrap italic">Cadastro Duplicado</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6 md:mb-10">
        <div className="bg-emerald-600/20 p-3 md:p-4 rounded-2xl border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          <svg className="w-6 h-6 md:w-8 md:h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none">NOVO CLIENTE</h2>
          <p className="text-[8px] md:text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1.5 md:mt-2">CREDPLUS - Gestão Segura</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 md:space-y-8">
        <div className="space-y-1.5 md:space-y-2">
          <label className="block text-[9px] md:text-[10px] font-black text-emerald-200/50 uppercase tracking-[0.3em] px-2 italic">NOME COMPLETO</label>
          <input
            required
            disabled={isSubmitting}
            type="text"
            placeholder="NOME DO CLIENTE"
            className="w-full px-5 md:px-6 py-3 md:py-4 bg-white/5 border border-white/10 rounded-[18px] md:rounded-[20px] outline-none font-black text-base md:text-lg focus:border-emerald-500 focus:bg-white/10 transition-all text-white placeholder:text-white/10 shadow-inner disabled:opacity-50"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-1.5 md:space-y-2">
            <label className="block text-[9px] md:text-[10px] font-black text-emerald-200/50 uppercase tracking-[0.3em] px-2 italic">WHATSAPP</label>
            <input 
              ref={phoneRef}
              required
              type="text" 
              inputMode="numeric"
              placeholder="Telefone (00 0 0000-0000)" 
              disabled={isSubmitting}
              className="w-full px-5 md:px-6 py-3 md:py-4 bg-white/5 border border-white/10 rounded-[18px] md:rounded-[20px] outline-none font-black text-base md:text-lg focus:border-emerald-500 focus:bg-white/10 transition-all text-white placeholder:text-white/10 shadow-inner disabled:opacity-50"
              value={telefone} 
              onChange={(e) => handleMaskedChange(e, phoneRef, maskPhone, setPhone)}
              maxLength={14}
            />
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <label className="block text-[9px] md:text-[10px] font-black text-emerald-200/50 uppercase tracking-[0.3em] px-2 italic">CPF</label>
            <input 
              ref={cpfRef}
              type="text" 
              inputMode="numeric"
              placeholder="000.000.000-00" 
              disabled={isSubmitting}
              className="w-full px-5 md:px-6 py-3 md:py-4 bg-white/5 border border-white/10 rounded-[18px] md:rounded-[20px] outline-none font-black text-base md:text-lg focus:border-emerald-500 focus:bg-white/10 transition-all text-white placeholder:text-white/10 shadow-inner disabled:opacity-50"
              value={cpf} 
              onChange={(e) => handleMaskedChange(e, cpfRef, maskCPF, setCpf)}
              maxLength={14}
            />
          </div>
        </div>

        <div className="space-y-1.5 md:space-y-2">
          <label className="block text-[9px] md:text-[10px] font-black text-emerald-200/50 uppercase tracking-[0.3em] px-2 italic">INDICADO POR</label>
          <input
            disabled={isSubmitting}
            type="text"
            placeholder="QUEM INDICOU?"
            className="w-full px-5 md:px-6 py-3 md:py-4 bg-white/5 border border-white/10 rounded-[18px] md:rounded-[20px] outline-none font-black text-base md:text-lg focus:border-emerald-500 focus:bg-white/10 transition-all text-white placeholder:text-white/10 shadow-inner disabled:opacity-50"
            value={formData.referredBy}
            onChange={(e) => setFormData(prev => ({ ...prev, referredBy: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5 md:space-y-2">
          <label className="block text-[9px] md:text-[10px] font-black text-emerald-200/50 uppercase tracking-[0.3em] px-2 italic">OBSERVAÇÕES</label>
          <textarea
            disabled={isSubmitting}
            rows={2}
            placeholder="NOTAS ADICIONAIS"
            className="w-full px-5 md:px-6 py-3 md:py-4 bg-white/5 border border-white/10 rounded-[18px] md:rounded-[20px] outline-none font-black text-xs md:text-sm focus:border-emerald-500 transition-all text-white placeholder:text-white/10 shadow-inner disabled:opacity-50 resize-none"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          />
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 pt-2 md:pt-4">
          <button disabled={isSubmitting} type="button" onClick={onCancel} className="flex-1 px-4 py-4 md:py-5 bg-white/5 hover:bg-white/10 border border-white/5 text-white/40 rounded-[20px] md:rounded-[24px] font-black uppercase text-[9px] md:text-[10px] tracking-[0.3em] italic transition-all disabled:opacity-50">CANCELAR</button>
          <button disabled={isSubmitting} type="submit" className="flex-[1.5] px-6 py-4 md:py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[20px] md:rounded-[24px] font-black uppercase text-[11px] md:text-[12px] tracking-[0.3em] italic transition-all shadow-[0_10px_30px_rgba(16,185,129,0.4)] active:scale-95 disabled:opacity-50">{isSubmitting ? 'CADASTRANDO...' : 'CONFIRMAR CADASTRO'}</button>
        </div>
      </form>
    </div>
  );
};

export default ClientForm;
