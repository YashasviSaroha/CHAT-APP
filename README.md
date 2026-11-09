# 💬 Chat App (MERN Stack) 
A real-time chat application built using the MERN stack, enabling users to communicate seamlessly with a modern UI and fast backend.

---

## 🚀 Live Demo 
- 🌐 Frontend: (https://chat-app-omega-puce.vercel.app/).
- 🔗 Backend API: (https://chat-app-backend-ten-zeta.vercel.app/).
- 📂 GitHub Repository: (https://github.com/YashasviSaroha/CHAT-APP).

---

## 🧰 Tech Stack 

**Frontend :-**
- React.js (with Vite)
- Tailwind CSS
- Axios
- React Router

**Backend :-**
- Node.js
- Express.js
- MongoDB (Mongoose)
- JWT Authentication
- Deployment

  ***(Frontend: Vercel || Backend: Vercel || Database: MongoDB Atlas)***

---

## ✨ Features 
- 🔐 User Authentication (Login / Signup)
- 💬 Real-time Messaging
- 👥 User-to-User Chat
- 📱 Responsive UI
- ⚡ Fast API with Express
- 🔒 Secure routes with JWT

---

## 📁 Project Structure
```txt
CHAT-APP/
│
├── backend/
│   ├── controllers/     # Business logic
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API routes
│   ├── middleware/      # Auth middleware
│   ├── config/          # DB connection
│   └── server.js        # Entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Pages (Login, Chat, etc.)
│   │   ├── services/    # API calls
│   │   └── App.jsx      # Main app
│   └── index.html
│
└── README.md
```

---

## ⚙️How It Works(Flow)
- User signs up or logs in
- Backend verifies credentials and generates JWT
- Frontend stores token and sends it in requests
- Users can send/receive messages via API
- Messages are stored in MongoDB

---

## 🛠️ Installation & Setup (Run Locally) 
### 1️⃣ Clone the Repository
```bash
git clone https://github.com/YashasviSaroha/CHAT-APP.git
cd CHAT-APP
```
### 2️⃣ Setup Backend
```bash
cd backend
npm install
```
### 3️⃣Create a .env file:
```bash
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```
### 4️⃣Run backend:
```bash
npm run dev
```
### 5️⃣Setup Frontend
```bash
cd frontend
npm install
```
### 6️⃣Create a .env file:
```bash
VITE_API_BASE_URL=http://localhost:5000
```
### 7️⃣Run frontend:
```bash
npm run dev
```

---

## 🌍 Deployment Guide
### Backend (Vercel)
- Push backend code to GitHub
- Import project in Vercel
- Set environment variables: MONGO_URI || JWT_SECRET
- Deploy

### Frontend (Vercel)
- Import frontend folder in Vercel
- Add environment variable: VITE_API_BASE_URL= your_backend_url/
- Deploy

---

## 🔑 Environment Variables Summary
- Variable	Description
- MONGO_URI	MongoDB connection string
- JWT_SECRET	Secret key for authentication
- PORT	Backend port
- VITE_API_BASE_URL	Backend API URL

---

## 🧪 Future Improvements
- 🔔 Real-time notifications (Socket.io)
- 🖼️ Image/file sharing
- 👥 Group chats
- 🌙 Dark mode
- 📞 Voice/Video calling

---

## 📞 Contact
**Yashasvi Saroha**

📧 yashasvisaroha24@gmail.com  
📞 8950463936  
🔗 [GitHub Profile](https://github.com/YashasviSaroha)
=======
# QuickChat

QuickChat is a privacy-first real-time messenger built on the existing React and Express chat app. People sign in, connect by exact username or a short-lived QR code, and exchange messages that expire.

Live messages are stored in MongoDB. Saved bookmarks, QR tokens, device sessions, and abuse reports have separate ownership, described below.

## Features

- Accounts, profiles, and mutual contacts remain.
- New connections are requests. Existing contacts stay connected.
- Direct messages and small groups.
- Text, images, and voice notes.
- Sent, delivered, and read ticks.
- Messages expire after 12 hours, 24 hours, or 7 days. The default is 24 hours.
- Personal bookmarks in Saved Messages. A bookmark survives expiry for that user only.
- Edit and delete, with time limits. Delete for everyone also removes saved copies and the uploaded file.
- Replies and message search.
- Exact username discovery, with a switch to hide a username.
- QR profile share: random token, 10 minutes, single use, revocable.
- Gemini summaries and Catch Me Up, only when a server key is configured.
- Voice transcripts through Gemini, with an optional searchable transcript.
- Mute, sound, desktop notifications, and mention alerts.
- Session list and remote logout.
- Block and report. Report evidence is stored only when the reporter opts in.

## Architecture

```text
Browser (React, IndexedDB cache)
        |  HTTPS + Socket.IO
Express API
        |-- MongoDB: users, contacts, conversations, messages, bookmarks, requests
        |-- MySQL: QR tokens, device sessions, abuse reports
        |-- Cloudinary: photos, images, voice notes
        |-- Redis (optional): Socket.IO adapter, cleanup queue, transcription queue
        |-- Gemini (optional): summaries and transcripts
```

IndexedDB still keeps a copy of messages on the device, including messages that were saved only in the browser before this upgrade. Those older messages are not uploaded.

## Stack

- React 19, Vite, Tailwind 4, Socket.IO client
- Express 5, Socket.IO, Mongoose, JWT, bcrypt
- MongoDB and MySQL
- Cloudinary
- Optional Redis, BullMQ, and Gemini

## Database ownership

| Data | Database |
| --- | --- |
| User, username, contacts, blocks, notification preferences | MongoDB `users` |
| Conversation, retention, mute | MongoDB `conversations` |
| Message, edits, expiry, read state on the message | MongoDB `messages` |
| Saved bookmark | MongoDB `savedmessages` |
| Connection request | MongoDB `connectionrequests` |
| Last read time | MongoDB `readstates` |
| Summary saved by the user | MongoDB `summaries` |
| QR invite | MySQL `qr_invite_tokens` |
| Device session | MySQL `device_sessions` |
| Abuse report | MySQL `abuse_reports` |

MongoDB and MySQL are not updated in one transaction. Redeeming a QR code adds the contact only if the token is still valid, and the token is marked used after that write succeeds. A retry is safe because adding a contact twice does not create a duplicate.

## Message retention

Every new message stores `createdAt` and `expiresAt`. The conversation’s retention applies to messages created after a change. A cleanup pass deletes expired messages. If someone bookmarked a message, the bookmark copy is written first and the file in Cloudinary is kept for that copy. A message deleted for everyone is removed for every member, including saved copies.

Delete for yourself hides the message from you. Your bookmark, if you made one, stays.

Edit is available to the sender for 15 minutes by default. Delete for everyone is available for 60 minutes. Both can be changed with `MESSAGE_EDIT_WINDOW_MS` and `DELETE_EVERYONE_WINDOW_MS`.

## QR tokens

The image contains only a random token. The server stores a SHA-256 hash, an owner id, and an expiry 10 minutes out. Redeeming checks that the token is unused, not revoked, and not expired. Creating a new code revokes the previous unused code.

## AI

Summarize and Catch Me Up send only the messages in the chosen range that the user can still access. Expired messages are excluded. The screen says that the text is sent to Google Gemini. A summary is stored only when the user presses Save.

Voice notes are uploaded to Cloudinary. Transcription runs after the message is saved. Without `GEMINI_API_KEY`, the note still sends and the transcript status is “unavailable”. A transcript is searchable only if the sender turns that on.

## Offline delivery

The server stores the message before it tells the sender the send succeeded. A recipient who is offline receives it from MongoDB on the next connection. Sending the same message id again does not create a second row. If the browser is offline, the message stays in an outbox and is sent when the socket reconnects.

A server restart no longer drops unread messages. It does drop in-memory presence until clients reconnect.

## Socket.IO events

Client to server:

- `send_message` with `messageId`, `receiverId` or `conversationId`, and `text`, `image`, or `audio`
- `message_delivered`
- `message_read`
- `get_pending_messages`
- `join_conversation`

Server to client:

- `message_sent`, `newMessage`, `message_delivered`, `message_read`
- `pending_messages`, `messages_removed`
- `message_edited`, `message_deleted`, `message_updated`
- `notification`, `getOnlineUsers`, `message_error`

The socket joins `user:{userId}` after the JWT is checked. It joins `conversation:{id}` only when the user is a member. A second device no longer replaces the first device’s connection.

## HTTP API

Authentication stays under `/api/auth`: `POST /signup`, `POST /login`, `GET /check`, `PUT /update-profile`.

Added:

- `PUT /api/auth/notifications`
- `GET /api/auth/lookup/:username`
- `GET /api/auth/relation/:id`
- `POST /api/auth/block/:id` and `POST /api/auth/unblock/:id`
- `GET /api/messages/users`, `/search`, `/find`, `/saved`, `/requests`, `/history/:peerId`, `/conversation/:id`
- `POST /api/messages/request/:id`, `/requests/:id/accept`, `/requests/:id/reject`
- `POST /api/messages/upload`
- `POST` and `DELETE /api/messages/:messageId/bookmark`
- `PATCH /api/messages/:messageId`
- `POST /api/messages/:messageId/delete` with `{ "scope": "me" }` or `{ "scope": "everyone" }`
- `GET /api/conversations` and `POST /api/conversations/group`
- `PUT /api/conversations/peer/:peerId/retention` and `PUT /api/conversations/:id/retention`
- `PUT /api/conversations/:id/mute`
- `POST /api/ai/summarize`, `/api/ai/catch-up`, `/api/ai/summaries`
- `POST /api/qr`, `POST /api/qr/redeem`, `POST /api/qr/:id/revoke`
- `GET /api/sessions`, `POST /api/sessions/:id/revoke`
- `POST /api/reports`, `GET /api/reports`, `PATCH /api/reports/:id`

The token is still sent in the `token` header.

## Setup

Node.js 18.18 or newer.

```bash
cd server
copy .env.example .env
npm install
npm run server
```

```bash
cd client
npm install
npm run dev
```

Set `VITE_BACKEND_URL` in `client/.env` to the API origin, for example `http://localhost:5000`.

MongoDB is required for chat. MySQL is required for QR codes, the session list, and reports. Gemini is required for summaries and transcripts. Redis is optional. Without Redis, expiry cleanup and transcription still run in the API process.

Do not commit `.env`.

## Deployment

Run the API as a long-running Node process so Socket.IO, presence, and cleanup keep running. Set `FRONTEND_URL` to the site origin. More than one API instance needs `REDIS_URL` so Socket.IO and the job queues share state.

`server/vercel.json` remains for a serverless import, and that host will not keep sockets or in-process jobs.

## Tests

```bash
cd server
npm test
```

The automated tests cover retention, blocks, username rules, public user fields, and QR state. They do not call MongoDB, MySQL, or Gemini.

## Limits

- Messages that existed only in one browser before this upgrade stay on that browser.
- Cloudinary files for expired messages are deleted when nobody bookmarked them. A bookmark keeps the file.
- There is no email notification.
- Report review is limited to addresses in `ADMIN_EMAILS`.
- Summaries and transcripts do nothing useful until `GEMINI_API_KEY` and `GEMINI_MODEL` are set.
- QR codes, sessions, and reports return a clear configuration error until MySQL is set.
