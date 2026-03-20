💬 Chat App (MERN Stack)

A real-time chat application built using the MERN stack, enabling users to communicate seamlessly with a modern UI and fast backend.

🚀 Live Demo

🌐 Frontend: https://chat-app-omega-puce.vercel.app/

🔗 Backend API: https://chat-app-backend-ten-zeta.vercel.app/

📂 GitHub Repository

👉 https://github.com/YashasviSaroha/CHAT-APP

🧰 Tech Stack
Frontend

React.js (with Vite)

Tailwind CSS

Axios

React Router

Backend

Node.js

Express.js

MongoDB (Mongoose)

JWT Authentication

Deployment

Frontend: Vercel

Backend: Vercel

Database: MongoDB Atlas

✨ Features

🔐 User Authentication (Login / Signup)

💬 Real-time Messaging

👥 User-to-User Chat

📱 Responsive UI

⚡ Fast API with Express

🔒 Secure routes with JWT

📁 Project Structure
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
⚙️ How It Works (Flow)

User signs up or logs in

Backend verifies credentials and generates JWT

Frontend stores token and sends it in requests

Users can send/receive messages via API

Messages are stored in MongoDB

🛠️ Installation & Setup (Run Locally)
1️⃣ Clone the Repository
git clone https://github.com/YashasviSaroha/CHAT-APP.git
cd CHAT-APP
2️⃣ Setup Backend
cd backend
npm install

Create a .env file:

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key

Run backend:

npm run dev
3️⃣ Setup Frontend
cd frontend
npm install

Create a .env file:

VITE_API_BASE_URL=http://localhost:5000

Run frontend:

npm run dev
🌍 Deployment Guide
Backend (Vercel)

Push backend code to GitHub

Import project in Vercel

Set environment variables:

MONGO_URI

JWT_SECRET

Deploy

Frontend (Vercel)

Import frontend folder in Vercel

Add environment variable:

VITE_API_BASE_URL=https://chat-app-backend-ten-zeta.vercel.app/

Deploy

🔑 Environment Variables Summary
Variable	Description
MONGO_URI	MongoDB connection string
JWT_SECRET	Secret key for authentication
PORT	Backend port
VITE_API_BASE_URL	Backend API URL
🧪 Future Improvements

🔔 Real-time notifications (Socket.io)

🖼️ Image/file sharing

👥 Group chats

🌙 Dark mode

📞 Voice/Video calling

🤝 Contributing

Contributions are welcome!

Fork the repo

Create a new branch

Commit changes

Push and create PR

📞 Contact

Developer: Yashasvi Saroha

GitHub: https://github.com/YashasviSaroha

Email: yashasvisaroha24@gmail.com
