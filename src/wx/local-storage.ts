// @ts-nocheck

import type { SupportedStorage } from '@supabase/auth-js'

export const wxLocalStorage: SupportedStorage = {
  getItem: (key) => wx.getStorageSync(key),
  setItem: (key, value) => {
    wx.setStorage({ key, data: value })
  },
  removeItem: (key) => {
    wx.removeStorage({ key })
  },
}
