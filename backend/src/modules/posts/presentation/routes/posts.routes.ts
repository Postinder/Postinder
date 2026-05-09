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
  return (req: Request, res: Response) => fn(req as any, res).catch(err => res.status(500).json({ error: err.message }))
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
    const { title, description, caption, scheduled_date, funnel_tag } = req.body
    const fields: string[] = ['updated_at = NOW()']
    const params: any[] = []
    if (title !== undefined)         { params.push(title);                      fields.push(`title = $${params.length}`) }
    if (description !== undefined)   { params.push(description);                fields.push(`description = $${params.length}`) }
    if (caption !== undefined)       { params.push(caption);                    fields.push(`description = $${params.length}`) }
    if (scheduled_date !== undefined){ params.push(scheduled_date);             fields.push(`scheduled_date = $${params.length}`) }
    if (funnel_tag !== undefined)    { params.push(funnel_tag);                 fields.push(`funnel_tag = $${params.length}`) }
    params.push(id)
    const result = await query(`UPDATE posts SET ${fields.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`, params)
    res.json(result.rows[0])
  }))

  router.delete('/:id', wrap(async (req: any, res: Response) => {
    await query(`UPDATE posts SET deleted_at = NOW() WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  }))

  // File upload: saves files to disk and inserts into files table
  router.post('/:id/files', upload.array('files'), wrap(async (req: any, res: Response) => {
    const { id } = req.params
    const uploadedFiles = req.files as Express.Multer.File[]
    if (!uploadedFiles?.length) {
      return res.status(400).json({ error: 'No files uploaded' })
    }
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
    await query(`UPDATE posts SET status = 'pending_approval', updated_at = NOW() WHERE id = $1`, [req.params.id])
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
    await query(`UPDATE posts SET ${updates.join(', ')} WHERE id = $${params.length}`, params)
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
