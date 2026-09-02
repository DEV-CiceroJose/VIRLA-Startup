# Integração Stripe Connect recomendada

## A. Configuração das contas

- API de contas: `/v2/core/accounts`
- Parâmetro legado `type`: não usado
- Dashboard: Express, uma visão leve para cuidadores (`dashboard: "express"`)
- Cobrança das tarifas Stripe: a VIRLA gerencia a precificação (`fees_collector: "application"`)
- Responsabilidade por saldos negativos: VIRLA (`losses_collector: "application"`)

Cada cuidador recebe a configuração de destinatário (`configuration.recipient`) com `stripe_transfers` em `stripe_balance`. Contas de cuidadores não solicitam configuração de lojista nem capacidade `card_payments`, pois recebem transferências da VIRLA em vez de cobrar o familiar diretamente.

## B. Padrão de cobrança: cobrança de destino

A cobrança é criada na conta da VIRLA somente depois da assinatura do relatório e aponta para um único cuidador. Como não existe cobrança nem autorização antes da assinatura, não há necessidade de reter fundos para liberação posterior; após o pagamento, o repasse pode ser automático.

## C. Cadastro dos cuidadores

O código usa onboarding hospedado pela Stripe, aberto apenas para o cuidador autenticado. A VIRLA cria a conta v2, solicita a configuração de destinatário e verifica continuamente se transferências e repasses estão ativos antes de liberar o Checkout.

## D. Acesso do cuidador

O cuidador abre o Dashboard Express por um link de login gerado pela VIRLA. Em uma evolução futura, os componentes incorporados recomendados são `account_onboarding`, `notification_banner`, `account_management`, `payments`, `payouts`, `balance_report` e `payout_reconciliation_report`.

## E. Webhook

Webhooks confirmam pagamentos e mudanças assíncronas, com verificação obrigatória da assinatura Stripe antes de qualquer atualização de estado.

## F. Bloqueio por relatório assinado

1. O cuidador envia o relatório do dia, que passa a ser imutável.
2. O familiar autenticado confirma o serviço, aceita a declaração e digita o nome completo.
3. O backend grava horário, identidade, versão da declaração, hash SHA-256 do relatório e HMAC dos metadados técnicos.
4. Somente o estado `SIGNED` permite criar uma sessão de Checkout.
5. O webhook da Stripe marca o relatório como pago.

## G. Estrutura do valor

- Modelo atual de teste: o familiar paga exatamente o valor calculado pelo contrato.
- Não há `application_fee_amount`; a VIRLA não retém taxa adicional nesta etapa.
- As tarifas de processamento da Stripe ficam sob responsabilidade da plataforma.

```text
Familiar paga: valor do contrato
        │
        ▼
      VIRLA ─── não retém taxa de serviço
        │
        ▼
    Cuidador ── recebe o valor base do serviço
```

As tarifas variam por país e método. Revise [stripe.com/pricing](https://stripe.com/pricing) e acompanhe o [relatório de margem](https://docs.stripe.com/connect/margin-reports).

## H. Prontidão de recebimento

Antes do Checkout, o backend consulta a conta v2 e exige as capacidades de transferências e repasses na árvore `configuration.recipient.capabilities.stripe_balance` em estado ativo.

## I. Saldos negativos

A VIRLA é responsável por saldos negativos. Em disputas, o valor é debitado primeiro da plataforma; o webhook implementado tenta reverter a transferência anterior para recuperar o valor da conta conectada.

## J. Gestão de risco

A VIRLA é a empresa que o familiar paga nessa transação e gerencia reembolsos e disputas. Stripe Radar deve ser ativado desde o início; essa proteção auxilia na detecção, mas não transfere a responsabilidade financeira da plataforma.

## K. Compatibilidade

A combinação Express + precificação pela VIRLA + responsabilidade da VIRLA por saldos negativos + cobrança de destino é compatível, com uma ressalva: o Dashboard Express tem visibilidade limitada sobre disputas e reembolsos desse padrão, portanto a VIRLA precisa manter os fluxos de recuperação por webhook implementados no backend.
