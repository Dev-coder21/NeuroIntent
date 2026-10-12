// Home: the scroll story (chapters i–v) over the particle stage, ending in the consent card.
// Scrolling scrubs the stage's formation; each chapter also sets where the scene sits and how bright it is.
// Consent rules are unchanged: the first switch is required, the second optional, neither is ever pre-set.
import { useEffect, useRef, useState } from 'react'
import { clamp, lerp, smooth } from './stage'
import { warp } from './warp'
import { fxMagnetic } from './fx'
import { Btn, Roll } from './Buttons'

const SCENE = {
    hero: { shift: 0.3, dim: 1 },
    one: { shift: 0.28, dim: 0.95 },
    two: { shift: -0.47, dim: 1 },
    three: { shift: 0.4, dim: 1 },
    four: { shift: 0, dim: 0.3 },
    start: { shift: 0, dim: 0.75 },
}

function Switch({ id, checked, onChange, children }) {
    return (
        <button type="button" role="switch" aria-checked={checked} className="switch" id={id} onClick={() => onChange(!checked)}>
            <span className="knob" aria-hidden="true" />
            <span className="sw-text">{children}</span>
        </button>
    )
}

export default function Home({ stageRef, onBegin }) {
    const [research, setResearch] = useState(false)
    const [asd, setAsd] = useState(false)
    const storyRef = useRef(null)

    // Scroll-scrubbing: register the morph-target function with the stage while the story is mounted.
    useEffect(() => {
        const stage = stageRef.current
        const story = storyRef.current
        if (!stage || !story) return undefined
        const { scene } = stage
        const isNarrow = () => innerWidth < 860
        let layout = null
        const byId = (id) => document.getElementById(id)
        const measure = () => {
            const y = scrollY, vh = innerHeight
            const top = (id) => byId(id).getBoundingClientRect().top + y
            const t3 = top('s-three'), h3 = byId('s-three').offsetHeight
            layout = {
                vh, t3, h3,
                anchors: [[0, 0], [top('s-one') - vh * 0.35, 1], [top('s-two') - vh * 0.35, 2], [t3, 2], [t3 + h3 - vh, 3], [top('s-four') - vh * 0.2, 3], [top('s-start') - vh * 0.45, 4]],
                sections: [...story.querySelectorAll('[data-scene]')].map(el => [el.dataset.scene, top(el.id), top(el.id) + el.offsetHeight]),
            }
        }
        const invalidate = () => { layout = null }
        window.addEventListener('resize', invalidate)
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(invalidate)
        const ro = new ResizeObserver(invalidate)
        ro.observe(story)

        const ui3 = { num: byId('biasNum'), bar: byId('biasBar'), steady: byId('steady'), tag: byId('stateTag'), last: -1, lastTag: '' }
        const storyTarget = () => {
            if (!layout) measure()
            const { vh, t3, h3, anchors, sections } = layout, y = scrollY
            let m = anchors[anchors.length - 1][1]
            for (let i = 0; i < anchors.length - 1; i++) {
                const [ya, ma] = anchors[i], [yb, mb] = anchors[i + 1]
                if (y <= ya) { m = ma; break }
                if (y < yb) { m = lerp(ma, mb, (y - ya) / Math.max(1, yb - ya)); break }
            }
            const mid = y + vh * 0.5
            let cur = 'hero'
            for (const [name, a, b] of sections) if (a <= mid && b > mid) cur = name
            const sc = SCENE[cur]
            // On phones the text sits low, so the scene moves into the upper half instead of to one side.
            scene.shiftTarget = isNarrow() ? 0 : sc.shift
            scene.shiftYTarget = isNarrow() && (cur === 'one' || cur === 'two' || cur === 'three') ? 0.42 : 0
            scene.dimTarget = isNarrow() ? (cur === 'hero' ? 0.6 : sc.dim * 0.9) : sc.dim
            // chapter iii readouts follow the flatten progress
            const s3 = smooth(clamp((clamp((y - t3) / Math.max(1, h3 - vh)) - 0.1) / 0.75))
            const d = Math.round(lerp(0.81, 0.38, s3) * 100) / 100
            if (d !== ui3.last) {
                ui3.last = d
                ui3.num.textContent = d.toFixed(2)
                ui3.bar.style.transform = `scaleX(${d})`
                ui3.steady.style.opacity = clamp(s3 * 3 - 0.3).toFixed(2)
            }
            const tag = s3 < 0.5 ? 'Lively pitch, steady pace' : 'Flat pitch, longer pauses'
            if (tag !== ui3.lastTag) { ui3.lastTag = tag; ui3.tag.textContent = tag }
            return m
        }
        stage.setStoryTarget(storyTarget)

        // ground rules light up as they scroll in
        let io = null
        const rules = story.querySelectorAll('.rule')
        if ('IntersectionObserver' in window) {
            io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }), { threshold: 0.4 })
            rules.forEach(r => io.observe(r))
        } else rules.forEach(r => r.classList.add('in'))

        return () => {
            stage.setStoryTarget(null)
            window.removeEventListener('resize', invalidate)
            ro.disconnect()
            if (io) io.disconnect()
        }
    }, [stageRef])

    // "Start a rehearsal" jumps straight to the booth card with the warp.
    const goToBooth = (e) => {
        e.preventDefault()
        const btn = e.currentTarget
        warp(btn, 'Into the booth', () => {
            const start = document.getElementById('s-start')
            window.scrollTo({ top: start.getBoundingClientRect().top + scrollY, behavior: 'instant' })
        }).then(() => { const sw = document.getElementById('swConsent'); if (sw) sw.focus({ preventScroll: true }) })
    }

    return (
        <main id="story" ref={storyRef}>
            <section className="hero" id="top" data-scene="hero">
                <h1>
                    <span className="reveal h-a"><span style={{ '--d': '.15s' }}>Same words</span></span>
                    <span className="reveal h-b"><span style={{ '--d': '.32s' }}>same score.</span></span>
                </h1>
                <div className="hero-foot">
                    <p className="lede fade" style={{ '--d': '.7s' }}>A rehearsal booth for interview answers. NeuroIntent scores what you said from the transcript alone, and keeps your pitch, pace and pauses out of that score.</p>
                    <div className="hero-cta fade" style={{ '--d': '.85s' }}>
                        <a className="btn btn-ember btn-lg magnetic warp-go" href="#s-start" ref={fxMagnetic} onClick={goToBooth}><Roll>Start a rehearsal</Roll></a>
                        <span className="hint">Scroll to take an answer apart</span>
                    </div>
                </div>
            </section>

            <section className="chap" id="s-one" data-scene="one">
                <div className="chap-text">
                    <span className="stage-num">i.</span>
                    <h2>Every answer arrives as one signal</h2>
                    <p>In a recording, what you said and how you said it are tangled together. Most automated interview tools score the whole tangle, so a flat pitch or a long pause can cost points that have nothing to do with the answer.</p>
                </div>
            </section>

            <section className="chap chap-right" id="s-two" data-scene="two">
                <div className="chap-text">
                    <span className="stage-num">ii.</span>
                    <h2>Pull it into two</h2>
                    <p>Whisper writes the words down and RoBERTa reads them. openSMILE takes 62 measurements of the voice. The model is trained to keep the two representations statistically independent, so the two sit at right angles, like two walls of a corner.</p>
                    <ul className="legend">
                        <li><span className="dot dot-bone" /><span><b>C</b> the words: what you said</span></li>
                        <li><span className="dot dot-ember" /><span><b>D</b> the voice: how it sounded</span></li>
                    </ul>
                </div>
            </section>

            <section className="pin" id="s-three" data-scene="three">
                <div className="pin-stage">
                    <span className="stage-num">iii.</span>
                    <h2>Flatten the voice</h2>
                    <p className="quote">“I rebuilt our reporting jobs so they finish in forty minutes instead of six hours.”</p>
                    <div className="meters">
                        <div className="m-bias">
                            <div className="meter-row"><span>A scorer that listens to delivery</span><span className="meter-num" id="biasNum">0.81</span></div>
                            <div className="track"><i id="biasBar" style={{ transform: 'scaleX(.81)' }} /></div>
                        </div>
                        <div className="m-content">
                            <div className="meter-row"><span>Content score, from the words only</span><span className="meter-num">0.74</span></div>
                            <div className="track"><i /></div>
                            <span className="steady" id="steady" style={{ opacity: 0 }}>Unchanged</span>
                        </div>
                    </div>
                    <p className="state-tag" id="stateTag">Lively pitch, steady pace</p>
                    <p className="footnote">Keep scrolling to flatten the delivery. This illustrates the problem the project studies; these numbers are made up for this page.</p>
                </div>
            </section>

            <section className="rules" id="s-four" data-scene="four">
                <span className="stage-num">iv.</span>
                <h2>Ground rules</h2>
                <div className="rules-list">
                    <p className="rule"><strong>No diagnosis</strong><span>It does not detect or diagnose autism or any other condition.</span></p>
                    <p className="rule"><strong>No coaching to sound different</strong><span>It interprets you as you speak. It never suggests you should change how you talk.</span></p>
                    <p className="rule"><strong>Nothing stored</strong><span>Answers are sent to the analysis server, processed, and deleted straight after.</span></p>
                </div>
            </section>

            <section className="start" id="s-start" data-scene="start">
                <div className="booth-card">
                    <span className="stage-num">v.</span>
                    <h2>Step into the booth</h2>
                    <p className="lede-sm" style={{ color: 'var(--mute)', marginTop: '1rem' }}>You'll answer five interview questions out loud and can re-record any answer before moving on.</p>
                    <div className="switches">
                        <Switch id="swConsent" checked={research} onChange={setResearch}>
                            <span className="sw-label">I consent to my recorded answers being sent to the analysis server and processed there. <span className="sw-tag">(required)</span></span>
                        </Switch>
                        <Switch id="swAsd" checked={asd} onChange={setAsd}>
                            <span className="sw-label">I identify as autistic / ASD. <span className="sw-tag">(optional)</span></span>
                            <span className="sw-hint">Sent to the server as the "speaker_declared" mode. In this milestone it does not change the analysis.</span>
                        </Switch>
                    </div>
                    <Btn className="btn-ember btn-block" magnetic id="begin" disabled={!research}
                        onClick={(e) => { if (research) onBegin(e.currentTarget, { researchConsent: research, asdConsent: asd }) }}>
                        Begin rehearsal
                    </Btn>
                    <p className="fine" id="beginHint">
                        {research
                            ? 'You can withdraw consent at any point; that brings you back here and clears everything.'
                            : 'Turn on the first switch to begin.'}
                    </p>
                </div>
            </section>
        </main>
    )
}
