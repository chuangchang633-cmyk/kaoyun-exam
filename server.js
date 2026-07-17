import http from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

const root = process.cwd()
const production = process.argv.includes('--production')
const port = Number(process.env.PORT || 8787)
const publicOrigin = (process.env.PUBLIC_ORIGIN || '').replace(/\/$/, '')
const adminUser = process.env.ADMIN_USER || 'admin'
const adminPass = process.env.ADMIN_PASS || '123456'
const operators = (() => {
  try {
    const parsed = JSON.parse(process.env.ADMIN_USERS || '[]')
    if (Array.isArray(parsed) && parsed.length) return parsed
  } catch {}
  return [
    { username: adminUser, password: adminPass, name: '管理员', role: '系统管理员' },
    { username: 'invigilator', password: adminPass, name: '监考员', role: '考试现场管理' },
    { username: 'analyst', password: adminPass, name: '数据员', role: '成绩汇总查看' }
  ]
})()
const safeOperators = operators.map(({ password, ...operator }) => operator)
const dataDir = path.join(root, 'data')
const dataFile = path.join(dataDir, 'db.json')
const clients = new Set()
const sessions = new Map()

const seed = {
  exams: [
    {
      id: 'exam-safety-01',
      title: '2026 年度生产安全知识考试',
      description: '共 5 题，满分 100 分，提交后自动判分。',
      duration: 30,
      passScore: 60,
      status: 'active',
      createdAt: '2026-07-14T01:30:00.000Z',
      questions: [
        { id: 'q1', type: 'single', title: '发现设备异常时，首先应该怎么做？', options: ['继续运行并观察', '立即停机并按流程上报', '自行拆卸检修', '等待交接班处理'], answer: [1] },
        { id: 'q2', type: 'multiple', title: '进入生产区域前，应完成哪些准备？', options: ['规范佩戴防护用品', '了解疏散通道', '关闭手机', '确认现场风险提示'], answer: [0, 1, 3] },
        { id: 'q3', type: 'single', title: '灭火器压力表指针位于哪个区域表示压力正常？', options: ['红色区域', '绿色区域', '黄色区域', '任意区域'], answer: [1] },
        { id: 'q4', type: 'single', title: '发生人员触电时，正确的第一步是？', options: ['直接用手拉开伤员', '立即切断电源', '给伤员喝水', '等待专业人员到场'], answer: [1] },
        { id: 'q5', type: 'multiple', title: '以下哪些属于事故隐患上报信息？', options: ['发生位置', '现场照片', '隐患描述', '发现时间'], answer: [0, 1, 2, 3] }
      ]
    },
    {
      id: 'exam-service-02',
      title: '门店服务规范月度测评',
      description: '门店服务人员月度知识复盘。',
      duration: 20,
      passScore: 80,
      status: 'draft',
      createdAt: '2026-07-10T06:00:00.000Z',
      questions: []
    }
  ],
  submissions: [
    { id: 's1', examId: 'exam-safety-01', name: '陈雨', department: '生产一部', score: 80, passed: true, durationSeconds: 612, submittedAt: '2026-07-14T02:13:00.000Z' },
    { id: 's2', examId: 'exam-safety-01', name: '赵明', department: '设备组', score: 100, passed: true, durationSeconds: 488, submittedAt: '2026-07-14T02:17:00.000Z' },
    { id: 's3', examId: 'exam-safety-01', name: '李晓', department: '生产二部', score: 40, passed: false, durationSeconds: 821, submittedAt: '2026-07-14T02:25:00.000Z' }
  ],
  candidates: [
    { id: 'c1', name: '陈雨', department: '生产一部', note: '安全员', createdAt: '2026-07-14T02:00:00.000Z' },
    { id: 'c2', name: '赵明', department: '设备组', note: '', createdAt: '2026-07-14T02:00:00.000Z' },
    { id: 'c3', name: '李晓', department: '生产二部', note: '需补考', createdAt: '2026-07-14T02:00:00.000Z' }
  ]
}

async function loadDb() {
  await mkdir(dataDir, { recursive: true })
  if (!existsSync(dataFile)) await writeFile(dataFile, JSON.stringify(seed, null, 2))
  const db = JSON.parse(await readFile(dataFile, 'utf8'))
  db.candidates ||= []
  db.submissions.forEach(item => {
    const exists = db.candidates.some(candidate => candidate.name === item.name && candidate.department === item.department)
    if (!exists) db.candidates.push({ id: `c-${crypto.randomUUID().slice(0, 8)}`, name: item.name, department: item.department, note: '', createdAt: item.submittedAt || new Date().toISOString() })
  })
  return db
}

async function saveDb(db) {
  await writeFile(dataFile, JSON.stringify(db, null, 2))
  broadcast({ type: 'refresh' })
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

async function body(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw ? JSON.parse(raw) : {}
}

function broadcast(payload) {
  const message = `data: ${JSON.stringify(payload)}\n\n`
  clients.forEach(client => client.write(message))
}

function mime(file) {
  const ext = path.extname(file)
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' })[ext] || 'application/octet-stream'
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter(item => item?.family === 'IPv4' && !item.internal).map(item => item.address)
}

function resolvePublicOrigin(req) {
  if (publicOrigin) return publicOrigin
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
  if (!forwardedHost) return ''
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(:\d+)?$/i.test(forwardedHost)) return ''
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (req.socket.encrypted ? 'https' : 'http')
  return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '')
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(part => {
    const [key, ...value] = part.trim().split('=')
    return [key, decodeURIComponent(value.join('='))]
  }))
}

function isAuthed(req) {
  const sid = cookies(req).ky_session
  return Boolean(sid && sessions.has(sid))
}

function currentSession(req) {
  const sid = cookies(req).ky_session
  return sid ? sessions.get(sid) : null
}

function requireAuth(req, res) {
  if (isAuthed(req)) return true
  json(res, 401, { error: '请先登录管理员账号' })
  return false
}

function cleanExam(input) {
  return {
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim(),
    duration: Math.max(1, Number(input.duration || 30)),
    passScore: Math.min(100, Math.max(0, Number(input.passScore || 60))),
    questions: (input.questions || []).map((question, index) => ({
      id: question.id || `q-${crypto.randomUUID().slice(0, 8)}`,
      type: question.type === 'multiple' ? 'multiple' : 'single',
      title: String(question.title || `第 ${index + 1} 题`).trim(),
      options: (question.options || []).map(option => String(option).trim()).filter(Boolean).slice(0, 8),
      answer: [...new Set((question.answer || []).map(Number))].filter(answer => Number.isInteger(answer) && answer >= 0)
    })).filter(question => question.title && question.options.length >= 2 && question.answer.length)
  }
}

function upsertCandidate(db, input) {
  const name = String(input.name || '').trim()
  const department = String(input.department || '').trim()
  if (!name || !department) return null
  let candidate = db.candidates.find(item => item.name === name && item.department === department)
  if (!candidate) {
    candidate = { id: `c-${crypto.randomUUID().slice(0, 8)}`, name, department, note: String(input.note || '').trim(), createdAt: new Date().toISOString() }
    db.candidates.unshift(candidate)
  }
  return candidate
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  try {
    if (url.pathname === '/api/events') {
      if (!requireAuth(req, res)) return
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
      res.write('data: {"type":"connected"}\n\n')
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }

    if (url.pathname === '/api/login' && req.method === 'POST') {
      const input = await body(req)
      const operator = operators.find(item => item.username === input.username && item.password === input.password)
      if (!operator) return json(res, 401, { error: '账号或密码不正确' })
      const sid = crypto.randomUUID()
      sessions.set(sid, { createdAt: Date.now(), username: operator.username })
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': `ky_session=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` })
      return res.end(JSON.stringify({ ok: true, user: safeOperators.find(item => item.username === operator.username) }))
    }

    if (url.pathname === '/api/logout' && req.method === 'POST') {
      const sid = cookies(req).ky_session
      if (sid) sessions.delete(sid)
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': 'ky_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' })
      return res.end(JSON.stringify({ ok: true }))
    }

    if (url.pathname === '/api/session' && req.method === 'GET') {
      const session = currentSession(req)
      return json(res, 200, { authenticated: Boolean(session), user: session ? safeOperators.find(item => item.username === session.username) : null, operators: safeOperators })
    }

    if (url.pathname === '/api/session/operator' && req.method === 'POST') {
      if (!requireAuth(req, res)) return
      const session = currentSession(req)
      const input = await body(req)
      const operator = safeOperators.find(item => item.username === input.username)
      if (!operator) return json(res, 404, { error: '登录人员不存在' })
      session.username = operator.username
      return json(res, 200, { ok: true, user: operator })
    }

    if (url.pathname === '/api/bootstrap' && req.method === 'GET') {
      if (!requireAuth(req, res)) return
      const db = await loadDb()
      const session = currentSession(req)
      return json(res, 200, { ...db, lanAddresses: lanAddresses(), port, production, publicOrigin: resolvePublicOrigin(req), operators: safeOperators, currentUser: safeOperators.find(item => item.username === session?.username) })
    }

    if (url.pathname === '/api/exams' && req.method === 'POST') {
      if (!requireAuth(req, res)) return
      const db = await loadDb()
      const input = cleanExam(await body(req))
      if (!input.title) return json(res, 400, { error: '请填写考试名称' })
      if (!input.questions.length) return json(res, 400, { error: '请至少添加一道有效试题' })
      const exam = { ...input, id: `exam-${crypto.randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString(), status: 'draft' }
      db.exams.unshift(exam)
      await saveDb(db)
      return json(res, 201, exam)
    }

    const examMatch = url.pathname.match(/^\/api\/exams\/([^/]+)$/)
    if (examMatch && req.method === 'PATCH') {
      if (!requireAuth(req, res)) return
      const db = await loadDb()
      const exam = db.exams.find(item => item.id === examMatch[1])
      if (!exam) return json(res, 404, { error: '考试不存在' })
      Object.assign(exam, await body(req))
      await saveDb(db)
      return json(res, 200, exam)
    }

    if (examMatch && req.method === 'DELETE') {
      if (!requireAuth(req, res)) return
      const db = await loadDb()
      const before = db.exams.length
      db.exams = db.exams.filter(item => item.id !== examMatch[1])
      db.submissions = db.submissions.filter(item => item.examId !== examMatch[1])
      if (db.exams.length === before) return json(res, 404, { error: '考试不存在' })
      await saveDb(db)
      return json(res, 200, { ok: true })
    }

    const publicMatch = url.pathname.match(/^\/api\/public\/exams\/([^/]+)$/)
    if (publicMatch && req.method === 'GET') {
      const db = await loadDb()
      const exam = db.exams.find(item => item.id === publicMatch[1] && item.status === 'active')
      if (!exam) return json(res, 404, { error: '考试未发布或已结束' })
      const safeExam = { ...exam, questions: exam.questions.map(({ answer, ...question }) => question) }
      return json(res, 200, safeExam)
    }

    if (url.pathname === '/api/submissions' && req.method === 'POST') {
      const db = await loadDb()
      const input = await body(req)
      const exam = db.exams.find(item => item.id === input.examId && item.status === 'active')
      if (!exam) return json(res, 404, { error: '考试未发布或已结束' })
      const correct = exam.questions.reduce((count, question) => {
        const given = [...(input.answers?.[question.id] || [])].sort().join(',')
        return count + (given === [...question.answer].sort().join(',') ? 1 : 0)
      }, 0)
      const score = exam.questions.length ? Math.round(correct / exam.questions.length * 100) : 0
      const submission = { id: `s-${crypto.randomUUID().slice(0, 8)}`, examId: exam.id, name: input.name.trim(), department: input.department.trim(), score, passed: score >= exam.passScore, durationSeconds: input.durationSeconds, submittedAt: new Date().toISOString() }
      upsertCandidate(db, input)
      db.submissions.unshift(submission)
      await saveDb(db)
      return json(res, 201, submission)
    }

    if (url.pathname === '/api/candidates' && req.method === 'POST') {
      if (!requireAuth(req, res)) return
      const db = await loadDb()
      const input = await body(req)
      const candidate = upsertCandidate(db, input)
      if (!candidate) return json(res, 400, { error: '请填写姓名和部门' })
      candidate.note = String(input.note || '').trim()
      await saveDb(db)
      return json(res, 201, candidate)
    }

    const candidateMatch = url.pathname.match(/^\/api\/candidates\/([^/]+)$/)
    if (candidateMatch && req.method === 'PATCH') {
      if (!requireAuth(req, res)) return
      const db = await loadDb()
      const candidate = db.candidates.find(item => item.id === candidateMatch[1])
      if (!candidate) return json(res, 404, { error: '考生不存在' })
      const input = await body(req)
      Object.assign(candidate, {
        name: String(input.name ?? candidate.name).trim(),
        department: String(input.department ?? candidate.department).trim(),
        note: String(input.note ?? candidate.note).trim()
      })
      await saveDb(db)
      return json(res, 200, candidate)
    }

    if (candidateMatch && req.method === 'DELETE') {
      if (!requireAuth(req, res)) return
      const db = await loadDb()
      const before = db.candidates.length
      db.candidates = db.candidates.filter(item => item.id !== candidateMatch[1])
      if (db.candidates.length === before) return json(res, 404, { error: '考生不存在' })
      await saveDb(db)
      return json(res, 200, { ok: true })
    }

    if (url.pathname === '/api/export.csv' && req.method === 'GET') {
      if (!requireAuth(req, res)) return
      const db = await loadDb()
      const rows = [['姓名', '部门', '考试', '成绩', '结果', '用时(秒)', '提交时间']]
      db.submissions.filter(item => !url.searchParams.get('examId') || item.examId === url.searchParams.get('examId')).forEach(item => {
        const exam = db.exams.find(examItem => examItem.id === item.examId)
        rows.push([item.name, item.department, exam?.title || '', item.score, item.passed ? '通过' : '未通过', item.durationSeconds, item.submittedAt])
      })
      const csv = '\ufeff' + rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="exam-results.csv"' })
      return res.end(csv)
    }

    if (production) {
      const dist = path.join(root, 'dist')
      let file = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname)
      try {
        if (!(await stat(file)).isFile()) file = path.join(dist, 'index.html')
      } catch {
        const rootAsset = ['/sw.js', '/manifest.webmanifest'].includes(url.pathname) ? path.join(root, url.pathname.slice(1)) : ''
        try { file = rootAsset && (await stat(rootAsset)).isFile() ? rootAsset : path.join(dist, 'index.html') } catch { file = path.join(dist, 'index.html') }
      }
      res.writeHead(200, { 'Content-Type': mime(file) })
      return res.end(await readFile(file))
    }

    json(res, 404, { error: 'Not found' })
  } catch (error) {
    console.error(error)
    json(res, 500, { error: '服务暂时不可用' })
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`考云数据服务已启动: http://localhost:${port}`)
  lanAddresses().forEach(address => console.log(`局域网访问: http://${address}:${port}`))
})
