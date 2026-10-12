// Button effects from the design: a press ripple and the magnetic lean.
// They attach through React 19 ref callbacks (which return their own cleanup).
import { useEffect, useState } from 'react'
import { reduceMotion } from './stage'

function attach(el, { ripple, magnetic }) {
    if (!el) return undefined
    const reduce = reduceMotion()
    const offs = []
    const on = (type, fn) => { el.addEventListener(type, fn); offs.push(() => el.removeEventListener(type, fn)) }
    if (ripple) {
        on('pointerdown', (e) => {
            if (el.disabled || reduce) return
            const r = el.getBoundingClientRect(), d = Math.hypot(r.width, r.height) * 2
            const rp = document.createElement('span')
            rp.className = 'ripple'
            rp.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${d}px;height:${d}px`
            el.appendChild(rp)
            rp.animate([{ transform: 'translate(-50%,-50%) scale(0)', opacity: 0.32 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => rp.remove()
        })
    }
    if (magnetic && !reduce) {
        // magnetic buttons lean toward the pointer
        on('pointermove', (e) => {
            const r = el.getBoundingClientRect()
            const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2)
            el.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`
        })
        on('pointerleave', () => { el.style.transform = '' })
    }
    return () => offs.forEach(fn => fn())
}

// Stable ref callbacks, so React does not re-attach on every render.
export const fxRipple = (el) => attach(el, { ripple: true })
export const fxMagnetic = (el) => attach(el, { ripple: true, magnetic: true })
export const fxMagnetOnly = (el) => attach(el, { magnetic: true })

// Returns `key` two frames after it changes (null before that), so CSS transitions run from their resting state.
export function useArmed(key) {
    const [armed, setArmed] = useState(null)
    useEffect(() => {
        let r2 = 0
        const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setArmed(key)) })
        return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
    }, [key])
    return armed === key ? key : null
}
