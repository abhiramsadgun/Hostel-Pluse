const db = require('../../db');

async function getUserNotifications(req, res) {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT id, title, message, type, is_read, metadata, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    const unreadCountRes = await db.query(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        notifications: result.rows,
        unreadCount: parseInt(unreadCountRes.rows[0]?.count || 0, 10),
      },
      error: null,
    });
  } catch (err) {
    console.error('[NOTIFICATIONS-FETCH] Error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to retrieve notifications: ' + err.message, code: 'NOTIF_ERROR' },
    });
  }
}

async function markAsRead(req, res) {
  try {
    const notifId = req.params.id;
    const userId = req.user.id;

    await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [notifId, userId]
    );

    return res.status(200).json({
      success: true,
      data: { message: 'Notification marked as read.' },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to update notification.', code: 'NOTIF_UPDATE_ERROR' },
    });
  }
}

async function markAllAsRead(req, res) {
  try {
    const userId = req.user.id;
    await db.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [userId]);

    return res.status(200).json({
      success: true,
      data: { message: 'All notifications marked as read.' },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to update notifications.', code: 'NOTIF_UPDATE_ERROR' },
    });
  }
}

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
};
