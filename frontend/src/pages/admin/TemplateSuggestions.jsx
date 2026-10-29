import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import gameTemplateService from '@/shared/api/gameTemplateService';
import { safeMarkdownToHtml } from '@/shared/utils/markdownSanitizer';
import { safeImageUrl } from '@/shared/utils/gameInfoStore';
import Icon from '@/components/ui/Icon';
import {
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPill,
  AdminTabs,
} from '@/components/admin/AdminUI';
import {
  formatDateTime,
  formatRelativeTime,
  useAdminConfirm,
} from '@/components/admin/adminUtils';
import { describeChange, sameBoxArt, siblingsOf } from './suggestionReview';
import '@/styles/pages/admin.css';

const TYPE_META = {
  new: { label: 'adminTemplates.newTemplate', icon: 'PackagePlus', tone: 'success' },
  change: { label: 'adminTemplates.changeRequest', icon: 'Edit', tone: 'accent' },
  boxArt: { label: 'adminTemplates.boxArtSuggestion', icon: 'Image', tone: 'warning' },
};

const STATUS_META = {
  pending: { tone: 'warning', icon: 'Clock' },
  approved: { tone: 'success', icon: 'CheckCircle2' },
  rejected: { tone: 'danger', icon: 'XCircle' },
};

const FIELD_LABELS = {
  name: 'adminTemplates.templateName',
  targetNumber: 'adminTemplates.targetNumber',
  lowIsBetter: 'adminTemplates.scoring',
  gameCategory: 'adminTemplates.category',
  scoringFormula: 'adminTemplates.scoringFormula',
  roundPattern: 'adminTemplates.roundPattern',
  maxRounds: 'adminTemplates.maxRounds',
  minPlayers: 'adminTemplates.minPlayersLabel',
  maxPlayers: 'adminTemplates.maxPlayersLabel',
  hasDealerRotation: 'adminTemplates.dealerRotation',
  hasForbiddenCall: 'adminTemplates.forbiddenCall',
  description: 'adminTemplates.description',
  descriptionMarkdown: 'adminTemplates.gameRules',
  gameInfo: 'adminTemplates.boxArt',
};

// Shown as their own blocks below the field list
const BLOCK_FIELDS = new Set(['descriptionMarkdown', 'gameInfo']);

const isWideScreen = () => typeof window !== 'undefined'
  && window.matchMedia?.('(min-width: 1024px)').matches;

function useFieldFormatter() {
  const { t } = useTranslation();
  return useCallback((field, value) => {
    if (value === null || value === undefined || value === '') return '—';
    switch (field) {
      case 'lowIsBetter':
        return value ? t('adminTemplates.lowScore') : t('adminTemplates.highScore');
      case 'gameCategory':
        return value === 'callAndMade' ? t('adminTemplates.categoryCallAndMade') : t('adminTemplates.categoryTable');
      case 'roundPattern':
        return t(`adminTemplates.pattern_${value}`, { defaultValue: value });
      case 'hasDealerRotation':
      case 'hasForbiddenCall':
        return value ? t('common.yes') : t('common.no');
      case 'scoringFormula':
        return t('adminTemplates.formulaSummary', {
          base: value.baseCorrect ?? 0,
          bonus: value.bonusPerTrick ?? 0,
          penalty: value.penaltyPerDiff ?? 0,
        });
      default:
        return String(value);
    }
  }, [t]);
}

function TypeBadge({ type }) {
  const { t } = useTranslation();
  const meta = TYPE_META[type] || TYPE_META.new;
  return <AdminPill tone={meta.tone} icon={meta.icon}>{t(meta.label)}</AdminPill>;
}

function suggestionArt(suggestion) {
  const info = suggestion.gameInfo || suggestion.originalTemplate?.gameInfo;
  return safeImageUrl(info?.thumbnailUrl) || safeImageUrl(info?.imageUrl);
}

/** One side of a box art comparison, linked to its BoardGameGeek page. */
function BoxArt({ gameInfo, heading, tone }) {
  const { t } = useTranslation();
  const src = safeImageUrl(gameInfo?.imageUrl) || safeImageUrl(gameInfo?.thumbnailUrl);
  return (
    <figure className={`adm-boxart adm-boxart--${tone}`}>
      <figcaption>{heading}</figcaption>
      <div className="adm-boxart-frame">
        {src ? <img src={src} alt="" loading="lazy" /> : <span>{t('adminTemplates.noBoxArt')}</span>}
      </div>
      {gameInfo?.bggId && (
        <a href={`https://boardgamegeek.com/boardgame/${gameInfo.bggId}`} target="_blank" rel="noopener noreferrer">
          {t('adminTemplates.viewOnBgg')} <Icon name="ExternalLink" size={12} />
        </a>
      )}
    </figure>
  );
}

function BoxArtCompare({ before, after }) {
  const { t } = useTranslation();
  return (
    <div className="adm-compare">
      <BoxArt gameInfo={before} heading={t('adminTemplates.currentBoxArt')} tone="before" />
      <Icon name="ArrowRight" size={18} className="adm-compare-arrow" />
      <BoxArt gameInfo={after} heading={t('adminTemplates.suggestedBoxArt')} tone="after" />
    </div>
  );
}

function Markdown({ source }) {
  return <div className="adm-markdown" dangerouslySetInnerHTML={{ __html: safeMarkdownToHtml(source || '') }} />;
}

function RulesCompare({ before, after }) {
  const { t } = useTranslation();
  return (
    <div className="adm-rules-compare">
      <div className="adm-rules adm-rules--before">
        <h4>{t('adminTemplates.previousRules')}</h4>
        {before ? <Markdown source={before} /> : <p className="adm-muted">{t('adminTemplates.empty')}</p>}
      </div>
      <div className="adm-rules adm-rules--after">
        <h4>{t('adminTemplates.newRules')}</h4>
        {after ? <Markdown source={after} /> : <p className="adm-muted">{t('adminTemplates.empty')}</p>}
      </div>
    </div>
  );
}

function ChangeDetails({ suggestion }) {
  const { t } = useTranslation();
  const format = useFieldFormatter();
  const { changes, hasBaseline, changedSinceRequest } = useMemo(() => describeChange(suggestion), [suggestion]);
  const isPending = suggestion.status === 'pending';

  const listed = changes.filter(change => !BLOCK_FIELDS.has(change.field));
  const rules = changes.find(change => change.field === 'descriptionMarkdown');
  const art = changes.find(change => change.field === 'gameInfo' && !sameBoxArt(change.before, change.after));
  const conflicts = changes.filter(change => change.conflict);

  return (
    <>
      {isPending && conflicts.length > 0 && (
        <AdminNotice tone="warning" title={t('adminTemplates.conflictTitle')}>
          {t('adminTemplates.conflictBody', {
            fields: conflicts.map(change => t(FIELD_LABELS[change.field])).join(', '),
          })}
        </AdminNotice>
      )}
      {isPending && changedSinceRequest.length > 0 && (
        <AdminNotice tone="info">
          {t('adminTemplates.changedSinceBody', {
            fields: changedSinceRequest.map(field => t(FIELD_LABELS[field])).join(', '),
          })}
        </AdminNotice>
      )}
      {isPending && !hasBaseline && (
        <AdminNotice tone="info">{t('adminTemplates.legacyChangeBody')}</AdminNotice>
      )}

      {changes.length === 0 ? (
        <AdminEmpty icon="CheckCircle2" title={t('adminTemplates.noFieldChanges')}>
          {t('adminTemplates.noFieldChangesBody')}
        </AdminEmpty>
      ) : (
        <>
          {listed.length > 0 && (
            <div className="adm-review-block">
              <h3>{t('adminTemplates.changesRequested', { count: changes.length })}</h3>
              <dl className="adm-diff">
                {listed.map(change => (
                  <div key={change.field} className={`adm-diff-row${change.conflict ? ' has-conflict' : ''}`}>
                    <dt>{t(FIELD_LABELS[change.field])}</dt>
                    <dd>
                      <span className="adm-diff-before">{format(change.field, change.before)}</span>
                      <Icon name="ArrowRight" size={14} className="adm-diff-arrow" />
                      <span className="adm-diff-after">{format(change.field, change.after)}</span>
                      {change.conflict && isPending && (
                        <span className="adm-diff-now">
                          {t('adminTemplates.currentlyValue', { value: format(change.field, change.current) })}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {art && (
            <div className="adm-review-block">
              <h3>{t('adminTemplates.boxArt')}</h3>
              <BoxArtCompare before={art.before} after={art.after} />
            </div>
          )}

          {rules && (
            <div className="adm-review-block">
              <h3>{t('adminTemplates.gameRules')}</h3>
              <RulesCompare before={rules.before} after={rules.after} />
            </div>
          )}
        </>
      )}
    </>
  );
}

function NewTemplateDetails({ suggestion }) {
  const { t } = useTranslation();
  const format = useFieldFormatter();
  const isCallAndMade = suggestion.gameCategory === 'callAndMade';
  const fields = [
    'lowIsBetter',
    'targetNumber',
    'gameCategory',
    ...(isCallAndMade ? ['scoringFormula', 'roundPattern', 'maxRounds', 'hasForbiddenCall'] : []),
    'minPlayers',
    'maxPlayers',
    'hasDealerRotation',
  ];

  return (
    <>
      {suggestion.duplicateOf && (
        <AdminNotice tone="warning" title={t('adminTemplates.duplicateTitle')}>
          {t('adminTemplates.duplicateBody', { name: suggestion.duplicateOf.name })}
        </AdminNotice>
      )}

      <div className="adm-review-block">
        <h3>{t('adminTemplates.templateSetup')}</h3>
        <dl className="adm-spec">
          {fields.map(field => (
            <div key={field}>
              <dt>{t(FIELD_LABELS[field])}</dt>
              <dd>{format(field, suggestion[field])}</dd>
            </div>
          ))}
        </dl>
      </div>

      {suggestion.description && (
        <div className="adm-review-block">
          <h3>{t('adminTemplates.description')}</h3>
          <p className="adm-prose">{suggestion.description}</p>
        </div>
      )}

      {(suggestion.gameInfo?.bggId || suggestion.gameInfo?.thumbnailUrl || suggestion.gameInfo?.imageUrl) && (
        <div className="adm-review-block">
          <h3>{t('adminTemplates.boxArt')}</h3>
          <div className="adm-compare adm-compare--single">
            <BoxArt gameInfo={suggestion.gameInfo} heading={t('adminTemplates.suggestedBoxArt')} tone="after" />
          </div>
        </div>
      )}

      {suggestion.descriptionMarkdown && (
        <details className="adm-review-block adm-collapsible">
          <summary>
            <h3>{t('adminTemplates.gameRules')}</h3>
            <Icon name="ChevronDown" size={16} />
          </summary>
          <Markdown source={suggestion.descriptionMarkdown} />
        </details>
      )}
    </>
  );
}

function SuggestionDetail({ suggestion, siblings, onBack, onApprove, onReject, busy }) {
  const { t, i18n } = useTranslation();
  const [note, setNote] = useState('');
  const isPending = suggestion.status === 'pending';
  const status = STATUS_META[suggestion.status] || STATUS_META.pending;
  const target = suggestion.originalTemplate?.name;

  useEffect(() => {
    setNote('');
  }, [suggestion._id]);

  const approveLabel = {
    new: t('adminTemplates.approveAndAdd'),
    change: t('adminTemplates.approveChanges'),
    boxArt: t('adminTemplates.approveBoxArt'),
  }[suggestion.suggestionType] || t('adminTemplates.approve');

  return (
    <article className="adm-review-detail" aria-labelledby="suggestion-title">
      <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm adm-review-back" onClick={onBack}>
        <Icon name="ArrowLeft" size={16} /> {t('adminTemplates.backToQueue')}
      </button>

      <header className="adm-review-head">
        <div className="adm-review-badges">
          <TypeBadge type={suggestion.suggestionType} />
          {!isPending && (
            <AdminPill tone={status.tone} icon={status.icon}>{t(`adminTemplates.status_${suggestion.status}`)}</AdminPill>
          )}
        </div>
        <h2 id="suggestion-title">{suggestion.name}</h2>
        {target && target !== suggestion.name && (
          <p className="adm-review-target">{t('adminTemplates.forTemplate', { name: target })}</p>
        )}
        <p className="adm-review-meta">
          <Icon name="User" size={13} />
          <span>{suggestion.userId?.username || t('common.unknown')}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={suggestion.createdAt} title={formatDateTime(suggestion.createdAt, i18n.language)}>
            {formatRelativeTime(suggestion.createdAt, i18n.language)}
          </time>
        </p>
      </header>

      {suggestion.suggestionNote && (
        <blockquote className="adm-quote">
          <Icon name="MessageSquare" size={14} />
          <div>
            <span>{t('adminTemplates.usersNote')}</span>
            <p>{suggestion.suggestionNote}</p>
          </div>
        </blockquote>
      )}

      {isPending && siblings.length > 0 && (
        <AdminNotice tone="info">
          {t('adminTemplates.siblingsBody', { count: siblings.length })}
        </AdminNotice>
      )}

      {suggestion.suggestionType === 'boxArt' && (
        <div className="adm-review-block">
          <h3>{t('adminTemplates.boxArt')}</h3>
          <BoxArtCompare before={suggestion.originalTemplate?.gameInfo} after={suggestion.gameInfo} />
        </div>
      )}
      {suggestion.suggestionType === 'change' && <ChangeDetails suggestion={suggestion} />}
      {(suggestion.suggestionType === 'new' || !suggestion.suggestionType) && <NewTemplateDetails suggestion={suggestion} />}

      {isPending ? (
        <footer className="adm-decision">
          <label htmlFor="review-note">{t('adminTemplates.reviewNoteLabel')}</label>
          <textarea
            id="review-note"
            className="adm-input"
            rows={1}
            maxLength={500}
            value={note}
            placeholder={t('adminTemplates.reviewNotePlaceholder')}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
          />
          <div className="adm-decision-actions">
            <button type="button" className="adm-btn adm-btn--danger-soft" onClick={() => onReject(suggestion, note)} disabled={busy}>
              <Icon name="X" size={16} /> {t('adminTemplates.reject')}
            </button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => onApprove(suggestion, note)} disabled={busy}>
              <Icon name={busy ? 'RefreshCw' : 'Check'} size={16} className={busy ? 'adm-spin' : ''} /> {approveLabel}
            </button>
          </div>
        </footer>
      ) : (
        <footer className="adm-review-outcome">
          <p>
            {t(`adminTemplates.reviewedBy_${suggestion.status}`, {
              name: suggestion.reviewedBy?.username || t('common.unknown'),
              date: formatDateTime(suggestion.reviewedAt, i18n.language),
            })}
          </p>
          {suggestion.reviewNote && <p className="adm-review-outcome-note">“{suggestion.reviewNote}”</p>}
        </footer>
      )}
    </article>
  );
}

function QueueItem({ suggestion, selected, onSelect }) {
  const { t, i18n } = useTranslation();
  const art = suggestionArt(suggestion);
  const meta = TYPE_META[suggestion.suggestionType] || TYPE_META.new;
  const warn = suggestion.status === 'pending' && (
    suggestion.duplicateOf
    || (suggestion.suggestionType === 'change' && describeChange(suggestion).changes.some(change => change.conflict))
  );

  return (
    <li>
      <button
        type="button"
        className={`adm-queue-item${selected ? ' is-selected' : ''}`}
        onClick={() => onSelect(suggestion._id)}
        aria-current={selected ? 'true' : undefined}
      >
        <span className={`adm-queue-thumb adm-queue-thumb--${meta.tone}`}>
          {art ? <img src={art} alt="" loading="lazy" /> : <Icon name={meta.icon} size={18} />}
        </span>
        <span className="adm-queue-text">
          <span className="adm-queue-title">
            {suggestion.name}
            {warn && <Icon name="AlertTriangle" size={13} className="adm-queue-warn" aria-label={t('adminTemplates.needsAttention')} />}
          </span>
          <span className="adm-queue-meta">
            {t(meta.label)} · {suggestion.userId?.username || t('common.unknown')} · {formatRelativeTime(
              suggestion.status === 'pending' ? suggestion.createdAt : suggestion.reviewedAt,
              i18n.language
            )}
          </span>
        </span>
        <Icon name="ChevronRight" size={16} className="adm-queue-chevron" />
      </button>
    </li>
  );
}

const TemplateSuggestions = () => {
  const { t } = useTranslation();
  const { setPendingSuggestions } = useOutletContext() || {};
  const [confirm, confirmDialog] = useAdminConfirm();

  const [status, setStatus] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [suggestions, setSuggestions] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await gameTemplateService.getAdminSuggestions(status);
      const list = data.suggestions || [];
      setSuggestions(list);
      setCounts(data.counts || null);
      if (data.counts) setPendingSuggestions?.(data.counts.pending);
      setSelectedId(current => (list.some(item => item._id === current) ? current : (isWideScreen() ? list[0]?._id ?? null : null)));
    } catch (err) {
      console.error('Error loading suggestions:', err);
      setError(err.message || t('adminTemplates.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [status, setPendingSuggestions, t]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => suggestions.filter(item => typeFilter === 'all' || (item.suggestionType || 'new') === typeFilter),
    [suggestions, typeFilter]
  );

  const typeCounts = useMemo(() => suggestions.reduce((acc, item) => {
    const type = item.suggestionType || 'new';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {}), [suggestions]);

  const selected = visible.find(item => item._id === selectedId) || null;

  // A finished review drops out of the queue and the next one opens
  const finishReview = useCallback((id, outcome, message) => {
    const index = visible.findIndex(item => item._id === id);
    const remaining = visible.filter(item => item._id !== id);
    setSuggestions(prev => prev.filter(item => item._id !== id));
    if (counts) {
      const pending = Math.max(0, counts.pending - 1);
      setCounts({ ...counts, pending, [outcome]: counts[outcome] + 1 });
      setPendingSuggestions?.(pending);
    }
    setSelectedId(remaining[Math.min(index, remaining.length - 1)]?._id ?? null);
    setNotice({ tone: 'success', text: message });
  }, [visible, counts, setPendingSuggestions]);

  const approve = async (suggestion, reviewNote, allowDuplicate = false) => {
    const type = suggestion.suggestionType || 'new';
    if (!allowDuplicate) {
      const ok = await confirm({
        title: t('adminTemplates.approveConfirmTitle'),
        message: t(`adminTemplates.approveConfirm_${type}`, { name: suggestion.name }),
        confirmLabel: t('adminTemplates.approve'),
        icon: 'CheckCircle2',
      });
      if (!ok) return;
    }

    setBusy(true);
    setNotice(null);
    try {
      await gameTemplateService.approveSuggestion(suggestion._id, { reviewNote, allowDuplicate });
      finishReview(suggestion._id, 'approved', t(`adminTemplates.approved_${type}`, { name: suggestion.name }));
    } catch (err) {
      if (err.code === 'DUPLICATE_NAME' && !allowDuplicate) {
        setBusy(false);
        const addAnyway = await confirm({
          title: t('adminTemplates.duplicateTitle'),
          message: t('adminTemplates.duplicateConfirm', { name: err.duplicateOf?.name || suggestion.name }),
          confirmLabel: t('adminTemplates.addAnyway'),
          tone: 'danger',
        });
        if (addAnyway) await approve(suggestion, reviewNote, true);
        return;
      }
      setNotice({ tone: 'error', text: t('adminTemplates.approveFailed', { error: err.message }) });
      if (err.status === 404) load();
    } finally {
      setBusy(false);
    }
  };

  const reject = async (suggestion, reviewNote) => {
    const ok = await confirm({
      title: t('adminTemplates.rejectConfirmTitle'),
      message: reviewNote
        ? t('adminTemplates.rejectConfirmWithNote', { name: suggestion.name })
        : t('adminTemplates.rejectConfirm', { name: suggestion.name }),
      confirmLabel: t('adminTemplates.reject'),
      tone: 'danger',
    });
    if (!ok) return;

    setBusy(true);
    setNotice(null);
    try {
      await gameTemplateService.rejectSuggestion(suggestion._id, reviewNote);
      finishReview(suggestion._id, 'rejected', t('adminTemplates.rejectedSuccess', { name: suggestion.name }));
    } catch (err) {
      setNotice({ tone: 'error', text: t('adminTemplates.rejectFailed', { error: err.message }) });
      if (err.status === 404) load();
    } finally {
      setBusy(false);
    }
  };

  const statusTabs = ['pending', 'approved', 'rejected'].map(value => ({
    value,
    label: t(`adminTemplates.status_${value}`),
    icon: STATUS_META[value].icon,
    count: counts?.[value],
  }));

  const typeTabs = [
    { value: 'all', label: t('adminTemplates.typeAll'), count: suggestions.length },
    ...Object.keys(TYPE_META).map(value => ({
      value,
      label: t(TYPE_META[value].label),
      count: typeCounts[value] || 0,
    })),
  ];

  return (
    <div className="adm-page adm-page--wide">
      <AdminPageHeader
        title={t('admin.templateSuggestions')}
        subtitle={t('adminTemplates.subtitle')}
        actions={(
          <button type="button" className="adm-icon-btn" onClick={load} disabled={loading} aria-label={t('admin.refresh')} title={t('admin.refresh')}>
            <Icon name="RefreshCw" size={16} className={loading ? 'adm-spin' : ''} />
          </button>
        )}
      />

      <div className="adm-toolbar">
        <AdminTabs value={status} onChange={(value) => { setStatus(value); setSelectedId(null); }} options={statusTabs} label={t('adminTemplates.statusFilter')} />
        <AdminTabs value={typeFilter} onChange={setTypeFilter} options={typeTabs} label={t('adminTemplates.typeFilter')} />
      </div>

      {notice && (
        <AdminNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</AdminNotice>
      )}

      {loading && suggestions.length === 0 ? (
        <AdminLoading label={t('adminTemplates.loadingSuggestions')} />
      ) : error ? (
        <AdminNotice tone="error">
          {error}{' '}
          <button type="button" className="adm-link-btn" onClick={load}>{t('admin.retry')}</button>
        </AdminNotice>
      ) : visible.length === 0 ? (
        <div className="adm-card">
          <AdminEmpty
            icon={status === 'pending' ? 'CheckCircle2' : 'History'}
            tone={status === 'pending' ? 'success' : undefined}
            title={status === 'pending' ? t('adminTemplates.noSuggestions') : t('adminTemplates.noHistory')}
          >
            {status === 'pending' ? t('adminTemplates.noSuggestionsBody') : null}
          </AdminEmpty>
        </div>
      ) : (
        <div className={`adm-review${selected ? ' has-selection' : ''}`}>
          <ul className="adm-queue" aria-label={t('adminTemplates.queueLabel')}>
            {visible.map(item => (
              <QueueItem key={item._id} suggestion={item} selected={item._id === selectedId} onSelect={setSelectedId} />
            ))}
          </ul>

          {selected ? (
            <SuggestionDetail
              suggestion={selected}
              siblings={status === 'pending' ? siblingsOf(selected, suggestions) : []}
              onBack={() => setSelectedId(null)}
              onApprove={approve}
              onReject={reject}
              busy={busy}
            />
          ) : (
            <div className="adm-review-placeholder">
              <AdminEmpty icon="FileText">{t('adminTemplates.selectHint')}</AdminEmpty>
            </div>
          )}
        </div>
      )}

      {confirmDialog}
    </div>
  );
};

export default TemplateSuggestions;
