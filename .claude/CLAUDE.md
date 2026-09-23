# CredPlus1.0 — regras específicas deste projeto

Esta pasta `.claude/` guarda as regras **só do CredPlus1.0** (o site **credplusemp.com.br**).
Elas ficam separadas das regras pessoais globais do Tom, que vivem em `~/.claude/CLAUDE.md`
e valem em qualquer projeto (por exemplo: responder sempre em português do Brasil, de forma simples).
Aqui só entra o que é específico deste projeto.

## Qual projeto é este
- Repositório GitHub: `LELLYS10/CredPlus1.0` (público — **nunca commitar senhas, chaves ou dados de clientes**)
- Site no ar: **credplusemp.com.br**, na VPS (`ssh vps`), pasta `/root/CredPlus1.0`
- Como roda: processo **PM2** chamado `credplus`, que serve a pasta `dist/` na porta 3000 (`npx serve dist -l 3000 -s`); o Traefik encaminha o domínio (`/docker/traefik-wvkg/dynamic/credplusemp.yml`)
- Stack: React 19 + TypeScript + Vite + Tailwind + Supabase (+ Gemini para o assistente de IA)
- Código em `src/`; documentação em `docs/`; esquema do banco em `supabase_schema.sql`

## Não confundir com (outros "CredPlus" que NÃO são este projeto)
- `credpluspainel.com` → repositório `LELLYS10/Credplus-painel-V2.0`, Next.js em Docker, é outro sistema
- `painelcredplus` → projeto separado com PocketBase, não é este site

## Comandos
```bash
npm install
npm run dev      # servidor local (porta 3000)
npm run lint     # confere o TypeScript (tsc --noEmit)
npm run build    # gera a pasta dist/
```

## Como publicar (só com autorização do Tom)
Na VPS: `cd /root/CredPlus1.0 && git pull && npm run build && pm2 restart credplus`.
O site é a pasta `dist/`; sem `npm run build` a mudança não aparece.

## Regras deste projeto
1. Nunca alterar a VPS (build, `pm2 restart`, Traefik) sem autorização explícita do Tom para aquele passo. Antes de qualquer mudança: backup e plano de volta.
2. Nunca apagar nada (arquivos, pastas, repositórios, processos PM2) sem pedir confirmação.
3. Este repositório é público: variáveis como `VITE_SUPABASE_ANON_KEY` e `VITE_GEMINI_API_KEY` ficam só no `.env` (fora do Git). O `.env.example` é o modelo.
4. Rodar `npm run lint` e `npm run build` antes de publicar.
5. Mudanças feitas direto na VPS devem ser enviadas ao GitHub (`git push origin main`) para a VPS e o GitHub não divergirem.
