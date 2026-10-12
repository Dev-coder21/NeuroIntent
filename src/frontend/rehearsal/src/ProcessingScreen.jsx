// Sends each answer to POST /analyze in turn: sequential requests, per-answer typed errors shown in
// the answer's row, retry only the failures, never invent a result.
import { useState, useEffect, useRef, useCallback } from 'react'
import { analyzeRecording } from './api'
import { reduceMotion } from './stage'
import { Btn } from './Buttons'
import { ROMAN } from './questions'

const LABEL = { waiting: 'Waiting', processing: 'Analysing', done: 'Done', error: "Couldn't analyse" }
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// The big counter: each new answer drops in.
function Counter({ value }) {
    const ref = useRef(null)
    const last = useRef(value)
    useEffect(() => {
        if (value > last.current && ref.current && !reduceMotion()) {
            ref.current.animate([{ transform: 'translateY(45%) scale(.9)', opacity: 0, filter: 'blur(8px)' }, { transform: 'none', opacity: 1, filter: 'none' }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' })
        }
        last.current = value
    }, [value])
    return <span className="cnum" ref={ref}>{value}</span>
}

// A returned score pops in when its row finishes.
function ScorePop({ value }) {
    const ref = useRef(null)
    useEffect(() => {
        if (ref.current && !reduceMotion()) {
            ref.current.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 600, easing: 'ease-out' })
        }
    }, [])
    return <span className="sc" ref={ref}>{value.toFixed(2)}</span>
}

function Pipe() {
    return (
        <svg className="pipe" viewBox="0 0 420 120" aria-hidden="true">
            <path id="pw" d="M10 60 H150 C200 60 210 22 260 22 H410" className="pipe-w" />
            <path id="pv" d="M150 60 C200 60 210 98 260 98 H410" className="pipe-v" />
            <circle cx="10" cy="60" r="5" className="pipe-node" />
            <circle cx="150" cy="60" r="5" className="pipe-node" />
            <circle r="4" className="pipe-dot-w"><animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#pw" /></animateMotion></circle>
            <circle r="4" className="pipe-dot-w"><animateMotion dur="1.8s" begin="-.9s" repeatCount="indefinite"><mpath href="#pw" /></animateMotion></circle>
            <circle r="4" className="pipe-dot-v"><animateMotion dur="1.8s" begin="-.45s" repeatCount="indefinite"><mpath href="#pv" /></animateMotion></circle>
            <circle r="4" className="pipe-dot-v"><animateMotion dur="1.8s" begin="-1.35s" repeatCount="indefinite"><mpath href="#pv" /></animateMotion></circle>
            <text x="10" y="88" className="pipe-t">Your answer</text>
            <text x="410" y="14" textAnchor="end" className="pipe-t">Words, scored</text>
            <text x="410" y="118" textAnchor="end" className="pipe-t pipe-tv">Voice, measured</text>
        </svg>
    )
}

function ProcessingScreen({ recordings, setStatus, onComplete }) {
    const n = recordings.length
    const [statuses, setStatuses] = useState(recordings.map(() => 'waiting'))
    const [errors, setErrors] = useState(recordings.map(() => null))
    const [results, setResults] = useState(recordings.map(() => null))
    const [needsAttention, setNeedsAttention] = useState(false)

    const resultsRef = useRef(recordings.map(() => null))
    const errorsRef = useRef(recordings.map(() => null))
    const abortRef = useRef(null)

    const onCompleteRef = useRef(onComplete)
    useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

    const processRecordings = useCallback(async (indices, signal) => {
        setNeedsAttention(false)
        for (const i of indices) {
            if (signal.aborted) return
            errorsRef.current[i] = null
            setStatuses(prev => prev.map((s, j) => (j === i ? 'processing' : s)))
            setErrors(prev => prev.map((e, j) => (j === i ? null : e)))
            try {
                const data = await analyzeRecording(recordings[i], i, { signal })
                resultsRef.current[i] = data
                setResults(prev => prev.map((r, j) => (j === i ? data : r)))
                setStatuses(prev => prev.map((s, j) => (j === i ? 'done' : s)))
            } catch (err) {
                if (signal.aborted) return
                const failure = { userMessage: err.userMessage || err.message || 'Unknown error', detail: err.detail || null }
                resultsRef.current[i] = null
                errorsRef.current[i] = failure
                setStatuses(prev => prev.map((s, j) => (j === i ? 'error' : s)))
                setErrors(prev => prev.map((e, j) => (j === i ? failure : e)))
            }
        }
        if (signal.aborted) return
        if (resultsRef.current.every(r => r !== null)) {
            // Let the last score land before the report opens
            setTimeout(() => {
                if (!signal.aborted) onCompleteRef.current([...resultsRef.current], [...errorsRef.current])
            }, 900)
        } else {
            setNeedsAttention(true)
        }
    }, [recordings])

    useEffect(() => {
        const controller = new AbortController()
        abortRef.current = controller
        const timer = setTimeout(() => processRecordings(recordings.map((_, i) => i), controller.signal), 500)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [recordings, processRecordings])

    const retryFailed = () => {
        const failed = resultsRef.current.map((r, i) => (r === null ? i : -1)).filter(i => i >= 0)
        processRecordings(failed, abortRef.current.signal)
    }

    const doneCount = statuses.filter(s => s === 'done').length
    useEffect(() => { setStatus(`${doneCount} of ${n} analysed`) }, [doneCount, n, setStatus])

    const cur = statuses.indexOf('processing')

    return (
        <section className="screen proc enter">
            <div className="proc-stage">
                <div className="count" aria-hidden="true"><Counter value={doneCount} /><span className="cden">/{n}</span></div>
                <p className="count-l">answers analysed</p>
                <Pipe />
                <p className="now">
                    {cur >= 0 ? <><span className="now-l">Now analysing</span>{recordings[cur].question}</>
                        : doneCount === n ? <><span className="now-l">All done</span>Opening your report</>
                            : needsAttention ? <><span className="now-l">Stopped</span>Some answers need another try</> : null}
                </p>
            </div>
            <div className="proc-panel">
                <h1>Analysing your answers</h1>
                <p className="sub">The first answer can take a minute or more while the server loads its models; later ones are faster. Keep this tab open.</p>
                <div className="bar-prog" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={doneCount}>
                    <i style={{ width: `${(doneCount / n) * 100}%` }} />
                </div>
                <ol className="plist">
                    {recordings.map((rec, i) => (
                        <li key={i} className={statuses[i]} style={{ '--i': i }}>
                            <span className="n">{ROMAN[i]}.</span>
                            <span className="q">
                                {rec.question}
                                <span className="mtrack" aria-hidden="true"><i /></span>
                                {statuses[i] === 'error' && errors[i] && (
                                    <>
                                        <span className="err" role="alert">{errors[i].userMessage}</span>
                                        {errors[i].detail && errors[i].detail !== errors[i].userMessage && (
                                            <span className="raw">Raw detail: {errors[i].detail}</span>
                                        )}
                                    </>
                                )}
                            </span>
                            <span className="s">
                                <span className="s-txt">{LABEL[statuses[i]]}</span>
                                {statuses[i] === 'done' && results[i] && isNum(results[i].content_score) && <ScorePop value={results[i].content_score} />}
                            </span>
                        </li>
                    ))}
                </ol>

                {needsAttention && (
                    <div className="proc-attn">
                        <p className="sub">
                            {doneCount === 0
                                ? 'None of your answers could be analysed, so there are no results yet.'
                                : 'Some answers could not be analysed.'}
                        </p>
                        <div className="rec-actions">
                            <Btn className="btn-ember btn-sm" magnetic onClick={retryFailed}>Retry failed answers</Btn>
                            {doneCount > 0 && (
                                <Btn className="btn-line btn-sm" onClick={(e) => onComplete([...resultsRef.current], [...errorsRef.current], e.currentTarget)}>
                                    View report for the answers that worked
                                </Btn>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}

export default ProcessingScreen
