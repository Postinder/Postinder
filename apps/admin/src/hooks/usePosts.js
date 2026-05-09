import { useState, useEffect, useCallback } from 'react'
import { fetchPosts } from '../services/posts.service'
import { usePostsStore } from '../store/postsStore'

export function usePosts(filters = {}) {
  const { posts, setPosts, setLoading, loading } = usePostsStore()
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPosts(filters)
      setPosts(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filters)])

  useEffect(() => { load() }, [load])

  return { posts, loading, error, refetch: load }
}
