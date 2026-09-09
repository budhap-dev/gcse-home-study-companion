import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router.tsx'
import './styles.css'
import { applyTheme, currentThemeId } from './theme/themes.ts'
import { applyPrefs } from './theme/prefs.ts'
import { AuthGate } from './auth/AuthGate.tsx'

applyTheme(currentThemeId())
applyPrefs()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <RouterProvider router={router} />
    </AuthGate>
  </StrictMode>,
)
