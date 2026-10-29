# Mapa de dados do Stabilis

Versão de 29/10/2026, conferida contra o código nesta data. Atualize sempre que um fluxo mudar. Os
artigos da LGPD citados estão transcritos em [base-legal.md](base-legal.md).

## Princípio

O Stabilis não tem cadastro, não tem banco de dados de usuários e não recebe as respostas de ninguém
por padrão. Tudo é calculado no navegador. Os únicos dados que saem do aparelho saem por ação da pessoa,
com aviso antes.

## Dados no aparelho da pessoa

| Dado | Onde fica | Quem pode ver | Por quanto tempo |
|---|---|---|---|
| Respostas do guia: perfil (idade, sexo ao nascer, gravidez, condições, hábitos), identidade de gênero (opcional), remédios em uso, tratamentos anteriores, relato, questionários, triagem de risco, prioridades | `sessionStorage` (padrão) ou `localStorage` (se a pessoa escolher guardar no aparelho), chave `stabilis_patient` | quem usar o mesmo aparelho e navegador | até fechar a aba (padrão) ou até a pessoa apagar |
| Versão do aviso aceito e data | junto das respostas | idem | idem |
| Diário do acompanhamento (humor, sono, efeitos, uso dos remédios, anotações) e questionários repetidos | `localStorage`, só se a pessoa escolher guardar no aparelho | idem | até apagar |
| Marca de que o relatório foi feito e respostas de "Depois da consulta" | junto das respostas | idem | idem |
| Plano de segurança | `sessionStorage` (padrão) ou `localStorage` (escolha da pessoa), chave `stabilis_safety_plan` | idem | idem |
| Caso digitado no modo profissional (dados do paciente do profissional) | `sessionStorage` do navegador do profissional, chave `stabilis_professional_case` | o profissional | até fechar a aba |
| Escolha sobre contagens anônimas | `localStorage`, chave `stabilis_metrics` | idem | até mudar ou apagar |
| Leitura do aviso do ditado | `sessionStorage`, chave `stabilis_dictation_ok` (só "lido") | idem | até fechar a aba |
| Cópias das páginas e arquivos do site, para uso sem internet | Cache Storage do navegador (`stabilis-<versão>`) | — (não contêm respostas) | até a próxima versão do site |

"Apagar meus dados" remove todas as chaves acima. O cache de páginas não tem dados pessoais e é
trocado a cada versão do site.

## Dados que saem do aparelho

| Fluxo | Quando | Para onde | O que vai | O que fica lá |
|---|---|---|---|---|
| Imprimir ou salvar o relatório em PDF | ação da pessoa | impressora ou arquivo da pessoa | o relatório | fora do controle do Stabilis |
| Compartilhar o resumo | ação da pessoa, depois de aviso | aplicativo escolhido (ex.: WhatsApp) | resumo de até 3.500 caracteres | segundo as regras do aplicativo |
| Baixar o arquivo de respostas | ação da pessoa, depois de aviso | arquivo da pessoa; pode ser aberto pelo profissional, no navegador dele | respostas do guia (sem diário nem plano) e soma de verificação | fora do controle do Stabilis |
| "Extrair do texto" (profissional) | **desligado** até haver mecanismo legal para a transferência (RIPD, R3b); ligado, ação do profissional, com aviso | função na Vercel (proxy) → servidor do Stabilis no Hugging Face, **fora do Brasil** | a anamnese digitada | o texto é descartado ao fim do processamento; o resultado, que cita trechos do texto, é apagado assim que lido (e expira em até 10 minutos); nada vai para disco nem para log |
| Ajuda para organizar o relato (paciente) | **desligada** até um modelo passar nos portões; ligada, só com consentimento a cada envio | mesmo caminho acima, **fora do Brasil** | o relato | idem |
| Ditado por voz | só depois do aviso, por escolha da pessoa | serviço de fala da empresa do navegador (Google no Chrome, Apple no Safari), **fora do Brasil** | o áudio | segundo a política da empresa do navegador; o Stabilis não recebe o áudio |
| Contagens anônimas | **desligadas** até a pessoa ligar | rota `/api/metrics` na Vercel → contador mensal no Upstash (se configurado) | só o nome de um evento de uma lista fechada | contador do mês (`stabilis:<aaaa-mm>:<evento>`); sem identificador |
| Aviso de erro no conteúdo | ação da pessoa, se o canal estiver configurado | página de nova issue do espelho público | fonte, localizador e endereço da página | público, por escolha de quem avisa |
| Acesso ao site | sempre | Vercel (e Hugging Face, no caso da extração) | registros técnicos da plataforma (endereço IP, navegador, página) | segundo a política de cada plataforma; os endereços das páginas não levam dados de saúde |

## Quem trata os dados

| Papel | Quem | Observação |
|---|---|---|
| Controlador | o responsável pelo projeto, pessoa física: **[preencher nome]** | ver RIPD |
| Operadores | Vercel (hospedagem e proxy), Hugging Face (servidor do modelo), Upstash (contagens, se ligadas) | contratos e políticas de cada plataforma; servidores fora do Brasil |
| Terceiros por escolha do titular | empresa do navegador (ditado), aplicativos de mensagem (compartilhamento) | o Stabilis avisa antes; não controla esses tratamentos |
