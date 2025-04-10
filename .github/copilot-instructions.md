# Copilot Instructions: CARE Scribe Plugin

## Overview

This document provides instructions for AI assistance with the CARE EMR Transcription Plugin. This plugin is:
- Built with TypeScript and React
- Federated using vite-plugin-federation
- Uses Tailwind CSS and shadcn/ui components
- Focused on providing transcription capabilities to the CARE EMR system

## Project Structure

```
care_scribe_fe/
├── src/
│   ├── components/     # UI Components
│   │   ├── ui/        # shadcn base components
│   │   ├── Controller.tsx
│   │   ├── FileUpload.tsx
│   │   ├── Review.tsx
│   │   └── ScribeButton.tsx
│   ├── hooks/         # React hooks
│   ├── utils/         # Helper functions
│   ├── types.ts       # TypeScript types
│   ├── App.tsx        # Main app component
│   ├── Providers.tsx  # React context providers
│   ├── main.tsx      # Entry point
│   └── manifest.ts    # Plugin manifest for federation
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

## Key Technical Guidelines

1. **TypeScript**
   - Use strict type checking
   - Define shared types in `src/types.ts`
   - Prefer explicit types over inferred ones

2. **Component Structure**
   - Use shadcn/ui base components from `components/ui/`
   - Keep business logic in hooks, pure UI in components
   - Follow component patterns from shadcn

3. **Plugin Integration**
   - Plugin is loaded into CARE via vite-plugin-federation
   - Export components through manifest.ts
   - Maintain compatibility with CARE's React version

4. **Code Style**
   - Use absolute imports (configured in vite.config.ts)
   - Follow existing naming conventions:
     - Components: PascalCase
     - Files: kebab-case
     - Hooks: camelCase, prefix with "use"
   - Include JSDoc comments for complex logic

5. **State Management**
   - Use React hooks for local state
   - Leverage React context when needed
   - Keep state close to where it's used

## Security & Compliance

- Handle PHI (Protected Health Information) according to HIPAA
- Never log or store sensitive patient data
- Use secure API endpoints for data transmission
- Keep dependencies up to date for security

## Available Tools

- Tailwind CSS for styling
- shadcn/ui for base components
- TypeScript for type safety
- Vite for building and development

## Best Practices

1. **Components**
   - Keep components focused and single-purpose
   - Use TypeScript interfaces for props
   - Implement proper error boundaries

2. **Hooks**
   - Extract reusable logic into custom hooks
   - Follow React hooks rules
   - Handle cleanup in useEffect

3. **Testing**
   - Write tests for critical functionality
   - Test user interactions and edge cases
   - Use proper mocking for external dependencies

4. **Performance**
   - Optimize component re-renders
   - Lazy load components when appropriate
   - Monitor bundle size