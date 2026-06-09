// 把 localhost 改回你们的阿里云服务器 IP
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

export function fetchAdminUsers(token, { search = '', sort = '' } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (sort) params.set('sort', sort)
  const queryString = params.toString()
  const url = '/api/admin/users' + (queryString ? `?${queryString}` : '')
  return request(url, {
    method: 'GET',
    headers: authHeaders(token)
  })
}

export function updateUserProfile(token, payload) {
  return request('/api/user/profile', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload)
  })
}

export function syncCloudSave(token, payload) {
  return request('/api/sync', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload)
  })
}

// ==========================================
// 📈 新增：节气统计与报告 API
// ==========================================

// 1. 上传/累加当天的节气每日统计
export function uploadTermDailyStat(token, payload) {
  // payload 包含: { date, solarTerm, codeLines, activeFileCount, fixCount }
  return request('/api/term-stats', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload)
  })
}

// 2. 获取某个节气的统计数据（用于生成周报）
export function fetchTermStats(token, solarTerm) {
  // 对中文节气名进行 URL 编码防止乱码
  const encodedTerm = encodeURIComponent(solarTerm)
  return request(`/api/term-stats?solarTerm=${encodedTerm}`, {
    method: 'GET',
    headers: authHeaders(token)
  })
}

// 3. 保存总结报告快照
export function saveTermReport(token, payload) {
  // payload 包含: { solarTerm, periodStart, periodEnd, summary }
  return request('/api/reports', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload)
  })
}

// 4. 查询历史报告列表
export function fetchHistoryReports(token, solarTerm = '') {
  let url = '/api/reports'
  if (solarTerm) {
    url += `?solarTerm=${encodeURIComponent(solarTerm)}`
  }
  return request(url, {
    method: 'GET',
    headers: authHeaders(token)
  })
}

// ==========================================
// 🔐 管理员：用户账号管理 API
// ==========================================

// 删除用户
export function deleteUser(token, username) {
  return request(`/api/admin/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: authHeaders(token)
  })
}

// 修改用户角色
export function updateUserRole(token, username, role) {
  return request(`/api/admin/users/${encodeURIComponent(username)}/role`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ role })
  })
}

// 重置用户密码
export function resetUserPassword(token, username, newPassword) {
  return request(`/api/admin/users/${encodeURIComponent(username)}/reset-password`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ newPassword })
  })
}

export { API_BASE }
