# LLM Comparison Tool

A modern Next.js application that allows you to compare responses from multiple Large Language Model (LLM) providers side by side. Compare OpenAI GPT, Anthropic Claude, Google Gemini, and Cohere in real-time.

## Features

- **Multi-Provider Support**: Compare responses from OpenAI, Anthropic, Google, Cohere, and Grok
- **Side-by-Side Comparison**: See responses from multiple providers simultaneously
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS
- **Secure API Key Management**: Local storage for API keys with security warnings
- **Real-Time Chat**: Interactive chat interface with message history
- **Provider Selection**: Choose which providers to query for each conversation

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- API keys for the LLM providers you want to use:
  - [OpenAI API Key](https://platform.openai.com/api-keys)
  - [Anthropic API Key](https://console.anthropic.com/)
  - [Google AI Studio API Key](https://makersuite.google.com/app/apikey)
  - [Cohere API Key](https://dashboard.cohere.com/api-keys)
  - [Grok API Key (xAI)](https://console.x.ai/)

## Security Features

The application includes comprehensive security measures:

- **Rate Limiting**: Per-IP rate limiting to prevent abuse
- **Input Validation**: All inputs are validated and sanitized
- **Security Headers**: CSP, HSTS, X-Frame-Options, and more
- **CORS Protection**: Configurable CORS for API routes
- **Error Sanitization**: Errors don't leak sensitive information
- **Server-Side API Keys**: Optional server-side API key storage

See [docs/SECURITY.md](docs/SECURITY.md) for detailed security documentation.

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd llm-comparison-tool
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Docker Setup

### Production Build

Build and run the production Docker image:

```bash
# Build the image
docker build -t llm-comparison-tool .

# Run the container
docker run -p 3000:3000 llm-comparison-tool
```

Or use Docker Compose:

```bash
docker-compose up -d
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Development Build

For development with hot-reloading:

```bash
# Using Docker Compose
docker-compose -f docker-compose.dev.yml up

# Or build and run manually
docker build -f Dockerfile.dev -t llm-comparison-tool-dev .
docker run -p 3000:3000 -v $(pwd):/app llm-comparison-tool-dev
```

## Usage

### Setting Up API Keys

1. Navigate to the Settings page (click "Settings" in the header)
2. Enter your API keys for each provider you want to use
3. Click "Save" for each provider
4. API keys are stored locally in your browser's localStorage

**⚠️ Security Warning**: API keys are stored in browser localStorage, which is not secure for production use. See [API_SAFETY.md](docs/API_SAFETY.md) for security best practices.

### Using the Chat Interface

1. Select one or more providers using the checkboxes
2. Type your message in the input field
3. Press Enter or click "Send" to submit
4. View responses from all selected providers side by side
5. Each response is labeled with its provider name

### Features

- **Multi-Provider Queries**: Select multiple providers to compare their responses
- **Message History**: All messages are preserved in the conversation
- **Error Handling**: Clear error messages for missing API keys or API errors
- **Loading States**: Visual feedback while waiting for responses
- **Clear Chat**: Reset the conversation at any time

## Project Structure

```
llm-comparison-tool/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── settings/          # Settings page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main chat page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ChatInterface.tsx
│   ├── MessageList.tsx
│   ├── MessageInput.tsx
│   ├── ProviderSelector.tsx
│   └── SettingsForm.tsx
├── lib/                   # Utility libraries
│   ├── providers/         # LLM provider implementations
│   ├── provider-registry.ts
│   └── storage.ts         # API key storage
├── types/                 # TypeScript type definitions
└── docs/                  # Documentation
```

## Configuration

### Environment Variables

The application supports both client-side and server-side API key storage:

**Client-Side (Default):**
- API keys are stored in browser localStorage
- Configure via the Settings page

**Server-Side (Recommended for Production):**
- Store API keys as environment variables
- Create a `.env.local` file (see `.env.example` for template):
  ```env
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=sk-ant-...
  GOOGLE_API_KEY=...
  COHERE_API_KEY=...
  ```

**Configuration Options:**
- `RATE_LIMIT_WINDOW_MS`: Rate limit window (default: 60000ms)
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 10)
- `RATE_LIMIT_MAX_PROMPT_LENGTH`: Max prompt length (default: 10000)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins
- `ENABLE_CORS`: Enable CORS (default: true)
- `MAX_REQUEST_SIZE_MB`: Max request size in MB (default: 10)
- `REQUEST_TIMEOUT_MS`: Request timeout (default: 60000ms)

See [docs/SECURITY.md](docs/SECURITY.md) for complete security configuration.

### Provider Models

Default models used by each provider:
- **OpenAI**: `gpt-3.5-turbo`
- **Anthropic**: `claude-3-sonnet-20240229`
- **Google**: `gemini-pro`
- **Cohere**: `command`

You can modify these in the provider implementation files under `lib/providers/`.

## Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Security Considerations

This application stores API keys in browser localStorage, which is **not secure** for production use. For production applications:

- Use server-side storage with encryption
- Implement environment variables
- Use secure key management services (AWS Secrets Manager, HashiCorp Vault, etc.)
- Never commit API keys to version control

See [docs/API_SAFETY.md](docs/API_SAFETY.md) and [docs/BEST_PRACTICES.md](docs/BEST_PRACTICES.md) for detailed security guidelines.

## Troubleshooting

### API Key Issues

- Ensure API keys are correctly entered in Settings
- Check that API keys have sufficient credits/quota
- Verify API keys are not expired or revoked

### Rate Limiting

- Each provider has rate limits
- If you hit rate limits, wait before retrying
- Consider implementing request queuing for high-volume usage

### Provider Errors

- Check provider status pages for outages
- Verify your account has access to the selected models
- Review error messages for specific issues

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions, please open an issue on the repository.
