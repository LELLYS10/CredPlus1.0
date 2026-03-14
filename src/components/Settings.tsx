import React, { useState } from 'react';
import { AppUser } from '../types';
import { supabaseService } from '../supabaseService';
import { Settings as SettingsIcon, Bell, Link, Save, CheckCircle, Info } from 'lucide-react';

interface SettingsProps {
  userProfile: AppUser | null;
  onUpdate: () => void;
}

const Settings: React.FC<SettingsProps> = ({ userProfile, onUpdate }) => {
  const [webhookUrl, setWebhookUrl] = useState(userProfile?.webhook_url || '');
  const [telegramChatId, setTelegramChatId] = useState(userProfile?.telegram_chat_id || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    if (!userProfile) return;
    setIsSaving(true);
    try {
      await supabaseService.saveProfile({
        ...userProfile,
        webhook_url: webhookUrl,
        telegram_chat_id: telegramChatId
      });
      setShowSuccess(true);
      onUpdate();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-emerald-600/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
          <SettingsIcon className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white uppercase italic leading-none">Configurações</h1>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-2">Integrações & Automação</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* n8n Integration */}
        <div className="glass p-8 rounded-[32px] border border-white/10 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Link className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Integração n8n</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-2 block">Webhook URL</label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://n8n.seu-dominio.com/webhook/..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-emerald-500 transition-all italic"
              />
            </div>
            
            <div className="p-4 bg-emerald-600/10 rounded-2xl border border-emerald-500/20 flex gap-3">
              <Info className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-[10px] text-emerald-300/80 leading-relaxed italic">
                Cole aqui o link do nó "Webhook" do seu workflow no n8n. O sistema enviará dados de novos empréstimos e pagamentos para este endereço.
              </p>
            </div>
          </div>
        </div>

        {/* Telegram Integration */}
        <div className="glass p-8 rounded-[32px] border border-white/10 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Notificações Telegram</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-2 block">Chat ID</label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Ex: 123456789"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-emerald-500 transition-all italic"
              />
            </div>
            
            <div className="p-4 bg-emerald-600/10 rounded-2xl border border-emerald-500/20 flex gap-3">
              <Info className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-[10px] text-emerald-300/80 leading-relaxed italic">
                O Chat ID é necessário para o n8n saber para quem enviar a mensagem. Você pode conseguir o seu falando com o bot @userinfobot no Telegram.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : showSuccess ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {showSuccess ? 'Salvo com Sucesso!' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
