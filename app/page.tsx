'use client'

import { useState, useRef, useEffect } from 'react'
import Onboarding from './components/Onboarding'
import VoiceRecording from './components/VoiceRecording'
// import { useFeedback } from './hooks/useFeedback'
import { getEnabledTypes, isTypeEnabled } from './config/transactionTypes'

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
  incomplete?: boolean
  partialData?: Partial<TransactionData>
  missingFields?: string[]
  message?: string
}

export default function Home() {
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState<{ message: string; type: string } | null>(null)
  const [extractedData, setExtractedData] = useState<TransactionData | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null)
  const [showErrorPopup, setShowErrorPopup] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [conversationContext, setConversationContext] = useState<TransactionData | null>(null)
  const [showIncompletePrompt, setShowIncompletePrompt] = useState(false)
  const [incompleteMessage, setIncompleteMessage] = useState('')
  const [isProcessingComplete, setIsProcessingComplete] = useState(false)
  const [showNoResponseMessage, setShowNoResponseMessage] = useState(false)
  const [attemptsCount, setAttemptsCount] = useState(0)
  const [originalInput, setOriginalInput] = useState('')
  const [hadIncompleteAttempt, setHadIncompleteAttempt] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showCorrectionPrompt, setShowCorrectionPrompt] = useState(false)
  const [correctionMessage, setCorrectionMessage] = useState('')
  const [correctionField, setCorrectionField] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const extractionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const silenceDetectionRef = useRef<NodeJS.Timeout | null>(null)
  const lastSpeechTimeRef = useRef<number>(Date.now())
  const noResponseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef<string>('')
  const showConfirmationRef = useRef<boolean>(false)
  const extractedDataRef = useRef<TransactionData | null>(null)
  const intentionalCloseRef = useRef<boolean>(false)
  const showCorrectionPromptRef = useRef<boolean>(false)
  const correctionFieldRef = useRef<string | null>(null)
  const isAccessibilityModeRef = useRef<boolean>(false)

  // Detect accessibility features (TalkBack/VoiceOver)
  useEffect(() => {
    const detectAccessibility = () => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const prefersContrast = window.matchMedia('(prefers-contrast: more)').matches
      isAccessibilityModeRef.current = prefersReducedMotion || prefersContrast
    }
    detectAccessibility()

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const contrastQuery = window.matchMedia('(prefers-contrast: more)')
    motionQuery.addEventListener('change', detectAccessibility)
    contrastQuery.addEventListener('change', detectAccessibility)

    return () => {
      motionQuery.removeEventListener('change', detectAccessibility)
      contrastQuery.removeEventListener('change', detectAccessibility)
    }
  }, [])

  // Get TTS delay based on accessibility mode
  const getTtsDelay = (messageLength: number, baseDelay: number = 500) => {
    if (isAccessibilityModeRef.current) {
      return messageLength * 60 + baseDelay // Full delay for screen readers
    }
    return 200 // Minimal delay for regular users
  }

  // Generate correction prompt based on transaction type
  const getCorrectionPrompt = (type: string): string => {
    switch (type) {
      case 'transfer':
        return 'Yang mana yang salah? Bank, nomor rekening, atau nominal?'
      case 'ewallet':
        return 'Yang mana yang salah? E-wallet, nomor HP, atau nominal?'
      case 'pulsa':
        return 'Yang mana yang salah? Provider, nomor HP, atau nominal?'
      case 'gold':
        return 'Yang mana yang salah? Jumlah gram atau nominal?'
      case 'token':
        return 'Yang mana yang salah? Nomor meter atau nominal?'
      default:
        return 'Yang mana yang salah?'
    }
  }

  // Generate prompt asking for specific field value with current value context
  const getFieldValuePrompt = (field: string, currentData?: TransactionData | null): string => {
    if (!currentData) {
      // Fallback to simple prompts if no current data
      switch (field) {
        case 'bank':
          return 'Nama banknya?'
        case 'accountNumber':
          return 'Nomor rekeningnya?'
        case 'ewallet':
          return 'Nama e-walletnya?'
        case 'phoneNumber':
          return 'Nomor HPnya?'
        case 'provider':
          return 'Nama providernya?'
        case 'amount':
          return 'Nominalnya berapa?'
        case 'grams':
          return 'Berapa gram?'
        case 'meterNumber':
          return 'Nomor meternya?'
        default:
          return 'Yang benar apa?'
      }
    }

    // Show current value and ask for correction
    switch (field) {
      case 'bank':
        return `Sekarang ${currentData.bank}. Bank yang baru?`
      case 'accountNumber':
        return `Sekarang ${spellDigits(currentData.accountNumber)}. Nomor rekening yang baru?`
      case 'ewallet':
        return `Sekarang ${currentData.ewallet}. E-wallet yang baru?`
      case 'phoneNumber':
        return `Sekarang ${spellDigits(currentData.phoneNumber)}. Nomor HP yang baru?`
      case 'provider':
        return `Sekarang ${currentData.provider}. Provider yang baru?`
      case 'amount':
        const amountWords = formatAmountToWords(currentData.amount)
        return `Sekarang ${amountWords} rupiah. Nominal yang baru?`
      case 'grams':
        return `Sekarang ${currentData.grams} gram. Berapa gram yang baru?`
      case 'meterNumber':
        return `Sekarang ${spellDigits(currentData.meterNumber)}. Nomor meter yang baru?`
      default:
        return 'Yang benar apa?'
    }
  }

  // TTS and haptic feedback (commented out for now)
  // const { feedback, speak, stopSpeaking, vibrate } = useFeedback()

  useEffect(() => {
    // Always show onboarding on start
    setShowOnboarding(true)
  }, [])

  // Keep refs in sync with state
  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  useEffect(() => {
    showConfirmationRef.current = showConfirmation
  }, [showConfirmation])

  useEffect(() => {
    extractedDataRef.current = extractedData
  }, [extractedData])

  useEffect(() => {
    showCorrectionPromptRef.current = showCorrectionPrompt
  }, [showCorrectionPrompt])

  useEffect(() => {
    correctionFieldRef.current = correctionField
  }, [correctionField])

  useEffect(() => {
    // Check browser support
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (!SpeechRecognition) {
        setStatus({
          message: '❌ Browser Anda tidak mendukung Speech Recognition. Gunakan Chrome atau Edge.',
          type: 'error'
        })
        return
      }

      // Initialize Speech Recognition
      const recognition = new SpeechRecognition()
      recognition.lang = 'id-ID'
      recognition.continuous = true // Keep listening during brief pauses
      recognition.interimResults = true // Enable interim results for live typing effect

      recognition.onstart = () => {
        setIsListening(true)
        setInterimTranscript('')
        setStatus({ message: '🎤 Mendengarkan... Silakan bicara', type: 'listening' })
      }

      recognition.onresult = (event: any) => {
        let interimText = ''
        let finalText = ''

        // Only process new results starting from resultIndex
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalText += transcript
          } else {
            interimText += transcript
          }
        }

        // Clear incomplete prompt and no response timeout when user starts speaking
        if (interimText || finalText) {
          setShowIncompletePrompt(false)
          setShowNoResponseMessage(false)
          if (noResponseTimeoutRef.current) {
            clearTimeout(noResponseTimeoutRef.current)
            noResponseTimeoutRef.current = null
          }
        }

        // Update interim transcript for live display
        setInterimTranscript(interimText)

        // Update final transcript
        if (finalText) {
          // Check for "konfirmasi" when in confirmation mode
          if (showConfirmationRef.current && extractedDataRef.current) {
            const lowerText = finalText.toLowerCase().trim()

            // Check if in correction mode - parse which field to correct
            if (showCorrectionPromptRef.current) {
              const data = extractedDataRef.current

              // Step 2: If we already know which field to correct, accumulate transcript and wait for silence
              if (correctionFieldRef.current) {
                // Accumulate the transcript for correction value
                setTranscript(prev => (prev ? prev + ' ' : '') + finalText)
                setInterimTranscript('')

                // Reset silence detection timer - user is speaking
                lastSpeechTimeRef.current = Date.now()

                // Clear any existing silence detection timer
                if (silenceDetectionRef.current) {
                  clearTimeout(silenceDetectionRef.current)
                }

                // Start new silence detection (3 seconds) - same as normal flow
                silenceDetectionRef.current = setTimeout(() => {
                  // User has been silent for 3 seconds, process the correction value
                  intentionalCloseRef.current = true // Prevent onend from restarting
                  if (recognitionRef.current) {
                    recognitionRef.current.stop()
                  }
                  setIsListening(false)
                  setInterimTranscript('')

                  // Process the correction value
                  const fullText = transcriptRef.current.toLowerCase().trim()
                  const field = correctionFieldRef.current
                  let newValue: string | null = null

                  // Parse value based on field type
                  if (field === 'bank') {
                    // Extract bank name - check for common banks first
                    if (fullText.includes('bca')) newValue = 'BCA'
                    else if (fullText.includes('bni')) newValue = 'BNI'
                    else if (fullText.includes('bri')) newValue = 'BRI'
                    else if (fullText.includes('mandiri')) newValue = 'Mandiri'
                    else if (fullText.includes('cimb')) newValue = 'CIMB'
                    else if (fullText.includes('danamon')) newValue = 'Danamon'
                    else if (fullText.includes('permata')) newValue = 'Permata'
                    else if (fullText.includes('btn')) newValue = 'BTN'
                    else if (fullText.includes('ocbc')) newValue = 'OCBC'
                    else if (fullText.includes('maybank')) newValue = 'Maybank'
                    else if (fullText.includes('panin')) newValue = 'Panin'
                    else if (fullText.includes('mega')) newValue = 'Mega'
                    else if (fullText.includes('bukopin')) newValue = 'Bukopin'
                    else if (fullText.includes('sinarmas')) newValue = 'Sinarmas'
                    else {
                      // Use the text as bank name
                      newValue = fullText.trim().toUpperCase()
                    }
                  } else if (field === 'accountNumber' || field === 'phoneNumber' || field === 'meterNumber') {
                    const digits = fullText.replace(/\D/g, '')
                    if (digits) newValue = digits
                  } else if (field === 'ewallet') {
                    if (fullText.includes('gopay')) newValue = 'GoPay'
                    else if (fullText.includes('ovo')) newValue = 'OVO'
                    else if (fullText.includes('dana')) newValue = 'Dana'
                    else if (fullText.includes('shopeepay') || fullText.includes('shopee')) newValue = 'ShopeePay'
                    else if (fullText.includes('linkaja')) newValue = 'LinkAja'
                  } else if (field === 'provider') {
                    if (fullText.includes('telkomsel')) newValue = 'Telkomsel'
                    else if (fullText.includes('xl')) newValue = 'XL'
                    else if (fullText.includes('indosat')) newValue = 'Indosat'
                    else if (fullText.includes('tri') || fullText.includes('three')) newValue = 'Tri'
                    else if (fullText.includes('smartfren')) newValue = 'Smartfren'
                    else if (fullText.includes('axis')) newValue = 'Axis'
                  } else if (field === 'amount') {
                    const digits = fullText.replace(/\D/g, '')
                    if (digits) newValue = digits
                  } else if (field === 'grams') {
                    const match = fullText.match(/(\d+(?:[.,]\d+)?)/)
                    if (match) newValue = match[1].replace(',', '.')
                  }

                  if (newValue && extractedDataRef.current) {
                    const updatedData = { ...extractedDataRef.current, [field!]: newValue }
                    setExtractedData(updatedData)
                    setShowCorrectionPrompt(false)
                    setCorrectionMessage('')
                    setCorrectionField(null)
                    setTranscript('')

                    // Re-confirm with updated data
                    const confirmMsg = generateConfirmationText(updatedData)
                    // TTS: feedback.confirmation(confirmMsg)

                    // Restart listening for confirmation
                    // const ttsDelay = getTtsDelay(confirmMsg.length, 800)
                    setTimeout(() => {
                      if (recognitionRef.current) {
                        try {
                          intentionalCloseRef.current = false
                          recognitionRef.current.start()
                          setIsListening(true)
                        } catch (e) {}
                      }
                    }, 100) // Minimal delay
                  } else {
                    // Couldn't parse value - ask again
                    const retryMsg = getFieldValuePrompt(field!, extractedDataRef.current)
                    // TTS: speak(retryMsg, true)
                    setTranscript('')

                    // Restart listening after prompt
                    setTimeout(() => {
                      if (recognitionRef.current) {
                        try {
                          intentionalCloseRef.current = false
                          recognitionRef.current.start()
                          setIsListening(true)
                        } catch (e) {}
                      }
                    }, 100) // Minimal delay
                  }
                }, 3000) // 3 seconds of silence

                return
              }

              // Step 1: Identify which field user wants to correct
              let fieldToCorrect: string | null = null

              if (data.type === 'transfer') {
                if (lowerText.includes('bank')) {
                  fieldToCorrect = 'bank'
                } else if (lowerText.includes('rekening') || lowerText.includes('nomor')) {
                  fieldToCorrect = 'accountNumber'
                } else if (lowerText.includes('nominal') || lowerText.includes('jumlah')) {
                  fieldToCorrect = 'amount'
                }
              } else if (data.type === 'ewallet') {
                if (lowerText.includes('wallet') || lowerText.includes('ewallet')) {
                  fieldToCorrect = 'ewallet'
                } else if (lowerText.includes('hp') || lowerText.includes('nomor') || lowerText.includes('telepon')) {
                  fieldToCorrect = 'phoneNumber'
                } else if (lowerText.includes('nominal') || lowerText.includes('jumlah')) {
                  fieldToCorrect = 'amount'
                }
              } else if (data.type === 'pulsa') {
                if (lowerText.includes('provider')) {
                  fieldToCorrect = 'provider'
                } else if (lowerText.includes('hp') || lowerText.includes('nomor') || lowerText.includes('telepon')) {
                  fieldToCorrect = 'phoneNumber'
                } else if (lowerText.includes('nominal') || lowerText.includes('jumlah')) {
                  fieldToCorrect = 'amount'
                }
              } else if (data.type === 'gold') {
                if (lowerText.includes('gram')) {
                  fieldToCorrect = 'grams'
                } else if (lowerText.includes('nominal') || lowerText.includes('jumlah')) {
                  fieldToCorrect = 'amount'
                }
              } else if (data.type === 'token') {
                if (lowerText.includes('meter')) {
                  fieldToCorrect = 'meterNumber'
                } else if (lowerText.includes('nominal') || lowerText.includes('jumlah')) {
                  fieldToCorrect = 'amount'
                }
              }

              if (fieldToCorrect) {
                // Stop recognition to prevent picking up TTS
                intentionalCloseRef.current = true
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.stop()
                  } catch (e) {}
                }
                setIsListening(false)

                // Ask for the correct value
                setCorrectionField(fieldToCorrect)
                const valuePrompt = getFieldValuePrompt(fieldToCorrect, extractedDataRef.current)
                setCorrectionMessage(valuePrompt)
                setTranscript('') // Clear transcript for fresh value input
                setInterimTranscript('')
                // TTS: speak(valuePrompt, true)

                // Restart listening after TTS finishes
                setTimeout(() => {
                  // stopSpeaking() // Make sure TTS is stopped
                  if (recognitionRef.current) {
                    try {
                      intentionalCloseRef.current = false
                      recognitionRef.current.start()
                      setIsListening(true)
                    } catch (e) {}
                  }
                }, 100) // Minimal delay
                return
              } else {
                // Stop recognition to prevent picking up TTS
                intentionalCloseRef.current = true
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.stop()
                  } catch (e) {}
                }
                setIsListening(false)

                // Couldn't identify field - ask again
                const retryMsg = getCorrectionPrompt(data.type)
                setTranscript('') // Clear transcript
                setInterimTranscript('')
                // TTS: speak(retryMsg, true)

                // Restart listening after TTS finishes
                setTimeout(() => {
                  // stopSpeaking() // Make sure TTS is stopped
                  if (recognitionRef.current) {
                    try {
                      intentionalCloseRef.current = false
                      recognitionRef.current.start()
                      setIsListening(true)
                    } catch (e) {}
                  }
                }, 100) // Minimal delay
                return
              }
            }

            // Check for cancellation/correction words
            if (lowerText.includes('salah') || lowerText.includes('koreksi') || lowerText.includes('ganti')) {
              // User wants to correct - stop recognition first to prevent picking up TTS
              intentionalCloseRef.current = true
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.stop()
                } catch (e) {}
              }
              setIsListening(false)

              // Enter correction mode
              const correctionMsg = getCorrectionPrompt(extractedDataRef.current.type)
              setShowCorrectionPrompt(true)
              setCorrectionMessage(correctionMsg)
              setTranscript('') // Clear transcript
              setInterimTranscript('')
              // TTS: speak(correctionMsg, true)

              // Restart listening immediately
              setTimeout(() => {
                if (recognitionRef.current) {
                  try {
                    intentionalCloseRef.current = false
                    recognitionRef.current.start()
                    setIsListening(true)
                  } catch (e) {}
                }
              }, 100) // Minimal delay
              return
            }

            // Check for complete cancel
            if (lowerText.includes('batal') || lowerText.includes('ulangi') || lowerText.includes('cancel') || lowerText.includes('tidak')) {
              // User wants to cancel completely - restart
              intentionalCloseRef.current = true
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.stop()
                } catch (e) {}
              }
              setIsListening(false)

              // Voice feedback for cancellation
              // const cancelMsg = 'Oke, coba sebutin ulang transaksimu ya'
              // TTS: speak(cancelMsg, true)

              // Reset state and restart
              setTimeout(() => {
                setShowConfirmation(false)
                setShowCorrectionPrompt(false)
                setCorrectionMessage('')
                setCorrectionField(null)
                setExtractedData(null)
                setTranscript('')
                setConversationContext(null)
                setOriginalInput('')
                setAttemptsCount(0)
                setHadIncompleteAttempt(false)
                startRecording()
              }, 100) // Minimal delay
              return
            }

            // Check for confirmation words
            if (lowerText.includes('konfirmasi') || lowerText.includes('confirm') || lowerText.includes('ya') || lowerText.includes('oke') || lowerText.includes('ok') || lowerText.includes('lanjut') || lowerText.includes('benar') || lowerText.includes('betul')) {
              // User confirmed - proceed to payment
              intentionalCloseRef.current = true
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.stop()
                } catch (e) {}
              }
              setIsListening(false)
              setShowConfirmation(false)
              // Success feedback
              // vibrate('success')
              // TTS: speak('Oke, membuka halaman pembayaran')
              // Open payment URL - use location.href to avoid popup blocker
              const url = generateShareableUrl(extractedDataRef.current)
              window.location.href = url
              // Reset app state - return to default voice recording
              setTimeout(() => {
                // stopSpeaking()
                setExtractedData(null)
                setTranscript('')
                setInterimTranscript('')
                setShowCorrectionPrompt(false)
                setCorrectionMessage('')
                setCorrectionField(null)
                setSilenceCountdown(null)
                // Restart recording
                startRecording()
              }, 100) // Minimal delay
              return
            }
            // In confirmation mode but didn't say confirmation word - ignore
            setInterimTranscript('')
            return
          }
          setTranscript(prev => {
            const newTranscript = (prev ? prev + ' ' : '') + finalText
            transcriptRef.current = newTranscript // Update ref immediately to prevent race condition
            return newTranscript
          })
          setInterimTranscript('')
        }

        // Reset silence detection timer - user is speaking
        lastSpeechTimeRef.current = Date.now()

        // Clear any existing silence detection timer
        if (silenceDetectionRef.current) {
          clearTimeout(silenceDetectionRef.current)
        }

        // Start new silence detection (3 seconds) - but not in confirmation mode
        if (!showConfirmationRef.current) {
          silenceDetectionRef.current = setTimeout(() => {
            // User has been silent for 3 seconds, stop recording and extract immediately
            intentionalCloseRef.current = true // Prevent "no response" message
            if (recognitionRef.current) {
              recognitionRef.current.stop()
            }
            setIsListening(false)
            setInterimTranscript('')

            // Trigger immediate extraction by setting countdown to 0
            setSilenceCountdown(0)
          }, 3000) // 3 seconds of silence
        }
      }

      recognition.onerror = (event: any) => {
        setStatus({ message: '❌ Error: ' + event.error, type: 'error' })
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
        setInterimTranscript('')

        // Handle case where recognition ends with no speech
        if ((showConfirmationRef.current || showCorrectionPromptRef.current) && !intentionalCloseRef.current) {
          // In confirmation/correction mode - restart listening with longer delay for Safari
          setTimeout(() => {
            if (recognitionRef.current && (showConfirmationRef.current || showCorrectionPromptRef.current) && !intentionalCloseRef.current) {
              try {
                recognitionRef.current.start()
                setIsListening(true)
              } catch (e) {
                // Already running or failed - try again after short delay
                setTimeout(() => {
                  try {
                    recognitionRef.current?.start()
                    setIsListening(true)
                  } catch (e2) {}
                }, 300)
              }
            }
          }, 500)
        } else if (!transcriptRef.current.trim() && !extractedDataRef.current && !intentionalCloseRef.current) {
          // No transcript and no extracted data - show no response message
          setShowNoResponseMessage(true)
          // TTS: feedback.noResponse()

          // Auto-restart listening after feedback delay for voice-only experience
          setTimeout(() => {
            if (recognitionRef.current && !intentionalCloseRef.current) {
              setShowNoResponseMessage(false)
              try {
                recognitionRef.current.start()
              } catch (e) {
                // Already running or failed
              }
            }
          }, 100) // Minimal delay
        }
        // Reset intentional close flag
        intentionalCloseRef.current = false
      }

      recognitionRef.current = recognition
    }
  }, [])

  const startRecording = () => {
    if (recognitionRef.current) {
      setTranscript('') // Clear previous transcript
      setInterimTranscript('')
      setShowNoResponseMessage(false)

      // Clear any existing timers
      if (silenceDetectionRef.current) {
        clearTimeout(silenceDetectionRef.current)
        silenceDetectionRef.current = null
      }
      if (extractionTimeoutRef.current) {
        clearTimeout(extractionTimeoutRef.current)
        extractionTimeoutRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      if (noResponseTimeoutRef.current) {
        clearTimeout(noResponseTimeoutRef.current)
        noResponseTimeoutRef.current = null
      }
      setSilenceCountdown(null)

      lastSpeechTimeRef.current = Date.now()

      // Stop any TTS before starting recognition
      // stopSpeaking()

      recognitionRef.current.start()

      // Haptic feedback when starting to listen
      // vibrate('listening')

      // Set 5s timeout for no response (only for incomplete prompts)
      if (showIncompletePrompt) {
        noResponseTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current && !transcriptRef.current.trim()) {
            try {
              recognitionRef.current.stop()
            } catch (e) {
              // Recognition might already be stopped
            }
            setIsListening(false)
            setShowIncompletePrompt(false) // Clear incomplete prompt
            setShowNoResponseMessage(true)
          }
        }, 5000)
      }
    }
  }

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    // Clear all timers
    if (silenceDetectionRef.current) {
      clearTimeout(silenceDetectionRef.current)
      silenceDetectionRef.current = null
    }
    if (extractionTimeoutRef.current) {
      clearTimeout(extractionTimeoutRef.current)
      extractionTimeoutRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    setSilenceCountdown(null)
  }

  const handleCloseVoiceRecording = () => {
    // Mark as intentional close to prevent no response message
    intentionalCloseRef.current = true

    // Clear silence detection timer if user manually closes
    if (silenceDetectionRef.current) {
      clearTimeout(silenceDetectionRef.current)
      silenceDetectionRef.current = null
    }

    // Stop the recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
    setInterimTranscript('')

    // Clear conversation context
    setConversationContext(null)
    setShowIncompletePrompt(false)

    // Extract immediately when user closes (only if there's transcript)
    if (transcript.trim()) {
      setSilenceCountdown(0)
    }
  }

  // Sanitize input to prevent prompt injection and XSS
  const sanitizeInput = (input: string): string => {
    return input
      .replace(/[<>{}[\]\\]/g, '') // Remove potential injection characters
      .replace(/```/g, '') // Remove code blocks
      .replace(/\$/g, '') // Remove template literal markers
      .slice(0, 500) // Limit length to prevent abuse
      .trim()
  }

  const extractData = async (textToExtract: string) => {
    if (!textToExtract.trim()) {
      return
    }

    // Sanitize input before processing
    const sanitizedText = sanitizeInput(textToExtract)
    if (!sanitizedText) {
      return
    }

    // Track original input if this is the start of a new transaction
    if (!conversationContext) {
      setOriginalInput(sanitizedText)
      setAttemptsCount(1)
      setHadIncompleteAttempt(false)
    } else {
      // Increment attempts for continuation
      setAttemptsCount(prev => prev + 1)
    }

    setIsExtracting(true)

    try {
      console.log('Extracting from text:', sanitizedText)
      console.log('Conversation context:', conversationContext)

      // Use Claude API for extraction
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: sanitizedText,
          context: conversationContext
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        throw new Error(errorData.error || 'Failed to extract data')
      }

      const data = await response.json()

      console.log('Extracted data:', data)

      // Validate that we have a valid transaction type
      const enabledTypes = getEnabledTypes()
      if (!data.type || !enabledTypes.includes(data.type)) {
        console.error('Invalid or disabled transaction type:', data)
        if (data.type && !isTypeEnabled(data.type)) {
          throw new Error(`Maaf, transaksi ${data.type} sedang tidak tersedia.`)
        }
        throw new Error('Hmm, aku belum paham maksudnya. Coba bilang lagi ya, misalnya "transfer 100 ribu ke BCA 1234567890"')
      }

      // Validate Indonesian phone number for e-wallet and pulsa
      if ((data.type === 'ewallet' || data.type === 'pulsa') && data.phoneNumber && !data.incomplete) {
        const phone = data.phoneNumber.replace(/\s+/g, '')
        const isValidIndonesian = /^(\+62|62|0)8[1-9][0-9]{7,10}$/.test(phone)
        if (!isValidIndonesian) {
          console.error('Invalid Indonesian phone number:', data.phoneNumber)
          throw new Error('Nomor HP harus nomor Indonesia yang valid (contoh: 08123456789)')
        }
      }

      // Validate required fields are present (not undefined/null)
      if (!data.incomplete) {
        const missingFields: string[] = []
        let message = ''

        if (data.type === 'transfer') {
          if (!data.amount) missingFields.push('amount')
          if (!data.bank) missingFields.push('bank')
          if (!data.accountNumber) missingFields.push('accountNumber')

          if (missingFields.length > 0) {
            if (missingFields.includes('amount')) message = 'Nominalnya berapa?'
            else if (missingFields.includes('bank') && missingFields.includes('accountNumber')) message = 'Ke bank apa dan nomor rekening berapa?'
            else if (missingFields.includes('bank')) message = 'Ke bank apa?'
            else if (missingFields.includes('accountNumber')) message = 'Nomor rekeningnya berapa?'
          }
        } else if (data.type === 'ewallet') {
          if (!data.amount) missingFields.push('amount')
          if (!data.ewallet) missingFields.push('ewallet')
          if (!data.phoneNumber) missingFields.push('phoneNumber')

          if (missingFields.length > 0) {
            if (missingFields.includes('amount') && missingFields.includes('phoneNumber')) message = 'Nominal berapa dan ke nomor HP berapa?'
            else if (missingFields.includes('amount')) message = 'Nominal berapa?'
            else if (missingFields.includes('phoneNumber')) message = 'Ke nomor HP berapa?'
            else if (missingFields.includes('ewallet')) message = 'E-wallet apa?'
          }
        } else if (data.type === 'pulsa') {
          if (!data.amount) missingFields.push('amount')
          if (!data.phoneNumber) missingFields.push('phoneNumber')

          if (missingFields.length > 0) {
            if (missingFields.includes('phoneNumber')) message = 'Ke nomor HP berapa?'
            else if (missingFields.includes('amount')) message = 'Nominal berapa?'
          }
        } else if (data.type === 'token') {
          if (!data.amount) missingFields.push('amount')
          if (!data.meterNumber) missingFields.push('meterNumber')

          if (missingFields.length > 0) {
            if (missingFields.includes('meterNumber')) message = 'Nomor meter PLN-nya berapa?'
            else if (missingFields.includes('amount')) message = 'Nominal berapa?'
          }
        } else if (data.type === 'gold') {
          if (!data.amount) missingFields.push('amount')
          if (!data.grams) missingFields.push('grams')

          if (missingFields.length > 0) {
            if (missingFields.includes('grams')) message = 'Berapa gram?'
            else if (missingFields.includes('amount')) message = 'Nominal berapa?'
          }
        }

        // Convert to incomplete if any required fields are missing
        if (missingFields.length > 0) {
          const partialData = { ...data }
          delete partialData.incomplete

          data.incomplete = true
          data.partialData = partialData
          data.missingFields = missingFields
          data.message = message
        }
      }

      // Check if the command is incomplete
      if (data.incomplete) {
        console.log('Incomplete command detected:', data)

        // Mark that we had an incomplete attempt
        setHadIncompleteAttempt(true)

        // Store the partial data and message
        setConversationContext(data)
        const incompleteMsg = data.message || 'Ada data yang masih kurang. Bisa sebutkan lagi?'
        setIncompleteMessage(incompleteMsg)
        setShowIncompletePrompt(true)

        // Voice feedback for missing info
        // TTS: feedback.askForInfo(incompleteMsg)

        // Stop extracting to remove loading
        setIsExtracting(false)
        setIsProcessingComplete(false)

        // After showing the message with typing effect, automatically restart recording to continue conversation
        // Calculate delay based on message length for natural reading time
        const typingDelay = (data.message?.length || 50) * 30 // 30ms per character
        const readingDelay = 1000 // 1 second for reading
        const totalDelay = typingDelay + readingDelay

        setTimeout(() => {
          // Keep showIncompletePrompt true - it will be cleared when user starts speaking
          setTranscript('')
          startRecording()
        }, totalDelay)
        return // Exit early to prevent setting isExtracting in finally block
      } else {
        // Command is complete - show "Memproses permintaanmu..."
        setIsProcessingComplete(true)

        let finalData = data

        // Check if this is a continuation of previous incomplete transaction or a new one
        if (conversationContext && conversationContext.partialData &&
            data.type === conversationContext.type) {
          // This appears to be a continuation, merge the data
          const mergedData = {
            ...conversationContext.partialData,
            ...data,
          }
          setExtractedData(mergedData)
          finalData = mergedData
        } else {
          // This is either a new transaction or the user changed their mind
          setExtractedData(data)
        }

        // Show confirmation and start listening for "konfirmasi"
        setShowConfirmation(true)
        setTranscript('')
        setIsExtracting(false)

        // Generate and speak confirmation message
        const confirmMsg = generateConfirmationText(finalData)
        // TTS: feedback.confirmation(confirmMsg)

        // Start listening for confirmation
        setTimeout(() => {
          if (recognitionRef.current) {
            try {
              // Clear any existing timers
              if (silenceDetectionRef.current) {
                clearTimeout(silenceDetectionRef.current)
                silenceDetectionRef.current = null
              }
              lastSpeechTimeRef.current = Date.now()
              recognitionRef.current.start()
            } catch (e) {
              // Recognition might already be running
            }
          }
        }, 100) // Minimal delay

        // Send feedback for learning - successful transaction!
        try {
          await fetch('/api/feedback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              originalInput: originalInput || textToExtract,
              extractedData: finalData,
              wasIncomplete: hadIncompleteAttempt,
              attemptsCount: attemptsCount
            }),
          })
          console.log('Learning feedback sent successfully')
        } catch (feedbackError) {
          // Silently fail - learning is optional
          console.log('Could not send learning feedback:', feedbackError)
        }

        // Clear context and reset tracking
        setConversationContext(null)
        setOriginalInput('')
        setAttemptsCount(0)
        setHadIncompleteAttempt(false)
      }
    } catch (error) {
      console.error('Error:', error)
      // Show error popup
      const errorMsg = (error as Error).message || 'Duh, aku lagi ada masalah nih. Coba lagi ya!'
      setErrorMessage(errorMsg)
      setShowErrorPopup(true)
      // Voice and haptic feedback for error
      // TTS: feedback.error(errorMsg)
    } finally {
      setIsExtracting(false)
      setIsProcessingComplete(false)
    }
  }

  // Auto-extract data after silence countdown
  useEffect(() => {
    if (silenceCountdown === 0 && transcript.trim() && !extractedData) {
      // Start extraction (isExtracting will keep the screen visible)
      extractData(transcript)
      // Clear countdown after extraction starts to prevent re-triggering
      setSilenceCountdown(null)
    }
  }, [silenceCountdown, transcript, extractedData])

  const formatAmount = (amount?: string | number) => {
    if (!amount) return '0'
    const numAmount = typeof amount === 'string' ? amount : amount.toString()
    return numAmount.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  // Convert number to Indonesian words for TTS
  const numberToWords = (num: number): string => {
    if (num === 0) return 'nol'

    const ones = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan']
    const teens = ['sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas']

    const convert = (n: number): string => {
      if (n === 0) return ''
      if (n < 10) return ones[n]
      if (n < 20) return teens[n - 10]
      if (n < 100) {
        const tens = Math.floor(n / 10)
        const remainder = n % 10
        return (tens === 1 ? 'sepuluh' : ones[tens] + ' puluh') + (remainder ? ' ' + ones[remainder] : '')
      }
      if (n < 1000) {
        const hundreds = Math.floor(n / 100)
        const remainder = n % 100
        return (hundreds === 1 ? 'seratus' : ones[hundreds] + ' ratus') + (remainder ? ' ' + convert(remainder) : '')
      }
      if (n < 1000000) {
        const thousands = Math.floor(n / 1000)
        const remainder = n % 1000
        return (thousands === 1 ? 'seribu' : convert(thousands) + ' ribu') + (remainder ? ' ' + convert(remainder) : '')
      }
      if (n < 1000000000) {
        const millions = Math.floor(n / 1000000)
        const remainder = n % 1000000
        return convert(millions) + ' juta' + (remainder ? ' ' + convert(remainder) : '')
      }
      if (n < 1000000000000) {
        const billions = Math.floor(n / 1000000000)
        const remainder = n % 1000000000
        return convert(billions) + ' miliar' + (remainder ? ' ' + convert(remainder) : '')
      }
      return num.toString()
    }

    return convert(num)
  }

  const formatAmountToWords = (amount?: string | number) => {
    if (!amount) return 'nol'
    const num = typeof amount === 'string' ? parseInt(amount.replace(/\D/g, '')) : amount
    return numberToWords(num)
  }

  // Spell out digits for account numbers and phone numbers
  // Group digits with strong pauses to prevent TTS from interpreting as large numbers
  const spellDigits = (numStr?: string) => {
    if (!numStr) return ''
    const digitWords = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan']
    const digits = numStr.replace(/\D/g, '').split('').map(d => digitWords[parseInt(d)])

    // Group digits in sets of 3 with periods for strong pauses
    const groups: string[] = []
    for (let i = 0; i < digits.length; i += 3) {
      groups.push(digits.slice(i, i + 3).join(' '))
    }
    return groups.join('. ')
  }

  const generateConfirmationText = (data: TransactionData) => {
    const amount = formatAmountToWords(data.amount)

    if (data.type === 'transfer') {
      return `Transfer ${amount} rupiah ke ${data.bank}, nomor rekening ${spellDigits(data.accountNumber)}. Sudah benar?`
    } else if (data.type === 'ewallet') {
      return `Top up ${data.ewallet} ${amount} rupiah ke nomor ${spellDigits(data.phoneNumber)}. Sudah benar?`
    } else if (data.type === 'pulsa') {
      return `Beli pulsa ${data.provider} ${amount} rupiah ke nomor ${spellDigits(data.phoneNumber)}. Sudah benar?`
    } else if (data.type === 'gold') {
      return `Beli emas ${data.grams} gram senilai ${amount} rupiah. Sudah benar?`
    } else if (data.type === 'token') {
      return `Token listrik ${amount} rupiah untuk meter ${spellDigits(data.meterNumber)}. Sudah benar?`
    }
    return 'Sudah benar?'
  }

  const generateShareableUrl = (data: TransactionData): string => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

    // Prepare payment data
    const paymentData: Record<string, unknown> = {
      type: data.type,
      amount: data.amount
    }

    // Add type-specific data
    if (data.type === 'transfer') {
      paymentData.bank = data.bank
      paymentData.accountNumber = data.accountNumber
    } else if (data.type === 'ewallet') {
      paymentData.ewallet = data.ewallet
      paymentData.phoneNumber = data.phoneNumber
    } else if (data.type === 'pulsa') {
      paymentData.provider = data.provider
      paymentData.phoneNumber = data.phoneNumber
    } else if (data.type === 'gold') {
      paymentData.grams = data.grams
    } else if (data.type === 'token') {
      paymentData.meterNumber = data.meterNumber
    }

    // Generate URL with base64 encoded data (instant, no API call)
    const token = btoa(JSON.stringify(paymentData))
    return `${baseUrl}/payment?data=${encodeURIComponent(token)}`
  }

  const handleCloseOnboarding = () => {
    setShowOnboarding(false)
  }

  const handleGetStarted = () => {
    setShowOnboarding(false)
    // Auto-start recording immediately
    setTimeout(() => {
      startRecording()
    }, 300)
  }

  // Screen reader announcement text
  const getScreenReaderAnnouncement = () => {
    if (isListening) return 'Jingga sedang mendengarkan. Silakan bicara.'
    if (isExtracting) return 'Sedang memproses permintaan Anda.'
    if (showCorrectionPrompt) return correctionMessage
    if (showConfirmation && extractedData) return generateConfirmationText(extractedData)
    if (showErrorPopup) return `Terjadi kesalahan: ${errorMessage}`
    if (showNoResponseMessage) return 'Tidak ada suara terdeteksi. Silakan coba lagi.'
    if (showIncompletePrompt) return incompleteMessage
    return ''
  }

  return (
    <>
      {/* Screen Reader Announcer */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0
        }}
      >
        {getScreenReaderAnnouncement()}
      </div>

      {/* Onboarding Screen */}
      {showOnboarding && (
        <Onboarding
          onClose={handleCloseOnboarding}
          onGetStarted={handleGetStarted}
        />
      )}

      {/* Voice Recording Screen */}
      {(isListening || silenceCountdown !== null || showErrorPopup || isExtracting || showIncompletePrompt || showNoResponseMessage || showConfirmation) && (
        <VoiceRecording
          isListening={isListening}
          transcript={transcript.trim()}
          interimTranscript={interimTranscript}
          onClose={() => {
            handleCloseVoiceRecording()
            setShowConfirmation(false)
            setShowCorrectionPrompt(false)
            setCorrectionMessage('')
            setCorrectionField(null)
            setExtractedData(null)
          }}
          silenceCountdown={silenceCountdown}
          showError={showErrorPopup}
          errorMessage={errorMessage}
          onRetry={() => {
            setShowErrorPopup(false)
            setErrorMessage('')
            setTranscript('')
            setConversationContext(null)
            setOriginalInput('')
            setAttemptsCount(0)
            setHadIncompleteAttempt(false)
            setShowCorrectionPrompt(false)
            setCorrectionMessage('')
            setCorrectionField(null)
            startRecording()
          }}
          onBackToStart={() => {
            setShowErrorPopup(false)
            setErrorMessage('')
            setTranscript('')
            setConversationContext(null)
            setOriginalInput('')
            setAttemptsCount(0)
            setHadIncompleteAttempt(false)
            setShowCorrectionPrompt(false)
            setCorrectionMessage('')
            setCorrectionField(null)
            setShowOnboarding(true)
          }}
          isExtracting={isExtracting}
          showIncomplete={showIncompletePrompt}
          incompleteMessage={incompleteMessage}
          isProcessingComplete={isProcessingComplete}
          showNoResponse={showNoResponseMessage}
          onRetryAfterNoResponse={() => {
            setShowNoResponseMessage(false)
            setOriginalInput('')
            setAttemptsCount(0)
            setHadIncompleteAttempt(false)
            startRecording()
          }}
          showConfirmation={showConfirmation}
          confirmationData={extractedData}
          showCorrectionPrompt={showCorrectionPrompt}
          correctionMessage={correctionMessage}
        />
      )}

    </>
  )
}
