# Evolution: extrato e múltiplos de R$ 5

Esta documentação registra uma regra exclusiva do canal Evolution/WhatsApp.

O painel CredPlus continua normal, com centavos. O banco de dados também não recebe arredondamento por causa desta regra.

No Evolution, os valores exibidos sobem para o próximo múltiplo de R$ 5. Assim, R$ 45,60 aparece como R$ 50,00, R$ 298,50 aparece como R$ 300,00 e R$ 75,00 permanece R$ 75,00.

As consultas são apresentadas em blocos no formato de extrato, com categoria, clientes, valores e total. Consultas separadas por ponto e vírgula geram um bloco por consulta. Ações de pagamento, cadastro e alteração continuam exigindo um comando por vez.

Implementação de produção:

- Arquivo: `/root/wa_bot.py`
- Processo PM2: `wa-bot`
- Backup: `/root/wa_bot.py.bak-extrato`
