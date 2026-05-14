const API_BASE = import.meta.env.VITE_CLOUD_API_BASE || 'http://120.25.247.9:3000'

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })

  const data = await response.json().catch(() => ({
    success: false,
    message: '服务器返回了无法解析的数据'
  }))

  if (!response.ok || data.success === false) {
    const error = new Error(data.message || '云端请求失败')
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function registerAccount(username, password) {
  return request('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
}

export function loginAccount(username, password) {
  return request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
}

export function fetchCloudSave(token) {
  return request('/api/user/me', {
    method: 'GET',
    headers: authHeaders(token)
  })
}

export function syncCloudSave(token, payload) {
  return request('/api/sync', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload)
  })
}

export { API_BASE }
