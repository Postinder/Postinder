import { create } from 'zustand'

export const usePostsStore = create((set, get) => ({
  posts:   [],
  loading: false,
  error:   null,

  setPosts:  (posts)  => set({ posts }),
  setLoading:(v)      => set({ loading: v }),
  setError:  (e)      => set({ error: e }),

  addPost: (post) => set({ posts: [post, ...get().posts] }),

  updatePost: (id, updates) => set({
    posts: get().posts.map(p => p.id === id ? { ...p, ...updates } : p)
  }),

  removePost: (id) => set({
    posts: get().posts.filter(p => p.id !== id)
  }),
}))
