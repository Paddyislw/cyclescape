FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package.json ./backend/
RUN cd backend && npm install --production

# Copy backend source
COPY backend/ ./backend/

# Copy frontend (single HTML file served from /dist)
RUN mkdir -p dist
COPY index.html ./dist/

# Expose port
EXPOSE 3000

# Start backend (serves dist/ as static files)
CMD ["node", "backend/server.js"]
