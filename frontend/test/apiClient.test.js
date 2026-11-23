import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAvatarUrl } from '../src/api/apiClient.js'

describe('apiClient - Normalización de URLs y Avatares', () => {
  test('Retorna null para valores vacíos, nulos o no string', () => {
    assert.equal(resolveAvatarUrl(null), null)
    assert.equal(resolveAvatarUrl(undefined), null)
    assert.equal(resolveAvatarUrl(''), null)
    assert.equal(resolveAvatarUrl('   '), null)
  })

  test('Mantiene intactas las URLs de datos (data URLs y blob URLs)', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const blobUrl = 'blob:http://localhost:5173/1234-5678'
    assert.equal(resolveAvatarUrl(dataUrl), dataUrl)
    assert.equal(resolveAvatarUrl(blobUrl), blobUrl)
  })

  test('Conserva URLs absolutas de CDN externas (ej. Unsplash, Auth0)', () => {
    const unsplashUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'
    assert.equal(resolveAvatarUrl(unsplashUrl), unsplashUrl)
  })

  test('Normaliza rutas relativas y antepone /media a /avatares/', () => {
    assert.equal(resolveAvatarUrl('/avatares/emp_01.png'), '/media/avatares/emp_01.png')
    assert.equal(resolveAvatarUrl('avatares/emp_01.png'), '/media/avatares/emp_01.png')
    assert.equal(resolveAvatarUrl('/media/avatares/emp_01.png'), '/media/avatares/emp_01.png')
  })

  test('Limpia prefijos de host internos si vinieron en la base de datos', () => {
    assert.equal(resolveAvatarUrl('http://backend:8000/media/avatares/foto.jpg'), '/media/avatares/foto.jpg')
    assert.equal(resolveAvatarUrl('http://localhost:8000/media/avatares/foto.jpg'), '/media/avatares/foto.jpg')
    assert.equal(resolveAvatarUrl('http://127.0.0.1:8000/media/avatares/foto.jpg'), '/media/avatares/foto.jpg')
  })
})
