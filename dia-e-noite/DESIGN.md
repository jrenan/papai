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

Modelo pedagógico simplificado: lugar próximo ao Equador, sem estações ou órbita,
tempo acelerado e dimensões fora de escala. As notas para adultos explicitam isso.

Leo e Rafa são companheiros astronautas, modelados em geometria 3D a partir da
arte do cabeçalho `assets/trio-do-saber.png`. O traje azul identifica Leo; o
vermelho, Rafa. Rafa tem olhos azuis. Rostos, cabelo, olhos, capacetes, mochilas e membros articulados
são volumes reais. Uma cena separada ilumina os personagens sem clarear a face
noturna da Terra. Eles flutuam acima e abaixo do Sol, longe dos controles e do
marcador. O movimento é pausável, respeita movimento reduzido e para fora da tela.
O modo sem WebGL usa PNG transparentes renderizados dos mesmos modelos.

`astronauts.js` fornece construtores e animação reutilizáveis. Os arquivos em
`models/` podem ser abertos com `THREE.ObjectLoader`; `scripts/render-astronauts.cjs`
gera esses arquivos e os PNG a partir da geometria.
