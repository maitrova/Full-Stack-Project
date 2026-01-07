# CRUD Application

A full-stack CRUD (Create, Read, Update, Delete) application with a premium UI design.

## Tech Stack

### Frontend
- React 18
- Axios for API calls
- React Icons
- Modern CSS with gradients and animations

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- CORS enabled

## Project Structure

```
curd-operations/
├── backend/
│   ├── models/
│   │   └── Item.js
│   ├── routes/
│   │   └── items.js
│   ├── .env
│   ├── .gitignore
│   ├── package.json
│   └── server.js
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── Header.js
    │   │   ├── Header.css
    │   │   ├── ItemForm.js
    │   │   ├── ItemForm.css
    │   │   ├── ItemList.js
    │   │   └── ItemList.css
    │   ├── App.js
    │   ├── App.css
    │   ├── index.js
    │   └── index.css
    ├── .env
    ├── .gitignore
    └── package.json
```

## Prerequisites

Before running this application, make sure you have installed:
- Node.js (v14 or higher)
- MongoDB (running locally or MongoDB Atlas account)
- npm or yarn

## Installation & Setup

### 1. Install MongoDB (if not already installed)

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Or use MongoDB Atlas (cloud):**
- Sign up at https://www.mongodb.com/cloud/atlas
- Create a free cluster
- Get your connection string and update the `.env` file

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 4. Configure Environment Variables

The `.env` files are already created. Update them if needed:

**Backend (.env):**
- For local MongoDB: Keep `MONGODB_URI=mongodb://localhost:27017/crud-app`
- For MongoDB Atlas: Replace with your Atlas connection string

**Frontend (.env):**
- Keep `REACT_APP_API_URL=http://localhost:5000/api` (for local development)

## Running the Application

### Option 1: Run Both Servers Separately (Recommended)

**Terminal 1 - Start Backend:**
```bash
cd backend
npm start
```
The backend server will start on http://localhost:5000

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm start
```
The frontend will open automatically at http://localhost:3000

### Option 2: Development Mode with Nodemon

**For Backend (with auto-reload):**
```bash
cd backend
npm run dev
```

## Features

✨ **Premium UI Design**
- Modern gradient backgrounds
- Smooth animations and transitions
- Responsive design for all devices
- Glass morphism effects

📝 **Full CRUD Operations**
- Create new tasks with title, description, category, status, and priority
- Read and display all tasks with filtering options
- Update existing tasks
- Delete tasks with confirmation

🎯 **Task Management**
- Categories: Work, Personal, Shopping, Other
- Status: Pending, In Progress, Completed
- Priority: Low, Medium, High
- Filter by status and category
- Timestamps for creation and updates

## API Endpoints

- `GET /api/items` - Get all items
- `GET /api/items/:id` - Get single item
- `POST /api/items` - Create new item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

## Troubleshooting

**Backend won't start:**
- Make sure MongoDB is running: `brew services list` (macOS)
- Check if port 5000 is available
- Verify `.env` file configuration

**Frontend won't start:**
- Check if port 3000 is available
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

**Can't connect to database:**
- For local MongoDB, ensure service is running
- For MongoDB Atlas, check connection string and IP whitelist

## Development

To modify the application:
- Backend API routes: `backend/routes/items.js`
- Database models: `backend/models/Item.js`
- Frontend components: `frontend/src/components/`
- Styling: Individual CSS files for each component

## License

MIT
