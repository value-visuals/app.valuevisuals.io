# Use the official Node.js 22.x Alpine image
FROM node:22-alpine

# Install required system libraries for sharp
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Copy and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source files
COPY . .

# Build the Next.js app
RUN npm run build

# Prune dev dependencies (safe since sharp is in dependencies)
RUN npm prune --production

# Expose app port
EXPOSE 3015

# Start the Next.js server
CMD ["npm", "start"]