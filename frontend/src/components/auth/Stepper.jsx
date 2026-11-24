import Check from '@mui/icons-material/Check'

/**
 * Stepper — adaptado do "Stepper" (Origin UI, 21st.dev): bolinhas numeradas
 * ligadas por uma linha que se enche conforme o avanço. Etapas já feitas
 * viram ✓ e podem ser revisitadas; as próximas ficam bloqueadas.
 */
export default function Stepper({ steps, current, onSelect, label = 'Etapas' }) {
  return (
    <ol className="va-stepper" aria-label={label}>
      {steps.map((step, index) => {
        const state = index < current ? 'is-done' : index === current ? 'is-current' : 'is-next'
        return (
          <li key={step.id} className={`va-step ${state}`} aria-current={index === current ? 'step' : undefined}>
            <button
              type="button"
              className="va-step-trigger"
              disabled={index >= current}
              onClick={() => onSelect(index)}
              aria-label={`${index < current ? 'Voltar para a etapa' : 'Etapa'} ${index + 1}: ${step.title}`}
            >
              <span className="va-step-dot" aria-hidden="true">
                {index < current ? <Check /> : index + 1}
              </span>
              <span className="va-step-title" aria-hidden="true">{step.title}</span>
            </button>
            {index < steps.length - 1 && (
              <span className="va-step-line" aria-hidden="true"><span /></span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
