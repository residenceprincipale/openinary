import { Hono } from "hono"
import { promises as fs } from "fs"
import { join } from "path"
import { existsSync } from "fs"
import { apiKeyAuth, AuthVariables } from "../middleware/auth"
import { SmartCache } from "../utils/cache"
import { createStorageClient } from "../utils/storage"
import { safePath } from "../utils/path-security"
import logger from "../utils/logger"

const CACHE_DIR = "./cache"

const cacheRoute = new Hono<AuthVariables>()
cacheRoute.use("/*", apiKeyAuth)

cacheRoute.get("/stats", async (c) => {
  let totalFiles = 0, totalSize = 0
  const files: { name: string; size: number; lastModified: number }[] = []

  if (existsSync(CACHE_DIR)) {
    const names = await fs.readdir(CACHE_DIR)
    for (const name of names) {
      const s = await fs.stat(join(CACHE_DIR, name))
      files.push({ name, size: s.size, lastModified: s.mtimeMs })
    }
    files.sort((a, b) => b.lastModified - a.lastModified)
    totalFiles = files.length
    totalSize = files.reduce((sum, f) => sum + f.size, 0)
  }

  const storage = createStorageClient()
  let cloudFiles: { key: string; size: number; lastModified: Date }[] = []

  if (storage) {
    // ponytail: lists all cache/ objects each time; add pagination if >1000 objects
    cloudFiles = await storage.listAllCachedTransformations()
  }

  return c.json({
    success: true,
    data: {
      local: { totalFiles, totalSize, maxSize: SmartCache["stats"].maxCacheSize, files },
      cloud: storage ? { enabled: true, totalFiles: cloudFiles.length, totalSize: cloudFiles.reduce((s, f) => s + f.size, 0), files: cloudFiles } : { enabled: false },
    },
  })
})

cacheRoute.delete("/", async (c) => {
  let localDeleted = 0

  if (existsSync(CACHE_DIR)) {
    const names = await fs.readdir(CACHE_DIR)
    for (const name of names) {
      try {
        await fs.unlink(join(CACHE_DIR, name))
        localDeleted++
      } catch (err) {
        logger.warn({ error: (err as Error).message, file: name }, "Failed to delete cache file")
      }
    }
  }

  SmartCache["stats"].requests.clear()
  SmartCache["stats"].totalCacheSize = 0

  const storage = createStorageClient()
  let cloudDeleted = 0
  if (storage) {
    cloudDeleted = await storage.clearAllCachedTransformations()
  }

  return c.json({ success: true, data: { localDeleted, cloudDeleted } })
})

cacheRoute.delete("/:name", async (c) => {
  const name = c.req.param("name")
  if (!name) return c.json({ success: false, error: "File name required" }, 400)
  const filePath = safePath(CACHE_DIR, name)
  if (!existsSync(filePath)) return c.json({ success: false, error: "File not found" }, 404)
  try {
    await fs.unlink(filePath)
    return c.json({ success: true, data: { deleted: name } })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

cacheRoute.delete("/old", async (c) => {
  const age = parseInt(c.req.query("age") || String(7 * 24 * 60 * 60 * 1000))
  const cutoff = Date.now() - age

  if (!existsSync(CACHE_DIR)) {
    return c.json({ success: true, data: { deletedCount: 0 } })
  }

  const names = await fs.readdir(CACHE_DIR)
  let deletedCount = 0
  for (const name of names) {
    try {
      const s = await fs.stat(join(CACHE_DIR, name))
      if (s.mtimeMs < cutoff) {
        await fs.unlink(join(CACHE_DIR, name))
        deletedCount++
      }
    } catch (err) {
      logger.warn({ error: (err as Error).message, file: name }, "Failed to delete old cache file")
    }
  }

  return c.json({ success: true, data: { deletedCount, cutoffAge: age } })
})

export default cacheRoute
