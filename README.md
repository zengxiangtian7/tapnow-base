# TapNow — AI Multimodal Canvas

A node-based infinite canvas for building and running AI generation workflows. Connect text, images, and video nodes to create multi-step pipelines powered by leading image and video models.

![License](https://img.shields.io/badge/license-MIT-blue) ![Vite](https://img.shields.io/badge/vite-6.x-646cff) ![React](https://img.shields.io/badge/react-19-61dafb) ![TypeScript](https://img.shields.io/badge/typescript-5.8-3178c6)

---

## Features

- **Infinite canvas** — pan, zoom, and freely arrange nodes
- **Node-based workflow** — connect outputs to inputs across nodes to chain generation steps
- **Image generation** — Text → Image, Image → Image (edit/variation)
- **Video generation** — Text → Video, Image → Video, Start+End frame → Video
- **Creative description node** — AI-powered prompt optimizer before generation
- **Multi-model support** — switch models per node; supports batch generation
- **Dark / light theme**
- **Local persistence** — canvas state saved to localStorage; export/import as JSON
- **CORS proxy** — built-in dev-server proxy for third-party API calls

---

## Supported Models

### Image

| Name | ID | Notes |
|---|---|---|
| Banana Pro | `gemini-3-pro-image-preview` | Chat-based, supports edit |
| Banana | `gemini-2.5-flash-image-preview` | Chat-based |
| Flux 2 | `flux-kontext-pro` | Standard image gen |
| Jimeng 4.5 | `doubao-seedream-4-5-251128` | Up to 4k |
| Jimeng 4 | `doubao-seedream-4-0-250828` | 1k only |
| Midjourney | `mj_modal` | Via MJ modal endpoint |
| Qwen Zimage | `z-image-turbo` | Standard image gen |

### Video

| Name | ID | Notes |
|---|---|---|
| Sora 2 | `sora-2` | Up to 12s, 1080p |
| Veo 3.1 Fast | `veo3.1` | 720p / 1080p |
| Veo 3.1 Pro | `veo3.1-pro` | 720p / 1080p |
| Hailuo 2.0 | `MiniMax-Hailuo-02` | MiniMax |
| Hailuo 2.3 | `MiniMax-Hailuo-2.3` | MiniMax |
| Kling O1 Pro | `kling-omni-video` | Kling Omni |
| Kling 2.5 Pro | `kling-v2-5-turbo` | Standard Kling |
| Jimeng 3.5 | `doubao-seedance-1-5-pro` | Seedance |
| Qwen Wan 2.6 | `wan2.6-i2v` | Alibaba |

Custom models can be added at runtime via the Settings panel.

---

## Tech Stack

- [Vite 6](https://vitejs.dev/) + [React 19](https://react.dev/) + [TypeScript 5.8](https://www.typescriptlang.org/)
- [Lucide React](https://lucide.dev/) for icons
- [@google/genai](https://www.npmjs.com/package/@google/genai) SDK
- No UI framework — fully custom canvas and components

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- [pnpm](https://pnpm.io/) (recommended) or npm

### Install

```bash
# Clone the repo
git clone https://github.com/your-username/tapnow-base.git
cd tapnow-base

# Install dependencies (pnpm recommended — pnpm-lock.yaml is the source of truth)
pnpm install
```

### Configure API Keys

The app reads API credentials from the in-app Settings panel (stored in `localStorage`). No `.env` file is required for normal use.

Optionally, you can pre-seed a default key via environment variables:

```bash
# .env.local  (never commit this file)
GEMINI_API_KEY=your_key_here
API_BASE_URL=https://your-proxy-or-api-endpoint.com
```

These values are injected at build time as `process.env.API_KEY` and `process.env.GEMINI_API_KEY`.

### Run in Development

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

> **Note:** The dev server listens on `0.0.0.0:3001` to avoid IPv4/IPv6 binding issues on Windows.

### Build for Production

```bash
pnpm build
```

Output is written to `dist/`. Preview the production build locally:

```bash
pnpm preview
```

---

## Project Structure

```
tapnow-base/
├── index.html
├── index.tsx              # Entry point
├── App.tsx                # Root component, canvas state
├── types.ts               # Shared TypeScript types
├── vite.config.ts         # Vite config + CORS proxy plugin
│
├── components/
│   ├── Canvas.tsx         # Infinite canvas renderer
│   ├── Sidebar.tsx        # Node palette + history panel
│   ├── ThemeSwitcher.tsx
│   ├── Icons.tsx
│   ├── Nodes/
│   │   ├── BaseNode.tsx           # Draggable/resizable node shell
│   │   ├── NodeContent.tsx        # Node type router
│   │   ├── TextToImageNode.tsx
│   │   ├── TextToVideoNode.tsx
│   │   ├── ImageToImageNode.tsx
│   │   ├── ImageToVideoNode.tsx
│   │   ├── StartEndToVideoNode.tsx
│   │   ├── CreativeDescNode.tsx
│   │   ├── OriginalImageNode.tsx
│   │   └── Shared/
│   └── Settings/
│       ├── SettingsModal.tsx      # API key + model config
│       ├── StorageModal.tsx       # LocalStorage management
│       ├── ExportImportModal.tsx  # Canvas JSON export/import
│       └── WelcomeModal.tsx
│
└── services/
    ├── geminiService.ts           # Public generation API
    ├── storageService.ts          # LocalStorage abstraction
    ├── env.ts                     # Env var defaults
    └── mode/
        ├── config.ts              # Model registry + CRUD
        ├── network.ts             # Fetch + URL helpers
        ├── types.ts
        ├── image/
        │   ├── configurations.ts  # Image model handlers
        │   ├── banana.ts
        │   ├── flux.ts
        │   └── rules.ts           # Resolution/ratio rules
        └── video/
            ├── configurations.ts  # Video model handlers
            ├── veo.ts
            ├── minimax.ts
            ├── kling.ts
            ├── seedance.ts
            ├── alibailian.ts
            └── rules.ts
```

---

## Usage Guide

### 1. Configure API Access

Click the **Settings** icon (top-right) to open the Settings panel.

- **Global Base URL** — set once; applies to all models (e.g. `https://api.openai.com`)
- **Global API Key** — set once; applies to all models
- Per-model overrides are available by expanding each model entry
- Use **Test Connection** to verify a model is reachable before generating

### 2. Add Nodes

Click the **+** button in the left sidebar to open the node palette. Available node types:

| Node | Input | Output |
|---|---|---|
| Text → Image | Prompt | Image |
| Text → Video | Prompt | Video |
| Image → Image | Image + Prompt | Image |
| Image → Video | Image + Prompt | Video |
| Start+End → Video | 2 Images + Prompt | Video |
| Creative Description | Text | Optimized prompt |
| Original Image | — | Image (upload/paste) |

### 3. Connect Nodes

Drag from the output port of one node to the input port of another. The connected node will automatically receive the upstream result as its input when you generate.

### 4. Generate

Click **Generate** on any node. Results appear inside the node. If **Count > 1**, results are stacked — click the stack badge to browse all outputs.

### 5. Prompt Optimization

Enable the **Optimize** toggle on a node to run the prompt through the Creative Description model before sending it to the generation model.

### 6. Export / Import

Use the **Export/Import** button in the sidebar to save the entire canvas as a JSON file or restore a previous session.

### 7. Add a Custom Model

In Settings, scroll to the bottom and click **Add Model**. Provide:
- Display name
- Model ID (as expected by the API)
- Category (Image or Video)
- Base URL and API key (or leave blank to inherit global config)

---

## Deployment

The project includes a `vercel.json` for zero-config deployment on [Vercel](https://vercel.com/).

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Set `GEMINI_API_KEY` and `API_BASE_URL` as environment variables in the Vercel project dashboard.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a Pull Request

Please keep PRs focused — one feature or fix per PR.

---

## License

MIT
