import { useState } from 'react'
import Modal from './Modal.jsx'
import { Icon, toast } from './ui.jsx'
import { useAdmin } from '../lib/admin.js'
import { useGoogle, connect, disconnect, setClientId } from '../lib/google.js'
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES, GOOGLE_ALLOWED_ORIGINS, CALENDAR_SCOPE } from '../config.js'

/** OAuth Client ID 입력칸 (공개 값 · 이 브라우저 설정으로 저장) — 캘린더/시트 설정에서 같이 사용 */
export function ClientIdField() {
  const g = useGoogle()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const saveId = () => {
    try {
      setClientId(draft)
      setEditing(false)
      setError('')
      toast(draft.trim() ? 'Client ID를 저장했어요.' : 'Client ID를 지웠어요.')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <section>
      <h3>OAuth Client ID (공개용)</h3>
      {GOOGLE_CLIENT_ID ? (
        <p className="gs-mono">{GOOGLE_CLIENT_ID}</p>
      ) : editing || !g.clientId ? (
        <div className="gs-row">
          <input
            className="gs-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="123456789012-xxxx.apps.googleusercontent.com"
            spellCheck={false}
            aria-label="Google OAuth Client ID"
          />
          <button type="button" className="btn btn-sm btn-primary" onClick={saveId}>
            저장
          </button>
        </div>
      ) : (
        <div className="gs-row">
          <p className="gs-mono">{g.clientId}</p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => (setDraft(g.clientId), setEditing(true))}>
            변경
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

/** Google 연동 설정 + 보안 가이드 모달 */
export function GoogleSettingsModal({ open, onClose }) {
  const g = useGoogle()
  const [error, setError] = useState('')

  const doConnect = async () => {
    setError('')
    try {
      const t = await connect([CALENDAR_SCOPE])
      toast(t.calendar ? 'Google 캘린더를 연결했어요.' : 'Google 계정은 연결됐지만 캘린더 읽기 권한이 거부됐어요.', t.calendar ? 'default' : 'error')
      onClose()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Modal open={open} title="Google 캘린더 연동 설정" onClose={onClose} width={600}>
      <div className="gsettings">
        <section className="gs-status">
          <span className={`gs-dot ${g.connected ? 'on' : ''}`} />
          <div>
            <strong>{g.connected ? 'Google 계정 연결됨' : '연결 안 됨'}</strong>
            <span>
              {g.connected
                ? `캘린더 읽기 ${g.token.calendar ? '✓' : '✕ (권한 거부됨)'} · ${new Date(g.token.expiresAt).toTimeString().slice(0, 5)}까지 유효`
                : '연결하면 내 Google 캘린더 일정이 이 브라우저 화면에만 표시돼요.'}
            </span>
          </div>
          {g.connected ? (
            <button className="btn btn-sm btn-ghost" onClick={() => (disconnect(), toast('Google 연결을 해제했어요.'))}>
              연결 해제
            </button>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={doConnect} disabled={!g.clientId || g.connecting}>
              {g.connecting ? '연결 중…' : 'Google 캘린더 연결'}
            </button>
          )}
        </section>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <ClientIdField />

        <section className="gs-guide" aria-label="보안 가이드">
          <h3>
            <Icon name="lock" size={16} /> 보안 가이드
          </h3>
          <ol>
            <li>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
                Google Cloud Console → 사용자 인증 정보
              </a>
              에서 <b>OAuth 클라이언트 ID</b>를 만들고 유형은 <b>웹 애플리케이션</b>을 고르세요.
            </li>
            <li>
              <b>승인된 JavaScript 원본</b>에는 아래 두 주소만 등록하세요. 다른 도메인이 이 Client ID를 도용하지 못하게 막아 줘요.
              <ul className="gs-origins">
                {GOOGLE_ALLOWED_ORIGINS.map((o) => (
                  <li key={o}>
                    <code>{o}</code>
                  </li>
                ))}
              </ul>
              승인된 리디렉션 URI는 비워 두세요. (팝업 Token 방식이라 필요 없어요)
            </li>
            <li>
              <b>Client Secret은 필요 없어요.</b> 발급되더라도 사이트·저장소 어디에도 넣지 마세요.
            </li>
            <li>
              API 라이브러리에서 <b>Google Calendar API</b>를 사용 설정하고, OAuth 동의 화면은 <b>테스트</b> 상태로 두고 내 Google 계정만 테스트
              사용자로 추가하세요.
            </li>
          </ol>
          <dl className="gs-facts">
            <div>
              <dt>요청 권한</dt>
              <dd>
                {GOOGLE_SCOPES.map((s) => (
                  <code key={s}>{s.replace('https://www.googleapis.com/auth/', '')}</code>
                ))}{' '}
                (읽기 전용 1개만)
              </dd>
            </div>
            <div>
              <dt>토큰 보관</dt>
              <dd>메모리 + sessionStorage에만 · 탭을 닫거나 1시간이 지나면 사라짐 · localStorage·저장소에는 절대 저장 안 함</dd>
            </div>
            <div>
              <dt>공개 범위</dt>
              <dd>불러온 일정은 이 브라우저 화면에만 표시되고, 방문자에게는 공개용으로 지정한 일정만 보여요.</dd>
            </div>
          </dl>
        </section>
      </div>
    </Modal>
  )
}

/** 페이지 상단에 놓는 작은 Google 연결 버튼 (관리자 전용) */
export function GoogleConnectButton({ label = 'Google 캘린더 연결' }) {
  const { isAdmin } = useAdmin()
  const g = useGoogle()
  const [open, setOpen] = useState(false)
  if (!isAdmin) return null
  return (
    <>
      <button className={`btn btn-md ${g.connected ? 'btn-weak' : 'btn-ghost'}`} onClick={() => setOpen(true)}>
        <span className={`gs-dot ${g.connected ? 'on' : ''}`} /> {g.connected ? 'Google 연결됨' : label}
      </button>
      <GoogleSettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
