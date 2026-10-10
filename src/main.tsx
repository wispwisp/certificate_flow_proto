import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import appCss from './styles/app.css?inline'
import fontsCss from './styles/fonts.css?inline'
import App from './ui/App.tsx'

// Injected as <style>, not <link>: html2canvas clones the document, and a cloned stylesheet link would be fetched again.
for (const css of [fontsCss, appCss]) {
  const style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
