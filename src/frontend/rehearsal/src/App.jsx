// The booth: intro, then the home story over a WebGL particle stage, then the rehearsal
// (record → analyse → report) inside that same stage. Design source: demos/neurointent-booth-final.html.
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createStage } from './stage'
import { warp, setWarpStage } from './warp'
import { fxRipple } from './fx'
import { Roll } from './Buttons'
import { isDemo } from './demo'
import Intro from './Intro'
import Home from './Home'
import RecordingScreen from './RecordingScreen'
import ProcessingScreen from './ProcessingScreen'
import ReportScreen from './ReportScreen'

function App() {
    // the intro gate plays once per browser session, not on every reload
    const [introSeen] = useState(() => { try { return sessionStorage.getItem('ni-intro') === '1' } catch { return false } })
    const [screen, setScreen] = useState('home') // 'home' | 'rec' | 'proc' | 'report'
    const [status, setStatus] = useState('')
    const [consentData, setConsentData] = useState(null)
    const [recordings, setRecordings] = useState([])
    const [results, setResults] = useState([])
    const [errors, setErrors] = useState([])

    const stageRef = useRef(null)
    // The stage is created from the canvas's ref callback, which runs before any effect, so child
    // screens can use stageRef in their own effects.
    const attachStage = useCallback((canvas) => {
        const stage = createStage(canvas)
        stageRef.current = stage
        setWarpStage(stage)
        return () => {
            stage.destroy()
            stageRef.current = null
            setWarpStage(null)
        }
    }, [])

    const appMode = screen !== 'home'
    useEffect(() => {
        document.documentElement.classList.toggle('app-on', appMode)
    }, [appMode])

    // Every new screen starts at the top. The stage moves to the screen's position at the same moment
    // (synchronously, so a warp landing can snap to it).
    const go = useCallback((next) => {
        if (stageRef.current && next !== 'home') stageRef.current.toScreen(next)
        setScreen(next)
    }, [])
    useLayoutEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' })
    }, [screen])

    const begin = (btn, data) => {
        warp(btn, 'Question i', () => {
            setConsentData(data)
            setRecordings([])
            setResults([])
            setErrors([])
            setStatus('')
            go('rec')
        })
    }

    const handleRecordingComplete = (data, btn) => {
        warp(btn, 'Analysing', () => {
            setRecordings(data)
            go('proc')
        })
    }

    const handleProcessingComplete = (data, errorList = [], btn = null) => {
        warp(btn, 'Your report', () => {
            setResults(data)
            setErrors(errorList)
            go('report')
        })
    }

    // Withdrawing consent drops everything held in memory and returns to the hero.
    // Leaving a screen unmounts it, which also stops the microphone and cancels requests in flight.
    const withdrawNow = () => {
        setConsentData(null)
        setRecordings([])
        setResults([])
        setErrors([])
        setStatus('')
        const stage = stageRef.current
        if (stage) {
            stage.scene.levelTarget = 0
            stage.scene.morphTarget = 0
            stage.scene.morph = 0
        }
        setScreen('home')
    }
    const withdraw = (e) => warp(e && e.currentTarget, 'All cleared', withdrawNow)

    const introDone = () => {
        try { sessionStorage.setItem('ni-intro', '1') } catch { /* storage unavailable */ }
        const cta = document.querySelector('.hero .btn-ember')
        if (cta) cta.focus({ preventScroll: true })
    }

    return (
        <>
            {!introSeen && <Intro onDone={introDone} />}
            <canvas id="gl" ref={attachStage} aria-hidden="true" />
            <div className="vignette" aria-hidden="true" />

            <header className="bar">
                <a className="brand" href="#top" onClick={(e) => { if (appMode) e.preventDefault() }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12h6c3 0 4-6 7-6h7" stroke="#1B1722" strokeWidth="2" strokeLinecap="round" /><path d="M8 12c3 0 4 6 7 6h7" stroke="#3E6B66" strokeWidth="2" strokeLinecap="round" /></svg>
                    NeuroIntent
                    {isDemo() && <span className="pill pill-demo" title="Demo mode: every result is sample data, not model output">demo data</span>}
                </a>
                <div className="bar-right">
                    <span className="bar-status">{status}</span>
                    {appMode && (
                        <button type="button" className="btn btn-exit" ref={fxRipple} onClick={withdraw}>
                            <svg className="exit-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                            <Roll>Withdraw consent</Roll>
                        </button>
                    )}
                </div>
            </header>

            {screen === 'home' && <Home stageRef={stageRef} onBegin={begin} />}
            {appMode && (
                <div id="app">
                    {screen === 'rec' && (
                        <RecordingScreen consentData={consentData} stageRef={stageRef} setStatus={setStatus} onComplete={handleRecordingComplete} />
                    )}
                    {screen === 'proc' && (
                        <ProcessingScreen recordings={recordings} setStatus={setStatus} onComplete={handleProcessingComplete} />
                    )}
                    {screen === 'report' && (
                        <ReportScreen recordings={recordings} results={results} errors={errors} setStatus={setStatus} onWithdraw={withdraw} />
                    )}
                </div>
            )}

            <div id="warp" aria-hidden="true">
                <div className="warp-disc warp-a" />
                <div className="warp-disc warp-b" />
                <div className="warp-word"><span className="warp-line" id="warpText">Into the booth</span></div>
            </div>
        </>
    )
}

export default App
