import { describe, it, expect, vi, beforeEach } from 'vitest'

const rows = []
vi.mock('../../db/database.js', () => {
  const where = () => ({
    anyOf: (keys) => ({
      toArray: async () => rows.filter((row) => keys.includes(row.gameKey)),
      delete: async () => {
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (keys.includes(rows[i].gameKey)) rows.splice(i, 1)
        }
      },
    }),
  })
  return {
    db: {
      gamePhotos: {
        where,
        put: async (row) => { rows.push(row) },
        delete: async (id) => {
          const index = rows.findIndex((row) => row.id === id)
          if (index >= 0) rows.splice(index, 1)
        },
      },
    },
  }
})

const {
  getGamePhotoKeys,
  getGamePhotos,
  addGamePhoto,
  deleteGamePhoto,
  deleteGamePhotos,
} = await import('../gamePhotoStorage.js')

describe('gamePhotoStorage', () => {
  beforeEach(() => { rows.length = 0 })

  it('collects every id a game is known by, deduplicated, local id first', () => {
    const game = { id: 'table_1', localId: 'table_1', cloudId: 'abc123' }
    expect(getGamePhotoKeys(game, 'abc123')).toEqual(['table_1', 'abc123'])
    expect(getGamePhotoKeys(null, 'route-id')).toEqual(['route-id'])
    expect(getGamePhotoKeys({}, undefined)).toEqual([])
  })

  it('finds photos stored under any of the game ids, oldest first', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    const first = await addGamePhoto('table_1', blob)
    first.createdAt = 1
    const second = await addGamePhoto('abc123', blob)
    second.createdAt = 2
    await addGamePhoto('other_game', blob)

    const photos = await getGamePhotos(['table_1', 'abc123'])
    expect(photos.map((p) => p.id)).toEqual([first.id, second.id])
  })

  it('rejects non-Blob input and missing keys', async () => {
    await expect(addGamePhoto('table_1', 'data:image/png')).rejects.toThrow()
    await expect(addGamePhoto('', new Blob(['x']))).rejects.toThrow()
  })

  it('deletes single photos and all photos of a game', async () => {
    const blob = new Blob(['x'])
    const photo = await addGamePhoto('table_1', blob)
    await addGamePhoto('table_1', blob)
    await addGamePhoto('other_game', blob)

    await deleteGamePhoto(photo.id)
    expect(await getGamePhotos(['table_1'])).toHaveLength(1)

    await deleteGamePhotos(['table_1'])
    expect(await getGamePhotos(['table_1'])).toHaveLength(0)
    expect(await getGamePhotos(['other_game'])).toHaveLength(1)
  })

  it('returns nothing for an empty key list', async () => {
    expect(await getGamePhotos([])).toEqual([])
  })
})
