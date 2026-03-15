import React, { useState, useEffect, useRef } from 'react';
import { AppData } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { MessageSquare, Send, Bot, User, X, Trash2, Mic, MicOff, Volume2 } from 'lucide-react';

// Add SpeechRecognition types for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface AIAssistantProps {
  data: AppData;
  onAddClient: (client: any) => Promise<void>;
  onAddLoan: (loan: any) => Promise<void>;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ data, onAddClient, onAddLoan }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(() => {
    const saved = localStorage.getItem('cred_chat_history');
    return saved ? JSON.parse(saved) : [
      { role: 'assistant', content: 'E aí! Tudo certo? Sou o Cred. Como posso ajudar com sua carteira hoje?' }
    ];
  });

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed') {
          setErrorMessage('O acesso ao microfone foi negado. Por favor, verifique as permissões do seu navegador.');
        } else if (event.error === 'no-speech') {
          // Silent error
        } else {
          setErrorMessage('Erro no reconhecimento de voz: ' + event.error);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        setErrorMessage('Seu navegador não suporta reconhecimento de voz.');
        return;
      }
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Save messages to localStorage
  useEffect(() => {
    localStorage.setItem('cred_chat_history', JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
      
      const systemInstruction = `
        Seu nome é Cred. Você é o assistente pessoal e parceiro de negócios do administrador no sistema CREDPLUS.
        Sua missão é ser um braço direito: alguém que entende de crédito, mas que fala como uma pessoa real, não como um relatório ambulante.

        DIRETRIZES DE PERSONALIDADE:
        1. BREVIDADE É TUDO: Se o usuário disser apenas "Oi" ou "Olá", responda de forma curta e amigável.
        2. CONVERSA NATURAL: Use um tom informal e profissional.
        3. FOCO NO QUE IMPORTA: Só mencione dados se o usuário perguntar ou se houver algo REALMENTE crítico.
        4. NÃO SEJA UM ROBÔ: Não repita estatísticas que o usuário já está vendo na tela principal.
        5. MEMÓRIA DE PREFERÊNCIAS: Memorize e siga fielmente qualquer modelo de cadastro, lista de formulário ou regra que o usuário definir durante a conversa. Se ele disser "quero o cadastro assim", use esse padrão sempre que ele pedir um novo cadastro.
        6. CAMPOS DE CADASTRO: Você deve conhecer todos os campos disponíveis para o cadastro de clientes:
           - NOME (Obrigatório)
           - WHATSAPP/FONE (Obrigatório)
           - CPF (Opcional)
           - ENDEREÇO (Opcional)
           - INDICADO POR (Opcional)
           - OBSERVAÇÕES/NOTAS (Opcional)
        7. REGRA DE OURO: Você NUNCA, sob hipótese alguma, deve inventar dados ou usar placeholders para cadastrar um cliente. Se o usuário disser "cadastre um cliente" ou "novo cliente", sua ÚNICA resposta deve ser pedir o Nome e o WhatsApp dele.
        8. FLUXO DE CADASTRO: 
           - Passo 1: Usuário pede cadastro.
           - Passo 2: Você pede os dados (Nome e WhatsApp).
           - Passo 3: Usuário fornece os dados.
           - Passo 4: Você confirma os dados recebidos.
           - Passo 5: Você executa a ferramenta 'register_client'.
        9. PROIBIÇÃO: É estritamente proibido chamar 'register_client' com nomes genéricos como "Novo Cliente", "Cliente", ou telefones fictícios.

        DADOS DO SISTEMA (Use apenas se necessário):
        - Clientes: ${data.clients.length} (${data.stats?.activeClientsCount || 0} ativos)
        - Empréstimos: ${data.loans.filter(l => l.status !== 'paid').length} ativos
        - Capital: R$ ${data.stats?.totalActiveCapital || 0}
        - Atrasos: ${data.stats?.overdueCount || 0}
        - Hoje: ${data.stats?.dueTodayCount || 0} vencimentos

        LISTA DE CLIENTES DISPONÍVEIS (Para empréstimos):
        ${data.clients.map(c => `- ${c.name} (ID: ${c.id})`).join('\n')}

        AÇÕES DISPONÍVEIS:
        - Você pode cadastrar novos clientes usando a ferramenta 'register_client'.
        - Você pode cadastrar novos empréstimos usando a ferramenta 'register_loan'.
        - Para cadastrar um empréstimo, você PRECISA do ID do cliente. Se o usuário falar o nome, procure na lista acima.
      `;

      const chatHistory = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const tools = [
        {
          functionDeclarations: [
            {
              name: "register_client",
              description: "ATENÇÃO: Use esta função APENAS se o usuário já tiver fornecido o NOME e o WHATSAPP reais nesta conversa. NUNCA use para cadastrar dados fictícios ou vazios.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nome completo do cliente (OBRIGATÓRIO)" },
                  cpf: { type: Type.STRING, description: "CPF do cliente (apenas números ou formatado)" },
                  phone: { type: Type.STRING, description: "Telefone de contato/Whatsapp (OBRIGATÓRIO)" },
                  address: { type: Type.STRING, description: "Endereço completo" },
                  referredBy: { type: Type.STRING, description: "Quem indicou o cliente" },
                  notes: { type: Type.STRING, description: "Observações adicionais" }
                },
                required: ["name", "phone"]
              }
            },
            {
              name: "register_loan",
              description: "Cadastra um novo empréstimo para um cliente existente",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  clientId: { type: Type.STRING, description: "ID do cliente (obtenha da lista de clientes)" },
                  amount: { type: Type.NUMBER, description: "Valor do capital emprestado" },
                  interestFixedAmount: { type: Type.NUMBER, description: "Valor fixo do juros (ex: 100 para um empréstimo de 1000 com 10% de juros fixo)" },
                  loanType: { type: Type.STRING, enum: ["recurrent", "installments"], description: "Tipo de empréstimo: recorrente (apenas juros) ou parcelado" },
                  loanDate: { type: Type.STRING, description: "Data do empréstimo (DD/MM/AAAA)" },
                  dueDate: { type: Type.STRING, description: "Data do primeiro vencimento (DD/MM/AAAA)" },
                  installmentsCount: { type: Type.NUMBER, description: "Número de parcelas (apenas para tipo parcelado)" }
                },
                required: ["clientId", "amount", "interestFixedAmount", "loanType", "loanDate", "dueDate"]
              }
            }
          ]
        }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...chatHistory,
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction,
          temperature: 0.7,
          tools
        }
      });

      const functionCalls = response.functionCalls;
      if (functionCalls) {
        console.log('AI requested function calls:', functionCalls);
        for (const call of functionCalls) {
          if (call.name === 'register_client') {
            try {
              console.log('Registering client via AI:', call.args);
              await onAddClient(call.args);
              setMessages(prev => [...prev, { role: 'assistant', content: `Pronto! Já cadastrei o cliente ${call.args.name} para você. Pode conferir na lista de clientes.` }]);
            } catch (err) {
              console.error('Error in register_client tool:', err);
              setMessages(prev => [...prev, { role: 'assistant', content: `Tive um probleminha ao tentar cadastrar o cliente: ${(err as any).message}` }]);
            }
          } else if (call.name === 'register_loan') {
            try {
              console.log('Registering loan via AI:', call.args);
              await onAddLoan(call.args);
              const client = data.clients.find(c => c.id === call.args.clientId);
              setMessages(prev => [...prev, { role: 'assistant', content: `Feito! Empréstimo de R$ ${call.args.amount} cadastrado para ${client?.name || 'o cliente'}.` }]);
            } catch (err) {
              console.error('Error in register_loan tool:', err);
              setMessages(prev => [...prev, { role: 'assistant', content: `Tive um probleminha ao tentar cadastrar o empréstimo: ${(err as any).message}` }]);
            }
          }
        }
      } else {
        const text = response.text || "Desculpe, não consegui processar sua solicitação.";
        setMessages(prev => [...prev, { role: 'assistant', content: text }]);
      }
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Erro ao conectar com a inteligência artificial." }]);
    } finally {
      setLoading(false);
    }
  };


  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-6 w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/40 flex items-center justify-center hover:scale-110 transition-all z-40"
      >
        <Bot size={28} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 md:inset-auto md:bottom-24 md:right-6 md:w-96 md:h-[600px] bg-[#0a1629] border border-white/10 shadow-2xl rounded-t-[32px] md:rounded-[32px] flex flex-col z-50 animate-in slide-in-from-bottom-10">
          {errorMessage && (
            <div className="absolute top-0 left-0 right-0 z-[60] px-4 -translate-y-full pb-2 animate-in slide-in-from-bottom-2">
              <div className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase italic text-center shadow-lg border border-white/20">
                {errorMessage}
              </div>
            </div>
          )}
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-emerald-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500 rounded-xl text-white">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black italic text-white uppercase">CRED</h3>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Online</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/20 hover:text-white transition-all p-2">
              <X size={20} />
            </button>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar scroll-smooth"
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-emerald-500 text-white rounded-tr-none' 
                    : 'bg-white/5 text-white/80 rounded-tl-none border border-white/5'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-white/5">
            <div className="flex gap-2">
              <button
                onClick={toggleListening}
                className={`p-4 rounded-2xl flex items-center justify-center transition-all ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                }`}
                title={isListening ? "Parar de ouvir" : "Falar com o Cred"}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isListening ? "Ouvindo..." : "Pergunte algo..."}
                  className={`w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-4 pr-14 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all ${isListening ? 'border-emerald-500/50 ring-2 ring-emerald-500/20' : ''}`}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
