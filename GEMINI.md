# Development Philosophy Integration

- **Progressive Development**: Small, iterative commits. Every commit must compile and pass tests. Avoid big-bang changes.
- **Learn Before Reinventing**: Research and plan before implementing. Study existing code first.
- **Pragmatism Over Dogma**: Adapt to the reality of the project. Solve the actual problem, not a theoretical one.
- **Clarity Over Cleverness**: Choose simple, obvious solutions. Code should explain itself.

## New Requirements Process
1.  **Discuss First, Code Later**: Do not start coding immediately upon receiving a new requirement. Discuss the approach first.
2.  **Visualize Options**: Use ASCII charts or diagrams to compare multiple solutions when necessary. Let the user choose the best path.
3.  **Confirm Before Building**: Only begin concrete development work after the user has explicitly confirmed the chosen plan.

## Implementation Process
1.  **Understand Existing Patterns**: Study at least 3 similar features or components in the codebase.
2.  **Identify Conventions**: Recognize common patterns and architectural decisions already in place.
3.  **Follow Standards**: Use the same libraries, tools, and testing patterns as the rest of the project.
4.  **Phased Execution**: Break complex tasks down into 3-5 manageable stages.

## Quality Standards
-   Every commit must build successfully.
-   All existing tests must pass.
-   New features must include corresponding tests.
-   Adhere to project formatting and linting standards.

## Decision Framework Priority
1.  **Testability**: Is it easy to verify?
2.  **Readability**: Will it be understandable 6 months from now?
3.  **Consistency**: Does it fit the project's established patterns?
4.  **Simplicity**: Is this the simplest viable solution?
5.  **Reversibility**: How hard will it be to undo or change later?

## Error Handling & When Stuck
**Critical Rule:** Stop after a maximum of 3 failed attempts.

1.  **Log the Failure**: Document what was tried, the specific error, and the probable cause.
2.  **Research Alternatives**: Find 2-3 alternative implementation approaches.
3.  **Question Assumptions**: Is the abstraction level correct? Can the problem be decomposed further?
4.  **Pivot Strategy**: Try a different angle (different library? different pattern? remove abstraction?).

## Core Mandates
-   **Language**: Always use **English** for code comments, commit messages, and internet searches.
-   **Search**: Use broad, English search queries to find industry-standard solutions and best practices.