// The reflection report. Every value shown came from the server; a missing field hides its block,
// failures say so and can be retried here. Each answer splits into a Words column and a Voice column.
import { useState, useEffect, useRef } from 'react'
import { analyzeRecording } from './api'
import { isDemo } from './demo'
import { clamp, reduceMotion } from './stage'
import { useArmed } from './fx'
import { Btn, CountUp } from './Buttons'
import { ROMAN } from './questions'

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isText = (v) => typeof v === 'string' && v.length > 0

// "Pitch variation (normalised std dev, unitless): 0.12" becomes a label and a value.
function splitFact(fact) {
    const s = String(fact)
    const k = s.lastIndexOf(': ')
    return k > 0 ? [s.slice(0, k), s.slice(k + 2)] : [s, '']
}

function ResultBody({ result, open, armed }) {
    const explanation = result.explanation && typeof result.explanation === 'object' ? result.explanation : null
    const feats = explanation && Array.isArray(explanation.top_features)
        ? explanation.top_features.filter(f => f && isText(f.feature) && isNum(f.contribution))
        : []
    const method = explanation ? (explanation.method === 'shap' ? 'SHAP' : explanation.method === 'proxy' ? 'proxy' : null) : null
    const maxAbs = Math.max(0.0001, ...feats.map(f => Math.abs(f.contribution)))
    const delivery = Array.isArray(result.delivery_pattern) ? result.delivery_pattern : []

    return (
        <div className="res">
            <div className="cols">
                <div className="col col-w">
                    <h3 className="col-t">Words</h3>
                    {result.content_score_source === 'proxy' && (
                        <p className="stamp">{isText(result.content_scorer_stamp) ? result.content_scorer_stamp : 'Proxy score, not a trained scorer'}</p>
                    )}
                    {isNum(result.content_score) ? (
                        <div className="blk">
                            <div className="score"><CountUp className="big" value={result.content_score} run={open} duration={1200} /><span className="unit">content score, 0 to 1</span></div>
                            <div className="strack"><i style={{ transform: `scaleX(${armed ? clamp(result.content_score) : 0})` }} /></div>
                        </div>
                    ) : (
                        <p className="muted">The server did not return a content score.</p>
                    )}
                    <p className="muted">Computed from the transcript only. Your voice and delivery are not an input to it.</p>
                    {isText(result.transcript) && (
                        <div className="blk">
                            <p className="blk-t">Transcript</p>
                            <p className="transcript">
                                {result.transcript.split(' ').map((w, j) => <span key={j} style={{ '--d': `${Math.min(j * 18, 1500)}ms` }}>{w} </span>)}
                            </p>
                        </div>
                    )}
                    <details>
                        <summary>Technical details</summary>
                        <div>
                            {isNum(result.content_score_raw) && (
                                <p>Unclipped score (content_score_raw): {result.content_score_raw.toFixed(4)}. The score above is this value limited to the range 0 to 1.</p>
                            )}
                            {isText(result.content_score_source) && <p>Score source: {result.content_score_source}</p>}
                            {isText(result.content_label_source) && (
                                <p>
                                    Trained against: {result.content_label_source}
                                    {result.content_label_source === 'chalearn' && ' (human impressions of video clips, a weak stand-in for the quality of the words alone)'}
                                </p>
                            )}
                        </div>
                    </details>
                </div>

                <div className="col col-v">
                    <h3 className="col-t">Voice</h3>
                    {delivery.length > 0 && (
                        <div className="blk">
                            <p className="blk-t">Delivery measurements, not used in the content score</p>
                            <dl className="facts">
                                {delivery.map((f, j) => {
                                    const [l, v] = splitFact(f)
                                    return <div key={j} style={{ '--fi': j }}><dt>{l}</dt><dd>{v}</dd></div>
                                })}
                            </dl>
                        </div>
                    )}
                    {isNum(result.prosody_only_baseline_score) && isText(result.prosody_only_baseline_label) && (
                        <div className="blk">
                            <p className="blk-t">Baseline comparison</p>
                            <p className="base">{result.prosody_only_baseline_score.toFixed(2)}</p>
                            <p className="muted">{result.prosody_only_baseline_label}</p>
                            <p className="muted">This model looks at the voice measurements only. Its number is in standard-deviation units of the training data, not on the 0 to 1 scale of the content score.</p>
                        </div>
                    )}
                    {method && feats.length > 0 && (
                        <div className="blk">
                            <p className="blk-t">What drove the baseline number (method: {method})</p>
                            <ul className="drv">
                                {feats.map((f, j) => (
                                    <li key={j} style={{ '--i': j }}>
                                        <span className="nm">{f.feature}</span>
                                        <span className="bar" aria-hidden="true">
                                            <i className={f.contribution < 0 ? 'neg' : 'pos'} style={{ transform: `scaleX(${armed ? (Math.abs(f.contribution) / maxAbs).toFixed(3) : 0})` }} />
                                        </span>
                                        <span className="vl">{f.contribution.toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                            {isText(explanation.note) && <p className="muted">{explanation.note}</p>}
                        </div>
                    )}
                </div>
            </div>

            {isText(result.interpretation) && (
                <div className="interp">
                    <p className="blk-t">Interpretation</p>
                    <p className="t">{result.interpretation}</p>
                    {result.interpretation_source === 'template' ? (
                        <p className="muted">This text is filled in from a template. It is not written by a model.</p>
                    ) : isText(result.interpretation_source) ? (
                        <p className="muted">Source: {result.interpretation_source}</p>
                    ) : null}
                </div>
            )}

            <div className="meta">
                <span>Intent label: {result.intent_label === null || result.intent_label === undefined ? 'not part of this milestone.' : String(result.intent_label)}</span>
                {isText(result.mode) && <span>Mode sent: {result.mode}.{isText(result.mode_effect) ? ` Effect: ${result.mode_effect}.` : ''}</span>}
            </div>
        </div>
    )
}

// Mean of the content scores the server returned (answers without a score are left out).
function AverageRing({ results }) {
    const vals = results.filter(r => r && isNum(r.content_score)).map(r => clamp(r.content_score))
    const arcRef = useRef(null)
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    const C = 2 * Math.PI * 52
    useEffect(() => {
        if (avg === null) return undefined
        let r2 = 0
        const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => { if (arcRef.current) arcRef.current.style.strokeDashoffset = String(C * (1 - avg)) }) })
        return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
    }, [avg, C])
    if (avg === null) return null
    return (
        <div className="avg" aria-label={`Average content score ${avg.toFixed(2)} across ${vals.length} answers`}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="52" className="avg-track" />
                <circle cx="60" cy="60" r="52" className="avg-arc" ref={arcRef} style={{ strokeDasharray: C, strokeDashoffset: C }} />
            </svg>
            <div className="avg-in"><CountUp className="avg-v" value={avg} delay={350} /><span className="avg-l">average content score</span></div>
        </div>
    )
}

function ReportScreen({ recordings, results: initialResults, errors: initialErrors = [], setStatus, onWithdraw }) {
    // Open the first answer that has a result.
    const [open, setOpen] = useState(() => initialResults.findIndex(r => r))
    const [results, setResults] = useState(initialResults)
    const [errors, setErrors] = useState(initialErrors)
    const [retrying, setRetrying] = useState([])
    const [seen, setSeen] = useState([])
    const rootRef = useRef(null)
    const armedOpen = useArmed(open)
    const gaugesOn = useArmed('gauges') === 'gauges'

    useEffect(() => { setStatus('') }, [setStatus])

    const abortRef = useRef(null)
    useEffect(() => {
        const controller = new AbortController()
        abortRef.current = controller
        return () => controller.abort()
    }, [])

    // Answer cards rise in as they scroll into view (including cards that appear after a retry).
    useEffect(() => {
        const cards = [...rootRef.current.querySelectorAll('.ans')]
        if (!('IntersectionObserver' in window) || reduceMotion()) {
            const all = cards.map(c => c.id)
            const id = requestAnimationFrame(() => setSeen(all))
            return () => cancelAnimationFrame(id)
        }
        const io = new IntersectionObserver(es => es.forEach(e => {
            if (e.isIntersecting) {
                io.unobserve(e.target)
                setSeen(prev => (prev.includes(e.target.id) ? prev : [...prev, e.target.id]))
            }
        }), { threshold: 0.12 })
        cards.forEach(c => io.observe(c))
        return () => io.disconnect()
    }, [results])

    const retryAnswer = async (i) => {
        setRetrying(prev => [...prev, i])
        try {
            const data = await analyzeRecording(recordings[i], i, { signal: abortRef.current.signal })
            setResults(prev => prev.map((r, j) => (j === i ? data : r)))
            setErrors(prev => prev.map((e, j) => (j === i ? null : e)))
            setOpen(i)
        } catch (err) {
            if (abortRef.current.signal.aborted) return
            const failure = { userMessage: err.userMessage || err.message || 'Unknown error', detail: err.detail || null }
            setErrors(prev => prev.map((e, j) => (j === i ? failure : e)))
        } finally {
            setRetrying(prev => prev.filter(j => j !== i))
        }
    }

    const pick = (i) => {
        if (results[i]) setOpen(i)
        const el = document.getElementById(`ans-${i}`)
        if (el) el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
    }

    const smoke = results.some(r => r && r.smoke_artifacts === true)
    const title = 'Your reflection report'.split(' ')

    return (
        <section className="screen enter" ref={rootRef}>
            <div className="report">
                {smoke && <div className="smoke" role="alert">Smoke-test artifacts, not results</div>}
                <div className="rep-head enter">
                    <div>
                        <h1 className="rep-title">
                            {title.map((w, i) => <span key={i}><span className="w"><span style={{ '--i': i }}>{w}</span></span>{i < title.length - 1 ? ' ' : ''}</span>)}
                        </h1>
                        <p className="sub rep-sub">What the system returned for each answer. Words and voice are reported separately, and only the words feed the content score.</p>
                    </div>
                    <AverageRing results={results} />
                </div>

                <div className="summary">
                    {recordings.map((rec, i) => {
                        const r = results[i], ok = r && isNum(r.content_score)
                        return (
                            <button type="button" key={i} className={`sum ${ok ? '' : 'missing'}`} style={{ '--i': i }} onClick={() => pick(i)}
                                aria-label={`Answer ${i + 1}: ${ok ? 'content score ' + r.content_score.toFixed(2) : 'no score'}`}>
                                {ok ? <CountUp className="v" value={r.content_score} delay={500 + i * 110} /> : <span className="v">n/a</span>}
                                <span className="gauge"><i style={{ transform: `scaleX(${gaugesOn && ok ? clamp(r.content_score) : 0})` }} /></span>
                                <span className="l">Answer {ROMAN[i]}</span>
                            </button>
                        )
                    })}
                </div>

                <div className="answers">
                    {recordings.map((rec, i) => {
                        const r = results[i]
                        const inView = seen.includes(`ans-${i}`) ? ' in' : ''
                        if (!r) {
                            const failure = errors[i]
                            return (
                                <article key={i} className={`ans failed${inView}`} id={`ans-${i}`}>
                                    <div className="ans-head"><span className="n">{ROMAN[i]}.</span><span className="q">{rec.question}</span></div>
                                    <div className="fail">
                                        <p className="err">This answer could not be analysed, so there is no score for it.</p>
                                        {failure && (
                                            <>
                                                <p className="err">{failure.userMessage}</p>
                                                {failure.detail && failure.detail !== failure.userMessage && <p className="raw">Raw detail: {failure.detail}</p>}
                                            </>
                                        )}
                                        <Btn className="btn-ember btn-xs" onClick={() => retryAnswer(i)} disabled={retrying.includes(i)}>
                                            {retrying.includes(i) ? 'Retrying…' : 'Retry this answer'}
                                        </Btn>
                                    </div>
                                </article>
                            )
                        }
                        const isOpen = open === i
                        return (
                            <article key={i} className={`ans${isOpen ? ' open' : ''}${inView}`} id={`ans-${i}`}>
                                <button type="button" className="ans-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : i)}>
                                    <span className="n">{ROMAN[i]}.</span>
                                    <span className="q">{rec.question}</span>
                                    {isNum(r.content_score) && <span className="peek">{r.content_score.toFixed(2)}</span>}
                                    <span className="chev" aria-hidden="true" />
                                </button>
                                <div className="ans-body" inert={!isOpen}>
                                    <div className="ans-inner"><ResultBody result={r} open={isOpen} armed={isOpen && armedOpen === i} /></div>
                                </div>
                            </article>
                        )
                    })}
                </div>

                <div className="rep-foot">
                    <p className="privacy">
                        {isDemo()
                            ? 'The answers and scores shown here are samples for this demo.'
                            : 'Nothing is stored. Your audio is deleted right after analysis.'}
                    </p>
                    <Btn className="btn-line btn-sm" onClick={onWithdraw}>Withdraw consent and clear this report</Btn>
                </div>
            </div>
        </section>
    )
}

export default ReportScreen
