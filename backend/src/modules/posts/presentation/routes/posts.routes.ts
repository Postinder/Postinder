import { Router, Request, Response } from 'express'
import { PostsController } from '../controllers/PostsController'
import { CreatePostService } from '../../application/services/CreatePostService'
import { ListPostsService } from '../../application/services/ListPostsService'
import { GetPostService } from '../../application/services/GetPostService'
import { PostRepository } from '../../infrastructure/repositories/PostRepository'
import { ApprovalsController } from '../../../approvals/presentation/controllers/ApprovalsController'
import { upload, getFileCategory } from '../../../../shared/upload/multer'
import { query } from '../../../../shared/database/pool'

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => fn(req as any, res).catch(err => res.status(err.statusCode || 500).json({ error: err.message }))
}

const approvalsCtrl = new ApprovalsController()

export function createPostsRoutes(): Router {
  const router = Router()
  const postRepo = new PostRepository()
  const controller = new PostsController(
    new CreatePostService(postRepo),
    new ListPostsService(postRepo),
    new GetPostService(postRepo),
  )

  router.get('/', wrap(controller.list.bind(controller)))
  router.post('/', wrap(controller.create.bind(controller)))
  router.get('/:id', wrap(controller.getById.bind(controller)))

  router.put('/:id', wrap(async (req: any, res: Response) => {
    const { id } = req.params
    const { title, description, caption, scheduled_date, scheduledDate, funnel_tag, funnelTag, channels, formats, email_link, emailLink } = req.body
    const fields: string[] = ['updated_at = NOW()']
    const params: any[] = []
    if (title !== undefined)         { params.push(title);                      fields.push(`title = $${params.length}`) }
    if (description !== undefined)   { params.push(description);                fields.push(`description = $${params.length}`) }
    if (caption !== undefined)       { params.push(caption);                    fields.push(`description = $${params.length}`) }
    if (scheduled_date !== undefined || scheduledDate !== undefined) {
      params.push(scheduled_date ?? scheduledDate)
      fields.push(`scheduled_date = $${params.length}`)
    }
    if (funnel_tag !== undefined || funnelTag !== undefined) {
      params.push(funnel_tag ?? funnelTag)
      fields.push(`funnel_tag = $${params.length}`)
    }
    if (channels !== undefined)      { params.push(channels);                   fields.push(`channels = $${params.length}`) }
    if (formats !== undefined)       { params.push(JSON.stringify(formats));    fields.push(`formats = $${params.length}`) }
    if (email_link !== undefined || emailLink !== undefined) {
      params.push(email_link ?? emailLink)
      fields.push(`email_link = $${params.length}`)
    }
    params.push(id)
    const conditions = [`id = $${params.length}`, 'deleted_at IS NULL']
    if (req.tenantId) {
      params.push(req.tenantId)
      conditions.push(`company_id = $${params.length}`)
    }
    const result = await query(`UPDATE posts SET ${fields.join(', ')} WHERE ${conditions.join(' AND ')} RETURNING *`, params)
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' })
    res.json(result.rows[0])
  }))

  router.delete('/:id', wrap(async (req: any, res: Response) => {
    const params: any[] = [req.params.id]
    const conditions = ['id = $1']
    if (req.tenantId) {
      params.push(req.tenantId)
      conditions.push(`company_id = $${params.length}`)
    }
    await query(`UPDATE posts SET deleted_at = NOW(), updated_at = NOW() WHERE ${conditions.join(' AND ')}`, params)
    res.json({ success: true })
  }))

  // File upload: saves files to disk and inserts into files table
  router.post('/:id/files', upload.array('files'), wrap(async (req: any, res: Response) => {
    const { id } = req.params
    const uploadedFiles = req.files as Express.Multer.File[]
    if (!uploadedFiles?.length) {
      return res.status(400).json({ error: 'No files uploaded' })
    }
    const params: any[] = [id]
    const conditions = ['id = $1', 'deleted_at IS NULL']
    if (req.tenantId) {
      params.push(req.tenantId)
      conditions.push(`company_id = $${params.length}`)
    }
    const post = await query(`SELECT id FROM posts WHERE ${conditions.join(' AND ')}`, params)
    if (!post.rows[0]) return res.status(404).json({ error: 'Post not found' })

    const savedFiles = []
    for (const file of uploadedFiles) {
      const url = `/uploads/${file.filename}`
      const category = getFileCategory(file.mimetype)
      const result = await query(
        `INSERT INTO files (post_id, url, original_name, file_type, status)
         VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
        [id, url, file.originalname, category],
      )
      savedFiles.push(result.rows[0])
    }
    await query(`UPDATE posts SET status = 'pending_approval', updated_at = NOW() WHERE id = $1`, [id])
    res.status(201).json({ data: savedFiles })
  }))

  // Submit for approval (sets status to pending_approval)
  router.post('/:id/submit-for-approval', wrap(async (req: any, res: Response) => {
    const params: any[] = [req.params.id]
    const conditions = ['id = $1', 'deleted_at IS NULL']
    if (req.tenantId) {
      params.push(req.tenantId)
      conditions.push(`company_id = $${params.length}`)
    }
    const result = await query(`UPDATE posts SET status = 'pending_approval', submitted_at = NOW(), updated_at = NOW() WHERE ${conditions.join(' AND ')} RETURNING id`, params)
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' })
    res.json({ success: true })
  }))

  // Resubmit a rejected post for client re-approval
  router.post('/:id/resubmit', wrap(async (req: any, res: Response) => {
    const { id } = req.params
    const { title, caption, description, justificativa } = req.body
    const updates: string[] = ['status = \'pending_approval\'', 'updated_at = NOW()']
    const params: any[] = []
    if (title)                   { params.push(title);                   updates.push(`title = $${params.length}`) }
    if (caption || description)  { params.push(caption || description);  updates.push(`description = $${params.length}`) }
    params.push(id)
    const conditions = [`id = $${params.length}`, 'deleted_at IS NULL']
    if (req.tenantId) {
      params.push(req.tenantId)
      conditions.push(`company_id = $${params.length}`)
    }
    const result = await query(`UPDATE posts SET ${updates.join(', ')} WHERE ${conditions.join(' AND ')} RETURNING id`, params)
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' })
    await query(
      `UPDATE files SET status = 'pending' WHERE post_id = $1 AND status = 'rejected'`,
      [id]
    )
    if (justificativa) {
      await query(
        `INSERT INTO post_notes (post_id, note, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
        [id, justificativa]
      ).catch(() => {})
    }
    res.json({ success: true })
  }))

  // Approve / reject all files in a post (used by admin override)
  router.post('/:id/approve', wrap(approvalsCtrl.approvePost.bind(approvalsCtrl)))
  router.post('/:id/reject', wrap(approvalsCtrl.rejectPost.bind(approvalsCtrl)))

  return router
}
