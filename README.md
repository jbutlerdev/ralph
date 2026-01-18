# Ralph

A server-based AI development orchestrator powered by the "Ralph Wiggum technique" - run the same AI prompt repeatedly until tasks are complete, with git-backed branching for exploration and structured review at commit boundaries.

## Architecture

Ralph consists of three main components:

### 1. Ralph Server

A TypeScript server that uses the Claude Code SDK to implement plans using the Ralph Wiggum methodology.

**Location:** `src/server.ts`

**Features:**
- HTTP API for plan execution
- Session management with persistent state
- Git-based branching and checkpointing
- Real-time status updates

**API Endpoints:**
- `POST /execute` - Start plan execution
- `GET /status/:sessionId` - Check execution status
- `GET /plans` - List available plans
- `GET /plans/:planId` - Get plan details
- `GET /sessions` - List active sessions
- `GET /health` - Health check

**Usage:**
```bash
# Build the project
npm run build

# Start the server
npm run server

# CLI mode
ralph run [plan]

# Server mode
ralph server --port 3001
```

### 2. Plan Generator Skill

A Claude Code skill that generates structured implementation plans from requirements.

**Location:** `skills/ralph-plan-generator.skill.ts` (re-exports from `src/plan-generator.ts`)

**Features:**
- Parses requirements into structured tasks
- Auto-generates task IDs and dependencies
- Validates plan structure
- Supports markdown export/import

**Usage:**
```
Use the ralph-plan-generator skill to create an implementation plan from your requirements.
```

### 3. Plan Sender / Executor Skill

A Claude Code skill that sends plans to the Ralph server for execution.

**Location:** `.claude/skills/ralph-executor/ralph-executor.skill.ts` (contains server client logic)

**Features:**
- Submits plans to Ralph server
- Tracks execution progress
- Retrieves task results
- Handles errors and retries

**Usage:**
```
Use the ralph-executor skill to send a plan to the server and monitor execution.
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git
- Claude Code CLI (for task execution)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ralph.git
cd ralph

# Install dependencies
npm install

# Build the project
npm run build
```

### Running the Server

```bash
# Development mode (watch mode)
npm run watch

# Build for production
npm run build

# Start server
npm run server

# Or start CLI mode
npm start
```

### Using the Skills

1. **Generate a Plan:**
   - In Claude Code, invoke the `ralph-plan-generator` skill
   - Provide your requirements
   - Review and edit the generated plan

2. **Execute the Plan:**
   - Invoke the `ralph-executor` skill
   - Select your plan
   - Monitor execution progress

## Development

### Project Structure

```
ralph/
├── src/                      # Main source code
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts
│   ├── plan-generator.ts     # Plan parsing and validation
│   ├── executor.ts           # Core execution logic
│   ├── server.ts            # HTTP API server
│   └── cli.ts               # CLI entry point
├── skills/                   # Claude Code skills
│   └── ralph-plan-generator.skill.ts
├── .claude/skills/            # Internal skills
│   └── ralph-executor/    # Server client skill
├── plans/                    # Generated plans
├── dist/                     # Compiled output
├── tsconfig.json
└── package.json
```

### Technology Stack

- **Language:** TypeScript 5.x
- **AI SDK:** @anthropic-ai/claude-agent-sdk v0.2.8
- **Server:** Express 5.2.1
- **Git:** simple-git v3.22.0
- **Testing:** Vitest v4.0.17

### Configuration

Server configuration can be set via CLI flags:

```bash
ralph server --port 3001 --host localhost
```

### CLI Commands

```bash
# Run a plan
ralph run [plan-path]

# List available plans
ralph list

# Show execution status
ralph status

# Start server mode
ralph server [options]
```

## The Ralph Wiggum Technique

The core philosophy: run the same AI prompt repeatedly until tasks are complete, with git-backed branching for exploration and structured review at commit boundaries.

### How It Works

1. **Planning** - Generate structured implementation plans
2. **Execution** - Execute tasks one at a time with AI
3. **Review** - Review changes at commit boundaries
4. **Iteration** - Iterate or fork as needed

### Benefits

- Structured, autonomous AI-driven development
- Git-backed safety with easy rollbacks
- Parallel exploration through branching
- Clear audit trail of all changes

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Detailed project instructions for Claude Code
- [ralph-wiggum-technique.md](./ralph-wiggum-technique.md) - Methodology deep dive
- [skills/ralph-plan-generator.md](./skills/ralph-plan-generator.md) - Plan generator documentation

## License

MIT
