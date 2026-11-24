import { DarkModeOutlined, LightModeOutlined } from '@mui/icons-material'
import { IconButton, Tooltip } from '@mui/material'
import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()
  const nextTheme = isDark ? 'claro' : 'escuro'

  return (
    <Tooltip title={`Ativar tema ${nextTheme}`}>
      <IconButton
        onClick={toggleTheme}
        aria-label={`Ativar tema ${nextTheme}`}
        size="large"
        sx={{
          position: 'fixed',
          right: { xs: 16, sm: 24 },
          bottom: { xs: 16, sm: 24 },
          zIndex: 1200,
          width: 48,
          height: 48,
          color: 'var(--virla-text-primary)',
          backgroundColor: 'var(--virla-surface-raised)',
          border: '1px solid var(--virla-border)',
          boxShadow: 'var(--virla-shadow-floating)',
          '&:hover': {
            backgroundColor: 'var(--virla-surface-muted)',
          },
        }}
      >
        {isDark ? <LightModeOutlined /> : <DarkModeOutlined />}
      </IconButton>
    </Tooltip>
  )
}
