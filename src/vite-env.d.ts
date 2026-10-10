/// <reference types="vite/client" />

declare module '*.docx?inline' {
  const dataUrl: string
  export default dataUrl
}

declare module '*.csv?inline' {
  const dataUrl: string
  export default dataUrl
}
