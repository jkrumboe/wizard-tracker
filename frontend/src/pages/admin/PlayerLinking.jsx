import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import userService from '@/shared/api/userService';
import Icon from '@/components/ui/Icon';
import {
  AdminEmpty,
  AdminExplainer,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminSearch,
  AdminSection,
  AdminTabs,
} from '@/components/admin/AdminUI';
import {
  formatDate,
  useAdminConfirm,
} from '@/components/admin/adminUtils';
import '@/styles/pages/admin.css';

const matches = (value, query) => (value || '').toLowerCase().includes(query.trim().toLowerCase());

const PlayerLinking = () => {
  const { t, i18n } = useTranslation();
  const [confirm, confirmDialog] = useAdminConfirm();

  const [guestIdentities, setGuestIdentities] = useState([]);
  const [linkedIdentities, setLinkedIdentities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState(null);

  const [identitySearch, setIdentitySearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [linkedFilter, setLinkedFilter] = useState('');
  const [tab, setTab] = useState('unlinked');

  const userDropdownRef = useRef(null);
  const formRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [guestData, usersData] = await Promise.all([
        userService.getGuestIdentities(),
        userService.getAllUsers()
      ]);

      const userArray = Array.isArray(usersData)
        ? usersData
        : usersData?.users || Object.values(usersData || {}).find(Array.isArray) || [];
      const identities = guestData.identities || [];

      setGuestIdentities(identities.filter(identity => !identity.linkedToUser));
      setLinkedIdentities(identities.filter(identity => identity.linkedToUser));
      setUsers(userArray.filter(user => user.role !== 'guest' && !user.isDeleted));
    } catch (err) {
      console.error('Error loading data:', err);
      setError(t('adminPlayerLinking.loadFailed', { error: err.message }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showUserDropdown) return undefined;
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserDropdown]);

  const handleSelectIdentity = (identity) => {
    setSelectedIdentity(identity);
    setSelectedUser(null);
    setUserSearch('');
    setSuccess('');
    // On phones the form sits below the list
    requestAnimationFrame(() => formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }));
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setUserSearch(user.username);
    setShowUserDropdown(false);
  };

  const clearSelection = () => {
    setSelectedIdentity(null);
    setSelectedUser(null);
    setUserSearch('');
  };

  const handleLink = async () => {
    if (!selectedIdentity || !selectedUser) {
      setError(t('adminPlayerLinking.selectBothRequired'));
      return;
    }

    const ok = await confirm({
      title: t('adminPlayerLinking.linkIdentity'),
      message: t('adminPlayerLinking.linkConfirm', { identity: selectedIdentity.displayName, username: selectedUser.username }),
      confirmLabel: t('adminPlayerLinking.linkIdentity'),
      icon: 'Link2',
    });
    if (!ok) return;

    try {
      setIsLinking(true);
      setError('');
      setSuccess('');
      await userService.linkGuestIdentity(selectedIdentity._id, selectedUser._id || selectedUser.id);
      setSuccess(t('adminPlayerLinking.linkSuccess', { identity: selectedIdentity.displayName, username: selectedUser.username }));
      clearSelection();
      await loadData();
    } catch (err) {
      console.error('Error linking identity:', err);
      setError(t('adminPlayerLinking.linkFailed', { error: err.message }));
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (identity) => {
    const ok = await confirm({
      title: t('adminPlayerLinking.unlinkIdentity'),
      message: t('adminPlayerLinking.unlinkConfirm', { identity: identity.displayName, username: identity.linkedToUser?.username || '' }),
      confirmLabel: t('adminPlayerLinking.unlink'),
      tone: 'danger',
    });
    if (!ok) return;

    try {
      setUnlinkingId(identity._id);
      setError('');
      setSuccess('');
      await userService.unlinkGuestIdentity(identity._id, identity.linkedToUser?._id);
      setSuccess(t('adminPlayerLinking.unlinkSuccess', { identity: identity.displayName }));
      await loadData();
    } catch (err) {
      console.error('Error unlinking identity:', err);
      setError(t('adminPlayerLinking.unlinkFailed', { error: err.message }));
    } finally {
      setUnlinkingId(null);
    }
  };

  const filteredGuestIdentities = useMemo(
    () => guestIdentities.filter(identity => matches(identity.displayName, identitySearch)),
    [guestIdentities, identitySearch]
  );

  const filteredLinkedIdentities = useMemo(
    () => linkedIdentities.filter(identity =>
      matches(identity.displayName, linkedFilter) || matches(identity.linkedToUser?.username, linkedFilter)
    ),
    [linkedIdentities, linkedFilter]
  );

  const filteredUsers = useMemo(
    () => users.filter(user => matches(user.username, userSearch)),
    [users, userSearch]
  );

  if (loading && guestIdentities.length === 0 && linkedIdentities.length === 0) {
    return (
      <div className="adm-page">
        <AdminPageHeader title={t('adminPlayerLinking.title')} subtitle={t('adminPlayerLinking.description')} />
        <AdminLoading label={t('adminPlayerLinking.loading')} />
      </div>
    );
  }

  return (
    <div className="adm-page adm-page--wide">
      <AdminPageHeader
        title={t('adminPlayerLinking.title')}
        subtitle={t('adminPlayerLinking.description')}
        actions={(
          <button type="button" className="adm-icon-btn" onClick={loadData} disabled={loading} title={t('adminPlayerLinking.refreshData')} aria-label={t('adminPlayerLinking.refreshData')}>
            <Icon name="RefreshCw" size={16} className={loading ? 'adm-spin' : ''} />
          </button>
        )}
      />

      <AdminExplainer title={t('adminPlayerLinking.howItWorks')}>
        <div className="adm-explainer-columns">
          <div>
            <h3>{t('adminPlayerLinking.whenToUse')}</h3>
            <ul className="adm-bullets">
              <li>{t('adminPlayerLinking.useCase1')}</li>
              <li>{t('adminPlayerLinking.useCase2')}</li>
              <li>{t('adminPlayerLinking.useCase3')}</li>
            </ul>
          </div>
          <div>
            <h3>{t('adminPlayerLinking.whatHappens')}</h3>
            <ul className="adm-bullets">
              <li><strong>{t('adminPlayerLinking.result1')}</strong> {t('adminPlayerLinking.result1Desc')}</li>
              <li><strong>{t('adminPlayerLinking.result2')}</strong> {t('adminPlayerLinking.result2Desc')}</li>
              <li><strong>{t('adminPlayerLinking.result3')}</strong> {t('adminPlayerLinking.result3Desc')}</li>
            </ul>
          </div>
        </div>
      </AdminExplainer>

      {error && <AdminNotice tone="error" onDismiss={() => setError('')}>{error}</AdminNotice>}
      {success && <AdminNotice tone="success" onDismiss={() => setSuccess('')}>{success}</AdminNotice>}

      <AdminTabs
        value={tab}
        onChange={setTab}
        label={t('adminPlayerLinking.title')}
        options={[
          { value: 'unlinked', label: t('adminPlayerLinking.unlinkedTitle'), icon: 'Users', count: guestIdentities.length },
          { value: 'linked', label: t('adminPlayerLinking.linkedTitle'), icon: 'Link2', count: linkedIdentities.length },
        ]}
      />

      {tab === 'unlinked' && (
        <div className="adm-linking">
          <AdminSection
            icon="Users"
            title={t('adminPlayerLinking.guestIdentities', { count: filteredGuestIdentities.length })}
            description={t('adminPlayerLinking.unlinkedDesc')}
          >
            <AdminSearch value={identitySearch} onChange={setIdentitySearch} placeholder={t('adminPlayerLinking.searchGuest')} />
            {filteredGuestIdentities.length === 0 ? (
              <AdminEmpty icon="UserCheck">
                {identitySearch ? t('adminPlayerLinking.noMatchingIdentities') : t('adminPlayerLinking.noUnlinkedIdentities')}
              </AdminEmpty>
            ) : (
              <ul className="adm-list adm-list--scroll">
                {filteredGuestIdentities.map(identity => (
                  <li key={identity._id}>
                    <button
                      type="button"
                      className={`adm-list-row${selectedIdentity?._id === identity._id ? ' is-selected' : ''}`}
                      onClick={() => handleSelectIdentity(identity)}
                      aria-pressed={selectedIdentity?._id === identity._id}
                    >
                      <Icon name="User" size={16} className="adm-muted" />
                      <span className="adm-list-main">
                        <strong>{identity.displayName}</strong>
                        <span>
                          {t('adminPlayerLinking.gamesCount', { count: identity.gameCount || 0 })}
                          {identity.lastSeen && ` · ${t('adminPlayerLinking.lastSeen', { date: formatDate(identity.lastSeen, i18n.language) })}`}
                        </span>
                      </span>
                      <Icon name="ChevronRight" size={16} className="adm-list-chevron" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </AdminSection>

          <div ref={formRef} className="adm-linking-form">
            <AdminSection icon="Link2" title={t('adminPlayerLinking.linkToUser')}>
              {selectedIdentity ? (
                <>
                  <div className="adm-link-preview">
                    <span className="adm-chip adm-chip--strong">
                      <Icon name="User" size={14} /> {selectedIdentity.displayName}
                    </span>
                    <Icon name="Link2" size={18} className="adm-muted" />
                    <span className={`adm-chip${selectedUser ? ' adm-chip--accent' : ''}`}>
                      <Icon name="UserCheck" size={14} /> {selectedUser?.username || t('adminPlayerLinking.chooseUser')}
                    </span>
                    <button type="button" className="adm-icon-btn adm-icon-btn--plain" onClick={clearSelection} title={t('adminPlayerLinking.clearSelection')} aria-label={t('adminPlayerLinking.clearSelection')}>
                      <Icon name="X" size={16} />
                    </button>
                  </div>

                  <div className="adm-field">
                    <label htmlFor="link-user-search">{t('adminPlayerLinking.selectUserToLink')}</label>
                    <div className="adm-combobox" ref={userDropdownRef}>
                      <div className="adm-combobox-field">
                        <input
                          id="link-user-search"
                          type="text"
                          className="adm-input"
                          value={userSearch}
                          onChange={(event) => {
                            setUserSearch(event.target.value);
                            setShowUserDropdown(true);
                            if (!event.target.value) setSelectedUser(null);
                          }}
                          onFocus={() => setShowUserDropdown(true)}
                          placeholder={t('adminPlayerLinking.searchUser')}
                          autoComplete="off"
                        />
                      </div>
                      {showUserDropdown && (
                        <div className="adm-combobox-menu">
                          {filteredUsers.length > 0 ? (
                            <div className="adm-combobox-list">
                              {filteredUsers.map(user => (
                                <button
                                  key={user._id || user.id}
                                  type="button"
                                  className={`adm-combobox-option${selectedUser && (selectedUser._id || selectedUser.id) === (user._id || user.id) ? ' is-selected' : ''}`}
                                  onClick={() => handleSelectUser(user)}
                                >
                                  <Icon name="User" size={14} />
                                  <span>{user.username}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="adm-combobox-empty">{t('adminPlayerLinking.noUsersFound')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <button type="button" onClick={handleLink} disabled={!selectedUser || isLinking} className="adm-btn adm-btn--primary adm-btn--block">
                    <Icon name={isLinking ? 'RefreshCw' : 'Link2'} size={16} className={isLinking ? 'adm-spin' : ''} />
                    {isLinking ? t('adminPlayerLinking.linking') : t('adminPlayerLinking.linkIdentity')}
                  </button>
                </>
              ) : (
                <AdminEmpty icon="Users">{t('adminPlayerLinking.selectIdentityHint')}</AdminEmpty>
              )}
            </AdminSection>
          </div>
        </div>
      )}

      {tab === 'linked' && (
        <AdminSection icon="Link2" title={t('adminPlayerLinking.linkedTitle')} description={t('adminPlayerLinking.linkedDesc')}>
          <AdminSearch value={linkedFilter} onChange={setLinkedFilter} placeholder={t('adminPlayerLinking.searchLinked')} />
          {filteredLinkedIdentities.length === 0 ? (
            <AdminEmpty icon="Link2">
              {linkedFilter ? t('adminPlayerLinking.noMatchingLinked') : t('adminPlayerLinking.noLinkedYet')}
            </AdminEmpty>
          ) : (
            <ul className="adm-list">
              {filteredLinkedIdentities.map(identity => (
                <li key={identity._id}>
                  <div className="adm-list-row is-static">
                    <span className="adm-list-main">
                      <strong className="adm-link-pair">
                        <span>{identity.displayName}</span>
                        <Icon name="ArrowRight" size={14} className="adm-muted" />
                        <span>{identity.linkedToUser?.username || t('adminPlayerLinking.unknownUser')}</span>
                      </strong>
                      <span>
                        {t('adminPlayerLinking.gamesCount', { count: identity.gameCount || 0 })}
                        {identity.linkedAt && ` · ${t('adminPlayerLinking.linkedDate', { date: formatDate(identity.linkedAt, i18n.language) })}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="adm-btn adm-btn--danger-soft adm-btn--sm"
                      onClick={() => handleUnlink(identity)}
                      disabled={unlinkingId !== null}
                      title={t('adminPlayerLinking.unlinkIdentity')}
                    >
                      <Icon name={unlinkingId === identity._id ? 'RefreshCw' : 'Trash2'} size={14} className={unlinkingId === identity._id ? 'adm-spin' : ''} />
                      <span>{t('adminPlayerLinking.unlink')}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminSection>
      )}

      {confirmDialog}
    </div>
  );
};

export default PlayerLinking;
