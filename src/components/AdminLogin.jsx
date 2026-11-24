import { useState } from 'react'
import Modal from './Modal.jsx'
import { Icon, toast } from './ui.jsx'
import { login, loginWithGitHub, hasGitHubLogin } from '../lib/admin.js'
import { REPO } from '../config.js'

function TokenForm({ onDone }) {
  const [token, setToken] = useState('')
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await login(token, { remember })
      toast(`관리자 모드가 켜졌어요. (${user.login})`)
      setToken('')
      onDone()
    } catch (err) {
      setError(err.message || '인증에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form id="admin-form" className="form-stack" onSubmit={submit}>
      <label>
        <span>Personal Access Token</span>
        <input
          type="password"
          autoFocus={!hasGitHubLogin}
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_… 또는 ghp_…"
          aria-invalid={!!error}
          aria-describedby={error ? 'admin-error' : undefined}
        />
      </label>
      {error && (
        <p id="admin-error" className="form-error" role="alert">
          {error}
        </p>
      )}
      <label className="check-row">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <span>이 브라우저에 로그인 유지 (공용 PC에서는 사용하지 마세요)</span>
      </label>
      <p className="form-hint">
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
          Fine-grained token
        </a>{' '}
        권장 설정: 저장소는 <code>{REPO.name}</code> + 비공개 글 저장소(기본 <code>duckseul-private-notes</code>)만, 권한은 <strong>Contents: Read and write</strong> 하나만, 만료는{' '}
        <strong>7~30일</strong>처럼 짧게. 토큰은 기본적으로 이 탭에만 보관되고 탭·브라우저를 닫으면 자동으로 지워져요.
      </p>
      <button className="btn btn-md btn-primary" type="submit" disabled={busy || !token.trim()}>
        {busy ? '확인 중…' : '토큰으로 로그인'}
      </button>
    </form>
  )
}

export default function AdminLogin({ open, onClose }) {
  const [going, setGoing] = useState(false)
  return (
    <Modal open={open} title="관리자 로그인" onClose={onClose} width={440}>
      <div className="admin-login">
        <p className="modal-text">
          <code>
            {REPO.owner}/{REPO.name}
          </code>{' '}
          저장소 관리자만 로그인할 수 있어요.
        </p>
        {hasGitHubLogin ? (
          <>
            <button
              className="btn btn-lg btn-dark gh-login"
              autoFocus
              disabled={going}
              onClick={() => {
                setGoing(true)
                loginWithGitHub()
              }}
            >
              <Icon name="github" size={20} /> {going ? 'GitHub로 이동 중…' : 'GitHub로 로그인'}
            </button>
            <details className="token-alt">
              <summary>토큰으로 직접 로그인</summary>
              <TokenForm onDone={onClose} />
            </details>
          </>
        ) : (
          <TokenForm onDone={onClose} />
        )}
      </div>
    </Modal>
  )
}
