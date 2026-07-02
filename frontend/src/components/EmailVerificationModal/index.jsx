import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui'
import { resendVerification, reloadUser, logout } from '../../services/auth'

export default function EmailVerificationModal({ open, email, onVerified, onLogout }) {
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  if (!open) return null

  async function handleAlreadyConfirmed() {
    setChecking(true)
    try {
      const verified = await reloadUser()
      if (verified) onVerified()
      else toast.warning('Ainda não confirmamos seu e-mail. Verifique sua caixa de entrada.')
    } finally {
      setChecking(false)
    }
  }

  async function handleResend() {
    setResending(true)
    try {
      await resendVerification()
      toast.success('E-mail de confirmação reenviado.')
    } catch {
      toast.error('Não foi possível reenviar agora. Tente em instantes.')
    } finally {
      setResending(false)
    }
  }

  async function handleLogout() {
    await logout()
    onLogout()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-virla-texto">Confirme seu e-mail</h2>
        <p className="text-sm text-virla-muted">
          Enviamos um link de confirmação para <strong>{email}</strong>. Confirme para acessar a plataforma.
        </p>
        <div className="space-y-2">
          <Button fullWidth loading={checking} onClick={handleAlreadyConfirmed}>Já confirmei</Button>
          <Button fullWidth variant="secondary" loading={resending} onClick={handleResend}>
            Reenviar e-mail
          </Button>
          <button type="button" onClick={handleLogout} className="w-full text-sm text-virla-muted hover:text-virla-roxo pt-1">
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
