
---

## 🧭 How to Run This Project (After Cloning)

If you’ve just cloned this repository, follow these steps 👇

### Step 1: Clone the repo
```bash
git clone https://github.com/maitrova/Full-Stack-Project.git
cd Full-Stack-Project


### backend setup

cd server
npm install

to run the server : npm run dev

### front end setup

cd frontend
npm install

to run the server : npm start


visit the localhost found in the terminal

uodatred 

### local try-on test

To test the AI try-on feature locally:

1. Copy `server/.env.example` to `server/.env`
2. Add your `REPLICATE_API_TOKEN`
3. Start the backend on port `5000`
4. Expose the backend with a public tunnel like `ngrok http 5000`
5. Point the frontend to that tunnel URL with:

```env
VITE_API_URL=https://your-tunnel-url
VITE_IMAGE_URL=https://your-tunnel-url
```

The backend is preconfigured for Replicate `cuuupid/idm-vton` using version `0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985`.
