// Records one answer per question with MediaRecorder: keep or redo each take, the mic is released on
// stop, withdraw and unmount. Live microphone levels drive the particle ring (the stage's uLevel).
import { useState, useRef, useEffect } from 'react'
import { clamp } from './stage'
import { warp, isWarping } from './warp'
import { fxMagnetOnly } from './fx'
import { Btn } from './Buttons'
import { isDemo } from './demo'
import { QUESTIONS, ROMAN } from './questions'

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function QuestionText({ text }) {
    const words = text.split(' ')
    return words.map((w, i) => (
        <span key={i}><span className="w"><span style={{ '--i': i }}>{w}</span></span>{i < words.length - 1 ? ' ' : ''}</span>
    ))
}

function RecordingScreen({ consentData, stageRef, setStatus, onComplete }) {
    const [questionIndex, setQuestionIndex] = useState(0)
    const [recordingState, setRecordingState] = useState('idle') // 'idle' | 'recording' | 'done'
    const [micError, setMicError] = useState(null)
    const [seconds, setSeconds] = useState(0)

    const recordingsRef = useRef([])
    const mediaRecorderRef = useRef(null)
    const audioChunksRef = useRef([])
    const audioContextRef = useRef(null)
    const levelRafRef = useRef(0)
    const simRef = useRef(0)
    const timerRef = useRef(null)

    const setLevel = (v) => { if (stageRef.current) stageRef.current.scene.levelTarget = v }

    const releaseMicrophone = () => {
        cancelAnimationFrame(levelRafRef.current)
        cancelAnimationFrame(simRef.current)
        simRef.current = 0
        clearInterval(timerRef.current)
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close()
        audioContextRef.current = null
        const recorder = mediaRecorderRef.current
        if (recorder) {
            if (recorder.state !== 'inactive') recorder.stop()
            recorder.stream.getTracks().forEach(t => t.stop())
        }
        mediaRecorderRef.current = null
    }

    // Leaving this screen (including withdrawing consent) switches the microphone off.
    useEffect(() => {
        const stage = stageRef.current
        return () => {
            cancelAnimationFrame(levelRafRef.current)
            cancelAnimationFrame(simRef.current)
            clearInterval(timerRef.current)
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close()
            const recorder = mediaRecorderRef.current
            if (recorder) {
                if (recorder.state !== 'inactive') recorder.stop()
                recorder.stream.getTracks().forEach(t => t.stop())
            }
            if (stage) stage.scene.levelTarget = 0
        }
    }, [stageRef])

    useEffect(() => {
        setStatus(`Question ${questionIndex + 1} of ${QUESTIONS.length}`)
    }, [questionIndex, setStatus])

    const beginTake = () => {
        setSeconds(0)
        clearInterval(timerRef.current)
        timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
        setRecordingState('recording')
    }

    const startRecording = async () => {
        setMicError(null)
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw Object.assign(new Error('this browser does not offer microphone access on this page'), { name: 'NotSupportedError' })
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            mediaRecorderRef.current = new MediaRecorder(stream)
            audioChunksRef.current = []
            mediaRecorderRef.current.ondataavailable = (e) => { audioChunksRef.current.push(e.data) }

            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            audioContextRef.current = ctx
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 256
            ctx.createMediaStreamSource(stream).connect(analyser)
            const data = new Uint8Array(analyser.frequencyBinCount)
            const loop = () => {
                analyser.getByteFrequencyData(data)
                let sum = 0
                for (let i = 2; i < 48; i++) sum += data[i]
                setLevel(clamp((sum / 46 / 255) * 2.6))
                levelRafRef.current = requestAnimationFrame(loop)
            }
            loop()

            mediaRecorderRef.current.start()
            beginTake()
        } catch (err) {
            releaseMicrophone()
            setMicError(
                err && err.name === 'NotAllowedError'
                    ? 'Microphone access was denied. Allow microphone access for this page in your browser, then press Record again.'
                    : `The microphone could not be used (${err && err.message ? err.message : 'unknown error'}).`
            )
        }
    }

    const stopRecording = () => {
        releaseMicrophone()
        setLevel(0.18)
        setRecordingState('done')
    }

    // Demo mode only: a simulated take with sample levels, so the flow can be shown without a mic.
    const sampleTake = () => {
        setMicError(null)
        audioChunksRef.current = []
        beginTake()
        const start = performance.now(), len = 3400
        const loop = (now) => {
            const t = (now - start) / len
            if (t >= 1) { simRef.current = 0; stopRecording(); return }
            const syll = Math.max(0, Math.sin(now / 95) * 0.5 + Math.sin(now / 37) * 0.3 + 0.35)
            setLevel(clamp(syll * (0.4 + 0.6 * Math.sin(Math.PI * t))))
            simRef.current = requestAnimationFrame(loop)
        }
        simRef.current = requestAnimationFrame(loop)
    }

    const handleReRecord = () => {
        audioChunksRef.current = []
        setSeconds(0)
        setLevel(0)
        setRecordingState('idle')
    }

    const handleAcceptAnswer = (e) => {
        if (isWarping()) return
        const btn = e.currentTarget
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        recordingsRef.current = [...recordingsRef.current, {
            questionIndex,
            question: QUESTIONS[questionIndex],
            audioBlob,
            // Both modes run the same pipeline in this milestone
            mode: consentData.asdConsent ? 'speaker_declared' : 'universal_fairness',
        }]
        setLevel(0)
        if (questionIndex === QUESTIONS.length - 1) {
            onComplete(recordingsRef.current, btn)
            return
        }
        warp(btn, 'Question ' + ROMAN[questionIndex + 1], () => {
            audioChunksRef.current = []
            setQuestionIndex(q => q + 1)
            setSeconds(0)
            setRecordingState('idle')
        })
    }

    const isLast = questionIndex === QUESTIONS.length - 1

    return (
        <section className="screen rec enter" aria-label="Recording">
            <div className="rec-top">
                <div>
                    <span className="q-num">{ROMAN[questionIndex]}.</span>
                    <h1 className="q-text enter" key={questionIndex} aria-live="polite"><QuestionText text={QUESTIONS[questionIndex]} /></h1>
                </div>
                <ol className="rail" aria-label="Questions">
                    {QUESTIONS.map((_, i) => (
                        <li key={i} className={i < questionIndex ? 'done' : i === questionIndex ? 'now' : ''}
                            aria-label={`Question ${i + 1}${i < questionIndex ? ', answered' : i === questionIndex ? ', current' : ''}`}>
                            {ROMAN[i]}
                        </li>
                    ))}
                </ol>
            </div>

            <div className="core">
                {recordingState === 'idle' && (
                    <button type="button" className="core-btn magnetic" ref={fxMagnetOnly} onClick={startRecording}>
                        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
                        <span>Record</span>
                    </button>
                )}
                {recordingState === 'recording' && (
                    <button type="button" className="core-btn stop" onClick={stopRecording}>
                        <span className="sq" aria-hidden="true" /><span>Stop</span>
                    </button>
                )}
                {recordingState === 'done' && (
                    <div className="core-done" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="38" height="38"><path className="tick" d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                )}
            </div>

            <div className="rec-bottom">
                <p className="rec-status">
                    {recordingState === 'recording' ? <><span className="live" />Recording {fmt(seconds)}</>
                        : recordingState === 'done' ? `Answer captured, ${fmt(seconds)}`
                            : 'Press Record when you are ready. Take as long as you need.'}
                </p>
                {micError && <p className="err" role="alert">{micError}</p>}
                {recordingState === 'done' && (
                    <div className="rec-actions">
                        <Btn className="btn-ember" magnetic onClick={handleAcceptAnswer}>
                            {isLast ? 'Use this answer and finish' : 'Use this answer and continue'}
                        </Btn>
                        <Btn className="btn-line" onClick={handleReRecord}>Record this answer again</Btn>
                    </div>
                )}
                {isDemo() && recordingState === 'idle' && (
                    <button type="button" className="sample" onClick={sampleTake}>Use a sample answer instead</button>
                )}
            </div>
        </section>
    )
}

export default RecordingScreen
