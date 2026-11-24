import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { Icon, toast } from './ui.jsx'
import { ClientIdField } from './GoogleConnect.jsx'
import { useGoogle, connect } from '../lib/google.js'
import { saveSiteData } from '../lib/siteData.js'
import { fetchSheet, parseSheetUrl, ROLE_DEFS } from '../lib/sheets.js'
import { API_KEY_REFERRERS, GOOGLE_ALLOWED_ORIGINS, SHEETS_SCOPE } from '../config.js'

const MODES = [
  { value: 'sample', label: '샘플 데이터', desc: '연결 전 기본 예시' },
  { value: 'gviz', label: '링크 공유 시트', desc: '키 없이 · 「링크가 있는 모든 사용자」 공유' },
  { value: 'apikey', label: 'Sheets API · API Key', desc: '공개 시트 · 제한된 브라우저 키' },
  { value: 'oauth', label: 'Sheets API · OAuth', desc: '비공개 시트 · 관리자 브라우저에서만' },
]

export function SecurityLockGuide() {
  return (
    <section className="gs-guide" aria-label="보안 잠금 가이드">
      <h3>
        <Icon name="lock" size={16} /> Google Cloud Console 보안 잠금 가이드
      </h3>
      <ol>
        <li>
          <b>API Key 설정</b> —{' '}
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
            사용자 인증 정보
          </a>
          에서 키를 만든 뒤 <b>애플리케이션 제한사항 → 웹사이트(HTTP 리퍼러)</b>에 아래 두 주소만 등록하고, <b>API 제한사항</b>에서{' '}
          <b>Google Sheets API</b>만 선택하세요.
          <ul className="gs-origins">
            {API_KEY_REFERRERS.map((o) => (
              <li key={o}>
                <code>{o}</code>
              </li>
            ))}
          </ul>
        </li>
        <li>
          <b>OAuth Client ID 사용 시</b> — 유형은 웹 애플리케이션, <b>승인된 JavaScript 원본</b>에 아래 두 주소만 등록하세요. (리디렉션 URI는 비워 둠)
          <ul className="gs-origins">
            {GOOGLE_ALLOWED_ORIGINS.map((o) => (
              <li key={o}>
                <code>{o}</code>
              </li>
            ))}
          </ul>
        </li>
        <li>
          <b>Client Secret은 쓰지 않아요.</b> 발급돼도 코드·.env·저장소 어디에도 넣지 마세요. API 라이브러리에서 <b>Google Sheets API</b>를 사용 설정하세요.
        </li>
      </ol>
      <dl className="gs-facts">
        <div>
          <dt>API Key</dt>
          <dd>브라우저에 전달되는 공개 값이라 radar.json에 저장돼요. 위 리퍼러·API 제한이 걸린 키만 쓰세요.</dd>
        </div>
        <div>
          <dt>OAuth 권한</dt>
          <dd>
            <code>spreadsheets.readonly</code> (읽기 전용) — 토큰은 메모리 + sessionStorage에만, localStorage·저장소에는 저장 안 함
          </dd>
        </div>
      </dl>
    </section>
  )
}

export default function RadarSettings({ open, onClose, radar }) {
  const g = useGoogle()
  const [cfg, setCfg] = useState({})
  const [test, setTest] = useState(null) // { headers, roles, count } | null
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setCfg({
      mode: radar?.sheetUrl ? radar.mode || 'gviz' : 'sample',
      sheetUrl: radar?.sheetUrl || '',
      sheetName: radar?.sheetName || '',
      apiKey: radar?.apiKey || '',
      columns: { ...(radar?.columns || {}) },
    })
    setTest(null)
    setError('')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => {
    setCfg((c) => ({ ...c, [k]: v }))
    if (k !== 'columns') setTest(null)
  }
  const oauthReady = g.connected && g.token?.sheets

  const runTest = async () => {
    setError('')
    if (!parseSheetUrl(cfg.sheetUrl)) return setError('Google Sheets 링크 형식이 아니에요. (docs.google.com/spreadsheets/d/…)')
    if (cfg.mode === 'oauth' && !oauthReady) return setError('먼저 「Sheets 읽기 권한 연결」로 Google 계정을 연결해 주세요.')
    setBusy('test')
    try {
      const d = await fetchSheet(cfg)
      setTest({ headers: d.headers, roles: d.roles, count: d.papers.length })
      return d
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const connectSheets = async () => {
    setError('')
    try {
      const t = await connect([SHEETS_SCOPE])
      toast(t.sheets ? 'Sheets 읽기 권한을 연결했어요.' : 'Sheets 읽기 권한이 거부됐어요.', t.sheets ? 'default' : 'error')
    } catch (e) {
      setError(e.message)
    }
  }

  const save = async () => {
    setError('')
    let next
    if (cfg.mode === 'sample') next = { ...radar, mode: 'sample', sheetUrl: '', sheetName: '', apiKey: '', columns: {} }
    else {
      const d = await runTest()
      if (!d) return
      if (!d.papers.length) return setError('시트는 읽었지만 제목이 있는 행이 없어요. 컬럼 매핑을 확인해 주세요.')
      const columns = Object.fromEntries(Object.entries(cfg.columns || {}).filter(([, v]) => v))
      next = {
        ...radar,
        mode: cfg.mode,
        sheetUrl: cfg.sheetUrl.trim(),
        sheetName: cfg.sheetName.trim(),
        apiKey: cfg.mode === 'apikey' ? cfg.apiKey.trim() : '', // OAuth/gviz 모드에서는 키를 남기지 않음
        columns,
      }
    }
    setBusy('save')
    try {
      await saveSiteData('radar', next, `radar: 데이터 소스 ${next.mode} 설정`)
      toast('논문 레이더 설정을 저장했어요. 1~2분 뒤 모든 방문자에게 반영돼요.')
      onClose()
    } catch (e) {
      setError(`저장 실패: ${e.message}`)
    } finally {
      setBusy('')
    }
  }

  const headers = test?.headers || []

  return (
    <Modal
      open={open}
      title="Google Sheets API 연동 설정"
      onClose={() => !busy && onClose()}
      width={680}
      footer={
        <>
          <button className="btn btn-md btn-ghost" onClick={onClose} disabled={!!busy}>
            취소
          </button>
          <button className="btn btn-md btn-primary" onClick={save} disabled={!!busy}>
            {busy === 'save' ? '저장 중…' : busy === 'test' ? '확인 중…' : cfg.mode === 'sample' ? '샘플로 저장' : '연결 확인 후 저장'}
          </button>
        </>
      }
    >
      <div className="gsettings">
        <section>
          <h3>데이터 소스</h3>
          <div className="mode-grid" role="radiogroup" aria-label="데이터 소스">
            {MODES.map((m) => (
              <label key={m.value} className={`mode-opt ${cfg.mode === m.value ? 'is-active' : ''}`}>
                <input type="radio" name="radar-mode" value={m.value} checked={cfg.mode === m.value} onChange={() => set('mode', m.value)} />
                <strong>{m.label}</strong>
                <span>{m.desc}</span>
              </label>
            ))}
          </div>
        </section>

        {cfg.mode !== 'sample' && (
          <section className="form-grid">
            <label className="form-field full">
              <span>시트 링크 (또는 Spreadsheet ID)</span>
              <input value={cfg.sheetUrl || ''} onChange={(e) => set('sheetUrl', e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…/edit" spellCheck={false} />
            </label>
            <label className="form-field">
              <span>시트 탭 이름 (선택)</span>
              <input value={cfg.sheetName || ''} onChange={(e) => set('sheetName', e.target.value)} placeholder="예: Papers" />
            </label>
            {cfg.mode === 'apikey' && (
              <label className="form-field">
                <span>API Key (제한된 브라우저 키)</span>
                <input value={cfg.apiKey || ''} onChange={(e) => set('apiKey', e.target.value)} placeholder="AIza…" spellCheck={false} autoComplete="off" />
              </label>
            )}
            {cfg.mode === 'gviz' && <p className="form-hint full">시트 공유 → 일반 액세스를 「링크가 있는 모든 사용자 · 뷰어」로 바꿔 주세요. 키가 필요 없어요.</p>}
            {cfg.mode === 'apikey' && (
              <p className="form-hint full">
                API Key로는 공개(링크 공유) 시트만 읽을 수 있어요. 요청 형식: <code>sheets.googleapis.com/v4/spreadsheets/{'{ID}'}/values/{'{RANGE}'}?key=…</code>
              </p>
            )}
          </section>
        )}

        {cfg.mode === 'oauth' && (
          <>
            <section className="gs-status">
              <span className={`gs-dot ${oauthReady ? 'on' : ''}`} />
              <div>
                <strong>{oauthReady ? 'Sheets 읽기 권한 연결됨' : '연결 안 됨'}</strong>
                <span>
                  {oauthReady
                    ? `${new Date(g.token.expiresAt).toTimeString().slice(0, 5)}까지 유효 · 이 탭에만 보관`
                    : '비공개 시트는 관리자 브라우저에서만 보여요. 방문자에게는 공개되지 않아요.'}
                </span>
              </div>
              {!oauthReady && (
                <button className="btn btn-sm btn-primary" onClick={connectSheets} disabled={!g.clientId || g.connecting}>
                  {g.connecting ? '연결 중…' : 'Sheets 읽기 권한 연결'}
                </button>
              )}
            </section>
            <ClientIdField />
          </>
        )}

        {cfg.mode !== 'sample' && (
          <section>
            <div className="map-head">
              <h3>컬럼 매핑</h3>
              <button className="btn btn-sm btn-ghost" onClick={runTest} disabled={!!busy}>
                <Icon name="refresh" size={14} /> {busy === 'test' ? '불러오는 중…' : '헤더 불러오기 · 연결 테스트'}
              </button>
            </div>
            {test ? (
              <>
                <p className="form-hint">
                  ✓ 연결 성공 · 논문 {test.count}편. 열 이름이 달라도 아래에서 직접 지정할 수 있어요. (「자동」은 첫 행 헤더로 자동 인식)
                </p>
                <div className="map-grid">
                  {ROLE_DEFS.map((d) => (
                    <label key={d.role} className="form-field">
                      <span>{d.label}</span>
                      <select
                        value={cfg.columns?.[d.role] || ''}
                        onChange={(e) => set('columns', { ...cfg.columns, [d.role]: e.target.value })}
                        aria-label={`${d.label} 열`}
                      >
                        <option value="">자동{test.roles[d.role] !== undefined ? ` (${headers[test.roles[d.role]]})` : ' (없음)'}</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <p className="form-hint">「헤더 불러오기」를 누르면 시트 첫 행을 읽어 열을 자동으로 매핑하고, 필요하면 직접 바꿀 수 있어요.</p>
            )}
          </section>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <SecurityLockGuide />
      </div>
    </Modal>
  )
}
