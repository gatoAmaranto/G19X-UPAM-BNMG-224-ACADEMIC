import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isPlaceholderAuth0, AUTH0_CONFIG } from '../src/auth/authConfig.js'

describe('AuthContext - Validación de configuración Auth0', () => {
  test('isPlaceholderAuth0 identifica correctamente placeholders y valores vacíos', () => {
    assert.equal(isPlaceholderAuth0(null), true)
    assert.equal(isPlaceholderAuth0(''), true)
    assert.equal(isPlaceholderAuth0('tu_dominio.auth0.com'), true)
    assert.equal(isPlaceholderAuth0('tu_client_id_aqui'), true)
    assert.equal(isPlaceholderAuth0('placeholder'), true)
    assert.equal(isPlaceholderAuth0('dev-demo.example.com'), true)
  })

  test('isPlaceholderAuth0 aprueba dominios y client IDs reales', () => {
    assert.equal(isPlaceholderAuth0('dev-abc12345.us.auth0.com'), false)
    assert.equal(isPlaceholderAuth0('XyZ9876543210ABC'), false)
    assert.equal(isPlaceholderAuth0('login.plurione.com.mx'), false)
  })

  test('AUTH0_CONFIG expone los campos requeridos para PKCE', () => {
    assert.ok('domain' in AUTH0_CONFIG)
    assert.ok('clientId' in AUTH0_CONFIG)
    assert.ok('authorizationParams' in AUTH0_CONFIG)
    assert.ok('redirect_uri' in AUTH0_CONFIG.authorizationParams)
  })
})
