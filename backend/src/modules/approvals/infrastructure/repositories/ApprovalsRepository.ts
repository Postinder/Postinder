import { query } from '../../../../shared/database/pool'

export class ApprovalsRepository {
  async getClientQueue(clientId: string) {
    const result = await query(
      `SELECT
         p.id          AS post_id,
         p.title,
         p.description AS caption,
         f.id          AS file_id,
         f.url         AS storage_url,
         f.file_type,
         f.original_name,
         f.created_at  AS file_created_at
       FROM files f
       JOIN posts p ON f.post_id = p.id
       WHERE p.client_id = $1 AND f.status = 'pending'
       ORDER BY p.created_at DESC, f.created_at ASC`,
      [clientId],
    )

    // Group by post
    const postMap = new Map<string, { post: any; files: any[] }>()
    for (const row of result.rows) {
      if (!postMap.has(row.post_id)) {
        postMap.set(row.post_id, {
          post: { id: row.post_id, title: row.title, caption: row.caption, channels: [], formats: {} },
          files: [],
        })
      }
      postMap.get(row.post_id)!.files.push({
        id: row.file_id,
        name: row.original_name || row.storage_url?.split('/').pop() || 'arquivo',
        storage_url: row.storage_url,
        file_type: row.file_type,
      })
    }

    // Flatten to queue items (one item per file)
    const queue: any[] = []
    for (const [, { post, files }] of postMap) {
      files.forEach((file, fileIndex) => {
        queue.push({ post, file, fileIndex, totalFiles: files.length, isEmail: false })
      })
    }

    return queue
  }

  async approveFile(fileId: string) {
    const fileRes = await query(`UPDATE files SET status = 'approved', updated_at = NOW() WHERE id = $1 RETURNING post_id`, [fileId])
    if (!fileRes.rows[0]) return

    const postId = fileRes.rows[0].post_id
    const pending = await query(`SELECT id FROM files WHERE post_id = $1 AND status = 'pending'`, [postId])
    if (pending.rows.length === 0) {
      await query(`UPDATE posts SET status = 'approved', updated_at = NOW() WHERE id = $1`, [postId])
    }
  }

  async rejectFile(fileId: string, tags: string[], comment: string) {
    const fileRes = await query(
      `UPDATE files SET status = 'rejected', rejection_reason = $2, rejection_tags = $3, updated_at = NOW() WHERE id = $1 RETURNING post_id`,
      [fileId, comment || null, tags],
    )
    if (fileRes.rows[0]) {
      await query(`UPDATE posts SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [fileRes.rows[0].post_id])
    }
  }

  async saveFeedback(clientId: string, rating: number, text: string, month: string) {
    await query(
      `INSERT INTO feedback (client_id, rating, text, month) VALUES ($1, $2, $3, $4)`,
      [clientId, rating, text, month],
    )
  }

  async approveAllFiles(postId: string) {
    await query(`UPDATE files SET status = 'approved', updated_at = NOW() WHERE post_id = $1`, [postId])
    await query(`UPDATE posts SET status = 'approved', updated_at = NOW() WHERE id = $1`, [postId])
  }

  async rejectAllFiles(postId: string) {
    await query(`UPDATE files SET status = 'rejected', updated_at = NOW() WHERE post_id = $1`, [postId])
    await query(`UPDATE posts SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [postId])
  }
}
