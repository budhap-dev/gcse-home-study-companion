import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router.tsx'
import './styles.css'
import { applyTheme, currentThemeId } from './theme/themes.ts'

applyTheme(currentThemeId())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
