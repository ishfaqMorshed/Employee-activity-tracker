const BASE = import.meta.env.VITE_API_BASE || ''  // set VITE_API_BASE to Railway URL in production

function getSession() {
  return JSON.parse(localStorage.getItem('session') || 'null')
}

async function request(path, opts = {}) {
  const session = getSession()
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (session?.employee?.api_key) headers['x-api-key'] = session.employee.api_key
  const res = await fetch(BASE + path, { ...opts, headers })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

function adminRequest(path, opts = {}) {
  const session = getSession()
  return request(path, {
    ...opts,
    headers: { ...(opts.headers || {}), 'x-admin-key': session?.admin_key || '' }
  })
}

export const api = {
  login: (email) =>
    fetch(BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e))),

  employeeStatus: (id) => request(`/employee/${id}/status`),
  employeeDashboard: (id, date) => request(`/employee/${id}/dashboard${date ? `?date=${date}` : ''}`),
  teamStatus: () => adminRequest('/manager/team-status'),

  onboard: (profile) => fetch(BASE + '/employees/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e))),

  setAgentControl: (employeeId, status) => adminRequest(`/agent/${employeeId}/control`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),
}
