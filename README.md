# Aether — Social Media Platform 🚀

A full-stack social media platform where users can share posts, connect with others, like & comment, and stay updated through real-time notifications.

![Platform](https://img.shields.io/badge/Platform-Web-blue) ![Node.js](https://img.shields.io/badge/Node.js-v18+-green) ![MongoDB](https://img.shields.io/badge/Database-MongoDB-brightgreen) ![License](https://img.shields.io/badge/License-MIT-yellow) ![Status](https://img.shields.io/badge/Status-Live-success)

---

## 🌐 Live Demo

**[View Live on Vercel](https://code-alpha-social-media-platform-beige.vercel.app)** 

---

## ✨ Features

- 🔐 **Authentication** — Secure signup & login with JWT tokens and bcrypt password hashing
- 📝 **Posts** — Create, edit, and delete posts with optional image uploads
- ❤️ **Likes** — Like and unlike posts on home feed and profile pages
- 💬 **Comments** — Add and delete comments on any post
- 👥 **Follow System** — Follow/unfollow users with live follower counts
- 👤 **User Profiles** — View and edit your profile, upload avatar, update bio
- 🔖 **Saved Posts** — Bookmark posts and access them from your Saved Posts tab
- 🔔 **Notifications** — Get notified when someone likes, comments, or follows you
- 🔍 **Search** — Find users across the platform instantly
- 📱 **Responsive Design** — Works beautifully on desktop and mobile

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB, Mongoose |
| **Authentication** | JSON Web Tokens (JWT), bcryptjs |
| **Image Storage** | Cloudinary |
| **Frontend** | HTML, CSS, Vanilla JavaScript |
| **Security** | Helmet.js, express-rate-limit, CORS |
| **Deployment** | Vercel |

---

## 📁 Project Structure

```
aether/
├── public/              # Frontend (HTML, CSS, JS)
│   ├── index.html       # Landing / Auth page
│   ├── feed.html        # Main feed
│   ├── profile.html     # User profile
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── auth.js
│       ├── feed.js
│       ├── profile.js
│       └── utils.js
├── routes/              # API routes
│   ├── auth.js          # Register, login
│   ├── users.js         # Profile, follow, search
│   ├── posts.js         # CRUD, likes, bookmarks
│   ├── comments.js      # Comments
│   ├── notifications.js
│   ├── search.js
│   └── upload.js        # Cloudinary image upload
├── models/              # Mongoose schemas
├── middleware/          # Auth middleware
├── config/              # DB config
├── server.js            # Entry point
├── vercel.json          # Vercel deployment config
└── package.json
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js v18+
- MongoDB Atlas account
- Cloudinary account

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/WajeehaSajid/CodeAlpha_SocialMediaPlatform.git

# 2. Navigate to project folder
cd CodeAlpha_SocialMediaPlatform/aether

# 3. Install dependencies
npm install

# 4. Create your .env file
cp .env.example .env
# Fill in your values in .env

# 5. Start the development server
npm run dev
```

Open `http://localhost:5000` in your browser.

---

## ⚙️ Environment Variables

Create a `.env` file in the `aether/` folder with these variables:

```env
MONGODB_URI=your_mongodb_srv_connection_string
JWT_SECRET=your_long_random_secret_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
NODE_ENV=production
ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
```

> ⚠️ Never commit your `.env` file. It is already in `.gitignore`.

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login and get JWT |

### Posts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | Get all posts (feed) |
| POST | `/api/posts` | Create a post |
| PUT | `/api/posts/:id` | Edit a post |
| DELETE | `/api/posts/:id` | Delete a post |
| POST | `/api/posts/:id/like` | Like / unlike a post |
| POST | `/api/posts/:id/bookmark` | Save / unsave a post |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:username` | Get user profile |
| PUT | `/api/users/profile` | Update profile |
| POST | `/api/users/:id/follow` | Follow / unfollow |

### Comments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/comments/:postId` | Get comments on a post |
| POST | `/api/comments/:postId` | Add a comment |
| DELETE | `/api/comments/:id` | Delete a comment |

---

## 🔒 Security

- Passwords hashed with **bcryptjs**
- Routes protected with **JWT middleware**
- HTTP headers secured with **Helmet.js**
- Rate limiting on auth and upload routes
- Environment variables never exposed in code

---

## 👩‍💻 Author

**Wajeeha Sajid**
- GitHub: [@WajeehaSajid](https://github.com/WajeehaSajid)
- LinkedIn: [Wajeeha Sajid](https://www.linkedin.com/in/wajeeha-sajid)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
