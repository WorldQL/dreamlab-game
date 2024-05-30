;(function () {
  const o = document.createElement('link').relList
  if (o && o.supports && o.supports('modulepreload')) return
  for (const e of document.querySelectorAll('link[rel="modulepreload"]')) r(e)
  new MutationObserver(e => {
    for (const t of e)
      if (t.type === 'childList')
        for (const s of t.addedNodes) s.tagName === 'LINK' && s.rel === 'modulepreload' && r(s)
  }).observe(document, { childList: !0, subtree: !0 })
  function c(e) {
    const t = {}
    return (
      e.integrity && (t.integrity = e.integrity),
      e.referrerPolicy && (t.referrerPolicy = e.referrerPolicy),
      e.crossOrigin === 'use-credentials'
        ? (t.credentials = 'include')
        : e.crossOrigin === 'anonymous'
          ? (t.credentials = 'omit')
          : (t.credentials = 'same-origin'),
      t
    )
  }
  function r(e) {
    if (e.ep) return
    e.ep = !0
    const t = c(e)
    fetch(e.href, t)
  }
})()
const a = document.querySelector('#log-controls'),
  l = document.querySelector('#log-output'),
  m = a.querySelector('input[type=search]')
function C(n) {
  const o = {
    30: 'var(--text-secondary-color)',
    31: 'var(--accent-red-color)',
    32: 'var(--accent-green-color)',
    33: 'var(--accent-yellow-color)',
    34: 'var(--accent-primary-color)',
    35: 'var(--accent-secondary-color)',
    36: 'var(--accent-green-color)',
    37: 'var(--text-primary-color)',
    90: 'var(--text-secondary-color)',
  }
  return n.replace(/\x1b\[(\d+)m/g, (c, r) => {
    const e = o[r]
    return e ? `<span style="color: ${e};">` : r === '0' ? '</span>' : ''
  })
}
function q(n, o, c) {
  const r = n.toISOString().replace('T', ' ').replace('Z', ''),
    e = document.createElement('article')
  ;(e.className = o),
    e.appendChild(Object.assign(document.createElement('time'), { timestamp: n, textContent: r })),
    e.appendChild(
      Object.assign(document.createElement('div'), { className: 'level', textContent: o }),
    )
  const t = document.createElement('div')
  ;(t.className = 'message'), (t.innerHTML = C(c)), e.appendChild(t)
  const s = m.value
  e.setAttribute('data-matches', String(c.includes(s))), l.prepend(e)
}
let u = !1
const v = document.querySelector('#case-sensitive-btn')
v.addEventListener('click', () => {
  ;(u = !u), v.classList.toggle('active', u), m.dispatchEvent(new Event('input'))
})
m.addEventListener('input', () => {
  var o
  const n = m.value
  for (const c of l.children) {
    if (c.tagName !== 'ARTICLE') continue
    const r = ((o = c.querySelector('.message')) == null ? void 0 : o.textContent) ?? '',
      e = u ? r.includes(n) : r.toLowerCase().includes(n.toLowerCase())
    c.setAttribute('data-matches', String(e))
  }
})
const d = document.querySelector('#toggle-grid-btn')
d == null ||
  d.addEventListener('click', () => {
    l.classList.toggle('show-grid'), d.classList.toggle('active')
  })
const f = document.querySelector('#clear-logs-btn')
f == null ||
  f.addEventListener('click', () => {
    ;(l.innerHTML = ''), window.parent.postMessage('log-viewer:clear')
  })
window.addEventListener('message', n => {
  n.data === 'dark-theme'
    ? (document.body.classList.add('dark-theme'),
      document.documentElement.classList.add('dark-theme'))
    : n.data === 'light-theme' &&
      (document.body.classList.remove('dark-theme'),
      document.documentElement.classList.remove('dark-theme'))
})
const p = new URL(window.location.toString()).searchParams.get('connect')
if (p === null) a.querySelector('#status').textContent = 'Failed: no connect URL specified'
else {
  let n = 0
  const o = r => {
      n++
      const e = setTimeout(() => {
        n -= 1
      }, 3e4)
      r.addEventListener('open', () => {
        ;(l.innerHTML = ''),
          (a.querySelector('#status').textContent = 'Connected'),
          (a.querySelector('#status').style.color = 'var(--accent-green-color)')
      }),
        r.addEventListener('message', t => {
          const s = t.data
          if (typeof s != 'string') return
          const i = JSON.parse(s)
          if (typeof i == 'object' && 't' in i && i.t === 'New' && 'entry' in i) {
            const { level: L, timestamp: h, message: S, detail: g } = i.entry,
              w = new Date(h)
            let y = S
            if (g !== void 0)
              for (const [E, b] of Object.entries(g)) y += ` ${E}=${JSON.stringify(b)}`
            q(w, L, y)
          }
        }),
        r.addEventListener('close', () => {
          if (
            (clearTimeout(e),
            (a.querySelector('#status').textContent = 'Disconnected'),
            (a.querySelector('#status').style.color = 'var(--accent-red-color)'),
            n < 5)
          ) {
            const t = new WebSocket(p)
            o(t)
          } else console.warn('detected reconnect loop! aborting')
        })
    },
    c = new WebSocket(p)
  o(c)
}
