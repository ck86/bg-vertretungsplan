# Development Guidelines
## Overview
Welcome to the `bg-vertretungsplan` project. This guide outlines the overall architecture, conventions, and strategies used in the application. Both human developers and AI assistants should adhere to these guidelines to ensure consistency and maintainability.

## Technology Stack
- **Framework:** TanStack Start
- **Library:** React 19
- **Routing:** TanStack Router
- **Data Fetching:** TanStack Query
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Testing:** Vitest
- **Build Tool:** Vite

## Project Architecture
The project heavily relies on file-based conventions:
- `src/routes`: Contains all routes defined for the application via TanStack Router.
- `src/components`: Contains shared UI components not strictly bound to application pages.
- `src/components/ui`: Low-level, reusable UI components powered by **shadcn/ui**.
- `src/integrations`: Contains setup for external integrations, such as TanStack Query setup and any future API integrations.
- `vite.config.ts`: Sets up the project with plugins like `dev-tools`, `@tanstack/react-start`, and Tailwind CSS 4.

## Development Patterns

### Routing
We utilize file-based routing. To create a new page, add a file inside the `src/routes/` directory. Sub-paths are automatically reflected (e.g., `src/routes/about.tsx` resolves to `/about`).

### Styling & UI Components
We use a combination of **Tailwind CSS utility classes** and **shadcn/ui** components.
- **shadcn/ui First:** For common UI elements (Button, Input, Card, etc.), always check `src/components/ui` first. If a component is missing, add it using `npx shadcn@latest add [component]`.
- **Consistency:** Use shadcn's theme variables (e.g., `bg-primary`, `text-muted-foreground`) to ensure components automatically adapt to light/dark modes and the global color palette.
- **Custom Styling:** For layout and bespoke designs, use Tailwind utility classes. Refrain from adding bespoke CSS to `styles.css` unless it represents global design variables or integrations not natively supported by Tailwind.

---

## 💻 Concrete Examples & Code Conventions

### 1. Using shadcn/ui Components
Favor using pre-built components from the `ui` library. They are accessible and follow the project's design tokens.

```tsx
import { Button } from '#/components/ui/button'

export function ActionSection() {
  return (
    <div className="flex gap-4 p-4 island-shell rounded-xl">
      <Button variant="primary">Submit Data</Button>
      <Button variant="outline">Cancel</Button>
    </div>
  )
}
```

### 2. Data Loading with TanStack Router
When a route needs data before rendering, use the `loader` function. This prevents rendering spinners inside the page content and fetches data as early as possible.

```tsx
// src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router'

// 1. Define the loader
export const Route = createFileRoute('/posts')({
  loader: async () => {
    const response = await fetch('https://jsonplaceholder.typicode.com/posts')
    return response.json()
  },
  component: PostsComponent,
})

// 2. Consume the data in the component
function PostsComponent() {
  const posts = Route.useLoaderData()
  
  return (
    <div className="p-6">
      <h1 className="display-title text-3xl font-bold mb-6">Posts</h1>
      <ul className="space-y-4">
        {posts.map(post => (
          <li key={post.id} className="p-4 feature-card rounded-lg">
            {post.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### 3. Server Functions (TanStack Start)
Server functions allow you to write backend code seamlessly inside your frontend files. Use `createServerFn()` for actions like database mutations or fetching secure secrets.

```tsx
// src/routes/api/submit.tsx
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { Button } from '#/components/ui/button'

// 1. Define the Server Function (Runs only on the server)
const submitDataFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string }) => data) 
  .handler(async ({ data }) => {
    console.log("Received on server:", data.name)
    return { success: true, message: `Hello ${data.name}!` }
  })

// 2. Consume in Client Component
export function ContactForm() {
  const [result, setResult] = useState('')
  
  return (
    <form 
      className="flex flex-col gap-4 max-w-sm"
      onSubmit={async (e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const name = formData.get('name') as string
        const response = await submitDataFn({ data: { name } })
        setResult(response.message)
      }}
    >
      <input 
        name="name" 
        className="bg-surface border border-line p-2 rounded-md outline-none focus:ring-2 focus:ring-lagoon" 
        placeholder="Enter your name" 
      />
      <Button type="submit">Submit</Button>
      {result && <p className="text-sm text-palm font-medium">{result}</p>}
    </form>
  )
}
```

---

## Adding Features Checklist
When adding new functionality to the codebase:
1. **Check UI Library:** Can this be built using existing `src/components/ui` components?
2. **Define Scope:** Is this a UI Component (goes to `src/components`) or a Page (goes to `src/routes`)?
3. **Data Requirements:** Draft the Loader or Server Function if backend execution is required.
4. **Implementation:** Style iteratively using Tailwind + shadcn.
5. **Testing:** Create a corresponding `.test.tsx` file for critical boundary paths and logic implementations.
