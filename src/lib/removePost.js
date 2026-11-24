// 글 삭제 공통 흐름: 이 브라우저에서 지우고, 저장소에 있던 글이면 삭제 커밋까지 올림
import { toast } from '../components/ui.jsx'
import { deletePost, markSynced, isOnRemote } from './store.js'

/** 확인 문구: 저장소에서도 지워지는지 */
export function deleteMessage(post) {
  if (!isOnRemote(post.id)) return '아직 발행하지 않은 글이에요. 이 브라우저에서 삭제되고 되돌릴 수 없어요.'
  return post.draft
    ? '이 글은 이미 발행된 적이 있어요. 나만 보기 수정본과 함께 공개된 글도 GitHub 저장소에서 삭제돼요.'
    : 'GitHub 저장소의 posts.json에서 이 글을 지우는 커밋을 올려요. 배포가 끝나면 모든 방문자에게서 사라져요.'
}

export async function removePost(post) {
  const { id, title } = post
  const remote = await deletePost(id)
  if (!remote) {
    toast('삭제했어요.')
    return
  }
  toast('GitHub에 삭제를 반영하는 중…')
  try {
    const { publishChanges } = await import('./publish.js')
    await publishChanges({ deletes: [id], message: `journal: 「${title}」 삭제` })
    await markSynced([id])
    toast('GitHub에서 삭제했어요. 1~2분 뒤 사이트에 반영돼요.')
  } catch (e) {
    toast(`GitHub 반영 실패: ${e.message} — 목록 상단의 「모두 발행」으로 다시 시도할 수 있어요.`, 'error')
  }
}
