// Rolling-label buttons and count-ups from the design.
import { useEffect, useRef } from 'react'
import { reduceMotion, clamp } from './stage'
import { fxMagnetic, fxRipple } from './fx'

export function Roll({ children }) {
    return (
        <span className="roll">
            <span className="roll-a">{children}</span>
            <span className="roll-b" aria-hidden="true">{children}</span>
        </span>
    )
}

// A .btn whose plain-text label rolls on hover. Any other content is rendered as given.
export function Btn({ children, className = '', magnetic = false, type = 'button', ...rest }) {
    const label = typeof children === 'string' ? <Roll>{children}</Roll> : children
    return (
        <button type={type} className={`btn ${magnetic ? 'magnetic ' : ''}${className}`} ref={magnetic ? fxMagnetic : fxRipple} {...rest}>
            {label}
        </button>
    )
}

// Counts from 0 to value (2 decimals) by writing the text directly, once `run` turns true.
export function CountUp({ value, run = true, delay = 0, duration = 1300, className, ...rest }) {
    const ref = useRef(null)
    useEffect(() => {
        const el = ref.current
        if (!el) return undefined
        if (!run) { el.textContent = '0.00'; return undefined }
        if (reduceMotion()) { el.textContent = value.toFixed(2); return undefined }
        let raf = 0
        const t0 = performance.now() + delay
        const step = (now) => {
            const t = clamp((now - t0) / duration)
            el.textContent = (value * (1 - Math.pow(1 - t, 3))).toFixed(2)
            if (t < 1) raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
        return () => cancelAnimationFrame(raf)
    }, [value, run, delay, duration])
    return <span ref={ref} className={className} {...rest}>0.00</span>
}

