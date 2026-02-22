---
name: spec-plan-generator
description: Generates comprehensive product specifications (spec.md) and phased development plans (plan.md) for any software project. Use when starting a new feature, project, or initiative that needs detailed documentation and planning.
---

# Spec & Plan Generator

This skill helps you create detailed product specifications and development plans for software projects.

## IMPORTANT: Documentation Only - No Implementation

**This skill should ONLY generate documentation files (spec.md and plan.md).**
- Do NOT write any code
- Do NOT create any implementation files
- Do NOT set up project structures or dependencies
- The ONLY output from this skill should be `spec.md` and `plan.md` files

When you invoke this skill, it will:
1. **Create `spec.md`** - A comprehensive product specification document
2. **Create `plan.md`** - A phased development plan with markdown checkboxes

Then STOP. The actual implementation should be done in a separate session after the spec and plan are reviewed and approved.

## The Spec Document (spec.md)

The specification document includes:

### Header Section
- **Project Name** - Clear, descriptive title
- **Version** - Version identifier (e.g., 1.0.0)
- **Date Created** - Creation timestamp
- **Status** - Draft, In Review, Approved, etc.

### Problem Statement
- What problem are we solving?
- Why is this needed now?
- What are the consequences of not building this?

### Goals & Success Criteria
- **Primary Goals** - Main objectives (3-5 bullet points)
- **Success Metrics** - Measurable criteria (KPIs, performance targets, etc.)
- **Non-Goals** - Explicitly state what's out of scope

### Functional Requirements
Detailed breakdown of what the system must do:
- **User Stories** - As a [user], I want [feature] so that [benefit]
- **Core Features** - Primary capabilities with detailed descriptions
- **User Interactions** - How users interact with the system
- **Data Flow** - How data moves through the system

### Technical Requirements
- **Languages** - Primary programming languages and versions
- **Frameworks & Libraries** - Required dependencies with version constraints
- **Architecture Patterns** - Design patterns, architectural style (MVC, microservices, etc.)
- **Development Style** - Methodology (TDD, agile, pair programming, etc.)
- **Build System** - How the project is built and packaged

> **NOTE: All plans MUST follow Test-Driven Development (TDD) patterns** unless explicitly stated otherwise by the user. This means each phase should include test-first development cycles where tests are written before implementation code.

### Non-Functional Requirements
- **Performance** - Response times, throughput targets
- **Security** - Authentication, authorization, data protection requirements
- **Scalability** - Expected load, concurrent users, growth projections
- **Reliability** - Uptime requirements, error handling strategies
- **Usability** - Accessibility, UX requirements
- **Maintainability** - Code quality standards, documentation requirements

### Data Requirements
- **Data Models** - Key entities and their relationships
- **Data Storage** - Database technology choices
- **Data Migration** - Any data import/migration requirements
- **Data Retention** - Backup and archival policies

### API & Integration Requirements
- **Internal APIs** - API contracts between components
- **External APIs** - Third-party service integrations
- **API Documentation** - Swagger/OpenAPI requirements

### Testing Requirements
- **Unit Tests** - Coverage targets (e.g., 80%)
- **Integration Tests** - Cross-component testing
- **End-to-End Tests** - Full workflow testing
- **Performance Tests** - Load testing requirements
- **Security Tests** - Penetration testing, vulnerability scanning

### Deployment Requirements
- **Environments** - Dev, staging, production requirements
- **Infrastructure** - Cloud provider, hosting requirements
- **CI/CD** - Automated build, test, deployment pipeline requirements
- **Monitoring & Logging** - Observability requirements
- **Rollback Strategy** - How to handle deployment failures

### Dependencies & Constraints
- **External Dependencies** - Third-party services, APIs
- **Team Constraints** - Team size, expertise, availability
- **Time Constraints** - Deadlines, milestone dates
- **Budget Constraints** - Any financial limitations

### Risks & Mitigation
- **Technical Risks** - Potential technical challenges
- **Resource Risks** - Staffing, expertise gaps
- **Timeline Risks** - Schedule threats
- **Mitigation Strategies** - How to address each risk

## The Plan Document (plan.md)

The development plan is organized into phases with markdown checkboxes for progress tracking. These phases describe WHAT needs to be built, not HOW to build it - the implementation details will be determined later.

### TDD Pattern Requirements

**All development phases MUST follow Test-Driven Development (TDD) patterns:**

1. **Write the test first** - Each feature task should begin with writing a failing test
2. **Red-Green-Refactor cycle** - Follow the pattern: write failing test (red) → write minimal code to pass (green) → refactor
3. **Test coverage** - Include unit tests for all new functionality
4. **Integration tests** - Add integration tests as components are combined
5. **Test organization** - Group tests by feature or module

Each task in the plan should reflect this test-first approach.

### Phase Structure

Each phase includes:
- [ ] **Phase Name**
  - **Objective** - What this phase accomplishes
  - **Deliverables** - Concrete outputs (documentation, designs, tested features, etc.)
  - **Estimated Duration** - Time estimate
  - **Dependencies** - What must be completed first

**Tasks** (each with checkbox - describe work to be done, not implementation details):
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Typical Phases

#### Phase 0: Discovery & Planning
- [ ] Gather and document requirements
- [ ] Conduct user research if needed
- [ ] Analyze existing systems and integrations
- [ ] Create technical architecture documentation
- [ ] Define coding standards and conventions
- [ ] Define TDD testing framework and patterns to use
- [ ] Set up test directory structure and naming conventions
- [ ] Set up project repository structure (documentation only)

#### Phase 1: Foundation & Architecture
- [ ] Design core data models
- [ ] Create database schema design
- [ ] Design API contracts
- [ ] Define authentication/authorization approach
- [ ] Set up logging and monitoring specifications
- [ ] Create technical design document

#### Phase 2: Core Features
- [ ] Design feature 1 (detailed specifications)
- [ ] Design feature 2 (detailed specifications)
- [ ] Design feature 3 (detailed specifications)
- [ ] Create feature specifications document
- [ ] Design test strategies

#### Phase 3: Integration & Polish
- [ ] Design system integration approach
- [ ] Create end-to-end test scenarios
- [ ] Define performance benchmarks
- [ ] Document security requirements
- [ ] Complete technical documentation

#### Phase 4: Testing & QA
- [ ] Design test plans
- [ ] Define QA acceptance criteria
- [ ] Create load testing scenarios
- [ ] Define security testing approach
- [ ] Document bug reporting process

#### Phase 5: Deployment & Launch
- [ ] Design deployment strategy
- [ ] Define rollout plan
- [ ] Create rollback procedures
- [ ] Define monitoring and alerting setup
- [ ] Create runbooks and operational documentation

## How to Use

Simply describe your project idea, feature request, or requirements in natural language. The skill will:

1. **Ask clarifying questions** - Before generating documents, identify any open questions or ambiguities in the requirements. Ask the user specific questions to clarify:
   - Unclear requirements or missing details
   - Assumptions that need validation
   - Conflicting or contradictory requirements
   - Missing user stories or use cases
   - Technical constraints or preferences not specified
   - Scope boundaries that are unclear
2. Generate `spec.md` with all sections filled in
3. Generate `plan.md` with phased development and checkboxes
4. Save both files in the current directory

### Example Usage

```
I need a task management application with real-time collaboration features,
user authentication, and the ability to organize tasks by project.
```

The skill will then create comprehensive spec and plan documents.

## Customization

You can customize the output by specifying:
- **Technology stack** - Preferred languages/frameworks
- **Time constraints** - Deadlines or time limits
- **Team size** - Small, medium, large team
- **Priority features** - Must-have vs nice-to-have features
- **Compliance requirements** - HIPAA, GDPR, SOC2, etc.
