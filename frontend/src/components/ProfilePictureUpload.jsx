function ProfilePictureUpload({ onChange }) {
    const handleFileChange = (e) => {
      if (e.target.files && e.target.files[0]) {
        onChange(e.target.files[0])
      }
    }
  
    return (
      <div className="my-2">
        <label className="block text-sm font-medium text-gray-700">Profilbild hochladen:</label>
        <input type="file" accept="image/*" onChange={handleFileChange} className="mt-1" />
      </div>
    )
  }
  
  export default ProfilePictureUpload
  