import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from '../NotificationBell'
import VerifiedSeal from '../VerifiedSeal'
import Avatar from '../Avatar'
import ThemeToggle from '../../design-system/theme/ThemeToggle'

/** Barra superior da área logada (desktop): busca, notificações e usuário. */
export default function Topbar() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [query, setQuery] = useState('')
  const isCaregiver = profile?.role === 'CUIDADOR'

  function handleSubmit(e) {
    e.preventDefault()
    const term = query.trim()
    if (isCaregiver) {
      navigate('/solicitacoes-disponiveis')
    } else {
      navigate(term ? `/feed?busca=${encodeURIComponent(term)}` : '/feed')
    }
    setQuery('')
  }

  const name = profile?.name ?? localStorage.getItem('meuNome') ?? ''

  return (
    <header className="vd-topbar">
      <form role="search" className="vd-search" onSubmit={handleSubmit}>
        <SearchOutlined fontSize="small" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isCaregiver ? 'Buscar oportunidades' : 'Buscar cuidadores'}
          aria-label={isCaregiver ? 'Buscar oportunidades' : 'Buscar cuidadores'}
        />
      </form>

      <div className="vd-topbar-actions">
        <ThemeToggle variant="inline" className="vd-topbar-icon" />
        <div className="vd-topbar-bell"><NotificationBell /></div>
        <span className="vd-topbar-divider" aria-hidden />
        <Link to="/perfil" className="vd-user" aria-label="Abrir meu perfil">
          <Avatar src={profile?.profileImage} name={name} size={42} radius={12} />
          <span>
            <strong>
              {name.split(' ').slice(0, 2).join(' ') || 'Minha conta'}
              <VerifiedSeal user={profile} iconSize={15} className="!text-[#9932CC]" />
            </strong>
            <small>{isCaregiver ? 'Cuidador' : 'Familiar'}</small>
          </span>
          <KeyboardArrowDown fontSize="small" aria-hidden />
        </Link>
      </div>
    </header>
  )
}
