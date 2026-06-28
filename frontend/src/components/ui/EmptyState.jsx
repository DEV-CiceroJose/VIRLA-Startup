/**
 * Estado vazio padronizado — ícone, título e mensagem opcional + ação.
 * Substitui os blocos "Nenhum resultado" espalhados pelas telas.
 */
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-virla-roxo/8 flex items-center justify-center mb-4">
          <Icon sx={{ fontSize: 32 }} className="text-virla-roxo/40" aria-hidden />
        </div>
      )}
      {title && <p className="text-virla-texto font-semibold">{title}</p>}
      {description && (
        <p className="text-virla-muted text-sm mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
