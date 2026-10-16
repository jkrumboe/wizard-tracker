import { useMemo, useReducer } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLinkIcon } from '@/components/ui/Icon';
import BackButton from '@/components/ui/BackButton';
import GameThumbnail from '@/components/game/GameThumbnail';
import GameTypeManageActions from '@/components/game/GameTypeManageActions';
import EditionCards from '@/components/game/EditionCards';
import DeleteIconButton from '@/components/ui/DeleteIconButton';
import { useGameTemplates } from '@/shared/hooks/useGameTemplates';
import { getTemplateGameInfo, getTemplateImageUrl } from '@/shared/utils/gameInfoStore';
import { isScoreboardTemplate } from '@/shared/utils/templateResolver';
import { safeMarkdownToHtml } from '@/shared/utils/markdownSanitizer';
import { getTemplateEditions, findEdition, findEditionBySourceName, removeCustomEdition } from '@/shared/utils/gameEditions';
import '@/styles/pages/gamesPage.css';
import '@/styles/pages/gameType.css';

const normalize = (name) => (name || '').trim().toLowerCase();

const formatPlayerRange = (min, max) => {
  if (min && max) return min === max ? `${min}` : `${min}–${max}`;
  if (min) return `${min}+`;
  return max ? `1–${max}` : null;
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Rules often open with "# <game name>", which only repeats the page title
const stripTitleHeading = (markdown, title) => {
  if (!markdown || !title) return markdown;
  const heading = new RegExp(String.raw`^#\s+${escapeRegExp(title.trim())}\s*(?:\r?\n|$)`, 'i');
  return markdown.replace(heading, '').trim();
};

/**
 * Everything about one game type: box art, settings, BoardGameGeek info and rules,
 * plus edit/delete/sync actions. With `?edition=<id>` it shows that edition:
 * its own box art and rules when it was saved as a game of its own
 * ("Wizard: Jubiläumsedition"), and its special cards.
 */
const GameTypeInfoPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { name } = useParams();
  const { templates, loading } = useGameTemplates();
  const [searchParams] = useSearchParams();
  const editionParam = searchParams.get('edition');
  // Card edits only change storage; re-render to show them right away
  const [, refresh] = useReducer((n) => n + 1, 0);

  const template = useMemo(
    () => templates.find((tpl) => normalize(tpl.name) === normalize(name)) || null,
    [templates, name],
  );
  // An edition saved as its own game ("Wizard: Jubiläumsedition") lives on its main game's page
  const editionOf = useMemo(
    () => (template ? null : templates.find((tpl) => (tpl.editionSources || [])
      .some((source) => normalize(source.name) === normalize(name))) || null),
    [templates, template, name],
  );

  const gamePath = `/game-types/${encodeURIComponent(template?.name || name)}`;

  // Opened from the game page: step back to it. Pushing it again would leave
  // this page behind it in history, so its back button would return here.
  const handleBack = () => {
    if (location.state?.fromGamePage) navigate(-1);
    else navigate(gamePath, { replace: true });
  };

  if (editionOf) {
    const folded = findEditionBySourceName(editionOf, name);
    const query = folded ? `?edition=${encodeURIComponent(folded.id)}` : '';
    return <Navigate to={`/game-types/${encodeURIComponent(editionOf.name)}/info${query}`} replace state={location.state} />;
  }

  if (!template) {
    return (
      <div className="game-type-page">
        <header className="game-type-header">
          <BackButton to="/start" />
          <h1 className="games-title game-type-title">{name}</h1>
        </header>
        <p className="empty-message">{loading ? t('common.loading') : t('gameType.notFound', { name })}</p>
      </div>
    );
  }

  const edition = editionParam ? findEdition(getTemplateEditions(template), editionParam) : null;
  const editionName = edition && t(edition.nameKey, { defaultValue: edition.name || edition.id });
  // An edition saved as its own game brings its own art, BGG info and rules
  const source = edition?.sourceTemplate || null;
  const gameInfo = (source && getTemplateGameInfo(source)) || getTemplateGameInfo(template);
  const isCallAndMade = template.gameCategory === 'callAndMade';
  const playerRange = formatPlayerRange(template.minPlayers, template.maxPlayers);
  const sourceMarkdown = stripTitleHeading(source?.descriptionMarkdown?.trim(), source?.name);
  const markdownRules = sourceMarkdown || stripTitleHeading(template.descriptionMarkdown?.trim(), template.name);
  const plainRules = (!sourceMarkdown && source?.description?.trim()) || template.description?.trim();

  let typeLabel = t('gamesPage.tableGames');
  if (isCallAndMade) typeLabel = t('gamesPage.callAndMadeGames');
  else if (isScoreboardTemplate(template)) typeLabel = t('gamesPage.scoreboardGames');

  const facts = [
    { label: t('gameType.type'), value: typeLabel },
    template.targetNumber && { label: t('templateDetails.targetNumber'), value: template.targetNumber },
    !isCallAndMade && {
      label: t('templateDetails.scoringTarget'),
      value: template.lowIsBetter ? t('templateDetails.lowScores') : t('templateDetails.highScores'),
    },
    isCallAndMade && template.maxRounds && { label: t('common.rounds'), value: template.maxRounds },
    playerRange && { label: t('templateDetails.players'), value: playerRange },
    gameInfo?.playingTime && {
      label: t('templateDetails.playingTime'),
      value: t('templateDetails.minutes', { count: gameInfo.playingTime }),
    },
    gameInfo?.minAge && { label: t('templateDetails.minAge'), value: `${gameInfo.minAge}+` },
    gameInfo?.yearPublished && { label: t('templateDetails.yearPublished'), value: gameInfo.yearPublished },
  ].filter(Boolean);

  // The art's own blurred copy fills the banner beside a tall box
  const heroUrl = (source && getTemplateImageUrl(source, 'image')) || getTemplateImageUrl(template, 'image');
  const heroStyle = heroUrl ? { '--hero-art': `url("${heroUrl.replaceAll('"', '%22')}")` } : undefined;

  return (
    // Editing an edition saved as its own game edits (or deletes) that game
    <GameTypeManageActions template={source || template}>
      {({ editButton, moreActions }) => (
        <div className="game-type-page game-type-info-page">
          <header className="game-type-header">
            <BackButton onClick={handleBack} />
            <h1 className="games-title game-type-title">
              {template.name}
              {editionName && <span className="game-type-title-edition">{editionName}</span>}
            </h1>
            {edition?.isCustom && (
              <DeleteIconButton
                label={t('editions.removeEdition', { name: editionName })}
                onClick={() => {
                  removeCustomEdition(template.name, edition.id);
                  navigate(gamePath, { replace: true });
                }}
              />
            )}
            {editButton}
          </header>

          <div className="game-type-info-scroll">
            <aside className="game-type-info-aside">
              {heroUrl && (
                <div className="game-type-hero-frame" style={heroStyle}>
                  <GameThumbnail template={template} size="image" className="game-type-hero" />
                </div>
              )}

              {/* Box art lookup, plus sync / suggest / delete for your own (local) games */}
              {moreActions && (
                <section className="game-type-info-more" aria-label={t('gameType.manage')}>
                  {moreActions}
                </section>
              )}

              <section className="game-type-section" aria-label={t('templateDetails.gameSettings')}>
                <span className="games-section-label">{t('templateDetails.gameSettings')}</span>
                <dl className="game-type-facts">
                  {facts.map((fact) => (
                    <div key={fact.label} className="game-type-fact">
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
                {gameInfo?.bggId && (
                  <a
                    className="game-type-bgg-link"
                    href={`https://boardgamegeek.com/boardgame/${encodeURIComponent(gameInfo.bggId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('templateDetails.viewOnBgg')}
                    <ExternalLinkIcon size={14} />
                  </a>
                )}
              </section>

              {/* The edition's special cards and what they do (Call & Made games like Wizard) */}
              {edition && isCallAndMade && (
                <EditionCards templateName={template.name} edition={edition} onChange={refresh} />
              )}
            </aside>

            <section className="game-type-section game-type-info-rules" aria-label={t('gameType.rules')}>
              <span className="games-section-label">{t('gameType.rules')}</span>
              <div className="game-type-rules">
                {markdownRules && (
                  <div
                    className="markdown-content game-rules-text"
                    dangerouslySetInnerHTML={{ __html: safeMarkdownToHtml(markdownRules) }}
                  />
                )}
                {/* Plain description, e.g. from BoardGameGeek, when there are no written rules */}
                {!markdownRules && plainRules && <p className="game-type-plain-rules">{plainRules}</p>}
                {!markdownRules && !plainRules && <p className="empty-message">{t('gameType.noRules')}</p>}
              </div>
            </section>

          </div>
        </div>
      )}
    </GameTypeManageActions>
  );
};

export default GameTypeInfoPage;
