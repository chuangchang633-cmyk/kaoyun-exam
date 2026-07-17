import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import QRCode from 'qrcode'
import {
  Activity, BarChart3, BookOpenCheck, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, Copy, Download, Eye, FilePenLine, GraduationCap, LayoutDashboard,
  LockKeyhole, LogOut, Menu, Plus, QrCode, RefreshCw, Save, Search, Send, Settings,
  ShieldCheck, SquarePen, Trash2, Upload, UserPlus, Users, X
} from 'lucide-react'
import './styles.css'

const api = async (path, options = {}) => {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || '请求失败')
  return payload
}

const fmtTime = seconds => `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, '0')}秒`
const fmtDate = value => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

function Logo() {
  return <div className="brand"><span className="brand-mark"><BookOpenCheck size={21} /></span><span>考云</span></div>
}

function Status({ value }) {
  const map = { active: ['进行中', 'green'], draft: ['草稿', 'gray'], ended: ['已结束', 'amber'] }
  const [label, tone] = map[value] || map.draft
  return <span className={`status ${tone}`}><i />{label}</span>
}

function Empty({ children }) {
  return <div className="empty"><CircleHelp size={26} /><p>{children}</p></div>
}

function Sidebar({ active, setActive, open, close, onLogout, user, operators, onSwitchUser }) {
  const [operatorOpen, setOperatorOpen] = useState(false)
  const nav = [
    ['dashboard', LayoutDashboard, '概览'],
    ['exams', FilePenLine, '考试管理'],
    ['papers', BookOpenCheck, '考试试卷'],
    ['results', BarChart3, '成绩汇总'],
    ['candidates', Users, '考生管理']
  ]
  const current = user || operators[0] || { name: '管理员', role: '账号保护模式', username: 'admin' }
  return <>
    {open ? <button className="sidebar-scrim" onClick={close} aria-label="关闭菜单" /> : null}
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-top"><Logo /><button className="icon-button mobile-only" onClick={close}><X size={19} /></button></div>
      <nav>{nav.map(([id, Icon, label]) => <button key={id} className={active === id ? 'active' : ''} onClick={() => { setActive(id); close() }}><Icon size={19} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom">
        <button><Settings size={18} /><span>系统设置</span></button>
        <button onClick={onLogout}><LogOut size={18} /><span>退出登录</span></button>
        <div className="operator-wrap">
          <button className={`operator ${operatorOpen ? 'open' : ''}`} onClick={() => setOperatorOpen(value => !value)} aria-expanded={operatorOpen}>
            <span>{current.name?.slice(0, 1) || '管'}</span>
            <div><strong>{current.name || current.username}</strong><small>{current.role || '账号保护模式'}</small></div>
            <ChevronDown size={16} />
          </button>
          {operatorOpen ? <div className="operator-menu">
            {operators.map(operator => <button key={operator.username} className={operator.username === current.username ? 'active' : ''} onClick={() => { onSwitchUser(operator.username); setOperatorOpen(false) }}>
              <span>{operator.name?.slice(0, 1) || operator.username.slice(0, 1).toUpperCase()}</span>
              <div><strong>{operator.name || operator.username}</strong><small>{operator.role || operator.username}</small></div>
              {operator.username === current.username ? <Check size={16} /> : null}
            </button>)}
          </div> : null}
        </div>
      </div>
    </aside>
  </>
}

function Header({ title, onMenu, onCreate }) {
  return <header className="topbar"><div className="topbar-title"><button className="icon-button mobile-only" onClick={onMenu}><Menu size={20} /></button><h1>{title}</h1></div><div className="topbar-actions"><button className="icon-button" title="刷新" onClick={() => location.reload()}><RefreshCw size={18} /></button><button className="primary" onClick={onCreate}><Plus size={18} />新建考试</button></div></header>
}

function Stat({ label, value, detail, icon: Icon, tone }) {
  return <div className="stat"><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><span className={`stat-icon ${tone}`}><Icon size={21} /></span></div>
}

function Dashboard({ exams, submissions, onNavigate, onQr }) {
  const active = exams.filter(item => item.status === 'active')
  const passed = submissions.filter(item => item.passed).length
  const average = submissions.length ? Math.round(submissions.reduce((sum, item) => sum + item.score, 0) / submissions.length) : 0
  const latest = submissions.slice(0, 5)
  return <div className="page dashboard-page">
    <section className="intro"><div><h2>上午好，管理员</h2><p>这里是当前考试运行情况，数据提交后会自动更新。</p></div><span className="live"><i />实时同步中</span></section>
    <section className="stats-grid">
      <Stat label="进行中考试" value={active.length} detail={`共 ${exams.length} 场考试`} icon={Activity} tone="green" />
      <Stat label="累计参考" value={submissions.length} detail="已提交答卷" icon={Users} tone="blue" />
      <Stat label="平均成绩" value={average} detail="满分 100 分" icon={GraduationCap} tone="amber" />
      <Stat label="通过率" value={`${submissions.length ? Math.round(passed / submissions.length * 100) : 0}%`} detail={`${passed} 人通过`} icon={ShieldCheck} tone="red" />
    </section>
    <section className="dashboard-grid">
      <div className="panel exam-focus"><div className="panel-head"><div><h3>正在进行</h3><p>扫码入口与实时考试状态</p></div><button className="text-button" onClick={() => onNavigate('exams')}>查看全部 <ChevronRight size={15} /></button></div>
        {active.length ? active.slice(0, 2).map(exam => <div className="active-exam" key={exam.id}><div className="exam-symbol"><BookOpenCheck size={21} /></div><div className="active-exam-main"><div><Status value={exam.status} /><h4>{exam.title}</h4><p>{exam.questions.length} 道题 · {exam.duration} 分钟 · {exam.passScore} 分及格</p></div><div className="exam-actions"><button className="secondary" onClick={() => onQr(exam)}><QrCode size={17} />答题二维码</button></div></div></div>) : <Empty>暂无进行中的考试</Empty>}
      </div>
      <div className="panel quick"><div className="panel-head"><div><h3>快捷操作</h3><p>常用管理功能</p></div></div><button onClick={() => onNavigate('exams')}><span className="quick-icon green"><SquarePen size={19} /></span><div><strong>创建一场考试</strong><small>配置试题与及格分数</small></div><ChevronRight size={17} /></button><button onClick={() => onNavigate('results')}><span className="quick-icon blue"><Download size={19} /></span><div><strong>导出成绩明细</strong><small>下载 Excel 可用表格</small></div><ChevronRight size={17} /></button></div>
    </section>
    <section className="panel"><div className="panel-head"><div><h3>最近提交</h3><p>最新考生答题结果</p></div><button className="text-button" onClick={() => onNavigate('results')}>成绩汇总 <ChevronRight size={15} /></button></div>
      <div className="table-wrap"><table><thead><tr><th>考生</th><th>部门</th><th>成绩</th><th>结果</th><th>用时</th><th>提交时间</th></tr></thead><tbody>{latest.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.department}</td><td><b className="score">{item.score}</b></td><td><span className={`result ${item.passed ? 'pass' : 'fail'}`}>{item.passed ? '通过' : '未通过'}</span></td><td>{fmtTime(item.durationSeconds)}</td><td>{fmtDate(item.submittedAt)}</td></tr>)}</tbody></table></div>
    </section>
  </div>
}

function Exams({ exams, submissions, onQr, onToggle, onCreate, onDelete, onViewPaper }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const filtered = exams.filter(item => item.title.includes(query) && (status === 'all' || item.status === status))
  return <div className="page"><div className="section-toolbar"><div className="search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索考试名称" /></div><div className="segmented"><button className={status === 'all' ? 'active' : ''} onClick={() => setStatus('all')}>全部</button><button className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')}>进行中</button><button className={status === 'draft' ? 'active' : ''} onClick={() => setStatus('draft')}>草稿</button></div></div>
    <section className="panel no-padding"><div className="table-wrap"><table className="exam-table"><thead><tr><th>考试名称</th><th>状态</th><th>题目</th><th>参考人数</th><th>及格分</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{filtered.map(exam => { const count = submissions.filter(item => item.examId === exam.id).length; return <tr key={exam.id}><td><div className="exam-name"><span><BookOpenCheck size={18} /></span><div><strong>{exam.title}</strong><small>{exam.description || '无考试说明'}</small></div></div></td><td><Status value={exam.status} /></td><td>{exam.questions.length} 题</td><td>{count} 人</td><td>{exam.passScore} 分</td><td>{fmtDate(exam.createdAt)}</td><td><div className="row-actions"><button className="icon-button" title="查看试卷" onClick={() => onViewPaper(exam)}><Eye size={17} /></button>{exam.status === 'active' ? <button className="icon-button" title="二维码" onClick={() => onQr(exam)}><QrCode size={17} /></button> : null}<button className="secondary small" onClick={() => onToggle(exam)}>{exam.status === 'active' ? '结束' : '发布'}</button><button className="icon-button danger" title="删除考试" onClick={() => onDelete(exam)}><Trash2 size={17} /></button></div></td></tr> })}</tbody></table></div>{!filtered.length ? <Empty>没有找到符合条件的考试</Empty> : null}</section>
    <button className="floating-create" onClick={onCreate}><Plus size={20} />新建考试</button>
  </div>
}

const answerLetters = question => question.answer.map(item => String.fromCharCode(65 + item)).join('、')

function PaperContent({ exam }) {
  return <div className="paper-content">
    <div className="paper-meta"><span><FilePenLine size={15} />{exam.questions.length} 道题</span><span><Clock3 size={15} />{exam.duration} 分钟</span><span><ShieldCheck size={15} />{exam.passScore} 分及格</span><Status value={exam.status} /></div>
    {exam.description ? <p className="paper-desc">{exam.description}</p> : null}
    <div className="paper-questions">{exam.questions.length ? exam.questions.map((question, index) => <article className="paper-question" key={question.id}>
      <div className="paper-question-head"><span>第 {index + 1} 题</span><b>{question.type === 'multiple' ? '多选题' : '单选题'}</b></div>
      <h3>{question.title}</h3>
      <div className="paper-options">{question.options.map((option, optionIndex) => <div className={question.answer.includes(optionIndex) ? 'correct' : ''} key={`${question.id}-${optionIndex}`}><span>{String.fromCharCode(65 + optionIndex)}</span><p>{option}</p>{question.answer.includes(optionIndex) ? <Check size={15} /> : null}</div>)}</div>
      <div className="paper-answer">正确答案：<strong>{answerLetters(question)}</strong></div>
    </article>) : <Empty>这场考试还没有试题</Empty>}</div>
  </div>
}

function PaperModal({ exam, onClose }) {
  return <Modal onClose={onClose} wide><div className="modal-head"><div><h2>考试试卷</h2><p>{exam.title}</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><PaperContent exam={exam} /></Modal>
}

function Papers({ exams }) {
  const [examId, setExamId] = useState(exams[0]?.id || '')
  useEffect(() => { if (!examId && exams[0]) setExamId(exams[0].id) }, [examId, exams])
  const current = exams.find(item => item.id === examId)
  return <div className="page papers-page">
    <section className="paper-layout">
      <aside className="panel paper-list"><div className="panel-head"><div><h3>考试试卷</h3><p>查看每次考试的完整试题</p></div></div>{exams.map(exam => <button key={exam.id} className={exam.id === examId ? 'active' : ''} onClick={() => setExamId(exam.id)}><BookOpenCheck size={18} /><div><strong>{exam.title}</strong><small>{exam.questions.length} 题 · {fmtDate(exam.createdAt)}</small></div><Status value={exam.status} /></button>)}</aside>
      <section className="panel paper-view">{current ? <><div className="paper-title"><div><h2>{current.title}</h2><p>{current.description || '无考试说明'}</p></div></div><PaperContent exam={current} /></> : <Empty>暂无考试试卷</Empty>}</section>
    </section>
  </div>
}

function Results({ exams, submissions }) {
  const [examId, setExamId] = useState(exams[0]?.id || '')
  const rows = submissions.filter(item => !examId || item.examId === examId)
  const passed = rows.filter(item => item.passed).length
  const average = rows.length ? Math.round(rows.reduce((sum, item) => sum + item.score, 0) / rows.length) : 0
  const distribution = [
    ['90-100', rows.filter(i => i.score >= 90).length], ['80-89', rows.filter(i => i.score >= 80 && i.score < 90).length],
    ['60-79', rows.filter(i => i.score >= 60 && i.score < 80).length], ['0-59', rows.filter(i => i.score < 60).length]
  ]
  const max = Math.max(...distribution.map(item => item[1]), 1)
  return <div className="page"><div className="results-toolbar"><label>当前考试<select value={examId} onChange={e => setExamId(e.target.value)}>{exams.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><a className="primary" href={`/api/export.csv?examId=${examId}`}><Download size={17} />导出 CSV</a></div>
    <section className="stats-grid results-stats"><Stat label="参考人数" value={rows.length} detail="已提交答卷" icon={Users} tone="blue" /><Stat label="平均成绩" value={average} detail="满分 100 分" icon={GraduationCap} tone="amber" /><Stat label="通过人数" value={passed} detail={`通过率 ${rows.length ? Math.round(passed / rows.length * 100) : 0}%`} icon={ShieldCheck} tone="green" /></section>
    <section className="dashboard-grid results-grid"><div className="panel"><div className="panel-head"><div><h3>分数分布</h3><p>各成绩区间人数</p></div></div><div className="bars">{distribution.map(([label, value]) => <div className="bar-row" key={label}><span>{label}</span><div><i style={{ width: `${value / max * 100}%` }} /></div><b>{value}</b></div>)}</div></div><div className="panel result-summary"><div className="panel-head"><div><h3>结果概况</h3><p>自动判分汇总</p></div></div><div className="donut" style={{ '--pass': `${rows.length ? passed / rows.length * 360 : 0}deg` }}><span><strong>{rows.length ? Math.round(passed / rows.length * 100) : 0}%</strong><small>通过率</small></span></div><div className="legend"><span><i className="pass-dot" />通过 {passed}</span><span><i className="fail-dot" />未通过 {rows.length - passed}</span></div></div></section>
    <section className="panel no-padding"><div className="table-wrap"><table><thead><tr><th>考生</th><th>部门</th><th>成绩</th><th>结果</th><th>用时</th><th>提交时间</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.department}</td><td><b className="score">{item.score}</b></td><td><span className={`result ${item.passed ? 'pass' : 'fail'}`}>{item.passed ? '通过' : '未通过'}</span></td><td>{fmtTime(item.durationSeconds)}</td><td>{fmtDate(item.submittedAt)}</td></tr>)}</tbody></table></div>{!rows.length ? <Empty>暂无提交记录</Empty> : null}</section>
  </div>
}

function Candidates({ candidates, submissions, onAdd, onSave, onDelete }) {
  const stats = useMemo(() => {
    const map = new Map()
    submissions.forEach(item => {
      const key = `${item.name}::${item.department}`
      const current = map.get(key) || { count: 0, total: 0, latest: item.submittedAt }
      current.count += 1
      current.total += item.score
      if (new Date(item.submittedAt) > new Date(current.latest)) current.latest = item.submittedAt
      map.set(key, current)
    })
    return map
  }, [submissions])
  return <div className="page"><div className="section-toolbar"><div /><button className="primary" onClick={onAdd}><UserPlus size={17} />添加考生</button></div><section className="panel no-padding"><div className="table-wrap"><table className="candidate-table"><thead><tr><th>姓名</th><th>部门</th><th>备注</th><th>参考次数</th><th>平均成绩</th><th>最近参考</th><th>操作</th></tr></thead><tbody>{candidates.map(candidate => { const stat = stats.get(`${candidate.name}::${candidate.department}`); return <CandidateRow key={candidate.id} candidate={candidate} stat={stat} onSave={onSave} onDelete={onDelete} /> })}</tbody></table></div>{!candidates.length ? <Empty>暂无考生档案</Empty> : null}</section></div>
}

function CandidateRow({ candidate, stat, onSave, onDelete }) {
  const [draft, setDraft] = useState(candidate)
  useEffect(() => setDraft(candidate), [candidate])
  return <tr>
    <td><input className="table-input strong-input" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></td>
    <td><input className="table-input" value={draft.department} onChange={event => setDraft({ ...draft, department: event.target.value })} /></td>
    <td><input className="table-input note-input" value={draft.note || ''} onChange={event => setDraft({ ...draft, note: event.target.value })} placeholder="输入备注" /></td>
    <td>{stat?.count || 0}</td>
    <td><b className="score">{stat ? Math.round(stat.total / stat.count) : '-'}</b></td>
    <td>{stat ? fmtDate(stat.latest) : '-'}</td>
    <td><div className="row-actions"><button className="icon-button" title="保存" onClick={() => onSave(draft)}><Save size={17} /></button><button className="icon-button danger" title="删除考生" onClick={() => onDelete(candidate)}><Trash2 size={17} /></button></div></td>
  </tr>
}

function Modal({ children, onClose, wide = false }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal ${wide ? 'wide' : ''}`} onMouseDown={event => event.stopPropagation()}>{children}</div></div>
}

function QrModal({ exam, onClose, network }) {
  const [src, setSrc] = useState('')
  const [copied, setCopied] = useState(false)
  const lanHost = network?.lanAddresses?.[0]
  const fallbackOrigin = network?.production && lanHost ? `http://${lanHost}:${network.port}` : location.origin
  const origin = network?.publicOrigin || fallbackOrigin
  const link = `${origin}/?join=${exam.id}`
  useEffect(() => { QRCode.toDataURL(link, { width: 360, margin: 2, color: { dark: '#102a24', light: '#ffffff' }, errorCorrectionLevel: 'M' }).then(setSrc) }, [link])
  const copy = async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600) }
  return <Modal onClose={onClose}><div className="modal-head"><div><h2>微信扫码答题</h2><p>{exam.title}</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="qr-body"><div className="qr-frame">{src ? <img src={src} alt="考试答题二维码" /> : null}</div><div className="qr-status"><span><i />考试入口已开启</span><p>{network?.publicOrigin ? '当前二维码使用公网地址，考生不需要和管理员连接同一个 Wi-Fi。' : '当前二维码使用本机或局域网地址。配置 PUBLIC_ORIGIN 为公网域名后，考生可在任意网络扫码答题。'}</p></div><div className="link-copy"><input readOnly value={link} /><button className="icon-button" onClick={copy} title="复制链接">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div></div></Modal>
}

const blankQuestion = () => ({ id: `q-${crypto.randomUUID().slice(0, 8)}`, type: 'single', title: '', options: ['', '', '', ''], answer: [0] })

function parsePaperText(text) {
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
    if (Array.isArray(parsed.questions)) return parsed.questions
  } catch {}
  const blocks = text.split(/\n\s*\n/).map(item => item.trim()).filter(Boolean)
  return blocks.map((block, index) => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
    const answerLine = lines.find(line => /^答案[:：]/.test(line))
    const optionLines = lines.filter(line => /^[A-Ha-h][.、)]/.test(line))
    const title = (lines.find(line => !/^答案[:：]/.test(line) && !/^[A-Ha-h][.、)]/.test(line)) || `第 ${index + 1} 题`).replace(/^\d+[.、)]\s*/, '')
    const options = optionLines.map(line => line.replace(/^[A-Ha-h][.、)]\s*/, ''))
    const answerText = answerLine ? answerLine.replace(/^答案[:：]\s*/, '').toUpperCase() : 'A'
    const answer = answerText.split(/[,，、\s]+/).filter(Boolean).map(letter => letter.charCodeAt(0) - 65).filter(item => item >= 0)
    return { id: `q-${crypto.randomUUID().slice(0, 8)}`, type: answer.length > 1 ? 'multiple' : 'single', title, options, answer: answer.length ? answer : [0] }
  }).filter(item => item.title && item.options.length >= 2)
}

function CreateExam({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', duration: 30, passScore: 60, questions: [blankQuestion()] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const setQuestion = (id, patch) => setForm(current => ({ ...current, questions: current.questions.map(question => question.id === id ? { ...question, ...patch } : question) }))
  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api('/api/exams', { method: 'POST', body: JSON.stringify(form) })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  const importFile = event => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const questions = parsePaperText(String(reader.result || ''))
      if (questions.length) setForm(current => ({ ...current, questions }))
      else setError('未识别到有效题目')
    }
    reader.readAsText(file)
    event.target.value = ''
  }
  return <Modal onClose={onClose} wide><form onSubmit={submit}><div className="modal-head"><div><h2>新建考试</h2><p>可手动建立题库，也可上传 TXT / JSON 试卷</p></div><button type="button" className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="form-body">
    <label className="field full"><span>考试名称</span><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="例如：新员工入职考试" /></label>
    <label className="field full"><span>考试说明</span><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="填写考试范围或注意事项" /></label>
    <label className="field"><span>答题时长（分钟）</span><input type="number" min="1" value={form.duration} onChange={e => setForm({ ...form, duration: Number(e.target.value) })} /></label>
    <label className="field"><span>及格分数</span><input type="number" min="0" max="100" value={form.passScore} onChange={e => setForm({ ...form, passScore: Number(e.target.value) })} /></label>
    <div className="question-tools full"><strong>试题配置</strong><label className="secondary"><Upload size={16} />上传试卷<input hidden type="file" accept=".txt,.json" onChange={importFile} /></label><button type="button" className="secondary" onClick={() => setForm({ ...form, questions: [...form.questions, blankQuestion()] })}><Plus size={16} />添加题目</button></div>
    <div className="question-list full">{form.questions.map((question, index) => <div className="question-card" key={question.id}><div className="question-card-head"><span>第 {index + 1} 题</span><select value={question.type} onChange={event => setQuestion(question.id, { type: event.target.value, answer: question.answer.slice(0, event.target.value === 'single' ? 1 : question.answer.length) })}><option value="single">单选</option><option value="multiple">多选</option></select><button type="button" className="icon-button danger" onClick={() => setForm(current => ({ ...current, questions: current.questions.filter(item => item.id !== question.id) }))}><Trash2 size={16} /></button></div><input value={question.title} onChange={event => setQuestion(question.id, { title: event.target.value })} placeholder="输入题目" />{question.options.map((option, optionIndex) => <div className="option-edit" key={optionIndex}><label><input type={question.type === 'multiple' ? 'checkbox' : 'radio'} checked={question.answer.includes(optionIndex)} onChange={() => { const answer = question.type === 'multiple' ? (question.answer.includes(optionIndex) ? question.answer.filter(item => item !== optionIndex) : [...question.answer, optionIndex]) : [optionIndex]; setQuestion(question.id, { answer }) }} />{String.fromCharCode(65 + optionIndex)}</label><input value={option} onChange={event => { const options = [...question.options]; options[optionIndex] = event.target.value; setQuestion(question.id, { options }) }} placeholder={`选项 ${String.fromCharCode(65 + optionIndex)}`} /></div>)}</div>)}</div>
    {error ? <div className="form-error full">{error}</div> : null}
  </div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={saving}>{saving ? '创建中...' : '创建考试'}</button></div></form></Modal>
}

function CandidateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', department: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api('/api/candidates', { method: 'POST', body: JSON.stringify(form) })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  return <Modal onClose={onClose}><form onSubmit={submit}><div className="modal-head"><div><h2>添加考生</h2><p>建立考生档案并填写备注</p></div><button type="button" className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="form-body single-column"><label className="field"><span>姓名</span><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>部门 / 班级</span><input required value={form.department} onChange={event => setForm({ ...form, department: event.target.value })} /></label><label className="field"><span>备注</span><textarea value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} placeholder="例如：需补考、外协人员、班组长" /></label>{error ? <div className="form-error">{error}</div> : null}</div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={saving}>{saving ? '保存中...' : '保存考生'}</button></div></form></Modal>
}

function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: 'admin', password: '123456' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify(form) })
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  return <div className="login-shell"><form className="login-card" onSubmit={submit}><Logo /><div className="login-title"><LockKeyhole size={22} /><div><h1>管理员登录</h1><p>请输入账号和密码进入后台</p></div></div><label><span>账号</span><input value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></label><label><span>密码</span><input type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>{error ? <div className="form-error">{error}</div> : null}<button className="primary" disabled={loading}>{loading ? '登录中...' : '登录'}</button><small>默认账号 admin / invigilator / analyst，默认密码 123456。可通过 ADMIN_USERS 配置更多登录人员。</small></form></div>
}

function AdminApp() {
  const [data, setData] = useState({ exams: [], submissions: [], candidates: [], operators: [], currentUser: null, lanAddresses: [] })
  const [active, setActive] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [sidebar, setSidebar] = useState(false)
  const [qrExam, setQrExam] = useState(null)
  const [paperExam, setPaperExam] = useState(null)
  const [creating, setCreating] = useState(false)
  const [addingCandidate, setAddingCandidate] = useState(false)
  const load = async () => { const next = await api('/api/bootstrap'); setData(next); setAuthenticated(true); setLoading(false) }
  useEffect(() => { api('/api/session').then(session => session.authenticated ? load() : setLoading(false)).catch(() => setLoading(false)) }, [])
  useEffect(() => {
    if (!authenticated) return undefined
    const events = new EventSource('/api/events')
    events.onmessage = event => { if (JSON.parse(event.data).type === 'refresh') load() }
    return () => events.close()
  }, [authenticated])
  const toggle = async exam => { await api(`/api/exams/${exam.id}`, { method: 'PATCH', body: JSON.stringify({ status: exam.status === 'active' ? 'ended' : 'active' }) }); load() }
  const removeExam = async exam => { if (!confirm(`确定删除“${exam.title}”？相关成绩也会一起删除。`)) return; await api(`/api/exams/${exam.id}`, { method: 'DELETE' }); load() }
  const saveCandidate = async candidate => { await api(`/api/candidates/${candidate.id}`, { method: 'PATCH', body: JSON.stringify(candidate) }); load() }
  const removeCandidate = async candidate => { if (!confirm(`确定删除考生“${candidate.name}”？历史成绩会保留在成绩汇总中。`)) return; await api(`/api/candidates/${candidate.id}`, { method: 'DELETE' }); load() }
  const switchUser = async username => { await api('/api/session/operator', { method: 'POST', body: JSON.stringify({ username }) }); load() }
  const logout = async () => { await api('/api/logout', { method: 'POST' }); setAuthenticated(false); setData({ exams: [], submissions: [], candidates: [], operators: [], currentUser: null, lanAddresses: [] }) }
  const titles = { dashboard: '工作台', exams: '考试管理', papers: '考试试卷', results: '成绩汇总', candidates: '考生管理' }
  if (loading) return <div className="loading"><RefreshCw size={22} />正在载入...</div>
  if (!authenticated) return <LoginPage onLogin={load} />
  return <div className="app-shell"><Sidebar active={active} setActive={setActive} open={sidebar} close={() => setSidebar(false)} onLogout={logout} user={data.currentUser} operators={data.operators || []} onSwitchUser={switchUser} /><main><Header title={titles[active]} onMenu={() => setSidebar(true)} onCreate={() => setCreating(true)} />{active === 'dashboard' ? <Dashboard exams={data.exams} submissions={data.submissions} onNavigate={setActive} onQr={setQrExam} /> : active === 'exams' ? <Exams exams={data.exams} submissions={data.submissions} onQr={setQrExam} onToggle={toggle} onCreate={() => setCreating(true)} onDelete={removeExam} onViewPaper={setPaperExam} /> : active === 'papers' ? <Papers exams={data.exams} /> : active === 'results' ? <Results exams={data.exams} submissions={data.submissions} /> : <Candidates candidates={data.candidates} submissions={data.submissions} onAdd={() => setAddingCandidate(true)} onSave={saveCandidate} onDelete={removeCandidate} />}</main>{qrExam ? <QrModal exam={qrExam} network={data} onClose={() => setQrExam(null)} /> : null}{paperExam ? <PaperModal exam={paperExam} onClose={() => setPaperExam(null)} /> : null}{creating ? <CreateExam onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); setActive('exams') }} /> : null}{addingCandidate ? <CandidateModal onClose={() => setAddingCandidate(false)} onCreated={() => { setAddingCandidate(false); load() }} /> : null}</div>
}

function CandidateApp({ examId }) {
  const [exam, setExam] = useState(null)
  const [error, setError] = useState('')
  const [identity, setIdentity] = useState({ name: '', department: '' })
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => { api(`/api/public/exams/${examId}`).then(setExam).catch(err => setError(err.message)) }, [examId])
  if (error) return <div className="candidate-shell"><div className="candidate-error"><CircleHelp size={32} /><h2>无法进入考试</h2><p>{error}</p></div></div>
  if (!exam) return <div className="candidate-shell"><div className="candidate-loading"><RefreshCw size={24} />正在载入考试...</div></div>
  if (result) return <div className="candidate-shell"><header className="candidate-brand"><Logo /></header><main className="result-page"><span className={`result-icon ${result.passed ? 'passed' : 'failed'}`}>{result.passed ? <Check size={34} /> : <X size={34} />}</span><h1>{result.passed ? '考试通过' : '未达到及格线'}</h1><p>你的成绩已提交，管理员端已自动汇总。</p><strong>{result.score}<small>分</small></strong><div><span>及格分数 <b>{exam.passScore}</b></span><span>答题用时 <b>{fmtTime(result.durationSeconds)}</b></span></div></main></div>
  if (!started) return <div className="candidate-shell"><header className="candidate-brand"><Logo /></header><main className="candidate-entry"><div className="entry-symbol"><BookOpenCheck size={28} /></div><h1>{exam.title}</h1><p>{exam.description}</p><div className="exam-meta"><span><FilePenLine size={17} />{exam.questions.length} 道题</span><span><Clock3 size={17} />{exam.duration} 分钟</span><span><ShieldCheck size={17} />{exam.passScore} 分及格</span></div><form onSubmit={event => { event.preventDefault(); setStartedAt(Date.now()); setStarted(true) }}><label><span>姓名</span><input required value={identity.name} onChange={e => setIdentity({ ...identity, name: e.target.value })} placeholder="请输入真实姓名" /></label><label><span>部门 / 班级</span><input required value={identity.department} onChange={e => setIdentity({ ...identity, department: e.target.value })} placeholder="例如：生产一部" /></label><button className="primary candidate-start">开始答题 <ChevronRight size={18} /></button></form><small className="privacy"><ShieldCheck size={14} />信息仅用于本次考试统计</small></main></div>
  const question = exam.questions[index]
  const selected = answers[question.id] || []
  const choose = optionIndex => { const next = question.type === 'multiple' ? (selected.includes(optionIndex) ? selected.filter(item => item !== optionIndex) : [...selected, optionIndex]) : [optionIndex]; setAnswers({ ...answers, [question.id]: next }) }
  const submit = async () => { setSubmitting(true); try { setResult(await api('/api/submissions', { method: 'POST', body: JSON.stringify({ examId, ...identity, answers, durationSeconds: Math.round((Date.now() - startedAt) / 1000) }) })) } catch (err) { setError(err.message) } finally { setSubmitting(false) } }
  return <div className="candidate-shell answering"><header className="answer-header"><div><Logo /><span>{index + 1} / {exam.questions.length}</span></div><div className="progress"><i style={{ width: `${(index + 1) / exam.questions.length * 100}%` }} /></div></header><main className="question-page"><span className="question-type">{question.type === 'multiple' ? '多选题' : '单选题'}</span><h1>{question.title}</h1><p>{question.type === 'multiple' ? '请选择所有正确答案' : '请选择一个答案'}</p><div className="options">{question.options.map((option, optionIndex) => <button key={`${question.id}-${optionIndex}`} className={selected.includes(optionIndex) ? 'selected' : ''} onClick={() => choose(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span><b>{option}</b>{selected.includes(optionIndex) ? <Check size={18} /> : null}</button>)}</div></main><footer className="answer-footer"><button className="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft size={18} />上一题</button>{index < exam.questions.length - 1 ? <button className="primary" disabled={!selected.length} onClick={() => setIndex(index + 1)}>下一题 <ChevronRight size={18} /></button> : <button className="primary" disabled={!selected.length || submitting} onClick={submit}><Send size={17} />{submitting ? '提交中...' : '提交答卷'}</button>}</footer></div>
}

const examId = new URLSearchParams(location.search).get('join')
createRoot(document.getElementById('root')).render(examId ? <CandidateApp examId={examId} /> : <AdminApp />)

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js')
