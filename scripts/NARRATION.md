# Narração do Trio do Saber

O site usa MP3 locais em `assets/narration/`, o player
`assets/narration-player.js` e dois manifestos equivalentes: `manifest.js` permite
iniciar áudio no gesto do usuário no iOS; `manifest.json` permite conferência
offline. Chaves e clientes ElevenLabs ficam somente na ferramenta de geração.
O DinoFala é um projeto independente e seus áudios não entram neste lote.

A voz escolhida pelo usuário é Jessica (`cgSgspJ2msm6clMCkdW9`), com
`eleven_v4`, idioma `pt` e textos em português brasileiro. Não substituir modelo
ou voz silenciosamente. A referência da voz é em inglês; não afirmar sotaque
nativo brasileiro sem ouvir o resultado.

## Inventário e preparação

Exporte novamente depois de qualquer mudança em texto narrado:

```sh
node scripts/export-narration.cjs
node tests/narration-corpus.cjs
python3 scripts/generate-narration.py plan --script assets/narration-script.json
```

O inventário revisado em 16 de outubro de 2026 contém 706 trechos únicos,
26.958 caracteres e no máximo 216 caracteres por trecho. O número muda quando o
conteúdo é editado; use a contagem do comando `plan`, sem inventar um teto menor.
O corpus fonte não é publicado no Pages. O manifesto publicado contém apenas
os textos e metadados necessários ao player.

Instale `ffprobe` e Python 3.10 ou posterior. Não são necessárias bibliotecas
Python externas. Guarde o staging fora do repositório, por exemplo
`/tmp/trio-narration-job`; não apague o job para tentar novamente uma requisição
de resultado incerto. Não use credenciais em argumentos de linha de comando,
arquivos do site, commits ou logs. A ferramenta lê `ELEVENLABS_API_KEY` do
ambiente ou pede a chave de forma oculta. Opcionalmente,
`ELEVENLABS_DISCOVERY_API_KEY` pode fornecer a permissão de consulta para GET;
essa chave nunca é usada para síntese POST.

## Consulta, amostra e lote

As consultas de modelos e vozes são separadas da síntese paga:

```sh
python3 scripts/generate-narration.py models
python3 scripts/generate-narration.py voices
```

Escolha um ID presente no corpus para `--clip-id`; `sample` aceita apenas um
trecho de até 500 caracteres. Ouça o MP3 produzido antes de marcar a amostra
como revisada. Use o mesmo staging, voz, modelo, configurações e seed no lote:

```sh
python3 scripts/generate-narration.py sample \
  --script assets/narration-script.json --staging /tmp/trio-narration-job \
  --voice-id cgSgspJ2msm6clMCkdW9 --model-id eleven_v4 \
  --clip-id ID_PRESENTE_NO_CORPUS

python3 scripts/generate-narration.py generate \
  --script assets/narration-script.json --staging /tmp/trio-narration-job \
  --voice-id cgSgspJ2msm6clMCkdW9 --model-id eleven_v4 \
  --sample-reviewed --approve-character-count 26958 --max-characters 26958
```

A amostra deve ter status completo, corresponder a um trecho atual e conservar
o hash de seu arquivo. Um áudio de amostra válido é reaproveitado no lote sem
outro POST. Um trecho já concluído só é reaproveitado se arquivo, hash,
configuração e texto ainda forem válidos; o reuso não espera o intervalo da API.
Trechos novos mantêm o limite padrão de 10 requisições por minuto, configurável
até 30. A aprovação de caracteres considera o inventário inteiro; o reuso reduz
as novas sínteses, sem relaxar esse teto.

## Retomada e saldo de credenciais autorizadas

Antes de cada POST, o gerador grava e sincroniza um registro `requested` em
`journal.jsonl`. Depois registra `complete`, `failed` ou `ambiguous`. Não há
tentativa automática após um POST. Em especial, timeout, conexão interrompida,
erro de autenticação, pagamento, limite de requisições e falha de decodificação
interrompem o job; confira o histórico do provedor antes de qualquer decisão.

Há uma exceção deliberada para o fluxo autorizado pelo usuário de consumir o
saldo de várias chaves: uma rejeição HTTP **401 ou 402** explícita com status do
provedor `quota_exceeded` pode ser retomada no **mesmo staging**, executando
novamente o comando com **outra credencial autorizada**. O gerador não escolhe
nem troca chaves. O registro contém somente um fingerprint SHA-256 truncado da
credencial, o status sanitizado e o código HTTP; nenhuma chave é gravada.

Se o saldo da **mesma credencial** foi recarregado, confira primeiro que os
créditos foram restabelecidos. Acrescente então `--resume-after-quota` ao mesmo
comando `generate` ou `sample`. Essa opção é uma confirmação explícita do
operador: permite novo POST somente quando o último registro correspondente
está `failed`, com `providerStatus=quota_exceeded`, HTTP 401/402 e fingerprint
conhecido. O novo registro conserva `quotaResumeAcknowledged=true` para auditoria.
Sem essa opção, a mesma credencial permanece bloqueada.

A opção nunca libera registros `requested` ou `ambiguous`, erros de rate limit,
autenticação ou `payment_required`, nem `quota_exceeded` com código HTTP
inesperado. Um registro legado sem fingerprint também permanece bloqueado.
Resultados completos são reaproveitados sem POST, mesmo com a opção ou depois
de trocar a chave. Não use essa opção como tentativa automática de resolver
falta de saldo, nem apague o journal para contornar a conferência.

Um `generation.lock` impede dois geradores simultâneos no mesmo staging. Ele é
removido ao finalizar ou interromper normalmente. Se o processo for encerrado
à força, verifique o processo e o histórico do provedor antes de remover um lock
residual. Não limpe o journal para forçar repetição.

## Conferência e instalação no site

Somente um lote completo produz `complete/manifest.json`. Antes de instalar,
`package` exige a mesma configuração, ordem, IDs, textos e nomes do corpus
atual; confere SHA-256 e decodificação com `ffprobe` de cada MP3:

```sh
python3 scripts/generate-narration.py package \
  --script assets/narration-script.json --staging /tmp/trio-narration-job \
  --resources assets/narration
```

O pacote substituto é preparado em diretório irmão temporário, incluindo ambos
os manifestos, antes de tocar nos recursos atuais. Uma falha de cópia mantém o
lote anterior; falha na instalação tenta restaurá-lo. Uma falha também no
rollback preserva a pasta `.narration-package-*` para recuperação manual. A
troca de diretórios é uma transação local com rollback, não uma promessa de
disponibilidade contínua durante os dois renames; faça antes da publicação.
Arquivos não relacionados que já existiam no destino são preservados.

Não publicar um lote incompleto nem um manifesto que aponte para MP3 ausentes.
O workflow de Pages usa `scripts/package-pages.cjs` para copiar apenas runtime
para `_site`, incluindo os dois manifestos e MP3, e excluir scripts, testes,
documentação, corpus fonte e temporários. Os tombstones `fono-do-leo/index.html`
e `sw.js` são preservados apenas para retirar caches antigos e redirecionar.

## Testes sem rede

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_generate_narration.py'
node tests/pages-package.cjs
```

Os testes Python usam áudios fictícios e `ffprobe` simulado. Exercitam limites,
journal, amostra, reuso, mudança de credencial após quota, bloqueio de repetição
ambígua, lock, integridade, manifestos web e falhas de escrita/instalação. Esses
testes não comprovam qualidade de pronúncia, áudio real ou funcionamento da API.
O lote real requer a conferência de cobertura, hashes, decodificação e audição.

Quando todos os MP3 estiverem prontos, confira o lote real sem rede:

```sh
python3 scripts/verify-narration.py --resources assets/narration \
  --report /tmp/trio-narration-verification.json
```

Esse verificador exige o inventário completo e confere os arquivos reais com
`ffprobe` e `ffmpeg`: codec MP3, 44.100 Hz, um ou dois canais, duração válida,
hashes e ausência de silêncio completo. `--allow-partial` é somente para auditar
um staging em andamento; não autoriza empacotamento nem publicação parcial.

Depois do verificador completo passar, mantenha um servidor estático na raiz e
rode a integração de navegador com o **mesmo lote real**:

```sh
BASE_URL=http://127.0.0.1:8000 node tests/narration-live.cjs
```

O teste recusa corpus incompleto, arquivos ausentes, hashes divergentes ou
manifestos JS/JSON diferentes antes de abrir os navegadores. Usa Chromium e
WebKit mobile sem trocar HTML, MP3, manifestos, decoder ou resultado de `play()`
por fixtures. Confere o primeiro prompt dos Biomas, a sequência Brasil → texto
de música, as duas introduções matemáticas, composição, velocidade persistida,
mudo e cancelamento por navegação. Também falha por erros locais de HTTP ou
tentativas de consultar ElevenLabs no runtime. Somente fontes externas são
ignoradas; integrações existentes de mapa e mídia geográfica são preservadas.
Use `BROWSER=chromium` ou `BROWSER=webkit` para executar apenas um navegador.

## Lote concluído em 16 de outubro de 2026

O lote completo foi empacotado em `assets/narration/`: **706 trechos únicos**,
26.958 caracteres, 2.242,429359 segundos (37 min 22,43 s) e 36.203.976 bytes
(36,20 MB). A voz é Jessica, com o ID e modelo definidos acima. Os quatro jogos
web estão cobertos; o DinoFala não integra esse inventário.

Os 706 arquivos passaram em cobertura, hashes SHA-256, decodificação integral
com `ffmpeg` e áudio não silencioso. Todos são MP3 mono a 44.100 Hz. A duração
individual varia de 0,679184 a 15,386122 segundos. Isso confirma a integridade
técnica; não é uma avaliação de pronúncia ou sotaque.

O staging `.narration-staging/eleven-v4-jessica/` permanece ignorado pelo Git e
sem credenciais, para reaproveitamento e auditoria. Não o publique. Alterações
futuras de texto exigem reexportar o corpus, gerar os trechos correspondentes e
conferir novamente o pacote completo antes da publicação.

## Correção contextual dos números e símbolos

`scripts/regenerate-math-narration.py` prepara dois áudios contínuos, mantendo
Jessica e `eleven_v4`, sempre com `language_code: "pt"`. O primeiro conta de 0
a 110; o segundo reúne “uma”, “duas”, “mais”, “é igual a”, dezenas e unidades.
O total é de 146 trechos existentes. As pausas usam pontuação e `[pause]`, sem
SSML. O staging conserva roteiros, respostas e o journal; não contém a chave.

```sh
python3 scripts/regenerate-math-narration.py plan \
  --staging .narration-staging/math-pt-20261017
python3 scripts/regenerate-math-narration.py generate \
  --staging .narration-staging/math-pt-20261017
```

A chave vem de `ELEVENLABS_API_KEY` ou de `--env-file` apontando para arquivo
privado fora do projeto. O journal usa as mesmas regras de retomada do gerador
original. Após recarregar a mesma chave, `--resume-after-quota` permite retomar
uma rejeição explícita de quota; não libera resultados ambíguos.

Transcreva cada master com o auxiliar `video-use-hermes`, usando `whisper-1`,
idioma `pt` e timestamps por palavra. Por exemplo, com o ambiente já instalado:

```sh
/Users/jrenan/Developer/video-use-hermes/.venv/bin/python \
  /Users/jrenan/Developer/video-use-hermes/helpers/transcribe.py \
  .narration-staging/math-pt-20261017/audio/numbers.mp3 \
  --language pt --edit-dir .narration-staging/math-pt-20261017/edit
python3 scripts/split-narration-sequence.py \
  --audio .narration-staging/math-pt-20261017/audio/numbers.mp3 \
  --plan .narration-staging/math-pt-20261017/numbers-plan.json \
  --transcript .narration-staging/math-pt-20261017/edit/transcripts/numbers.json \
  --output .narration-staging/math-pt-20261017/cuts/numbers
```

Repita os dois últimos comandos trocando `numbers` por `math`. O separador exige
correspondência entre o roteiro e o Whisper, inclusive numerais escritos como
dígitos, e escolhe os limites em silêncios entre os itens. Divergências impedem
os cortes. `cuts.json` registra fontes, hashes, limites e texto reconhecido.

Quando os tempos do Whisper atravessam pausas, `--ordered-silences` permite usar
somente os limites acústicos, exigindo exatamente uma pausa interna entre cada
par de itens e o mesmo texto reconhecido. No lote de 17 de outubro, a contagem
usou silêncio mínimo de 0,12 s; o vocabulário matemático usou 0,20 s para ignorar
uma pausa de 0,129 s dentro de uma expressão. Os dois preservam margens de 80 ms
e fades de 25 ms dentro do silêncio.

O Whisper pode omitir palavras na sequência longa. Nesse caso, confira uma janela
curta em uma nova chamada e preserve as duas respostas originais. Um arquivo
`numbers-alignment.json` pode reunir somente as palavras comprovadas pelas duas
transcrições, com os hashes e a origem de cada resposta; não invente palavras
para passar a validação. O relatório registra o basename e hash dessa evidência.
Confira também montagens feitas a partir dos MP3 finais antes de instalar.

```sh
python3 scripts/regenerate-math-narration.py install \
  --staging .narration-staging/math-pt-20261017
```

`install` exige os dois relatórios completos e `qa/cut-verification.json`
(status `pass`, 146 clipes, modelo `whisper-1`, idioma `pt` e hashes atuais dos
relatórios de corte). Verifica os hashes antes de
preparar o pacote completo de 706 trechos e instalar os dois manifestos juntos.
Depois execute o verificador completo e o teste de integração descritos acima.
Atualize também a versão de `manifest.js` nos três HTML antes da publicação;
o cache individual dos MP3 já usa seus hashes.

### Lote corrigido em 17 de outubro de 2026

Foram substituídos os 146 trechos numéricos e matemáticos (164,728163 segundos),
mantendo Jessica, Eleven v4 e `language_code: "pt"`. A contagem fonte tem
126,12 segundos e a sequência matemática, 50,36 segundos. Os dois masters e as
montagens dos arquivos finais foram transcritos com `whisper-1` em português.
A omissão de “um” nas transcrições longas foi resolvida com conferências curtas
independentes, que reconheceram “zero, um, dois, três”. As respostas originais
foram preservadas.

O pacote continua com 706 MP3 (2.208,53 segundos e 35.661.486 bytes). O
staging `.narration-staging/math-pt-20261017/` guarda fontes, cortes e evidências;
`qa/cut-verification.json` registra a conferência dos arquivos finais. Os hashes
desses relatórios também constam em `sequenceRegeneration` no manifesto.
Essa transcrição comprova o texto reconhecido, sem certificar sotaque regional.

Referências oficiais: [Text to Speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert),
[modelos](https://elevenlabs.io/docs/overview/models) e
[autenticação](https://elevenlabs.io/docs/api-reference/authentication).
