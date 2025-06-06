# frontend/Dockerfile

# 1. Use a lightweight Node image
FROM node:18-alpine

# 2. Set working directory
WORKDIR /app

# 3. Copy only package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# 4. Copy the rest of the frontend source code
COPY . .

# 5. Expose Vite’s default dev port
EXPOSE 5173

# 6. Run the Vite dev server, binding to 0.0.0.0 so Docker can forward it
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
