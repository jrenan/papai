# Dia e noite

Experiência de ciências do Trio do Saber, para crianças de aproximadamente 6 anos.
Mantém a tipografia arredondada e os controles grandes do site existente.

O espaço ocupa a metade esquerda e uma paisagem 3D vista de perto ocupa a direita.
No celular, as vistas ficam empilhadas. A marca rosa identifica o mesmo lugar nas
duas vistas; o personagem veste rosa. O contraste entre a metade iluminada e a
metade escura da Terra é parte essencial da explicação.

Uma única variável angular controla iluminação, posição do Sol no céu e textos.
Arrastar na horizontal gira a Terra sobre seu eixo em ambos os sentidos. Arrastar
na vertical muda a altura da câmera sem mudar o ciclo. O Sol continua fixo no
espaço. Controles alternativos: teclado, slider, quatro momentos e giro automático.

Paleta: espaço `#101c39`, papel `#f8f6ed`, texto `#1a3155`, luz `#ffcf63`, observador
`#ec5c84`. O jardim usa geometria simples, árvores, casa e personagem tridimensionais.
Nenhum tempo limite, placar, resposta punitiva ou requisito de leitura para girar.

## Descoberta guiada

A entrada oferece uma investigação com adulto, com saída para exploração livre
sempre disponível. São seis momentos: analogia corporal (ou boneco/imaginação),
comparação explícita das representações, previsão, observação do giro, explicação
causal e transferência para um ponto oposto da Terra. A fundamentação e os
limites estão em `RESEARCH.md`. A eficácia pedagógica deste app não foi medida.

Durante a previsão, o giro fica parado e os atalhos de fase são ocultados. A
primeira resposta não recebe nota. O resultado só aparece após a observação;
uma explicação causal acompanha a diferença entre previsão e acontecimento.
Na transferência, o outro céu só é mostrado após a escolha. Alternar entre os
lugares muda o ponto de vista sem girar a Terra: as duas iluminações são opostas.
O lugar rosa usa círculo; o verde usa losango e rótulo. A flutuação decorativa
dos astronautas pausa durante o percurso. As respostas ficam apenas em memória.

Os recursos gráficos são locais. Sem WebGL, as duas vistas usam Canvas 2D e os
mesmos controles e cálculos. A integração de voz usa MP3 locais e nunca expõe a
API ElevenLabs; sem um pacote de áudio gerado, o botão de voz fica oculto.

O ponto rosa usa as coordenadas de Taubaté (23°01′36″ S, 45°33′20″ O), com o mesmo
mapeamento geográfico em 3D e no modo leve. O relógio de 24 horas acompanha o
ângulo da simulação e muda ao observar o ponto oposto.

O botão **Entrar em VR** abre a exploração livre no navegador dos óculos, pelo
endereço HTTPS de `/dia-e-noite/`. O observador fica parado diante do globo.
Aponte o controle para a Terra e segure o gatilho para girá-la ou escolha um
dos quatro momentos. A janela do jardim e o relógio acompanham o mesmo ângulo.
Sair do VR devolve a exploração à página na posição escolhida. Em família, um
adulto pode usar os óculos e transmitir a imagem para as crianças menores.

Modelo pedagógico simplificado: sem estações ou órbita, tempo acelerado,
amanhecer às 06:00, entardecer às 18:00 e dimensões fora de escala. Não é um
relógio em tempo real nem uma previsão dos horários solares da cidade. As notas para adultos explicitam isso.

O Sol do jardim fica atrás da paisagem e seu disco é recortado gradualmente pelo
horizonte, tanto em 3D quanto no modo leve. As extremidades da trajetória ficam
visíveis entre os elementos da paisagem. O título da fase e sua explicação ficam
abaixo do céu, sem cobrir o nascer ou o pôr do sol.

Leo e Rafa são companheiros astronautas, modelados em geometria 3D a partir das
fotos da família. O traje azul identifica Leo; o vermelho, Rafa. Leo tem cabelo
castanho curto com franja reta para a frente, olhos castanhos sorridentes,
bochechas rosadas e um sorriso largo com a janelinha dos dentes da frente. Rafa
tem cabelo castanho-dourado mais comprido, penteado de lado, olhos
azul-acinzentados grandes, sobrancelhas marcadas e um sorriso suave. Cabelo
(calota e mechas afiladas), olhos com pálpebras, sobrancelhas, nariz, orelhas,
capacetes, mochilas e membros articulados são volumes reais; só o rubor, as
sombras suaves e a boca são pintados na pele. O sombreado é pré-calculado em
pequenas texturas (matcap), então os personagens não dependem de luzes e não
clareiam a face noturna da Terra. Eles flutuam acima e abaixo do Sol, piscam,
acenam, acompanham o ponto rosa com o olhar e comemoram as descobertas; tocar em
um deles também o faz comemorar. O movimento é pausável, respeita movimento
reduzido e para fora da tela. O modo sem WebGL usa PNG transparentes
renderizados dos mesmos modelos.

`astronauts.js` fornece construtores e animação reutilizáveis (`create`,
`animate`, `cheer`, `lookAt`). `models/preview.html` mostra os dois personagens
de perto, para conferir a semelhança. Os arquivos JSON em `models/` podem ser
abertos com `THREE.ObjectLoader`; `scripts/render-astronauts.cjs` gera esses
arquivos e os PNG a partir da geometria.

## Cenário e interface

`scenery.js` desenha a decoração das duas vistas: no espaço, fundo com nebulosa,
estrelas que cintilam, Sol com coroa e raios, setas de luz indo do Sol à Terra,
nuvens e o brilho da atmosfera no lado iluminado; no jardim, céu em degradê que
muda com a hora, nuvens, colinas, casa com janelas que acendem ao escurecer,
árvores, flores, vaga-lumes à noite, sombras que acompanham o Sol e a criança
vista de costas. O modelo, os marcadores e o disco solar testado continuam em
`app.js`. A Lua continua fora do cenário, para não sugerir que ela causa a
noite. Toda animação decorativa usa o mesmo relógio pausável dos astronautas.

A interface usa tipografia arredondada do sistema, botões com relevo, um
controle deslizante cuja trilha mostra o ciclo do dia, um cartão de fase com
ícone e cor próprios, pontinhos de progresso na descoberta guiada e uma chuva
curta de papéis e estrelas ao concluir uma descoberta. Soltar a Terra no meio
do gesto a mantém girando por um instante. Com movimento reduzido não há
inércia, confete nem animações decorativas.

A condução por voz tem 25 clipes no roteiro `narration-texts.json`. Um gesto no
botão de reprodução libera um único elemento de áudio, reutilizado entre etapas
para compatibilidade com iOS. As orientações explicam também os ícones das
opções. Não há reprodução antes do gesto; ocultar a página interrompe a voz.
A geração no ElevenLabs ficou para depois, por decisão do usuário. Até o
manifesto indicar um pacote disponível, os controles de voz ficam ocultos.
