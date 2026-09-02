# Match inteligente VIRLA

O match é uma pontuação determinística e explicável entre um perfil de cuidador e uma solicitação de cuidado. Ele ordena recomendações, mas não elimina candidatos nem substitui a avaliação da família.

## Critérios da versão `virla-match-v1`

| Critério | Peso máximo |
| --- | ---: |
| Necessidades e especialidades | 35 pontos |
| Cidade ou estado de atendimento | 25 pontos |
| Valor/hora em relação ao orçamento | 20 pontos |
| Turno e frequência disponíveis | 10 pontos |
| Qualidade do perfil profissional | 10 pontos |

O resultado final fica entre 0 e 100. A resposta da API inclui o percentual, o nível, as razões positivas, pontos que precisam ser confirmados e a versão do cálculo.

## Regra de visibilidade para cuidadores

- Oportunidades novas com 60% ou mais aparecem normalmente.
- Oportunidades novas abaixo de 60% ficam ocultas quando já existem pelo menos 5 opções com boa compatibilidade.
- Se houver menos de 5 opções com 60% ou mais, a lista é completada até 5 com as melhores alternativas abaixo do limiar.
- Alternativas liberadas por baixa oferta recebem um aviso explícito na interface.
- Solicitações já visualizadas ou assumidas permanecem acessíveis independentemente da pontuação.

## Proteções

- Idade, CPF, e-mail e outros dados pessoais não participam da pontuação.
- Uma família só pode calcular matches para solicitações que pertencem à própria conta.
- Pontuações menores continuam visíveis; o algoritmo apenas ordena as opções.
- A interface informa que o resultado é uma sugestão e que disponibilidade e detalhes precisam ser confirmados.

## Dados que melhoram o resultado

O cuidador deve preencher cidade/estado, valor/hora, especialidades, turnos disponíveis, frequências de atendimento, abordagem e dados profissionais. A família deve informar as necessidades, local, orçamento, turno e frequência na solicitação.
