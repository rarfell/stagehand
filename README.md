# Open Operator

A fork of [browserbase/open-operator](https://github.com/browserbase/open-operator) - A template for building web agents with Stagehand on Browserbase.

## Overview

Open Operator is a web agent that can:
- Navigate websites autonomously
- Execute actions based on natural language instructions
- Extract structured data from web pages
- Handle user interactions and follow-up tasks

## Key Features

- Browser automation powered by Browserbase
- Natural language understanding with GPT-4
- Voice feedback for actions
- Interactive user interface for action selection

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
```

3. Set up your API keys:
- `OPENAI_API_KEY`: Your OpenAI API key
- `BROWSERBASE_API_KEY`: Your Browserbase API key
- `BROWSERBASE_PROJECT_ID`: Your Browserbase project ID

4. Run the development server:
```bash
pnpm dev
```

Visit `http://localhost:3000` to start using Open Operator.

## License

MIT License
