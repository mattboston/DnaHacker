FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files (if they exist)
COPY package*.json ./

# Install http-server globally
RUN npm install -g http-server

# Copy application files
COPY . .

# Expose port 8000
EXPOSE 8000

# Start the server
CMD ["http-server", "-p", "8000", "-a", "0.0.0.0"]
