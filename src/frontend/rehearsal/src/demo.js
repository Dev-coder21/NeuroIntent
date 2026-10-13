// Demo mode: lets the redesign be shown without the Python backend.
// Turn it on with ?demo in the URL (or VITE_DEMO=1 in .env). Every screen then shows a
// "Demo mode" badge, and every value below is hand-written sample data, not model output.

export function isDemo() {
    try {
        const params = new URLSearchParams(window.location.search)
        if (params.has('demo')) return true
        if (params.has('live')) return false
    } catch {
        // no window (tests)
    }
    try {
        if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) return true
    } catch {
        // no window
    }
    try {
        return import.meta.env.VITE_DEMO === '1'
    } catch {
        return false
    }
}

const BASELINE_LABEL = 'illustrative comparison model, not an evaluator or vendor tool'

const SAMPLES = [
    {
        transcript: "I'm in my final year of computer engineering. Most of my work has been on data pipelines, and last summer I interned at a logistics company where I rebuilt their reporting jobs so they finished in forty minutes instead of six hours.",
        score: 0.74, raw: 0.7412, baseline: -0.41, pitch: 0.12, voiced: 2.04, unvoiced: 0.38,
    },
    {
        transcript: "Our team's sensor data kept arriving out of order. I wrote a small buffer that held readings for two seconds and sorted them by timestamp, then I tested it against a week of recorded data before we switched it on.",
        score: 0.69, raw: 0.6871, baseline: -0.72, pitch: 0.09, voiced: 1.81, unvoiced: 0.52,
    },
    {
        transcript: "I am precise and I finish things. When I review code I read every line, and I write down the edge cases before I start, which means fewer bugs reach testing.",
        score: 0.63, raw: 0.6302, baseline: -0.18, pitch: 0.15, voiced: 2.21, unvoiced: 0.31,
    },
    {
        transcript: "In my third year our project demo moved forward by a week. I split the remaining work into a list with owners and dates, took the backend myself, and we presented on time with one feature cut.",
        score: 0.71, raw: 0.7094, baseline: -0.55, pitch: 0.1, voiced: 1.92, unvoiced: 0.47,
    },
    {
        transcript: "In five years I want to be the person a team trusts with its data systems. I would like to lead a small infrastructure group and keep writing code.",
        score: 0.58, raw: 0.5826, baseline: -0.33, pitch: 0.13, voiced: 2.11, unvoiced: 0.41,
    },
]

const FEATURES = [
    'F0semitoneFrom27.5Hz_sma3nz_stddevNorm',
    'MeanUnvoicedSegmentLength',
    'VoicedSegmentsPerSec',
    'loudness_sma3_amean',
    'jitterLocal_sma3nz_amean',
]

function sampleResult(index, mode) {
    const s = SAMPLES[index % SAMPLES.length]
    const excerpt = s.transcript.slice(0, 80).trimEnd() + (s.transcript.length > 80 ? '...' : '')
    return {
        content_score: s.score,
        content_score_raw: s.raw,
        content_score_source: 'trained_head',
        content_scorer_stamp: null,
        content_label_source: 'chalearn',
        intent_label: null,
        intent_status: 'not_trained',
        prosody_only_baseline_score: s.baseline,
        prosody_only_baseline_label: BASELINE_LABEL,
        transcript: s.transcript,
        delivery_pattern: [
            `Pitch variation (normalised std dev, unitless): ${s.pitch.toFixed(2)}`,
            `Voiced segments per second: ${s.voiced.toFixed(2)}`,
            `Mean unvoiced segment length: ${s.unvoiced.toFixed(2)} s`,
        ],
        explanation: {
            method: 'proxy',
            explains: 'prosody_only_baseline_score',
            top_features: FEATURES.map((feature, j) => ({
                feature,
                contribution: Number((((j % 2 ? 1 : -1) * (0.62 - j * 0.11)) + index * 0.03).toFixed(3)),
            })),
            note: "Coefficient x z-score of the prosody-only baseline's 62 inputs. It explains the baseline only; the content score has no explanation.",
        },
        interpretation: `Content score: ${Math.round(s.score * 100)}%, computed from the transcript only; the audio is not an input to it. Transcript excerpt: "${excerpt}". The delivery measurements are reported separately and do not change the content score.`,
        interpretation_source: 'template',
        mode,
        mode_effect: 'none in this milestone',
        smoke_artifacts: false,
    }
}

// Behaves like analyzeRecording: resolves after a short wait, rejects with AbortError if cancelled.
export function demoAnalyze(recording, index, signal) {
    return new Promise((resolve, reject) => {
        const wait = 1100 + ((index * 397) % 900)
        const timer = setTimeout(() => resolve(sampleResult(index, recording.mode)), wait)
        if (signal) {
            signal.addEventListener('abort', () => {
                clearTimeout(timer)
                reject(new DOMException('Aborted', 'AbortError'))
            }, { once: true })
        }
    })
}
