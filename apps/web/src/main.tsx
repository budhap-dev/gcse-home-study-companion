import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router.tsx'
import './styles.css'
import { applyTheme, currentThemeId } from './theme/themes.ts'
import { applyPrefs } from './theme/prefs.ts'
import { AuthGate } from './auth/AuthGate.tsx'
import { installErrorReporting } from './auth/reports.ts'
import { warmScreens } from './app/screens.ts'

applyTheme(currentThemeId())
applyPrefs()
installErrorReporting()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <RouterProvider router={router} />
    </AuthGate>
  </StrictMode>,
)

warmScreens()
