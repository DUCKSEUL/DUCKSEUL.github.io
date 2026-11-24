// GitHub App 로그인(OAuth 웹 플로우) 중계 Worker
//   GET /login?redirect=<사이트 URL>&nonce=<사이트가 만든 난수>
//     → github.com 승인 화면으로 이동
//   GET /callback?code=…&state=…
//     → Client Secret으로 code를 토큰으로 교환 → 허용된 계정인지 확인
//     → <사이트 URL>#gh_token=…&nonce=… 로 돌려보냄 (#fragment는 서버로 전송되지 않음)
// Client Secret은 이 Worker에만 있고, 브라우저로는 절대 나가지 않습니다.

const enc = new TextEncoder()
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const b64urlText = (s) => b64url(enc.encode(s))
const fromB64urlText = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

const list = (s = '') =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

function allowedRedirect(env, raw) {
  try {
    const u = new URL(raw)
    return list(env.ALLOWED_ORIGINS).includes(u.origin) ? u : null
  } catch {
    return null
  }
}

function back(redirect, params) {
  const u = new URL(redirect)
  u.hash = new URLSearchParams(params).toString()
  return Response.redirect(u.toString(), 302)
}

const STATE_TTL = 10 * 60 * 1000

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/login') {
      const redirect = allowedRedirect(env, url.searchParams.get('redirect'))
      const nonce = url.searchParams.get('nonce') || ''
      if (!redirect) return new Response('허용되지 않은 redirect 주소예요.', { status: 400 })
      if (!/^[\w-]{16,64}$/.test(nonce)) return new Response('nonce가 올바르지 않아요.', { status: 400 })
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return new Response('Worker 설정(Client ID/Secret)이 비어 있어요.', { status: 500 })
      const payload = b64urlText(JSON.stringify({ r: redirect.toString(), n: nonce, t: Date.now() }))
      const state = `${payload}.${await hmac(env.GITHUB_CLIENT_SECRET, payload)}`
      const gh = new URL('https://github.com/login/oauth/authorize')
      gh.searchParams.set('client_id', env.GITHUB_CLIENT_ID)
      gh.searchParams.set('redirect_uri', `${url.origin}/callback`)
      gh.searchParams.set('state', state)
      return Response.redirect(gh.toString(), 302)
    }

    if (url.pathname === '/callback') {
      const [payload, sig] = (url.searchParams.get('state') || '').split('.')
      if (!payload || !sig || sig !== (await hmac(env.GITHUB_CLIENT_SECRET, payload))) {
        return new Response('state 검증에 실패했어요. 다시 로그인해 주세요.', { status: 400 })
      }
      const { r, n, t } = JSON.parse(fromB64urlText(payload))
      const redirect = allowedRedirect(env, r)
      if (!redirect) return new Response('허용되지 않은 redirect 주소예요.', { status: 400 })
      if (Date.now() - t > STATE_TTL) return back(redirect, { gh_error: '로그인 시간이 초과됐어요. 다시 시도해 주세요.', nonce: n })
      if (url.searchParams.get('error')) return back(redirect, { gh_error: '로그인이 취소됐어요.', nonce: n })

      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: url.searchParams.get('code'),
          redirect_uri: `${url.origin}/callback`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.access_token) return back(redirect, { gh_error: `토큰 발급 실패: ${data.error_description || data.error || res.status}`, nonce: n })

      // 허용된 계정만 통과
      const user = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${data.access_token}`, 'User-Agent': 'duckseul-auth', Accept: 'application/vnd.github+json' },
      }).then((x) => x.json())
      const allowed = list(env.ALLOWED_USERS).map((x) => x.toLowerCase())
      if (!user.login || !allowed.includes(user.login.toLowerCase())) {
        return back(redirect, { gh_error: `${user.login || '이 계정'}은(는) 관리자가 아니에요.`, nonce: n })
      }
      return back(redirect, { gh_token: data.access_token, nonce: n })
    }

    return new Response('DUCKSEUL auth worker', { status: 200 })
  },
}
