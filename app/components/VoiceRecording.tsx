'use client'

import { useEffect, useState, useRef } from 'react'

interface TransactionData {
  type: 'transfer' | 'ewallet' | 'pulsa' | 'gold' | 'token'
  amount?: string | number
  bank?: string
  accountNumber?: string
  ewallet?: string
  phoneNumber?: string
  provider?: string
  grams?: string | number
  meterNumber?: string
}

interface VoiceRecordingProps {
  isListening: boolean
  transcript: string
  interimTranscript: string
  onClose: () => void
  silenceCountdown?: number | null
  showError?: boolean
  errorMessage?: string
  onRetry?: () => void
  onBackToStart?: () => void
  isExtracting?: boolean
  showIncomplete?: boolean
  incompleteMessage?: string
  isProcessingComplete?: boolean
  showNoResponse?: boolean
  onRetryAfterNoResponse?: () => void
  onTranscriptEdit?: (editedTranscript: string) => void
  onShowOnboarding?: () => void
  showConfirmation?: boolean
  confirmationData?: TransactionData | null
  showCorrectionPrompt?: boolean
  correctionMessage?: string
  isAccessibilityMode?: boolean
}

export default function VoiceRecording({
  isListening,
  transcript,
  interimTranscript,
  onClose,
  silenceCountdown = null,
  showError = false,
  errorMessage = '',
  onRetry,
  onBackToStart,
  isExtracting = false,
  showIncomplete = false,
  incompleteMessage = '',
  isProcessingComplete = false,
  showNoResponse = false,
  onRetryAfterNoResponse,
  onTranscriptEdit,
  onShowOnboarding,
  showConfirmation = false,
  confirmationData = null,
  showCorrectionPrompt = false,
  correctionMessage = '',
  isAccessibilityMode = false
}: VoiceRecordingProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState('')
  const [screenReaderActive, setScreenReaderActive] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const previousIncompleteMessageRef = useRef('')
  const prevIsListeningRef = useRef(isListening)
  const prevShowErrorRef = useRef(showError)

  // Detect screen reader (TalkBack on Android, VoiceOver on iOS)
  useEffect(() => {
    const detectScreenReader = () => {
      // Check for reduced motion preference (often enabled with screen readers)
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // Check for forced colors (high contrast mode, common with accessibility)
      const prefersContrast = window.matchMedia('(prefers-contrast: more)').matches

      // Check if accessibility is explicitly enabled via prop
      if (isAccessibilityMode) {
        setScreenReaderActive(true)
        return
      }

      // Heuristic: if user has reduced motion OR high contrast, likely using accessibility features
      if (prefersReducedMotion || prefersContrast) {
        setScreenReaderActive(true)
        return
      }

      setScreenReaderActive(false)
    }

    detectScreenReader()

    // Listen for changes in accessibility preferences
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const contrastQuery = window.matchMedia('(prefers-contrast: more)')

    const handleChange = () => detectScreenReader()

    motionQuery.addEventListener('change', handleChange)
    contrastQuery.addEventListener('change', handleChange)

    return () => {
      motionQuery.removeEventListener('change', handleChange)
      contrastQuery.removeEventListener('change', handleChange)
    }
  }, [isAccessibilityMode])

  // Haptic feedback helper
  const vibrate = (pattern: number | number[]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  }

  // Sound cue helper using Web Audio API
  const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    try {
      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = frequency
      oscillator.type = type
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration)
    } catch (e) {
      // Audio not supported
    }
  }

  // Haptic and sound feedback for state changes
  useEffect(() => {
    // Recording started
    if (isListening && !prevIsListeningRef.current) {
      vibrate(50)
      if (screenReaderActive) {
        playTone(880, 0.15) // High beep for start
      }
    }
    // Recording stopped
    if (!isListening && prevIsListeningRef.current && !showError && !showNoResponse) {
      vibrate([50, 50, 50])
      if (screenReaderActive) {
        playTone(660, 0.1) // Lower tone for stop
      }
    }
    prevIsListeningRef.current = isListening
  }, [isListening, showError, showNoResponse, screenReaderActive])

  // Error feedback
  useEffect(() => {
    if (showError && !prevShowErrorRef.current) {
      vibrate([100, 50, 100])
      if (screenReaderActive) {
        playTone(330, 0.3, 'triangle') // Low error tone
      }
    }
    if (showNoResponse) {
      vibrate([50, 100, 50])
      if (screenReaderActive) {
        playTone(440, 0.2, 'triangle')
      }
    }
    prevShowErrorRef.current = showError
  }, [showError, showNoResponse, screenReaderActive])

  // Combine final transcript with interim transcript
  const fullTranscript = transcript + (interimTranscript ? ' ' + interimTranscript : '')


  // Typing effect for the transcript or incomplete message
  useEffect(() => {
    // Stop typing effect when showing error (but NOT when extracting - keep text visible)
    if (showError) {
      setIsTyping(false)
      return
    }

    // Show incomplete message with typing effect
    if (showIncomplete && incompleteMessage) {
      if (incompleteMessage.length > displayedText.length) {
        setIsTyping(true)
        const timeout = setTimeout(() => {
          setDisplayedText(incompleteMessage.slice(0, displayedText.length + 1))
          setIsTyping(false)
        }, 30)
        return () => clearTimeout(timeout)
      }
      return
    }

    // Normal transcript typing effect
    if (fullTranscript.length > displayedText.length) {
      setIsTyping(true)
      const timeout = setTimeout(() => {
        setDisplayedText(fullTranscript.slice(0, displayedText.length + 1))
        setIsTyping(false)
      }, 30)

      return () => clearTimeout(timeout)
    } else if (fullTranscript.length < displayedText.length) {
      setDisplayedText(fullTranscript)
    }
  }, [fullTranscript, displayedText, showError, showIncomplete, incompleteMessage])

  // Reset displayed text when transcript is cleared (but not when showing incomplete message)
  useEffect(() => {
    if (fullTranscript === '' && !showIncomplete && !showCorrectionPrompt) {
      setDisplayedText('')
    }
  }, [fullTranscript, showIncomplete, showCorrectionPrompt])

  // Reset displayed text when correction message changes
  useEffect(() => {
    if (showCorrectionPrompt && correctionMessage) {
      setDisplayedText('')
    }
  }, [correctionMessage, showCorrectionPrompt])

  // Reset displayed text only when incomplete message changes to a NEW message
  useEffect(() => {
    if (showIncomplete && incompleteMessage && incompleteMessage !== previousIncompleteMessageRef.current) {
      previousIncompleteMessageRef.current = incompleteMessage
      setDisplayedText('')
    } else if (!showIncomplete) {
      previousIncompleteMessageRef.current = ''
    }
  }, [incompleteMessage, showIncomplete])

  // Audio visualization setup
  useEffect(() => {
    if (!isListening) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      analyserRef.current = null
      setAudioLevel(0)
      return
    }

    let isMounted = true

    const setupAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        streamRef.current = stream

        const audioContext = new AudioContext()
        if (!isMounted) {
          audioContext.close().catch(() => {})
          stream.getTracks().forEach(track => track.stop())
          return
        }
        audioContextRef.current = audioContext

        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8
        analyserRef.current = analyser

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const updateLevel = () => {
          if (!isMounted || !analyserRef.current || !audioContextRef.current || audioContextRef.current.state === 'closed') {
            return
          }

          try {
            analyserRef.current.getByteFrequencyData(dataArray)

            // Calculate average level
            let sum = 0
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i]
            }
            const avg = sum / bufferLength / 255

            setAudioLevel(avg)
            animationRef.current = requestAnimationFrame(updateLevel)
          } catch (error) {
            console.error('Error in audio level update:', error)
          }
        }

        updateLevel()
      } catch (error) {
        console.error('Error accessing microphone for visualization:', error)
      }
    }

    setupAudio()

    return () => {
      isMounted = false
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      analyserRef.current = null
    }
  }, [isListening])

  // Calculate wave properties based on audio level - more sensitive
  const baseScale = 1 + audioLevel * 1.2
  const waveIntensity = 0.4 + audioLevel * 0.6

  // Format amount for display (numeric)
  const formatAmount = (amount?: string | number) => {
    if (!amount) return 'Rp0'
    const num = typeof amount === 'string' ? parseInt(amount.replace(/\D/g, '')) : amount
    return 'Rp' + new Intl.NumberFormat('id-ID').format(num)
  }

  // Generate confirmation message
  const getConfirmationMessage = () => {
    if (!confirmationData) return ''

    let message = ''
    const type = confirmationData.type

    if (type === 'transfer') {
      message = `Transfer ${formatAmount(confirmationData.amount)} ke ${confirmationData.bank} ${confirmationData.accountNumber}`
    } else if (type === 'ewallet') {
      message = `Top up ${confirmationData.ewallet} ${formatAmount(confirmationData.amount)} ke ${confirmationData.phoneNumber}`
    } else if (type === 'pulsa') {
      message = `Beli pulsa ${confirmationData.provider} ${formatAmount(confirmationData.amount)} ke ${confirmationData.phoneNumber}`
    } else if (type === 'gold') {
      message = `Beli emas ${confirmationData.grams} gram senilai ${formatAmount(confirmationData.amount)}`
    } else if (type === 'token') {
      message = `Beli token listrik ${formatAmount(confirmationData.amount)} untuk meter ${confirmationData.meterNumber}`
    }

    return message + '\n\nSudah benar?'
  }

  return (
    <div
      className="fixed inset-0 bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-recording-title"
      aria-describedby="voice-recording-description"
    >

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-6 left-6 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-50 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
        aria-label="Tutup layar perekaman suara dan kembali. Tekan Escape untuk menutup."
        type="button"
      >
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      {/* Onboarding Button */}
      {onShowOnboarding && (
        <button
          onClick={onShowOnboarding}
          className="absolute top-6 right-6 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-50 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          aria-label="Lihat panduan penggunaan"
          type="button"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </button>
      )}

      {/* Top Section - Transcript Display */}
      <div className="absolute top-24 left-8 right-8 max-w-2xl">
        <div className="text-left w-full">
          {/* Show correction prompt or transcript during correction */}
          {showCorrectionPrompt && correctionMessage ? (
            // During correction: show transcript if user is speaking, otherwise show prompt
            (displayedText || transcript || interimTranscript) ? (
              <h1
                id="voice-recording-title"
                className="text-3xl md:text-4xl font-bold text-gray-800 leading-tight"
                aria-live="polite"
              >
                {displayedText}
                {isTyping && <span className="animate-pulse" style={{ color: '#FD6542' }} aria-hidden="true">|</span>}
              </h1>
            ) : (
              <h1
                id="voice-recording-title"
                className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight"
                aria-live="polite"
              >
                {correctionMessage}
              </h1>
            )
          ) : showConfirmation && confirmationData ? (
            <h1
              id="voice-recording-title"
              className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight whitespace-pre-line"
              aria-live="polite"
            >
              {getConfirmationMessage()}
            </h1>
          ) : showError ? (
            <h1
              id="voice-recording-title"
              className="text-3xl md:text-4xl font-bold text-gray-800 leading-tight"
              role="alert"
              aria-live="assertive"
            >
              {errorMessage || 'Waduh, aku lagi error nih. Coba lagi ya!'}
            </h1>
          ) : showNoResponse ? (
            <h1
              id="voice-recording-title"
              className="text-3xl md:text-4xl font-bold text-gray-800 leading-tight"
              role="alert"
              aria-live="assertive"
            >
              Hmm, aku nggak dengar suaramu. Coba bicara lagi ya!
            </h1>
          ) : showIncomplete ? (
            <h1
              id="voice-recording-title"
              className="text-3xl md:text-4xl font-bold text-gray-800 leading-tight"
              aria-live="polite"
            >
              {displayedText}
              {isTyping && <span className="animate-pulse" style={{ color: '#FD6542' }} aria-hidden="true">|</span>}
            </h1>
          ) : isExtracting ? (
            isProcessingComplete ? (
              <h1
                id="voice-recording-title"
                className="text-3xl md:text-4xl font-bold text-gray-800"
                role="status"
                aria-live="polite"
              >
                Memproses permintaanmu...
              </h1>
            ) : (
              <div className="flex items-center gap-2" role="status" aria-live="polite" aria-label="Sedang memuat">
                <span className="text-5xl md:text-6xl font-bold animate-pulse" style={{ color: '#FD6542', animationDelay: '0ms', animationDuration: '1s' }} aria-hidden="true">.</span>
                <span className="text-5xl md:text-6xl font-bold animate-pulse" style={{ color: '#FD6542', animationDelay: '200ms', animationDuration: '1s' }} aria-hidden="true">.</span>
                <span className="text-5xl md:text-6xl font-bold animate-pulse" style={{ color: '#FD6542', animationDelay: '400ms', animationDuration: '1s' }} aria-hidden="true">.</span>
                <span className="sr-only">Memproses data transaksi</span>
              </div>
            )
          ) : displayedText ? (
            <>
              {isEditing ? (
                <div className="space-y-4">
                  <textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    className="w-full text-2xl md:text-3xl font-bold text-gray-800 leading-tight bg-white/50 border-2 border-orange-300 rounded-lg p-3 focus:outline-none focus:border-orange-500 resize-none"
                    rows={3}
                    aria-label="Edit transkrip suara"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (onTranscriptEdit) {
                          onTranscriptEdit(editedTranscript)
                        }
                        setIsEditing(false)
                      }}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                      type="button"
                    >
                      Konfirmasi
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false)
                        setEditedTranscript(displayedText)
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                      type="button"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <h1
                      id="voice-recording-title"
                      className="text-3xl md:text-4xl font-bold text-gray-800 leading-tight flex-1"
                      aria-live="polite"
                    >
                      {displayedText}
                      {isTyping && <span className="animate-pulse" style={{ color: '#FD6542' }} aria-hidden="true">|</span>}
                    </h1>
                    {silenceCountdown !== null && silenceCountdown > 0 && onTranscriptEdit && (
                      <button
                        onClick={() => {
                          setEditedTranscript(displayedText)
                          setIsEditing(true)
                        }}
                        className="flex-shrink-0 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white transition focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                        aria-label="Edit transkrip"
                        type="button"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  {silenceCountdown !== null && silenceCountdown > 0 && (
                    <p className="text-gray-500 text-lg mt-4" role="timer" aria-live="polite">
                      Memproses dalam {silenceCountdown} detik
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <h1
              id="voice-recording-title"
              className="text-3xl md:text-4xl font-bold text-gray-800"
            >
              {isListening ? 'Mau transaksi apa? Jingga akan bantu' : 'Siap mendengarkan'}
            </h1>
          )}
        </div>
      </div>

      {/* Hidden description for screen readers */}
      <p id="voice-recording-description" className="sr-only">
        Layar perekaman suara untuk transaksi. {isListening ? 'Mikrofon sedang aktif, silakan berbicara.' : 'Mikrofon tidak aktif.'}
        {showNoResponse && ' Tidak ada respons terdeteksi. Tekan tombol mikrofon untuk mencoba lagi.'}
        {showIncomplete && ` ${displayedText} Silakan berikan informasi yang diminta.`}
      </p>

      {/* Bottom Section - Fixed Container */}
      <div className="fixed bottom-0 left-0 right-0 flex flex-col items-center bg-gradient-to-t from-purple-100/80 via-pink-50/60 to-transparent backdrop-blur-sm z-10">

        <p
          className="text-gray-500 text-sm"
          style={{ marginBottom: "-12px" }}
          aria-live="polite"
        >
          {showError ? 'Tap mikrofon untuk coba lagi' : 'Pakai Bahasa Indonesia, ya~'}
        </p>

        {/* Siri-like animated blob */}
        {(showNoResponse || showError) ? (
          <button
            className="relative w-48 h-48 flex items-center justify-center bg-transparent border-none cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 focus-visible:ring-offset-2 rounded-full"
            onClick={showError ? onRetry : onRetryAfterNoResponse}
            aria-label="Coba lagi merekam suara"
            type="button"
          >
            {/* Outer wavy glow layer */}
            <div
              className="absolute blur-xl transition-all duration-75"
              aria-hidden="true"
              style={{
                width: `${120 + audioLevel * 100}px`,
                height: `${120 + audioLevel * 100}px`,
                background: 'radial-gradient(circle, rgba(253, 101, 66, 0.2) 0%, transparent 70%)',
                transform: `scale(${baseScale})`,
                borderRadius: '50%',
              }}
            />
            {/* Middle wavy layer */}
            <div
              className="absolute blur-md transition-all duration-50"
              aria-hidden="true"
              style={{
                width: `${100 + audioLevel * 80}px`,
                height: `${100 + audioLevel * 80}px`,
                background: 'radial-gradient(circle, rgba(253, 101, 66, 0.3) 0%, transparent 70%)',
                transform: `scale(${baseScale * 0.95})`,
                borderRadius: '50%',
              }}
            />
            {/* Core wavy blob */}
            <div
              className="absolute transition-all duration-50 flex items-center justify-center"
              aria-hidden="true"
              style={{
                width: `${80 + audioLevel * 60}px`,
                height: `${80 + audioLevel * 60}px`,
                background: 'linear-gradient(135deg, rgba(253, 101, 66, 0.7) 0%, rgba(255, 150, 100, 0.7) 100%)',
                transform: `scale(${baseScale})`,
                borderRadius: '50%',
                boxShadow: '0 0 30px rgba(253, 101, 66, 0.3)',
              }}
            >
              <svg
                className="w-8 h-8 text-white drop-shadow-lg"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/>
              </svg>
            </div>
          </button>
        ) : (
          <div
            className="relative w-48 h-48 flex items-center justify-center"
            role="img"
            aria-label={isListening || isExtracting || showConfirmation ? 'Mikrofon sedang aktif' : 'Mikrofon tidak aktif'}
          >
            {/* Outer wavy glow layer */}
            <div
              className="absolute blur-xl transition-all duration-75"
              aria-hidden="true"
              style={{
                width: `${120 + audioLevel * 100}px`,
                height: `${120 + audioLevel * 100}px`,
                background: (isListening || isExtracting || showConfirmation)
                  ? `radial-gradient(circle, rgba(253, 101, 66, ${0.3 + audioLevel * 0.3}) 0%, rgba(255, 150, 100, ${0.2 + audioLevel * 0.2}) 50%, transparent 70%)`
                  : 'radial-gradient(circle, rgba(253, 101, 66, 0.2) 0%, transparent 70%)',
                transform: `scale(${baseScale})`,
                borderRadius: (isListening || isExtracting || showConfirmation) ? '60% 40% 30% 70% / 60% 30% 70% 40%' : '50%',
                animation: (isListening || isExtracting || showConfirmation) ? 'morph 8s ease-in-out infinite' : 'none',
              }}
            />

            {/* Middle wavy layer */}
            <div
              className="absolute blur-md transition-all duration-50"
              aria-hidden="true"
              style={{
                width: `${100 + audioLevel * 80}px`,
                height: `${100 + audioLevel * 80}px`,
                background: (isListening || isExtracting || showConfirmation)
                  ? `radial-gradient(circle, rgba(253, 101, 66, ${0.4 + audioLevel * 0.4}) 0%, rgba(255, 180, 120, ${0.3 + audioLevel * 0.3}) 50%, transparent 70%)`
                  : 'radial-gradient(circle, rgba(253, 101, 66, 0.3) 0%, transparent 70%)',
                transform: `scale(${baseScale * 0.95})`,
                borderRadius: (isListening || isExtracting || showConfirmation) ? '40% 60% 70% 30% / 40% 50% 60% 50%' : '50%',
                animation: (isListening || isExtracting || showConfirmation) ? 'morph 6s ease-in-out infinite reverse' : 'none',
              }}
            />

            {/* Core wavy blob */}
            <div
              className="absolute transition-all duration-50 flex items-center justify-center"
              aria-hidden="true"
              style={{
                width: `${80 + audioLevel * 60}px`,
                height: `${80 + audioLevel * 60}px`,
                background: (isListening || isExtracting || showConfirmation)
                  ? `linear-gradient(135deg,
                      rgba(253, 101, 66, ${waveIntensity}) 0%,
                      rgba(255, 140, 90, ${waveIntensity}) 50%,
                      rgba(255, 180, 120, ${waveIntensity}) 100%)`
                  : 'linear-gradient(135deg, rgba(253, 101, 66, 0.7) 0%, rgba(255, 150, 100, 0.7) 100%)',
                transform: `scale(${baseScale})`,
                borderRadius: (isListening || isExtracting || showConfirmation) ? '30% 70% 70% 30% / 30% 30% 70% 70%' : '50%',
                animation: (isListening || isExtracting || showConfirmation) ? 'morph 4s ease-in-out infinite' : 'none',
                boxShadow: (isListening || isExtracting || showConfirmation)
                  ? `0 0 ${30 + audioLevel * 80}px rgba(253, 101, 66, ${0.4 + audioLevel * 0.5}),
                     0 0 ${60 + audioLevel * 100}px rgba(255, 150, 100, ${0.3 + audioLevel * 0.4})`
                  : '0 0 30px rgba(253, 101, 66, 0.3)',
              }}
            >
              {/* Mic icon */}
              <svg
                className="w-8 h-8 text-white drop-shadow-lg"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/>
              </svg>
            </div>

            {/* Animated wavy rings when listening, extracting, or confirming */}
            {(isListening || isExtracting || showConfirmation) && (
              <>
                <div
                  className="absolute"
                  aria-hidden="true"
                  style={{
                    width: `${90 + audioLevel * 100}px`,
                    height: `${90 + audioLevel * 100}px`,
                    borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
                    border: '2px solid rgba(253, 101, 66, 0.4)',
                    animation: 'morph 5s ease-in-out infinite, ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                  }}
                />
                <div
                  className="absolute"
                  aria-hidden="true"
                  style={{
                    width: `${110 + audioLevel * 120}px`,
                    height: `${110 + audioLevel * 120}px`,
                    borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%',
                    border: '1px solid rgba(255, 150, 100, 0.3)',
                    animation: 'morph 7s ease-in-out infinite reverse, ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                    animationDelay: '0.5s',
                  }}
                />
              </>
            )}

          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(${baseScale * 0.95});
          }
          50% {
            transform: scale(${baseScale * 1.05});
          }
        }
        @keyframes morph {
          0%, 100% {
            border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
          }
          25% {
            border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%;
          }
          50% {
            border-radius: 50% 60% 30% 60% / 30% 60% 70% 40%;
          }
          75% {
            border-radius: 60% 40% 60% 40% / 70% 30% 50% 60%;
          }
        }
      `}</style>
    </div>
  )
}
