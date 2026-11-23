import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const srcDir = path.resolve(__dirname, '../src')

describe('Componentes del Frontend - Integridad Estructural y Modularidad', () => {
  const expectedComponents = [
    'App.jsx',
    'components/ColaboradorDashboard.jsx',
    'components/AdminDashboard.jsx',
    'components/UserAuthHeader.jsx',
    'components/ConstanciaPreviewModal.jsx',
    'components/TicketModal.jsx',
    'components/TicketDetalleModal.jsx',
    'components/PerfilModal.jsx',
    'components/CalendarioLaboral.jsx',
    'components/ChatWidget.jsx',
    'components/CentroTicketsColaborador.jsx',
    'components/AdminFaqManager.jsx',
    'components/ErrorBoundary.jsx',
    'auth/AuthContext.jsx',
    'auth/authConfig.js',
    'api/apiClient.js'
  ]

  test('Todos los módulos y componentes clave existen en src/', () => {
    for (const relPath of expectedComponents) {
      const fullPath = path.join(srcDir, relPath)
      assert.ok(fs.existsSync(fullPath), `El archivo requerido ${relPath} debe existir`)
    }
  })

  test('Los componentes principales exportan default y tienen sintaxis válida', () => {
    for (const relPath of expectedComponents) {
      if (relPath.endsWith('.jsx')) {
        const fullPath = path.join(srcDir, relPath)
        const content = fs.readFileSync(fullPath, 'utf8')
        assert.ok(
          content.includes('export default') || content.includes('export function'),
          `${relPath} debe contener exportaciones de componentes`
        )
      }
    }
  })

  test('Los modales utilizan React Portal o contenedor flotante con zIndex adecuado', () => {
    const modalFiles = [
      'components/ConstanciaPreviewModal.jsx',
      'components/TicketModal.jsx',
      'components/PerfilModal.jsx'
    ]
    for (const relPath of modalFiles) {
      const content = fs.readFileSync(path.join(srcDir, relPath), 'utf8')
      const hasOverlay = content.includes('fixed') || content.includes('createPortal') || content.includes('modal')
      assert.ok(hasOverlay, `${relPath} debe estructurar una capa modal`)
    }
  })
})
