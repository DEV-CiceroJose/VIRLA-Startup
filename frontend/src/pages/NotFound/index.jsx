import { useNavigate } from 'react-router-dom'
import Home from '@mui/icons-material/Home'
import SearchOff from '@mui/icons-material/SearchOff'
import { Button } from '../../components/ui'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-virla-neve text-center px-4"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(128,0,128,0.10), transparent)',
      }}
    >
      <div className="animate-fade-up flex flex-col items-center">
        <div className="w-20 h-20 rounded-2xl bg-virla-roxo/8 flex items-center justify-center mb-6">
          <SearchOff sx={{ fontSize: 44 }} className="text-virla-roxo/50" aria-hidden />
        </div>
        <p className="text-7xl font-display font-black text-virla-roxo leading-none">404</p>
        <h1 className="text-2xl font-bold text-virla-texto mt-4">Página não encontrada</h1>
        <p className="text-virla-muted mt-2 mb-8 max-w-sm">
          O link que você acessou não existe ou foi removido.
        </p>
        <Button icon={Home} onClick={() => navigate('/')}>
          Voltar para o início
        </Button>
      </div>
    </div>
  )
}
