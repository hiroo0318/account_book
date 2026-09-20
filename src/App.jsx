import React, { useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from './supabase'

const money = new Intl.NumberFormat('ko-KR')
const monthFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' })
const formatMoney = (amount) => `${money.format(amount)}원`
const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }
const formatMonth = (monthKey) => { const [year, month] = monthKey.split('-').map(Number); return monthFormatter.format(new Date(year, month - 1, 1)) }
const shiftMonth = (monthKey, delta) => { const [year, month] = monthKey.split('-').map(Number); const date = new Date(year, month - 1 + delta, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` }
const Icon = ({ name }) => <span aria-hidden="true">{{ plus: '+', left: '‹', right: '›', close: '×' }[name]}</span>

function AccessScreen({ state, email, error, onLogin, onLogout }) {
  const pending = state === 'pending'
  const blocked = state === 'blocked'
  return <main className="auth-shell"><section className="auth-card" aria-live="polite">
    <div className="auth-mark">₩</div><p className="eyebrow">한 달 식비</p>
    <h1>{pending ? '승인 대기 중이에요' : blocked ? '접근이 제한되었어요' : '함께 쓰는 식비 기록'}</h1>
    <p className="auth-description">{pending ? '관리자가 계정을 승인하면 공동 가계부를 사용할 수 있어요.' : blocked ? '이 계정은 현재 공동 가계부에 접근할 수 없어요.' : '가족과 하나의 월별 식비 내역을 함께 기록해 보세요.'}</p>
    {email && <p className="signed-email">{email}</p>}{error && <p className="error" role="alert">{error}</p>}
    {state === 'signed-out' && <button className="google-button" type="button" onClick={onLogin}><span className="google-g" aria-hidden="true">G</span> Google로 계속하기</button>}
    {(pending || blocked) && <button className="text-button" type="button" onClick={onLogout}>다른 계정으로 로그인</button>}
  </section></main>
}

export default function App() {
  const [monthKey, setMonthKey] = useState(currentMonth)
  const [entries, setEntries] = useState([])
  const [authState, setAuthState] = useState('loading')
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(null)
  const total = useMemo(() => entries.reduce((sum, entry) => sum + entry.amount, 0), [entries])

  useEffect(() => {
    if (!sheet) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [sheet])

  useEffect(() => {
    if (!hasSupabaseConfig) { setError('Supabase 연결 정보가 없습니다. .env.local 파일을 확인해 주세요.'); setAuthState('signed-out'); return undefined }
    let live = true
    async function syncMember(session) {
      if (!session) { if (live) { setMember(null); setEntries([]); setAuthState('signed-out') }; return }
      if (live) setAuthState('checking')
      const { data, error: memberError } = await supabase.from('account_members').select('email, status').maybeSingle()
      if (!live) return
      if (memberError) { setError(memberError.message); setAuthState('signed-out'); return }
      const next = data ?? { email: session.user.email, status: 'pending' }
      setMember(next); setAuthState(next.status === 'active' ? 'active' : next.status)
    }
    supabase.auth.getSession().then(({ data: { session } }) => syncMember(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => syncMember(session))
    return () => { live = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => { if (authState === 'active') loadEntries() }, [authState, monthKey])
  async function loadEntries() {
    setLoading(true); setError('')
    const { data, error: queryError } = await supabase.from('expense_entries').select('id, month_key, item_name, amount, created_at').eq('month_key', monthKey).order('created_at', { ascending: false })
    if (queryError) setError(queryError.message); else setEntries(data ?? [])
    setLoading(false)
  }
  async function loginWithGoogle() {
    setError('')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (oauthError) setError(oauthError.message)
  }
  async function signOut() { await supabase.auth.signOut(); setSheet(null) }
  function openAddSheet() { setNotice(''); setSheet({ mode: 'add', itemName: '', amount: '' }) }
  function openEditSheet(entry) { setNotice(''); setSheet({ mode: 'edit', id: entry.id, itemName: entry.item_name, amount: String(entry.amount) }) }
  function updateSheet(field, value) { setSheet((current) => ({ ...current, [field]: field === 'amount' ? value.replace(/[^0-9]/g, '') : value })) }
  async function saveEntry(event) {
    event.preventDefault(); const itemName = sheet.itemName.trim(); const amount = Number(sheet.amount)
    if (!itemName) return setError('항목명을 입력해 주세요.')
    if (!Number.isInteger(amount) || amount < 1 || amount > 99999999) return setError('금액은 1원 이상 99,999,999원 이하의 정수로 입력해 주세요.')
    setSaving(true); setError('')
    const payload = { item_name: itemName, amount }
    const request = sheet.mode === 'add' ? supabase.from('expense_entries').insert({ ...payload, month_key: monthKey }) : supabase.from('expense_entries').update(payload).eq('id', sheet.id)
    const { error: saveError } = await request; setSaving(false)
    if (saveError) return setError(saveError.message)
    setSheet(null); setNotice(sheet.mode === 'add' ? '내역을 추가했어요.' : '내역을 수정했어요.'); loadEntries()
  }
  async function deleteEntry() {
    if (!sheet?.id || !window.confirm('이 내역을 삭제할까요?')) return
    setSaving(true); setError(''); const { error: deleteError } = await supabase.from('expense_entries').delete().eq('id', sheet.id); setSaving(false)
    if (deleteError) return setError(deleteError.message)
    setSheet(null); setNotice('내역을 삭제했어요.'); loadEntries()
  }

  if (authState !== 'active') {
    if (authState === 'loading' || authState === 'checking') return <main className="auth-shell"><p className="loading-copy">접속 상태를 확인하는 중…</p></main>
    return <AccessScreen state={authState} email={member?.email} error={error} onLogin={loginWithGoogle} onLogout={signOut} />
  }
  return <main className="app-shell"><section className="ledger" aria-label="월별 식비 가계부">
    <header className="month-header"><button className="month-button" type="button" aria-label="이전 달" onClick={() => setMonthKey((value) => shiftMonth(value, -1))}><Icon name="left" /></button><h1>{formatMonth(monthKey)}</h1><button className="month-button" type="button" aria-label="다음 달" onClick={() => setMonthKey((value) => shiftMonth(value, 1))}><Icon name="right" /></button></header>
    <section className="summary-card" aria-label="이번 달 사용 금액"><p>이번 달 사용 금액</p><strong className="summary-total"><span>{money.format(total)}</span><em>원</em></strong><button className="add-button" type="button" onClick={openAddSheet}><Icon name="plus" /> <span>추가</span></button></section>
    <section className="entry-section"><div className="section-heading"><h2>지출 내역</h2>{!loading && <span>{entries.length}건</span>}</div>{notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}
      <div className="entry-list" aria-busy={loading}>{loading ? <p className="state-message">내역을 불러오는 중…</p> : entries.length === 0 ? <p className="state-message">아직 기록한 지출이 없어요.<br />이번 달 내역을 추가해 보세요.</p> : entries.map((entry) => <button className="entry-row" type="button" key={entry.id} onClick={() => openEditSheet(entry)}><span>{entry.item_name}</span><strong>{formatMoney(entry.amount)}</strong></button>)}</div>
      <button className="ledger-signout" type="button" onClick={signOut}>로그아웃</button>
    </section>
  </section>{sheet && <div className="sheet-backdrop" onMouseDown={() => !saving && setSheet(null)}><section className="entry-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-header"><h2 id="sheet-title">{sheet.mode === 'add' ? '지출 추가' : '지출 수정'}</h2><button className="close-button" type="button" aria-label="닫기" onClick={() => !saving && setSheet(null)}><Icon name="close" /></button></div><form onSubmit={saveEntry}><label>항목<input autoFocus value={sheet.itemName} onChange={(event) => updateSheet('itemName', event.target.value)} placeholder="예: 장보기" maxLength="80" /></label><label>금액<span className="amount-input"><input inputMode="numeric" value={sheet.amount} onChange={(event) => updateSheet('amount', event.target.value)} placeholder="0" /><em>원</em></span></label><button className="save-button" type="submit" disabled={saving}>{saving ? '저장 중…' : '저장'}</button></form>{sheet.mode === 'edit' && <button className="delete-button" type="button" disabled={saving} onClick={deleteEntry}>내역 삭제</button>}</section></div>}</main>
}
