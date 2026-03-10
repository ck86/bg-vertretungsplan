# Development Guidelines
## Overview
Welcome to the `bg-vertretungsplan` project. This guide outlines the overall architecture, conventions, and strategies used in the application. Both human developers and AI assistants should adhere to these guidelines to ensure consistency and maintainability.

## Technology Stack
- **Framework:** TanStack Start
- **Library:** React 19
- **Routing:** TanStack Router
- **Data Fetching:** TanStack Query
- **Styling:** Tailwind CSS 4
- **Testing:** Vitest
- **Build Tool:** Vite

## Project Architecture
The project heavily relies on file-based conventions:
- `src/routes`: Contains all routes defined for the application via TanStack Router.
- `src/components`: Contains shared UI components not strictly bound to application pages.
- `src/integrations`: Contains setup for external integrations, such as TanStack Query setup and any future API integrations.
- `vite.config.ts`: Sets up the project with plugins like `dev-tools`, `@tanstack/react-start`, and Tailwind CSS 4.

## Development Patterns

### Routing
We utilize file-based routing. To create a new page, add a file inside the `src/routes/` directory. Sub-paths are automatically reflected (e.g., `src/routes/about.tsx` resolves to `/about`).

### Styling
All styling should be done using **Tailwind CSS utility classes**. 
- Refrain from adding bespoke CSS to `styles.css` unless it represents global design variables, layout defaults, or integrations not natively supported by Tailwind.
- Ensure any added Tailwind utility classes are accessible and semantic.

### Data Fetching and State Management
- **TanStack Query:** Use this for any external data fetching that exists outside the direct page loading phase.
- **Loaders:** For data that is critical for a page to render, use TanStack Router `loader` functions. It ensures the query starts fetching synchronously alongside route transitions.
- **Server Functions:** If a component requires interacting with a backend resource natively, use `createServerFn()`. It allows writing server-side logic in a way that seamlessly integrates with client-side code.

### Testing Strategy
- Use **Vitest** for testing critical utilities, state management behavior, and complex components.
- Tests can be co-located with their respective modules (e.g., `Button.test.tsx` next to `Button.tsx`) or stored in a dedicated `test/` directory based on specific operational scale.

---

## 💻 Concrete Examples & Code Conventions

### 1. Data Loading with TanStack Router
When a route needs data before rendering, use the `loader` function. This prevents rendering spinners inside the page content and fetches data as early as possible.

```tsx
// src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router'

// 1. Define the loader
export const Route = createFileRoute('/posts')({
  loader: async () => {
    // Fetch data, can integrate with TanStack Query here too
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
      <h1 className="text-2xl font-bold mb-4">Posts</h1>
      <ul className="space-y-2">
        {posts.map(post => (
          <li key={post.id} className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
            {post.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### 2. Server Functions (TanStack Start)
Server functions allow you to write backend code seamlessly inside your frontend files. Use `createServerFn()` for actions like database mutations or fetching secure secrets.

```tsx
// src/routes/api/submit.tsx
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'

// 1. Define the Server Function (Runs only on the server)
const submitDataFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string }) => data) // Optional zod validation
  .handler(async ({ data }) => {
    // This code ONLY runs on the server. Safe to use database drivers here.
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
        
        // Call the server function like a normal async function
        const response = await submitDataFn({ data: { name } })
        setResult(response.message)
      }}
    >
      <input 
        name="name" 
        className="border border-gray-300 p-2 rounded-md" 
        placeholder="Enter your name" 
      />
      <button className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md transition-colors">
        Submit
      </button>
      {result && <p className="text-sm text-green-600">{result}</p>}
    </form>
  )
}
```

### 3. Component Styling (Tailwind CSS 4)
Keep components encapsulated and avoid extracting Tailwind classes using `@apply` unless necessary. Use inline utility classes. For complex conditional logic, using `clsx` or `tailwind-merge` is recommended.

```tsx
// src/components/Button.tsx
import React from 'react'

// Explicitly type props
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  // Base styles applied to all variants
  const baseStyles = "inline-flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
  
  // Specific variant styles
  const variantStyles = variant === 'primary' 
    ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500" 
    : "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100"

  // Merge classes (simplified, consider using tailwind-merge library for production)
  return (
    <button 
      className={`${baseStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
```

---

## Starting the Project Locally
Ensure dependencies are up to date and then spin up the Vite development server:
```bash
npm install
npm run dev
```

## Adding Features Checklist
When adding new functionality to the codebase:
1. Define whether the feature is a UI Component (goes to `src/components`) or a Page (goes to `src/routes`).
2. Draft the API surface or Server Function if backend execution is intrinsically required.
3. Stub the behavior and create route Loaders for necessary pre-fetching.
4. Style the component iteratively using Tailwind CSS classes.
5. Create a corresponding `.test.tsx` file for critical boundary paths and logic implementations.
