'use client'

import { useRef, useCallback } from 'react'

interface UseFeedbackOptions {
  voice?: string
  rate?: number
  pitch?: number
  volume?: number
}

export function useFeedback(options: UseFeedbackOptions = {}) {
  const {
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0
  } = options

  const isSpeakingRef = useRef(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Text-to-Speech
  const speak = useCallback((text: string, priority: boolean = false) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('Speech synthesis not supported')
      return
    }

    // Cancel current speech if priority
    if (priority && isSpeakingRef.current) {
      window.speechSynthesis.cancel()
    }

    // Don't interrupt if already speaking and not priority
    if (isSpeakingRef.current && !priority) {
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'id-ID'
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume

    // Try to find Indonesian voice
    const voices = window.speechSynthesis.getVoices()
    const indonesianVoice = voices.find(v => v.lang.includes('id')) || voices[0]
    if (indonesianVoice) {
      utterance.voice = indonesianVoice
    }

    utterance.onstart = () => {
      isSpeakingRef.current = true
    }

    utterance.onend = () => {
      isSpeakingRef.current = false
    }

    utterance.onerror = () => {
      isSpeakingRef.current = false
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [rate, pitch, volume])

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      isSpeakingRef.current = false
    }
  }, [])

  // Haptic feedback patterns
  const vibrate = useCallback((pattern: 'success' | 'error' | 'warning' | 'tap' | 'listening') => {
    if (typeof navigator === 'undefined' || !navigator.vibrate) {
      return
    }

    const patterns: Record<string, number | number[]> = {
      tap: 50,           // Quick tap
      success: [100, 50, 100],  // Double pulse
      error: [200, 100, 200, 100, 200],  // Triple long pulse
      warning: [100, 100, 100],  // Triple short
      listening: [50, 50, 50, 50, 50]  // Ripple effect
    }

    try {
      navigator.vibrate(patterns[pattern] || 50)
    } catch (error) {
      console.warn('Vibration failed:', error)
    }
  }, [])

  // Combined feedback for different scenarios
  const feedback = {
    // When starting to listen
    startListening: useCallback(() => {
      vibrate('listening')
      speak('Aku mendengarkan')
    }, [vibrate, speak]),

    // When stopping to listen
    stopListening: useCallback(() => {
      vibrate('tap')
    }, [vibrate]),

    // When processing/extracting
    processing: useCallback(() => {
      speak('Sedang memproses')
    }, [speak]),

    // When extraction is complete - confirmation
    confirmation: useCallback((message: string) => {
      vibrate('success')
      speak(message, true)
    }, [vibrate, speak]),

    // When there's an error
    error: useCallback((message: string) => {
      vibrate('error')
      speak(message, true)
    }, [vibrate, speak]),

    // When asking for missing info
    askForInfo: useCallback((message: string) => {
      vibrate('warning')
      speak(message, true)
    }, [vibrate, speak]),

    // When no response detected
    noResponse: useCallback(() => {
      vibrate('warning')
      speak('Hmm, aku nggak dengar suaramu. Coba bicara lagi ya!')
    }, [vibrate, speak]),

    // When transaction is successful
    success: useCallback((message: string) => {
      vibrate('success')
      speak(message, true)
    }, [vibrate, speak]),

    // Simple tap feedback
    tap: useCallback(() => {
      vibrate('tap')
    }, [vibrate])
  }

  return {
    speak,
    stopSpeaking,
    vibrate,
    feedback,
    isSpeaking: isSpeakingRef.current
  }
}
