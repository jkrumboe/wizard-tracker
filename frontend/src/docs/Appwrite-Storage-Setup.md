# Appwrite Storage Setup for Avatar Uploads

This document describes how to set up Appwrite Storage for avatar uploads in your wizard-tracker application.

## Required Appwrite Storage Setup

### 1. Create Storage Bucket

1. **Go to your Appwrite Console**
   - Navigate to Storage section
   - Click "Create Bucket"

2. **Bucket Configuration**
   - **Bucket ID**: `avatar`
   - **Bucket Name**: `User Avatars`
   - **Maximum File Size**: 5MB (5,242,880 bytes)
   - **Allowed File Extensions**: `jpg`, `jpeg`, `png`, `gif`, `webp`
   - **Compression**: `gzip` (optional)
   - **Encryption**: `true` (recommended)

### 2. Set Bucket Permissions

Configure the following permissions for the `avatar` bucket:

#### Option 1: Bucket-Level Permissions (Simpler Setup)

- **Read**: `role:any` (allows public read access for avatar display)
- **Create**: `role:user` (allows authenticated users to upload avatars)
- **Update**: `role:user` (allows users to update their avatars)
- **Delete**: `role:user` (allows users to delete their avatars)

#### Option 2: File-Level Permissions (Recommended - More Secure)

If you want more granular control, you can:

1. **Set minimal bucket permissions**:
   - **Create**: `role:user` (allows authenticated users to upload)
   - Leave Read/Update/Delete empty at bucket level

2. **File-level permissions are set automatically by the app**:
   - **Read**: `role:any` (public read for avatar display)
   - **Update/Delete**: Only the file owner (set per user)

## Security Features

### File-Level Permissions (Implemented)

The avatar system uses Appwrite's file-level permissions for enhanced security:

- **Public Read Access**: Anyone can view avatar images (needed for profile display)
- **Owner-Only Control**: Only the user who uploaded an avatar can update or delete it
- **Automatic Permission Assignment**: Permissions are set automatically during upload

### Permission Model

```javascript
// Permissions set automatically during upload:
[
  Permission.read(Role.any()),              // Anyone can view the avatar
  Permission.update(Role.user(userId)),     // Only owner can update
  Permission.delete(Role.user(userId))      // Only owner can delete
]
```

### Benefits

1. **User Privacy**: Users can only modify their own avatars
2. **Public Display**: Avatars are publicly readable for profile views
3. **Automatic Management**: No manual permission configuration needed
4. **Secure by Default**: Each file is protected from unauthorized access

### 4. Environment Configuration

Update your `.env` file:

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id_here
```

### 5. Testing the Setup

1. **Upload Test**: Try uploading an avatar through the profile page
2. **Display Test**: Verify the avatar displays correctly after upload
3. **Permissions Test**: Ensure other users can see avatars but cannot modify them

## File Structure

The avatar system stores:
- **Files**: In the `avatar` Storage bucket
- **File IDs**: In user Account preferences (`avatarFileId`)
- **URLs**: Generated dynamically using Appwrite's preview API

## Avatar Features

### Image Processing
- **Automatic Resizing**: Images are resized to 128x128 pixels for display
- **Format Conversion**: Images are converted to WebP for optimal performance
- **Quality Optimization**: 80% quality setting for good balance of size/quality

### Fallback System
- **Initials Avatar**: Appwrite's built-in initials generator as fallback
- **Default Avatar**: Local default image if Appwrite is unavailable

### Performance
- **Caching**: Appwrite automatically caches generated previews
- **CDN**: Images are served through Appwrite's global CDN
- **Lazy Loading**: Images load on-demand

## Troubleshooting

### Common Issues

1. **403 Forbidden on Upload**
   - Check bucket create permissions include `role:user`
   - Verify user is authenticated

2. **Images Not Displaying**
   - Check bucket read permissions include `role:all`
   - Verify bucket ID is exactly `avatar`

3. **File Size Errors**
   - Confirm bucket maximum file size is at least 5MB
   - Check file is actually under 5MB

4. **Unsupported File Type**
   - Verify allowed extensions include common image formats
   - Ensure file has proper extension

### Debug Steps

1. **Check Console Logs**: Look for specific error messages
2. **Verify Bucket Settings**: Double-check all permissions and settings
3. **Test File Upload**: Try uploading through Appwrite console directly
4. **Check Network Tab**: Look for failed API requests

## Security Best Practices

1. **File Size Limits**: Keep maximum file size reasonable (5MB recommended)
2. **File Type Validation**: Only allow image file types
3. **Rate Limiting**: Consider implementing upload rate limits
4. **Content Scanning**: Enable antivirus if available
5. **User Quotas**: Consider per-user storage limits if needed

## Performance Optimization

1. **Image Compression**: Client-side compression before upload (optional)
2. **Progressive Loading**: Show placeholder while image loads
3. **Caching Strategy**: Leverage browser and CDN caching
4. **Batch Operations**: Group multiple avatar operations if needed
