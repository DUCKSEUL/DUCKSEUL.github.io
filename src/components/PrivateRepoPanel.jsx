// 관리자 전용: 비공개 저장소(나에게만 보기) 연결 상태 · 저장소 이름 설정 · 이 브라우저의 예전 비공개 글 이전
import { useState } from 'react'
import Modal from './Modal.jsx'
import { Icon, toast } from './ui.jsx'
import { usePosts, refreshPrivate, getLocalDrafts, migrateLocalDrafts } from '../lib/store.js'
import { getPrivateRepoName, setPrivateRepoName, DEFAULT_PRIVATE_REPO, PRIVATE_FILE } from '../lib/privateNotes.js'

const STATE_LABEL = {
  loading: '불러오는 중…',
  ok: '연결됨',
  'no-file': '연결됨 · 아직 비공개 글 없음',
  'no-repo': '저장소 없음 · 첫 비공개 저장 때 자동으로 만들어요',
  error: '연결 오류',
}

export function PrivateRepoSettings({ open, onClose }) {
  const { privateStatus } = usePosts()
  const [name, setName] = useState(getPrivateRepoName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const repo = privateStatus.repo

  const save = async (e) => {
    e.preventDefault()
    setError('')
    try {
      setPrivateRepoName(name)
    } catch (err) {
      setError(err.message)
      return
    }
    setBusy(true)
    await refreshPrivate()
    setBusy(false)
    toast('비공개 저장소 설정을 저장했어요.')
    onClose()
  }

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const { createPrivateRepo, privateRepo } = await import('../lib/privateNotes.js')
      setPrivateRepoName(name)
      await createPrivateRepo(privateRepo(repo?.owner))
      await refreshPrivate()
      toast('비공개 저장소를 만들었어요.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="🔒 비공개 저장소 설정" onClose={onClose} width={500}>
      <form className="form-stack" onSubmit={save}>
        <p className="modal-text">
          「나에게만 보기」 글은 내 GitHub 계정의 <strong>Private 저장소</strong> <code>{PRIVATE_FILE}</code>에 저장돼요. 어느 기기에서든 Admin으로 로그인하면 함께
          불러와요.
        </p>
        <label>
          <span>비공개 저장소 이름</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={DEFAULT_PRIVATE_REPO} spellCheck={false} autoComplete="off" />
        </label>
        <p className="form-hint">
          현재: <code>{repo ? `${repo.owner}/${repo.name}` : '—'}</code> · {STATE_LABEL[privateStatus.state] || '—'}
          {privateStatus.state === 'ok' && ` · ${privateStatus.count}개`}
        </p>
        {(error || privateStatus.error) && (
          <p className="form-error" role="alert">
            {error || privateStatus.error}
          </p>
        )}
        <p className="form-hint">
          토큰으로 로그인했다면 토큰의 Repository access에 이 저장소도 추가하고 Contents: Read and write 권한을 주세요. 저장소 자동 생성에는 Administration: Read and
          write 권한이 필요해요(없으면{' '}
          <a href={`https://github.com/new?name=${encodeURIComponent(name || DEFAULT_PRIVATE_REPO)}&visibility=private`} target="_blank" rel="noreferrer">
            GitHub에서 직접 만들기
          </a>
          ).
        </p>
        <div className="form-row-end">
          {privateStatus.state === 'no-repo' && (
            <button type="button" className="btn btn-md btn-ghost" onClick={create} disabled={busy}>
              지금 저장소 만들기
            </button>
          )}
          <button type="button" className="btn btn-md btn-ghost" onClick={() => refreshPrivate()} disabled={busy}>
            <Icon name="refresh" size={16} /> 다시 불러오기
          </button>
          <button type="submit" className="btn btn-md btn-primary" disabled={busy}>
            {busy ? '확인 중…' : '저장'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** 연구 일지 목록 상단: 비공개 저장소 상태 줄 + 예전(브라우저 전용) 비공개 글 이전 안내 */
export default function PrivateRepoPanel() {
  const { privateStatus, posts } = usePosts()
  const [open, setOpen] = useState(false)
  const [moving, setMoving] = useState(false)
  const localDrafts = getLocalDrafts()
  const count = posts.filter((p) => p.source === 'private').length
  const s = privateStatus.state
  if (s === 'off') return null

  const migrate = async () => {
    setMoving(true)
    try {
      const n = await migrateLocalDrafts()
      toast(`🔒 ${n}개의 글을 비공개 저장소로 옮겼어요. 이제 다른 기기에서도 보여요.`)
    } catch (e) {
      toast(`옮기지 못했어요: ${e.message}`, 'error')
    } finally {
      setMoving(false)
    }
  }

  return (
    <>
      <div className={`private-bar is-${s}`} role="status">
        <span className="lock-badge">🔒 비공개 저장소</span>
        <span className="private-bar-text">
          {s === 'error' ? privateStatus.error : `${STATE_LABEL[s] || ''}${s === 'ok' ? ` · 나에게만 보기 ${count}개` : ''}`}
        </span>
        <button className="link-btn" onClick={() => setOpen(true)}>
          설정
        </button>
      </div>
      {localDrafts.length > 0 && s !== 'loading' && s !== 'error' && (
        <div className="publish-bar private-migrate" role="status">
          <p>
            이 브라우저에만 저장된 나만 보기 글 <strong>{localDrafts.length}개</strong>가 있어요. 비공개 저장소로 옮기면 다른 기기에서도 보여요.
          </p>
          <button className="btn btn-sm btn-primary" onClick={migrate} disabled={moving}>
            <Icon name="lock" size={14} /> {moving ? '옮기는 중…' : '비공개 저장소로 옮기기'}
          </button>
        </div>
      )}
      <PrivateRepoSettings open={open} onClose={() => setOpen(false)} />
    </>
  )
}
