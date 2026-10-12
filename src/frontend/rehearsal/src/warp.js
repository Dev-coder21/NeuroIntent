// warp: a two-layer flood from the pressed button, a word, a jump, then the particles burst back.
// The overlay markup (#warp, .warp-a, .warp-b, #warpText) is rendered once by App.
import { reduceMotion } from './stage'

let stage = null
let warping = false

export function setWarpStage(s) { stage = s }
export const isWarping = () => warping

export function warp(fromEl, text, landing) {
    if (reduceMotion()) { landing(); return Promise.resolve() }
    if (warping) return Promise.resolve()
    const w = document.getElementById('warp')
    const word = document.getElementById('warpText')
    if (!w || !word) { landing(); return Promise.resolve() }
    warping = true
    const r = fromEl && fromEl.getBoundingClientRect ? fromEl.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 }
    const x = r.left + r.width / 2, y = r.top + r.height / 2
    w.style.setProperty('--x', x + 'px'); w.style.setProperty('--y', y + 'px')
    word.textContent = text
    w.classList.add('on')
    const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const k = (far * 2 + 40) / 20
    const ease = 'cubic-bezier(.76,0,.24,1)'
    w.querySelector('.warp-a').animate([{ transform: 'scale(0)' }, { transform: `scale(${k})` }], { duration: 620, easing: ease, fill: 'forwards' })
    w.querySelector('.warp-b').animate([{ transform: 'scale(0)' }, { transform: `scale(${k})` }], { duration: 620, delay: 140, easing: ease, fill: 'forwards' })
    word.animate([{ opacity: 0, transform: 'translateY(40%) scale(.9)', letterSpacing: '.2em' }, { opacity: 1, transform: 'none', letterSpacing: '0em' }], { duration: 520, delay: 380, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' })
    return new Promise(done => {
        setTimeout(() => {
            landing()
            if (stage) { stage.snap(); stage.burst() }   // snap the stage, no scrubbing through chapters
            // the flood lifts away like a curtain; the discs' round edge gives it a curved hem
            const out = w.animate([{ transform: 'translateY(0)' }, { transform: `translateY(-${innerHeight + far * 2}px)` }], { duration: 950, easing: ease, fill: 'forwards' })
            word.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.15)' }], { duration: 400, fill: 'forwards' })
            out.onfinish = () => {
                w.classList.remove('on')
                w.getAnimations({ subtree: true }).forEach(an => an.cancel())
                warping = false
                done()
            }
        }, 900)
    })
}
