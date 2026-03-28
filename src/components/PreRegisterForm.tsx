import React, { useState } from 'react';

interface PreRegisterFormProps {
  userId: string;
}

const PreRegisterForm: React.FC<PreRegisterFormProps> = ({ userId }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    cpf: '',
    referredBy: '',
    notes: '',
    desiredAmount: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
    }
    return value;
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4').trim();
    }
    return value;
  };

  const validate = () => {
    if (!formData.name.trim()) return 'Nome é obrigatório.';
    if (!formData.phone.trim()) return 'WhatsApp é obrigatório.';
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) return 'WhatsApp inválido.';
    if (formData.cpf.replace(/\D/g, '').length === 0) return null; // CPF é opcional mas se tiver deve ser válido
    if (formData.cpf.replace(/\D/g, '').length > 0 && formData.cpf.replace(/\D/g, '').length !== 11) {
      return 'CPF inválido.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        user_id: userId,
        name: formData.name.trim(),
        phone: formData.phone.replace(/\D/g, ''),
        cpf: formData.cpf.replace(/\D/g, '') || null,
        referred_by: formData.referredBy.trim() || null,
        notes: formData.notes.trim() || null,
        desired_amount: formData.desiredAmount.trim() || null,
        source: 'link'
      };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/pre_registrations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erro ${res.status}`);
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar. Tenta novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a1629] flex flex-col items-center justify-center p-6">
        <div className="glass max-w-md w-full p-8 rounded-[32px] border border-emerald-500/20 text-center">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-xl font-black text-white uppercase italic mb-4">Cadastro Enviado!</h2>
          <p className="text-sm text-white/60 italic leading-relaxed mb-6">
            Dados recebidos com sucesso. Entraremos em contato em breve pelo WhatsApp.
          </p>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
            CredPlus — Gestão de Empréstimos
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1629] flex flex-col items-center justify-center p-4">
      <div className="glass max-w-md w-full p-8 rounded-[32px] border border-white/10">
        <div className="text-center mb-8">
          <h2 className="text-lg font-black text-white uppercase italic mb-2">Novo Cliente</h2>
          <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Preencha seus dados</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <p className="text-red-400 text-[10px] font-black uppercase italic text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
              Nome Completo *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              placeholder="Seu nome completo"
              required
              className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
              WhatsApp *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={e => setFormData(p => ({ ...p, phone: formatPhone(e.target.value) }))}
              placeholder="(11) 99999-9999"
              required
              className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
              CPF
            </label>
            <input
              type="text"
              name="cpf"
              value={formData.cpf}
              onChange={e => setFormData(p => ({ ...p, cpf: formatCPF(e.target.value) }))}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
              Indicado por
            </label>
            <input
              type="text"
              name="referredBy"
              value={formData.referredBy}
              onChange={e => setFormData(p => ({ ...p, referredBy: e.target.value }))}
              placeholder="Nome de quem indicou"
              className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
              Valor Desejado (R$)
            </label>
            <input
              type="text"
              name="desiredAmount"
              value={formData.desiredAmount}
              onChange={e => setFormData(p => ({ ...p, desiredAmount: e.target.value }))}
              placeholder="Ex: 5.000,00"
              className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
              Endereço com CEP
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
              placeholder="Informe seu endereço completo com CEP."
              rows={3}
              className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-500 text-white font-black uppercase italic text-sm py-4 rounded-2xl mt-6 hover:bg-emerald-400 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Enviando...' : 'Cadastrar'}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
            CredPlus — Gestão de Empréstimos
          </p>
        </div>
      </div>
    </div>
  );
};

export default PreRegisterForm;
