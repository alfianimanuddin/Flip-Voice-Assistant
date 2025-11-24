# Voice Transfer App

Voice-to-text transfer data extraction application using Next.js, TypeScript, and Claude AI.

## Features

- 🎤 Voice Recording with Speech Recognition API
- 📝 Auto Transcription (Indonesian language)
- 🤖 Claude AI Integration for data extraction
- 💳 Beautiful UI with transfer details display
- 🔒 Secure API key management

## Prerequisites

- Node.js 18+ installed
- Anthropic API key (get it from https://console.anthropic.com/settings/keys)

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Configure API Key:**

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=your_actual_api_key_here
```

## Running the App

### Development Mode
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm start
```

## Usage

1. **Click "Mulai Rekam"** to start voice recording
2. **Speak your transfer command** in Indonesian, for example:
   - "Saya mau transfer 100.000 ke BCA 3790252895"
   - "Transfer 500 ribu ke Mandiri 1234567890"
   - "Kirim uang 1 juta ke BNI rekening 9876543210"
3. **Click "Stop"** when finished speaking
4. **Click "Extract Data Transfer"** to process with Claude AI
5. **View the extracted data** in the result section

## Supported Commands

The app understands various Indonesian transfer commands:
- ✅ "transfer", "kirim", "transfer uang"
- ✅ Numbers with "ribu" (thousands) or "juta" (millions)
- ✅ Bank names: BCA, Mandiri, BNI, BRI, CIMB, Permata, etc.
- ✅ Account numbers (digits only)

## Browser Compatibility

Speech Recognition works best on:
- ✅ Chrome (Desktop & Mobile)
- ✅ Edge (Desktop)
- ❌ Firefox (Limited support)
- ❌ Safari (Not supported)

## Project Structure

```
voice-transfer-app/
├── app/
│   ├── api/
│   │   └── extract/
│   │       └── route.ts          # API endpoint for Claude extraction
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page component
├── .env.local                    # Environment variables (API key)
├── .env.example                  # Environment variables template
├── next.config.js                # Next.js configuration
├── package.json                  # Dependencies
├── tailwind.config.js            # Tailwind CSS configuration
└── tsconfig.json                 # TypeScript configuration
```

## API Endpoint

### POST /api/extract

Extract transfer data from text using Claude AI.

**Request Body:**
```json
{
  "text": "Saya mau transfer 100.000 ke BCA 3790252895"
}
```

**Response:**
```json
{
  "amount": "100000",
  "bank": "BCA",
  "accountNumber": "3790252895"
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Yes |

## Security Notes

- ✅ API key is stored securely in `.env.local`
- ✅ API calls are made from the backend (Next.js API routes)
- ✅ `.env.local` is excluded from git
- ⚠️ Never commit your API key to version control

## Troubleshooting

### Speech Recognition not working
- Make sure you're using Chrome or Edge browser
- Allow microphone access when prompted
- Check browser console for errors

### API extraction failing
- Verify your `ANTHROPIC_API_KEY` is set correctly in `.env.local`
- Check if you have API credits in your Anthropic account
- Review the browser console and server logs for error messages

### Build errors
- Try deleting `node_modules` and `.next` folders, then run `npm install` again
- Make sure you're using Node.js 18 or higher

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add `ANTHROPIC_API_KEY` environment variable in Vercel dashboard
4. Deploy!

### Other Platforms

Make sure to:
- Set the `ANTHROPIC_API_KEY` environment variable
- Use Node.js 18+ runtime
- Build command: `npm run build`
- Start command: `npm start`

## License

MIT

## Support

For issues or questions, please open an issue on GitHub or contact support.
# Flip-Voice-Assistant
# Flip-Voice-Assistant
