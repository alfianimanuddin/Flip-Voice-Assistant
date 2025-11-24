'use client'

import { isTypeEnabled } from '../config/transactionTypes'

interface OnboardingProps {
  onClose: () => void
  onGetStarted: () => void
}

export default function Onboarding({ onClose, onGetStarted }: OnboardingProps) {

  const allExamples = [
    {
      type: 'transfer',
      title: "Transfer antar bank",
      icon: (
        <svg className="w-8 h-8" style={{ color: '#FD6542' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
        </svg>
      )
    },
    {
      type: 'ewallet',
      title: "Top Up E-Wallet",
      icon: (
        <svg className="w-8 h-8" style={{ color: '#FD6542' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>
      )
    },
    {
      type: 'pulsa',
      title: "Beli Pulsa",
      icon: (
        <svg className="w-8 h-8" style={{ color: '#FD6542' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
        </svg>
      )
    },
    {
      type: 'token',
      title: "Beli Token Listrik",
      icon: (
        <svg className="w-8 h-8" style={{ color: '#FD6542' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      )
    },
    {
      type: 'gold',
      title: "Beli Emas",
      icon: (
        <svg className="w-8 h-8" style={{ color: '#FD6542' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      )
    },
    {
      type: 'sedekah',
      title: "Bersedekah",
      icon: (
        <svg className="w-8 h-8" style={{ color: '#FD6542' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
      )
    }
  ]

  // Filter examples based on enabled transaction types
  const examples = allExamples.filter(example =>
    example.type === null || isTypeEnabled(example.type)
  )

  const handleGetStarted = () => {
    onGetStarted()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-6 left-6 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-50 transition focus:outline-none focus:ring-4 focus:ring-orange-500 focus:ring-offset-2"
        aria-label="Tutup layar sambutan"
        type="button"
      >
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 id="onboarding-title" className="text-3xl font-bold mb-3">
            <span style={{ color: '#FD6542' }}>Halo, Alfian! <span aria-label="waving hand">👋</span></span>
          </h1>
          <p id="onboarding-description" className="text-gray-600 text-lg">
            Ada kebutuhan apa di Flip? Jingga siap bantu dengan beberapa hal berikut.
          </p>
        </div>

        {/* What can I help with */}
        <div className="mb-8">
          <h2 className="sr-only">Berikut adalah transaksi yang bisa diproses oleh Jingga</h2>
          <div className="grid grid-cols-2 gap-3" role="list" aria-label="Berikut adalah transaksi yang bisa diproses oleh Jingga">
            {examples.map((example, index) => (
              <div
                key={index}
                className="p-5 rounded-3xl bg-white/60"
                role="listitem"
                aria-label={example.title}
              >
                <div className="flex flex-col items-center gap-2">
                  <span className='mb-1' aria-hidden="true">
                    {example.icon}
                  </span>
                  <span className="text-gray-700 text-sm font-medium text-center">
                    {example.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Fixed Bottom Container */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white/80 to-transparent backdrop-blur-sm">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleGetStarted}
            className="w-full text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3 hover:opacity-90"
            style={{ background: 'linear-gradient(to right, #FD6542, #FF8C5A)' }}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/>
            </svg>
            Mulai Bicara
          </button>
          <p className="text-gray-500 text-sm text-center mt-3 flex items-center justify-center gap-1">
            <svg className="w-4 h-4" fill="#00880D" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            Datamu dijamin 100% aman
          </p>
        </div>
      </div>
    </div>
  )
}
