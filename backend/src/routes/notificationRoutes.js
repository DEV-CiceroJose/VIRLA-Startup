import express from 'express'
import checkToken from '../middlewares/checkToken.js'
import { validateZod } from '../middlewares/validateZod.js'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  markConversationNotificationsRead,
} from '../controllers/notificationController.js'
import { notificationIdParamSchema, senderIdParamSchema } from '../schemas/notificationSchemas.js'

const router = express.Router()

router.get('/notifications', checkToken, listNotifications)
router.patch(
  '/notifications/:id/read',
  checkToken,
  validateZod(notificationIdParamSchema, 'params'),
  markNotificationRead,
)
router.post('/notifications/read-all', checkToken, markAllNotificationsRead)
router.patch(
  '/notifications/conversation/:senderId/read',
  checkToken,
  validateZod(senderIdParamSchema, 'params'),
  markConversationNotificationsRead,
)

export default router
