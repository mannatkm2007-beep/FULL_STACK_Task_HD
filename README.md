# DEV@Deakin - Task HD1

React (Vite) frontend + Express backend + Firebase Firestore.

## What's new in D1
- **Register / Login through the backend** (`backend/server.js`): data is validated with Zod, passwords are hashed with bcrypt, users are stored in Firestore, and login returns a signed **JWT**.
- **Session management**: the JWT is stored in `localStorage` and shared across the site with React `useContext` (`src/context/AuthContext.jsx`). Logout clears it.
- **Pricing page** (`/pricing`): Free vs Premium comparison.
- **Upgrade Plan**: only logged-in Free users can open the payment modal; on valid details the backend sets `plan: "paid"` in Firestore. Users without a `plan` field are treated as Free.


## What's new in HD1
- **Pagination + lazy loading:** `GET /api/posts?page=&limit=&type=&plan=&tag=&q=&from=&to=` is validated with Zod and filtered/paged by the backend. Browse Posts uses infinite scroll (IntersectionObserver) with a "Load more" button, `useDeferredValue` for search, `useTransition` for filters, and `React.lazy` for the post pop-up and the dashboard.
- **Likes:** `POST /api/posts/:id/like` toggles a like inside a Firestore transaction (no double likes, correct counts). The UI uses `useOptimistic` so the count changes instantly and rolls back if the request fails.
- **Real-time notifications:** when someone likes a post, the author is notified live through Server-Sent Events (`GET /api/notifications/stream`, JWT in the header). Notifications are also saved in Firestore (`GET /api/notifications`, `POST /api/notifications/read`) and shown on the Dashboard and as a header counter. State is managed with `useReducer` + Context and the custom hook `useNotificationStream`.
- **Free trial:** `POST /api/trial/start` gives a Free user 7 days of Premium access, once per account. The plan is calculated on every request from `trialEndsAt`, so the trial ends automatically.
- **Light / dark theme:** `ThemeContext` + CSS variables, saved in localStorage and following the device setting on first visit.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/posts` | Paginated, filtered posts allowed for the caller's plan |
| POST | `/api/posts/:id/like` | Like / unlike (logged in) |
| GET | `/api/notifications/stream` | Live notification stream (SSE) |
| GET | `/api/notifications` | Notification history |
| POST | `/api/notifications/read` | Mark all as read |
| POST | `/api/trial/start` | Start the 7-day trial |

Firestore collections used: `users`, `posts`, `likes` (document id `postId_userId`), `notifications`. Make sure your Firestore rules allow read/write on all four.

## What's new in D2
- **Storing posts (backend):** `POST /api/posts` (JWT required) validates with Zod and saves `type, plan, title, abstract, body, tags, userId, authorName, createdAt` to the Firestore `posts` collection. The Post page no longer touches Firestore.
- **Browse Posts (`/browse`):** the frontend calls `GET /api/posts`; the **backend** checks the user's plan in Firestore and only returns free posts to visitors/Free users (paid posts never reach the browser). Paid users get free + paid.
- **Filtering / Hide / Reset / Expand / Drag:** filter by text, type, plan, tag and date range; hide a post (frontend only, Firestore untouched); reset; click a post to expand the full Markdown; drag the handle to re-order.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/posts` | Create a post (logged-in users only) |
| GET | `/api/posts` | List posts allowed for the caller's plan |

## Backend API
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/register` | Validate, hash password, save user (plan = free) |
| POST | `/api/login` | Check credentials, return JWT + user |
| GET | `/api/me` | Restore session from JWT |
| POST | `/api/upgrade` | Validate payment details, set plan = paid |
| POST | `/signup` | SendGrid welcome email (Task P5) |

## Run it
```bash
# 1. Frontend (terminal 1)
cp .env.example .env              # fill in Firebase keys
npm install
npm run dev                       # http://localhost:5173

# 2. Backend (terminal 2)
cd backend
cp .env.example .env              # SendGrid keys + JWT_SECRET
npm install
npm start                         # http://localhost:3000
```
The backend reads the Firebase keys from the project-root `.env` (the same `VITE_FIREBASE_*` values), so nothing extra is needed.

Payment details are validated only and are **never stored**.
Do not commit `node_modules` or `.env` files (both are in `.gitignore`).
