import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import Icon from '@/components/ui/Icon'
import {
  addGamePhoto,
  deleteGamePhoto,
  getGamePhotos,
  MAX_PHOTOS_PER_GAME,
} from '@/shared/api/gamePhotoStorage'
import {
  blobToDataUrl,
  deleteCloudGamePhoto,
  listCloudGamePhotos,
  uploadCloudGamePhoto,
} from '@/shared/api/gamePhotoService'
import { compressImage } from '@/shared/utils/imageCompression'
import { useUser } from '@/shared/hooks/useUser'
import '@/styles/components/gamePhotos.css'

const COMPRESS_OPTIONS = { maxWidth: 1600, maxHeight: 1600, quality: 0.82, maxSizeKB: 450 }

/**
 * Photos of a finished game (e.g. the final board).
 *
 * Uploaded games keep their photos on the server, so every player with an
 * account can add them and everyone sees them; the server says what the viewer
 * may do. Games that only exist on this device keep photos in IndexedDB, and
 * those are uploaded the next time the page is opened once the game is in the cloud.
 *
 * @param {string|null} cloudGameId - server id of the game, if it was uploaded
 * @param {string[]} localKeys - every id the game is known by on this device
 * @param {boolean} canEditLocal - whether this device owns the local copy of the game
 * @param {'table'|'wizard'} gameType - which game collection serves the cloud photos
 * @param {string} [hint] - empty-state text; defaults to the generic hint
 */
export default function GamePhotos({ cloudGameId = null, localKeys = [], canEditLocal = false, gameType = 'table', hint }) {
  const { t } = useTranslation()
  const { user } = useUser()
  // Admins may always add photos, also while the server can't be reached:
  // they are kept on this device and uploaded the next time the page opens online
  const canEditDevice = canEditLocal || user?.role === 'admin'
  const fileInputRef = useRef(null)
  const [cloudPhotos, setCloudPhotos] = useState([])
  const [localPhotos, setLocalPhotos] = useState([])
  const [cloudMode, setCloudMode] = useState(false)
  const [cloudCanAdd, setCloudCanAdd] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [viewerIndex, setViewerIndex] = useState(null)

  const keysSignature = localKeys.join('|')

  const load = useCallback(async () => {
    const keys = keysSignature ? keysSignature.split('|') : []
    let stored = []
    try {
      stored = await getGamePhotos(keys)
    } catch (err) {
      console.error('Error loading local game photos:', err)
    }

    if (!cloudGameId || !navigator.onLine) {
      setCloudMode(false)
      setLocalPhotos(stored)
      return
    }

    try {
      let result = await listCloudGamePhotos(cloudGameId, gameType)

      // Photos taken before the game was uploaded: move them to the server
      if (stored.length > 0 && result.canAdd) {
        const room = Math.max(0, (result.maxPhotos || MAX_PHOTOS_PER_GAME) - result.photos.length)
        for (const photo of stored.slice(0, room)) {
          try {
            await uploadCloudGamePhoto(cloudGameId, await blobToDataUrl(photo.blob), photo, gameType)
            await deleteGamePhoto(photo.id)
          } catch (err) {
            console.warn('Could not upload a local game photo:', err.message)
            break
          }
        }
        result = await listCloudGamePhotos(cloudGameId, gameType)
        stored = await getGamePhotos(keys)
      }

      setCloudMode(true)
      setCloudPhotos(result.photos)
      setCloudCanAdd(result.canAdd)
      // Whatever could not be uploaded stays visible from this device
      setLocalPhotos(canEditDevice ? stored : [])
    } catch (err) {
      console.debug('Cloud photos unavailable, showing local ones:', err.message)
      setCloudMode(false)
      setLocalPhotos(stored)
    }
  }, [cloudGameId, keysSignature, canEditDevice, gameType])

  useEffect(() => {
    let cancelled = false
    load().finally(() => {
      if (!cancelled) setLoaded(true)
    })
    return () => { cancelled = true }
  }, [load])

  // Object URLs for photos stored on the device, released when the list changes
  const localUrls = useMemo(
    () => localPhotos.map((photo) => URL.createObjectURL(photo.blob)),
    [localPhotos],
  )
  useEffect(() => () => localUrls.forEach((url) => URL.revokeObjectURL(url)), [localUrls])

  const photos = useMemo(() => [
    ...cloudPhotos.map((photo) => ({
      id: photo.id,
      src: photo.src,
      uploaderName: photo.uploaderName,
      canDelete: photo.canDelete,
      source: 'cloud',
    })),
    ...localPhotos.map((photo, index) => ({
      id: photo.id,
      src: localUrls[index],
      uploaderName: null,
      canDelete: canEditDevice,
      source: 'local',
    })),
  ], [cloudPhotos, localPhotos, localUrls, canEditDevice])

  const closeViewer = useCallback(() => setViewerIndex(null), [])

  useEffect(() => {
    if (viewerIndex === null) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeViewer()
      if (event.key === 'ArrowRight') setViewerIndex((i) => (i + 1) % photos.length)
      if (event.key === 'ArrowLeft') setViewerIndex((i) => (i - 1 + photos.length) % photos.length)
    }
    globalThis.addEventListener('keydown', onKeyDown)
    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [viewerIndex, photos.length, closeViewer])

  const remainingSlots = MAX_PHOTOS_PER_GAME - photos.length
  const canAdd = remainingSlots > 0 && (
    cloudMode ? cloudCanAdd : (canEditDevice && localKeys.length > 0)
  )
  const hasLocalOnly = localPhotos.length > 0

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, Math.max(remainingSlots, 0))
    event.target.value = ''
    if (files.length === 0) return

    setBusy(true)
    setError(null)
    try {
      for (const file of files) {
        const { blob, dataUrl, width, height } = await compressImage(file, COMPRESS_OPTIONS)
        if (cloudMode) {
          const uploaded = await uploadCloudGamePhoto(cloudGameId, dataUrl, { width, height }, gameType)
          setCloudPhotos((prev) => [...prev, uploaded])
        } else {
          const stored = await addGamePhoto(localKeys[0], blob, { width, height })
          setLocalPhotos((prev) => [...prev, stored])
        }
      }
    } catch (err) {
      console.error('Error adding game photo:', err)
      if (err.status === 401) setError(t('gamePhotos.signInRequired'))
      else if (err.status === 403) setError(t('gamePhotos.notAllowed'))
      else if (err.code === 'PHOTO_LIMIT') setError(t('gamePhotos.limitReached', { max: MAX_PHOTOS_PER_GAME }))
      else setError(t('gamePhotos.addFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (photo) => {
    if (!confirm(t('gamePhotos.deleteConfirm'))) return
    try {
      if (photo.source === 'cloud') {
        await deleteCloudGamePhoto(cloudGameId, photo.id, gameType)
        setCloudPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      } else {
        await deleteGamePhoto(photo.id)
        setLocalPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      }
      setViewerIndex(null)
    } catch (err) {
      console.error('Error deleting game photo:', err)
      setError(t('gamePhotos.deleteFailed'))
    }
  }

  // Nothing to show to a viewer who can't add photos
  if (!loaded || (!canAdd && photos.length === 0)) return null

  const openPicker = () => fileInputRef.current?.click()
  const viewerPhoto = viewerIndex === null ? null : photos[viewerIndex]

  return (
    <section className="game-photos-section" aria-label={t('gamePhotos.title')}>
      <div className="game-photos-header">
        <h3 className="game-photos-title">
          <Icon name="Camera" size={18} aria-hidden="true" />
          {t('gamePhotos.title')}
        </h3>
        {canAdd && photos.length > 0 && (
          <button
            type="button"
            className="game-photos-add-button"
            onClick={openPicker}
            disabled={busy}
            aria-label={t('gamePhotos.add')}
            title={t('gamePhotos.add')}
          >
            <Icon name="ImagePlus" size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {canAdd && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="game-photos-input"
          onChange={(event) => void handleFiles(event)}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {photos.length === 0 ? (
        <button
          type="button"
          className="game-photos-empty"
          onClick={openPicker}
          disabled={busy}
        >
          <Icon name="ImagePlus" size={32} aria-hidden="true" />
          <span className="game-photos-empty-title">
            {busy ? t('gamePhotos.saving') : t('gamePhotos.emptyTitle')}
          </span>
          <span className="game-photos-empty-hint">{hint || t('gamePhotos.emptyHint')}</span>
        </button>
      ) : (
        <div className={`game-photos-grid${photos.length === 1 ? ' single' : ''}`}>
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              className="game-photo-thumb"
              onClick={() => setViewerIndex(index)}
              aria-label={t('gamePhotos.open', { n: index + 1 })}
            >
              <img src={photo.src} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
          {busy && <div className="game-photo-thumb game-photo-pending skeleton" aria-hidden="true" />}
        </div>
      )}

      {hasLocalOnly && (
        <p className="game-photos-note">
          {cloudGameId ? t('gamePhotos.pendingUploadNote') : t('gamePhotos.deviceOnlyNote')}
        </p>
      )}
      {error && <p className="game-photos-error" role="alert">{error}</p>}

      {viewerPhoto && createPortal(
        <div
          className="game-photo-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={t('gamePhotos.title')}
          onClick={closeViewer}
        >
          <img
            src={viewerPhoto.src}
            alt={t('gamePhotos.open', { n: viewerIndex + 1 })}
            onClick={(event) => event.stopPropagation()}
          />
          {viewerPhoto.uploaderName && (
            <p className="game-photo-viewer-caption">
              {t('gamePhotos.addedBy', { name: viewerPhoto.uploaderName })}
            </p>
          )}
          <div className="game-photo-viewer-actions" onClick={(event) => event.stopPropagation()}>
            {photos.length > 1 && (
              <button
                type="button"
                className="game-photo-viewer-button"
                onClick={() => setViewerIndex((i) => (i - 1 + photos.length) % photos.length)}
                aria-label={t('gamePhotos.previous')}
              >
                <Icon name="ChevronLeft" size={22} aria-hidden="true" />
              </button>
            )}
            {viewerPhoto.canDelete && (
              <button
                type="button"
                className="game-photo-viewer-button danger"
                onClick={() => void handleDelete(viewerPhoto)}
                aria-label={t('gamePhotos.delete')}
                title={t('gamePhotos.delete')}
              >
                <Icon name="Trash2" size={20} aria-hidden="true" />
              </button>
            )}
            {photos.length > 1 && (
              <button
                type="button"
                className="game-photo-viewer-button"
                onClick={() => setViewerIndex((i) => (i + 1) % photos.length)}
                aria-label={t('gamePhotos.next')}
              >
                <Icon name="ChevronRight" size={22} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="game-photo-viewer-button"
              onClick={closeViewer}
              aria-label={t('common.close')}
            >
              <Icon name="X" size={22} aria-hidden="true" />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}
