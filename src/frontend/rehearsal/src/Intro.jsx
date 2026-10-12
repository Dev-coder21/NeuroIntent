// Intro: the line draws in, the voice wakes up, the name decodes; Enter splits the screen open.
// Scroll is locked (html.intro-on) while it shows. Ported from demos/neurointent-booth-final.html.
import { useEffect, useRef, useState } from 'react'
import { reduceMotion } from './stage'
import { fxMagnetic } from './fx'
import { Roll } from './Buttons'

const NAME = 'NeuroIntent'
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export default function Intro({ onDone }) {
    const [gone, setGone] = useState(false)
    const rootRef = useRef(null)
    const onDoneRef = useRef(onDone)
    useEffect(() => { onDoneRef.current = onDone }, [onDone])

    useEffect(() => {
        const root = rootRef.current
        const html = document.documentElement
        html.classList.add('intro-on')
        const reduce = reduceMotion()
        const timers = []
        const later = (fn, ms) => timers.push(setTimeout(fn, ms))
        let raf = 0

        const letters = [...root.querySelectorAll('#inWord > span')]
        // Each slot is locked to its final letter's width so the scramble never shifts the line.
        const lock = () => letters.forEach((el, i) => {
            if (el.dataset.ok) return
            const keep = el.textContent; el.style.width = ''; el.textContent = NAME[i]
            el.style.width = el.getBoundingClientRect().width + 'px'
            el.textContent = keep
        })
        letters.forEach(el => { delete el.dataset.ok; el.className = ''; el.textContent = '' })
        lock()
        letters.forEach(el => { el.className = 'scr'; el.textContent = ' ' })
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(lock)
        const unlockWidths = () => letters.forEach(el => { el.style.width = '' })
        window.addEventListener('resize', unlockWidths, { once: true })

        const num = root.querySelector('#inNum')
        const enter = root.querySelector('.in-enter')
        const tag = root.querySelector('.in-tag'), hint = root.querySelector('.in-hint')
        const cv = root.querySelector('.in-wave'), cx = cv.getContext('2d')
        const ink = '#9CC3BC', paper = '#EEF2EF'   // the voice is soft sage, the plain line is pale
        let W = 0, H = 0, dpr = 1
        const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr }
        size(); window.addEventListener('resize', size)

        const t0 = performance.now()
        const st = { draw: 0, amp: 0, ampTarget: 0, flash: 0, done: false, leaving: false }
        const resolveAt = (i) => 1500 + i * 95            // when letter i settles
        const allResolved = resolveAt(NAME.length - 1) + 120

        function paint(now) {
            if (st.done) return
            const t = now - t0
            // 1. the line draws in, 2. the voice wakes up
            st.draw = reduce ? 1 : Math.min(1, t / 900)
            if (t > 900 && !st.leaving) st.ampTarget = 1
            st.amp += (st.ampTarget - st.amp) * (reduce ? 1 : 0.06)
            const pct = Math.min(100, Math.round(reduce ? 100 : (t / allResolved) * 100))
            const s = String(pct).padStart(3, '0'); if (num.textContent !== s) num.textContent = s
            // 3. the name decodes out of noise, left to right
            letters.forEach((el, i) => {
                if (el.dataset.ok) return
                if (reduce || t >= resolveAt(i)) { el.textContent = NAME[i]; el.className = ''; el.dataset.ok = '1'; return }
                if (t > 300 + i * 40 && Math.random() < 0.5) el.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0]
            })
            if (!enter.classList.contains('show') && (reduce || t >= allResolved)) reveal()
            cx.setTransform(dpr, 0, 0, dpr, 0, 0)
            cx.clearRect(0, 0, W, H)
            const mid = H / 2, n = Math.max(120, W / 3 | 0), tt = reduce ? 0 : t / 1000
            for (let pass = 0; pass < 2; pass++) {
                cx.beginPath()
                for (let k = 0; k <= n; k++) {
                    const u = k / n; if (u > st.draw) break
                    const x = u * W, edge = Math.sin(Math.PI * u)
                    const v = Math.sin(u * 22 - tt * 5) * 0.5 + Math.sin(u * 51 + tt * 7) * 0.28 + Math.sin(u * 9 - tt * 2) * 0.35
                    const y = mid + (pass ? 1 : 0.35) * v * edge * st.amp * H * 0.3
                    if (k) cx.lineTo(x, y); else cx.moveTo(x, y)
                }
                cx.strokeStyle = pass ? ink : paper
                cx.globalAlpha = pass ? Math.min(1, st.amp * 1.2) : 0.9 - st.amp * 0.5 + st.flash
                cx.lineWidth = pass ? 2.2 : 1.5 + st.flash * 3
                cx.stroke()
            }
            cx.globalAlpha = 1
            raf = requestAnimationFrame(paint)
        }
        raf = requestAnimationFrame(paint)

        function reveal() {
            enter.classList.add('show')
            const ease = 'cubic-bezier(.16,1,.3,1)'
            if (reduce) { [tag, enter, hint].forEach(e => { e.style.opacity = 1 }) }
            else {
                tag.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 800, easing: ease, fill: 'forwards' })
                enter.animate([{ opacity: 0, transform: 'translateY(16px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 150, easing: ease, fill: 'forwards' })
                hint.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 450, fill: 'forwards' })
                root.querySelector('.in-count').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 200, fill: 'forwards' })
            }
            enter.focus({ preventScroll: true })
        }

        function finish() {
            st.done = true
            html.classList.remove('intro-on')
            setGone(true)
            onDoneRef.current && onDoneRef.current()
        }
        function leave() {
            if (st.leaving || !enter.classList.contains('show')) return
            st.leaving = true
            if (reduce) { finish(); return }
            // the voice falls silent, the line flashes, then the screen splits along it
            st.ampTarget = 0
            const ease = 'cubic-bezier(.76,0,.24,1)'
            ;[tag, enter, hint].forEach((e, i) => e.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(10px)' }], { duration: 300, delay: i * 40, fill: 'forwards' }))
            letters.forEach((el, i) => el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-30%)', opacity: 0 }], { duration: 420, delay: 120 + i * 28, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' }))
            later(() => {
                const f0 = performance.now()
                const flash = (now) => { const k = Math.min(1, (now - f0) / 260); st.flash = Math.sin(Math.PI * k); if (k < 1 && !st.done) requestAnimationFrame(flash) }
                requestAnimationFrame(flash)
            }, 380)
            later(() => {
                cv.animate([{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(1.15)' }], { duration: 500, fill: 'forwards' })
                root.querySelector('.in-top').animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-101%)' }], { duration: 1100, easing: ease, fill: 'forwards' })
                const bot = root.querySelector('.in-bot').animate([{ transform: 'translateY(0)' }, { transform: 'translateY(101%)' }], { duration: 1100, easing: ease, fill: 'forwards' })
                // the home page's own entrance plays as the halves part
                later(() => html.classList.remove('intro-on'), 250)
                bot.onfinish = finish
            }, 640)
        }
        const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); leave() } }
        enter.addEventListener('click', leave)
        window.addEventListener('keydown', onKey)

        return () => {
            st.done = true
            cancelAnimationFrame(raf)
            timers.forEach(clearTimeout)
            enter.removeEventListener('click', leave)
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('resize', size)
            window.removeEventListener('resize', unlockWidths)
            root.getAnimations({ subtree: true }).forEach(a => a.cancel())
            html.classList.remove('intro-on')
        }
    }, [])

    if (gone) return null
    return (
        <div id="intro" role="dialog" aria-label="NeuroIntent" aria-modal="true" ref={rootRef}>
            <div className="in-half in-top">
                <div className="in-mark" aria-label="NeuroIntent">
                    <span aria-hidden="true" id="inWord">{[...NAME].map((ch, i) => <span key={i}>{ch}</span>)}</span>
                </div>
            </div>
            <div className="in-half in-bot">
                <div className="in-under">
                    <p className="in-tag">What you say, not how it sounds.</p>
                    <button type="button" className="btn btn-ember btn-lg magnetic in-enter" ref={fxMagnetic}><Roll>Enter</Roll></button>
                    <p className="in-hint">or press Enter</p>
                </div>
                <div className="in-count" aria-hidden="true"><span id="inNum">000</span><span className="in-count-l">tuning the booth</span></div>
            </div>
            <canvas className="in-wave" aria-hidden="true" />
        </div>
    )
}
