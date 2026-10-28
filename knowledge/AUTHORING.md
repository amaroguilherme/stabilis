# Como escrever e conferir a base de conhecimento

Toda afirmação clínica do Stabilis vem de uma fonte pública registrada em `knowledge/sources.json`, com **localizador** e **trecho literal**. O motor de decisão só usa o que está aqui. Não existe revisão clínica no projeto hoje; por isso o conteúdo é conferido mecanicamente (o trecho existe na fonte?) e depois por uma segunda leitura humana (o trecho sustenta o que afirmamos?).

## Ferramentas

| Comando | Para quê |
|---|---|
| `python -I scripts/fetch_sources.py [ids]` | Baixa as fontes para `.sources-cache/` (fora do git) e extrai o texto |
| `python -I scripts/show_source.py <fonte> "<seção>"` | Mostra o texto de uma seção de bula (ex.: `"5.2 Serotonin"`) |
| `python -I scripts/show_source.py <fonte> --grep "<regex>"` | Mostra ocorrências com contexto |
| `python -I scripts/show_source.py rename-2024 --page 131` | Mostra uma página de PDF |
| `python -I scripts/anvisa_lookup.py "<regex>"` | Princípios ativos e marcas nos dados abertos da ANVISA |
| `python -I scripts/dailymed_find.py <princípio> --title <MARCA>` | Acha a bula da FDA para registrar como fonte |
| `python scripts/build_kb.py --validate-only --filter drugs/<id>.json` | Valida esquema e referências de um arquivo |
| `python -I scripts/verify_quotes.py knowledge/drugs/<id>.json` | Confere os trechos citados contra a fonte |
| `python scripts/build_kb.py` | Valida tudo e gera `webapp/app/lib/kb/kb.generated.json` |

Os arquivos baixados são dados não confiáveis: os scripts que os leem rodam com `python -I`.

## Citação

```json
{"source": "label-fluoxetina", "locator": "seção 5.2 Serotonin Syndrome", "quote": "trecho copiado da fonte", "accessed": "2026-10-27"}
```

- **quote**: copie da saída de `show_source.py`, sem reescrever, sem traduzir e com no máximo 400 caracteres. A conferência ignora maiúsculas/minúsculas e espaços, mais nada.
- **locator**: em bulas, `seção <número> <título>`, `Boxed warning: <título>`, `Highlights: <seção>` (o quadro-resumo da bula, extraído como seções próprias) ou `Medication Guide: <pergunta>`; em PDFs, comece com `pdf p. N` (a conferência exige o trecho naquela página); em diretrizes HTML, o número da recomendação.
- **absent_term** (no lugar de `quote`): afirma que um termo *não aparece* na fonte — usado para "não consta na RENAME". A conferência falha se o termo aparecer.
- **note**: opcional, para contexto (ex.: um segundo trecho da mesma seção).

## Medicamento (`knowledge/drugs/<id>.json`)

Siga `knowledge/drugs/fluoxetina.json` como modelo. O nome do arquivo é o `id` (português, sem acento, ex.: `litio`, `acido-acetilsalicilico`).

- **names**: `dcb` (Denominação Comum Brasileira, como na RENAME/ANVISA), `display_pt`, `inn_en`, `aliases` (formas que alguém digitaria) e `anvisa_principles` — os valores **exatos** de `PRINCIPIO_ATIVO` da ANVISA para este medicamento (para combinações, só o componente, ex.: `"fosfato de codeína"`). Use `anvisa_lookup.py`.
- **class/subclass**: de `knowledge/vocab/classes.json`.
- **scope**: `anvisa_registered: true` só com registro ativo, citando a linha do CSV: `"quote": "\"Ativo\";\"cloridrato de fluoxetina\""` (para combinações, o campo inteiro, ex.: `"\"Ativo\";\"paracetamol, fosfato de codeína\""`). `interaction_only: true` para medicamentos não psiquiátricos que só entram para checar interações.
- **label_source**: a bula da FDA registrada (`label-<id>`).
- **sus**: componente na RENAME 2024 pela página do PDF — Anexo I, Componente Básico: pdf p. 124–145; Anexo II, Estratégico: pdf p. 146–161; Anexo III, Especializado: pdf p. 162 em diante. Ache com `show_source.py rename-2024 --grep "<nome>"` e cite o nome como aparece, com `pdf p. N`. Se não aparecer em lugar nenhum, `"component": "nao_consta"` com `absent_term`. Omita para medicamentos só de interação.
- **dose_adult** (mg/dia): da seção *Dosage and Administration* para a indicação adulta relevante (depressão, ansiedade, bipolar, insônia). Preencha só os números que a bula dá e diga a indicação. Doses por kg vão em `note`. Omita para medicamentos só de interação.
- **facts**: só o que a bula afirma sobre este medicamento, cada um com sua citação. Use apenas ids de `knowledge/vocab/facts.json` — se faltar um, não invente: anote no relatório.
- **monitoring**: só quando a bula manda acompanhar (ids de `knowledge/vocab/monitoring.json`).
- **review**: `{"status": "draft", "extracted_by": "ai", "extracted_on": "<data>", "verified_by": null, "verified_on": null}`. Só uma pessoa muda para `verified`, depois de reler cada citação.

### Severidade dos fatos

A severidade de um fato descreve **onde e como a bula fala dele**. É informação para exibição: o motor não decide nada com ela. As decisões vêm das regras (`rules/`) e das interações (`interactions/`), que têm severidade própria. A regra é posicional, para que qualquer pessoa chegue ao mesmo valor:

| severity | quando |
|---|---|
| `contraindicated` | o trecho citado diz que é contraindicado, ou está na seção 4 *Contraindications* |
| `major` | o trecho está no *Boxed warning* |
| `warning` | o trecho está em *Warnings and Precautions* (seção 5, ou WARNINGS/PRECAUTIONS nas bulas antigas) |
| `info` | qualquer outra seção (posologia, interações, superdosagem, farmacologia) |

Exceção: se o trecho da seção 4 é só contexto de outra contraindicação (ex.: amitriptilina cita QT ao contraindicar a cisaprida), use `warning` e explique no `note`. Prefira citar o trecho que sustenta o fato diretamente.

### Critérios por fato

| fato | marcar quando a bula… |
|---|---|
| `serotonergic` | descreve risco de síndrome serotoninérgica com este medicamento |
| `maoi` | diz que é inibidor da MAO |
| `maoi_contraindicated` | contraindica o uso com IMAO (seção 4), inclusive linezolida |
| `cns_depressant` | alerta para sedação/depressão respiratória somada a outros depressores do SNC |
| `qt_prolongation` | alerta para prolongamento do QT ou torsades com este medicamento |
| `seizure_threshold_lowering` | alerta para convulsões ou para usar com cuidado em quem tem convulsões |
| `seizure_disorder_contraindication` | contraindica em epilepsia/convulsões |
| `eating_disorder_contraindication` | contraindica em bulimia/anorexia |
| `anticholinergic_burden` | descreve efeitos anticolinérgicos relevantes (retenção urinária, glaucoma, confusão) |
| `bleeding_risk` | alerta para risco de sangramento |
| `antidepressant_mania_switch` | alerta para virada maníaca/hipomaníaca ou manda rastrear bipolaridade |
| `orthostatic_hypotension` | alerta para hipotensão ortostática/síncope |
| `blood_pressure_increase` | alerta para aumento de pressão arterial |
| `suicidality_warning_young` | tem o *boxed warning* de suicidalidade em jovens |
| `overdose_toxicity_high` | diz que a superdosagem pode ser fatal ou de alta toxicidade |
| `dementia_mortality_warning` | tem o *boxed warning* de mortalidade em idosos com demência |
| `opioid_coadministration_warning` | tem o *boxed warning* sobre uso com opioides |
| `dependence_withdrawal` | alerta para abuso, dependência ou abstinência |
| `complex_sleep_behaviors` | tem o alerta de comportamentos complexos do sono |
| `discontinuation_syndrome` | alerta para sintomas na retirada abrupta |
| `angle_closure_glaucoma_warning` | alerta para glaucoma de ângulo fechado |
| `hyponatremia_risk` | alerta para hiponatremia/SIADH |
| `neutropenia_agranulocytosis` | alerta para neutropenia, agranulocitose ou anemia aplástica |
| `serious_rash` | alerta para Stevens-Johnson/NET ou erupções graves |
| `myocarditis_cardiomyopathy` | alerta para miocardite/cardiomiopatia |
| `hepatotoxicity` | alerta para lesão hepática |
| `hepatic_impairment_avoid` | contraindica ou manda evitar em doença hepática |
| `renal_impairment_caution` | manda ajustar dose ou evitar em doença renal |
| `pancreatitis` | alerta para pancreatite |
| `renal_effects` / `thyroid_effects` | alerta para efeito sobre rim / tireoide |
| `narrow_therapeutic_index` | exige dosagem sérica por margem estreita |
| `sexual_dysfunction`, `sedation_significant`, `weight_gain_significant`, `metabolic_risk`, `eps_tardive_dyskinesia`, `prolactin_elevation` | tem seção ou alerta específico sobre isso (não basta aparecer na tabela de eventos adversos) |
| `teratogenic_major` | afirma risco aumentado de malformações congênitas graves (ex.: defeitos do tubo neural) |
| `pregnancy_risk` | descreve risco fetal ou neonatal (malformação específica, síndrome neonatal) sem ser `teratogenic_major` |
| `lactation_caution` | desaconselha amamentar ou descreve efeito adverso em lactentes |
| `cyp2d6_strong_inhibitor`, `cyp1a2_strong_inhibitor`, `cyp3a4_strong_inducer` | diz que o medicamento é inibidor/indutor potente dessa enzima |
| `cyp2d6_substrate_sensitive`, `cyp1a2_substrate_sensitive`, `cyp3a4_substrate_sensitive` | manda ajustar dose ou evitar com inibidores/indutores dessa enzima |
| `lamotrigine_level_raiser` | diz que aumenta os níveis de lamotrigina |
| `lithium_level_raiser` | diz que aumenta os níveis de lítio |
| `hormonal_contraceptive_reducer` | diz que reduz a eficácia de anticoncepcionais hormonais |

## Antes de terminar

1. `python scripts/build_kb.py --validate-only --filter drugs/<id>.json` → 0 erros.
2. `python -I scripts/verify_quotes.py knowledge/drugs/<id>.json` → 0 falhas.
3. Releia: cada `quote` sustenta o `tag` sozinho?

## Efeitos comuns (`common_effects` do medicamento)

Lista, em linguagem leiga, os efeitos adversos que a bula aponta como **mais comuns**, para a tela do paciente.

- Cite a frase da bula que lista as reações mais comuns (em geral "incidência ≥5% e pelo menos o dobro do placebo") para a indicação usada pelo Stabilis; diga no `note` quando a bula só tem outra indicação ou junta várias.
- Cada efeito precisa estar **no próprio trecho citado** (`quote`): o que só aparece no `note` não entra, porque o `note` não é conferido.
- Use os ids de `knowledge/vocab/effects.json`; reações sem id ficam de fora e são citadas no `note`.
- Bulas antigas sem frase de frequência ficam sem o campo (hoje: amitriptilina, nortriptilina, imipramina, clorpromazina).

## Questionários (`knowledge/instruments/<id>.json`)

- O texto de cada item, o enunciado e as opções vêm **literalmente** da versão oficial em português, com citação (`cite` no item, `stem_cite`, `options_cite`). Nunca traduza por conta própria: sem texto oficial ou sem licença que permita o uso num app gratuito, o item fica `pending` e o questionário não aparece no fluxo do paciente.
- `license_note` resume a licença e aparece embaixo das perguntas; o AUDIT exige informar que é instrumento aprovado pela OMS, e o ASQ exige citar o NIMH.
- Perguntas condicionais usam `ask_if` (ex.: a pergunta 5 do ASQ só depois de um "sim" nas perguntas 1 a 4). Item não perguntado conta como 0.
- Pontos de corte citam o estudo original ou o manual oficial; estudos brasileiros de validação entram em `validation_note`.
- **Perguntas baseadas em diretriz** (`"origin": "guideline_based"`) são a exceção: escritas pelo projeto em linguagem simples, cada item cita o trecho da diretriz que sustenta o seu conteúdo, e o `license_note` avisa que não é questionário validado. Use só quando não houver instrumento validado com licença compatível.
- `purpose` diz o papel no fluxo (`symptoms`, `suicide_screen`, `bipolar_screen`, `alcohol`); o motor acha as triagens por ele.
- Situação atual: PHQ-9, GAD-7, ASQ e AUDIT-C verificados; a triagem de bipolaridade usa `bipolar_hx`, perguntas baseadas na NICE CG185 1.2.1 e no MI-mhGAP. O MDQ segue pendente (exige permissão do autor e o texto brasileiro só existe como imagem).
