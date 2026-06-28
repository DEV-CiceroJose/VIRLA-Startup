import jwt from 'jsonwebtoken'
import { authLogger } from '../lib/logger.js'

/**
 * Socket.io auth middleware — runs before 'connection' event.
 * Verifies JWT and attaches userId to socket.
 */
export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token

  if (!token) {
    authLogger.warn('socket:auth_missing', {
      ip: socket.handshake.address,
      timestamp: new Date().toISOString()
    })
    return next(new Error('Authentication token missing'))
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRET)
    socket.userId = decoded.id ?? decoded.userId ?? decoded.sub
    next()
  } catch (err) {
    authLogger.warn('socket:auth_invalid', {
      ip: socket.handshake.address,
      error: err.message,
      timestamp: new Date().toISOString()
    })
    next(new Error('Invalid or expired token'))
  }
}

/**
 * Registers connection/disconnection lifecycle events.
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function registerConnectionEvents(socket, io) {
  const { userId } = socket

  // Each user joins their personal room so we can target them by ID
  socket.join(`user:${userId}`)

  authLogger.info('socket:connected', {
    userId,
    socketId: socket.id,
    timestamp: new Date().toISOString()
  })

  // Broadcast online status to everyone
  socket.broadcast.emit('user:online', { userId })

  socket.on('disconnect', (reason) => {
    authLogger.info('socket:disconnected', {
      userId,
      socketId: socket.id,
      reason,
      timestamp: new Date().toISOString()
    })
    socket.broadcast.emit('user:offline', { userId })
  })
}