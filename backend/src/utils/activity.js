import { getDb } from '../config/db.js';

export async function logActivity(user, module, action, oldValue = null, newValue = null) {
  try {
    const db = getDb();
    const oldStr = oldValue ? (typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue)) : null;
    const newStr = newValue ? (typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue)) : null;

    await db.query(
      'INSERT INTO activity_logs (user, module, action, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
      [user || 'System', module, action, oldStr, newStr]
    );
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
}
