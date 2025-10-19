import { useState, useEffect } from 'react';
import { LocalUserProfileService } from '@/shared/api';
import { useUser } from '@/shared/hooks/useUser';
import { UserIcon, XIcon } from '../ui/Icon';
import '@/styles/components/UserSwitcher.css';

/**
 * UserSwitcher Component
 * Allows switching between multiple user profiles on the same device
 * Useful for families or shared devices
 */
const UserSwitcher = ({ isOpen, onClose }) => {
  const { user, refreshAuthStatus } = useUser();
  const [profiles, setProfiles] = useState([]);
  const [showGuestCreation, setShowGuestCreation] = useState(false);
  const [guestName, setGuestName] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  const loadProfiles = () => {
    const profilesList = LocalUserProfileService.getProfilesList();
    setProfiles(profilesList);
  };

  const handleSwitchToProfile = (profileId) => {
    // Set the profile as current
    LocalUserProfileService.setCurrentUser(profileId);
    
    // Refresh the app to load the new user's data
    window.location.reload();
  };

  const handleCreateGuest = () => {
    if (!guestName.trim()) return;
    
    const profile = LocalUserProfileService.createGuestProfile(guestName.trim());
    console.debug('Created guest profile:', profile);
    
    // Reload to switch to the new guest user
    window.location.reload();
  };

  const handleDeleteProfile = (profileId) => {
    if (confirm('Are you sure you want to delete this profile and all its games?')) {
      LocalUserProfileService.deleteProfile(profileId);
      loadProfiles();
    }
  };

  const currentUserId = LocalUserProfileService.getCurrentUserId();

  if (!isOpen) return null;

  return (
    <div className="user-switcher-overlay" onClick={onClose}>
      <div className="user-switcher-modal" onClick={(e) => e.stopPropagation()}>
        <div className="user-switcher-header">
          <h2>Switch User</h2>
          <button className="close-btn" onClick={onClose}>
            <XIcon size={24} />
          </button>
        </div>

        <div className="user-switcher-content">
          {user && (
            <div className="current-user-info">
              <UserIcon size={20} />
              <span>Currently logged in as: <strong>{user.username || user.name}</strong></span>
            </div>
          )}

          <div className="profiles-list">
            <h3>Available Profiles</h3>
            {profiles.length === 0 ? (
              <p className="no-profiles">No local profiles found</p>
            ) : (
              profiles.map((profile) => (
                <div 
                  key={profile.userId} 
                  className={`profile-item ${profile.userId === currentUserId ? 'active' : ''}`}
                >
                  <div className="profile-info">
                    <UserIcon size={18} />
                    <div className="profile-details">
                      <span className="profile-name">{profile.username}</span>
                      {profile.isGuest && <span className="guest-badge">Guest</span>}
                      <span className="profile-last-active">
                        Last active: {new Date(profile.lastActive).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="profile-actions">
                    {profile.userId !== currentUserId && (
                      <button 
                        className="switch-btn"
                        onClick={() => handleSwitchToProfile(profile.userId)}
                      >
                        Switch
                      </button>
                    )}
                    {profile.isGuest && (
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteProfile(profile.userId)}
                      >
                        <XIcon size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="guest-section">
            {!showGuestCreation ? (
              <button 
                className="create-guest-btn"
                onClick={() => setShowGuestCreation(true)}
              >
                + Create Guest Profile
              </button>
            ) : (
              <div className="guest-creation-form">
                <input
                  type="text"
                  placeholder="Guest name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateGuest()}
                  autoFocus
                />
                <button onClick={handleCreateGuest}>Create</button>
                <button onClick={() => {
                  setShowGuestCreation(false);
                  setGuestName('');
                }}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="user-switcher-info">
            <p>
              <strong>Note:</strong> Each user profile stores games separately. 
              When you log in with an account, your games are associated with that account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSwitcher;
