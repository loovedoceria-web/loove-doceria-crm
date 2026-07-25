# Loove Doceria — CRM Financeiro

Guia passo a passo para colocar o app no ar, com um link acessível de qualquer lugar (celular, computador, etc).

## Parte 1 — Criar o banco de dados (Supabase, gratuito)

1. Acesse **https://supabase.com** e crie uma conta gratuita.
2. Clique em **New Project**. Dê um nome (ex: `loove-doceria`), crie uma senha para o banco (guarde-a, mas não vai precisar dela no dia a dia) e escolha uma região perto do Brasil (ex: São Paulo, se disponível).
3. Espere o projeto ser criado (leva 1-2 minutos).
4. No menu lateral, vá em **SQL Editor** → **New query**.
5. Abra o arquivo `supabase-setup.sql` (está junto com este projeto), copie todo o conteúdo, cole no editor e clique em **Run**. Isso cria as tabelas de produtos, vendas e gastos, já protegidas por login.
6. No menu lateral, vá em **Project Settings** → **API**. Copie:
   - **Project URL**
   - **anon public key**

## Parte 2 — Configurar o projeto

1. Instale o **Node.js** no seu computador, se ainda não tiver: https://nodejs.org (baixe a versão LTS).
2. Extraia a pasta deste projeto em algum lugar do seu computador.
3. Boa notícia: o arquivo `.env` já vem preenchido com as chaves do seu projeto Supabase (Loove Doceria). Não precisa mexer nele.
4. Abra um terminal dentro da pasta do projeto e rode:
   ```
   npm install
   npm run build
   ```
   Isso vai gerar uma pasta `dist` com o site pronto.

## Parte 3 — Publicar o site (Netlify, gratuito)

1. Acesse **https://app.netlify.com** e crie uma conta gratuita (pode entrar com Google/GitHub/e-mail).
2. Na tela inicial, procure a opção de **arrastar e soltar uma pasta** ("Deploy manually" / "Drag and drop your site folder").
3. Arraste a pasta **dist** (a que foi gerada no passo anterior) para lá.
4. Em poucos segundos, o Netlify vai te dar um link (algo como `https://loove-doceria-123.netlify.app`). Esse é o link definitivo do seu CRM!
5. (Opcional) Em **Site settings** → **Change site name**, você pode trocar para algo como `loove-doceria`, deixando o link mais bonito.

## Como usar depois de publicado

- Acesse o link em qualquer navegador (celular ou computador).
- Na primeira vez, clique em "Ainda não tenho conta, criar acesso" e cadastre seu e-mail e senha.
- O Supabase vai te enviar um e-mail de confirmação — clique no link para confirmar.
- Depois disso, é só entrar com e-mail e senha de qualquer lugar, e os dados vão estar sempre sincronizados.

## Se algo mudar no código depois

Sempre que você (ou eu) alterar o código, é só repetir: `npm run build`, e arrastar a nova pasta `dist` para o Netlify de novo (ou conectar o projeto a um repositório GitHub, para que isso aconteça automaticamente — posso te ajudar com isso depois, se quiser).
