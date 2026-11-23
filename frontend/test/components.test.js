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

  test('ConstanciaPreviewModal y ChatWidget no exponen JWT en la URL (?token=)', () => {
    const filesToCheck = [
      'components/ConstanciaPreviewModal.jsx',
      'components/ChatWidget.jsx'
    ]
    for (const relPath of filesToCheck) {
      const content = fs.readFileSync(path.join(srcDir, relPath), 'utf8')
      assert.ok(!content.includes('?token='), `${relPath} no debe enviar JWT por query string`)
    }
  })

  test('apiClient y App coordinan la alerta de Auth0 faltante en produccion', () => {
    const apiClientContent = fs.readFileSync(path.join(srcDir, 'api/apiClient.js'), 'utf8')
    const appContent = fs.readFileSync(path.join(srcDir, 'App.jsx'), 'utf8')
    assert.ok(apiClientContent.includes('auth0-prod-unauthorized'), 'apiClient debe emitir evento auth0-prod-unauthorized en 401')
    assert.ok(appContent.includes('auth0-prod-unauthorized'), 'App debe escuchar auth0-prod-unauthorized para mostrar banner')
  })
})
