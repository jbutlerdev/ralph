# Planning Phase Specification

## Overview

The Planning Phase is the foundation of Ralph Wiggum. This is where humans and AI collaborate to understand what needs to be built and create a structured plan for implementation.

## Goals

1. Gather and structure requirements
2. Create specification documents for each "topic of concern"
3. Generate a prioritized implementation plan
4. Validate plan feasibility before starting implementation

## User Flow

```
1. Start Ralph TUI
   ↓
2. Select "Start New Project" or "Open Existing"
   ↓
3. If New:
   a. Enter project name/description
   b. AI asks clarifying questions
   c. User provides requirements
   d. AI generates specs/[topic].md files
   e. User reviews and edits specs
   ↓
4. AI generates IMPLEMENTATION_PLAN.md from specs
   ↓
5. User reviews plan:
   - Reorder tasks
   - Add/remove tasks
   - Edit task descriptions
   - Set dependencies
   ↓
6. User approves plan
   ↓
7. Transition to Implementation Phase
```

## Components

### Planner

The main orchestrator for the planning phase.

```typescript
interface PlannerOptions {
  sessionManager: SessionManager
  branchManager: BranchManager
  eventBus: EventDispatcher
}

class Planner {
  // Orchestrate the entire planning phase
  async orchestrate(): Promise<ImplementationPlan>

  // Sub-phases
  private async gatherRequirements(): Promise<Requirement[]>
  private async generateSpecs(requirements: Requirement[]): Promise<Spec[]>
  private async reviewSpecs(specs: Spec[]): Promise<Spec[]>
  private async generatePlan(specs: Spec[]): Promise<ImplementationPlan>
  private async reviewPlan(plan: ImplementationPlan): Promise<ImplementationPlan>
}
```

### SpecGenerator

Uses AI to generate specification documents.

```typescript
class SpecGenerator {
  sessionManager: SessionManager

  // Generate a spec for a single topic
  async generateSpec(topic: string, context: string): Promise<Spec>

  // Generate multiple specs in parallel using subagents
  async generateSpecs(topics: string[]): Promise<Spec[]>

  // Validate spec structure
  async validateSpec(spec: Spec): Promise<ValidationResult>
}

interface Spec {
  topic: string
  filename: string
  content: string
  requirements: string[]
  considerations: string[]
  createdAt: Date
}
```

### PlanParser

Parses and validates IMPLEMENTATION_PLAN.md format.

```typescript
class PlanParser {
  // Parse markdown file into structured plan
  parse(markdown: string): ImplementationPlan

  // Validate plan structure
  validate(plan: ImplementationPlan): ValidationResult

  // Convert plan back to markdown
  serialize(plan: ImplementationPlan): string
}

interface ImplementationPlan {
  title: string
  description: string
  tasks: Task[]
  metadata: PlanMetadata
}

interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'high' | 'medium' | 'low'
  dependencies: string[]
  acceptanceCriteria: string[]
  estimatedComplexity: number
  specReferences: string[]  // Links to specs/*.md
}
```

### RequirementCollector

Interactively gathers requirements from the user.

```typescript
class RequirementCollector {
  // Conduct interactive requirement gathering
  async collect(initialPrompt: string): Promise<Requirement[]>

  // Use AI to ask clarifying questions
  private async askClarifyingQuestions(context: string): Promise<string[]>

  // Organize requirements into topics
  private async organizeIntoTopics(requirements: Requirement[]): Promise<Topic[]>
}

interface Requirement {
  id: string
  description: string
  category: string
  priority: number
  source: 'user' | 'ai_derived'
}
```

## Prompt Engineering

### Initial Planning Prompt

```
You are in Planning Mode for the Ralph Wiggum technique.

Your goal is to help the user create a complete software implementation plan.

**Context:**
- Project Description: {projectDescription}
- Existing Codebase: {codebaseSummary}

**Your Process:**
1. Ask clarifying questions to understand requirements
2. Identify "topics of concern" - distinct aspects of the system
3. For each topic, create a specification file at specs/[topic].md
4. After specs are created and reviewed, generate IMPLEMENTATION_PLAN.md

**Spec File Format:**
```markdown
# {Topic Name}

## Overview
[Brief description of this topic]

## Requirements
- [Requirement 1]
- [Requirement 2]

## Considerations
- [Technical consideration 1]
- [Design decision 2]

## Dependencies
- [Other topics this depends on]
```

**Implementation Plan Format:**
```markdown
# Implementation Plan

## Overview
[Project description]

## Tasks

### Task 1: {Task Title}
**ID:** task-001
**Priority:** high|medium|low
**Dependencies:** (none)

**Description:**
[Detailed description]

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

**Spec Reference:** [link to relevant spec]
---

(Repeat for all tasks)
```

Begin by asking clarifying questions to understand what needs to be built.
```

### Spec Generation Prompt (Subagent)

```
You are a Specification Writer. Create a detailed spec for the topic: "{topic}"

**Context:**
- Project Requirements: {requirements}
- Other Topics: {otherTopics}

Create a spec file at: specs/{topicSlug}.md

Follow the spec file format defined in the main planning prompt.

Focus on:
1. Clear requirements for this topic
2. Technical considerations
3. Dependencies on other topics
4. Acceptance criteria for completion

Return the complete spec content.
```

### Plan Generation Prompt

```
You are a Technical Planner. Generate a complete implementation plan from the provided specifications.

**Available Specifications:**
{specsList}

**Your Task:**
1. Read all specification files in specs/
2. Break down the work into discrete, implementable tasks
3. Each task should:
   - Be completable in a single AI session
   - Have clear acceptance criteria
   - Specify dependencies on other tasks
   - Reference relevant specs

4. Generate IMPLEMENTATION_PLAN.md

Order tasks by:
- Dependencies (dependent tasks after their dependencies)
- Priority (high-priority items first)
- Logical flow (foundational work first)

Output the complete implementation plan.
```

## UI Components

### RequirementGatheringView

```typescript
interface RequirementGatheringViewProps {
  question: string
  context: string
  onAnswer: (answer: string) => void
  onDone: () => void
}

// Displays:
// - AI's current question
// - Conversation history
// - Input area for user response
// - "I'm done" button
```

### SpecReviewView

```typescript
interface SpecReviewViewProps {
  specs: Spec[]
  selectedSpec: Spec | null
  onEdit: (spec: Spec) => void
  onApprove: (spec: Spec) => void
  onRegenerate: (topic: string) => void
}

// Displays:
// - List of generated specs (sidebar)
// - Selected spec content (main)
// - Edit/Regenerate/Approve actions
// - Diff view for changes
```

### PlanReviewView

```typescript
interface PlanReviewViewProps {
  plan: ImplementationPlan
  selectedTask: Task | null
  onMoveTask: (taskId: string, newIndex: number) => void
  onEditTask: (task: Task) => void
  onAddTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onApprove: () => void
}

// Displays:
// - Task list with drag-to-reorder
// - Task detail editor
// - Dependency graph visualization
// - Approve/Regenerate buttons
```

## Data Persistence

### Spec Files

Stored in `specs/[topic].md`:

```markdown
# Authentication

## Overview
User authentication and authorization system using JWT tokens.

## Requirements
- Users can register with email/password
- Users can login with email/password
- Sessions managed via JWT tokens
- Password reset flow

## Considerations
- Use bcrypt for password hashing
- JWT expires after 7 days
- Refresh token rotation
- Rate limiting on auth endpoints

## Dependencies
- User schema (from Database topic)
- API endpoints (from API topic)
```

### Implementation Plan

Stored in `IMPLEMENTATION_PLAN.md`:

```markdown
# Blog Platform Implementation Plan

## Overview
Build a simple blog platform with user authentication, post creation, and comments.

## Tasks

### Task 1: Database Schema
**ID:** task-001
**Priority:** high
**Dependencies:** none

Create PostgreSQL schema for users, posts, and comments.

**Acceptance Criteria:**
- [x] Migration files created
- [x] Schema can be applied successfully
- [x] Foreign keys properly defined
- [x] Indexes on frequently queried fields

**Spec Reference:** [Database](specs/database.md)

---

### Task 2: Authentication API
**ID:** task-002
**Priority:** high
**Dependencies:** task-001

Implement login, register, and logout endpoints.

**Acceptance Criteria:**
- [ ] POST /auth/register implemented
- [ ] POST /auth/login implemented
- [ ] POST /auth/logout implemented
- [ ] JWT tokens generated correctly
- [ ] Passwords hashed with bcrypt

**Spec Reference:** [Authentication](specs/authentication.md)
```

## State Transitions

```
[Idle]
  ↓ User starts planning
[Requirements Gathering]
  ↓ User provides initial requirements
[Clarifying Questions]
  ↓ Loop until user satisfied
[Spec Generation]
  ↓ AI generates specs
[Spec Review]
  ↓ User approves (or regenerate)
[Plan Generation]
  ↓ AI generates IMPLEMENTATION_PLAN.md
[Plan Review]
  ↓ User approves (or edit)
[Ready for Implementation]
```

## Error Handling

1. **AI Hallucination**: Validate generated specs against user requirements
2. **Missing Dependencies**: Dependency graph validation before approval
3. **Unclear Tasks**: Flag tasks without acceptance criteria
4. **Circular Dependencies**: Detect and prevent circular task dependencies
5. **Oversized Tasks**: Warn on tasks estimated > 3 hours

## Success Criteria

- All specs created and approved by user
- Implementation plan has clear, actionable tasks
- All tasks have acceptance criteria
- Dependencies are valid (no circular deps)
- User explicitly approves before proceeding

## Hooks Used

- **UserPromptSubmit**: Inject planning context into each AI turn
- **PostToolUse**: Track when spec files are created/modified
- **SessionStart**: Initialize planning state
