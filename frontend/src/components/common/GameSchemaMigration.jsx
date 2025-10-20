/**
 * Game Schema Migration Component
 * Provides UI for migrating games to the new schema format
 */

import React, { useState, useEffect } from 'react';
import { GameMigrationService } from '@/shared/utils/gameMigration';

const GameSchemaMigration = ({ onMigrationComplete }) => {
  const [stats, setStats] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const migrationStats = await GameMigrationService.getMigrationStats();
    setStats(migrationStats);
  };

  const handleMigration = async (dryRun = false) => {
    setIsLoading(true);
    setMigrationResult(null);

    try {
      const result = await GameMigrationService.migrateAllLocalGames(dryRun);
      setMigrationResult(result);
      
      if (!dryRun && result.migrated > 0) {
        // Reload stats after successful migration
        await loadStats();
        if (onMigrationComplete) {
          onMigrationComplete(result);
        }
      }
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationResult({
        total: 0,
        migrated: 0,
        failed: 1,
        errors: [{ gameId: 'GENERAL', error: error.message }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackup = () => {
    try {
      const backup = GameMigrationService.createBackup();
      const blob = new Blob([backup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wizard-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Backup error:', error);
      alert('Failed to create backup: ' + error.message);
    }
  };

  if (!stats) {
    return <div className="loading">Loading migration status...</div>;
  }

  return (
    <div className="schema-migration-section">
      <h3>Game Schema Migration</h3>
      
      {stats.migrationNeeded ? (
        <div className="migration-needed">
          <div className="migration-stats">
            <p>
              <strong>Migration Required:</strong> {stats.oldFormat} of {stats.total} games 
              need to be migrated to the new format.
            </p>
            <div className="stats-breakdown">
              <span className="stat-item">
                <span className="stat-label">Total Games:</span>
                <span className="stat-value">{stats.total}</span>
              </span>
              <span className="stat-item">
                <span className="stat-label">New Format:</span>
                <span className="stat-value">{stats.newFormat}</span>
              </span>
              <span className="stat-item">
                <span className="stat-label">Needs Migration:</span>
                <span className="stat-value">{stats.oldFormat}</span>
              </span>
            </div>
          </div>

          <div className="migration-actions">
            <button 
              className="btn btn-secondary"
              onClick={handleBackup}
              disabled={isLoading}
            >
              Create Backup
            </button>
            
            <button 
              className="btn btn-outline"
              onClick={() => handleMigration(true)}
              disabled={isLoading}
            >
              Test Migration
            </button>
            
            <button 
              className="btn btn-primary"
              onClick={() => handleMigration(false)}
              disabled={isLoading}
            >
              {isLoading ? 'Migrating...' : 'Migrate Games'}
            </button>
          </div>

          <div className="migration-info">
            <p className="info-text">
              The new schema provides better data consistency, validation, and future compatibility.
              <strong> Create a backup before migrating.</strong>
            </p>
          </div>
        </div>
      ) : (
        <div className="migration-complete">
          <p className="success-text">
            ✅ All {stats.total} games are using the latest schema format.
          </p>
        </div>
      )}

      {migrationResult && (
        <div className="migration-results">
          <h4>Migration Results</h4>
          <div className="result-summary">
            <span className="result-item">
              <span className="result-label">Total:</span>
              <span className="result-value">{migrationResult.total}</span>
            </span>
            <span className="result-item">
              <span className="result-label">Migrated:</span>
              <span className="result-value success">{migrationResult.migrated}</span>
            </span>
            <span className="result-item">
              <span className="result-label">Failed:</span>
              <span className="result-value error">{migrationResult.failed}</span>
            </span>
          </div>

          {migrationResult.errors.length > 0 && (
            <div className="migration-errors">
              <button 
                className="btn btn-text"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Hide' : 'Show'} Error Details ({migrationResult.errors.length})
              </button>
              
              {showDetails && (
                <div className="error-details">
                  {migrationResult.errors.map((error, index) => (
                    <div key={index} className="error-item">
                      <strong>Game ID:</strong> {error.gameId}<br />
                      <strong>Error:</strong> {error.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .schema-migration-section {
          background: var(--color-card-bg);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 20px;
          margin: 16px 0;
        }

        .migration-needed {
          color: var(--color-warning);
        }

        .migration-complete {
          color: var(--color-success);
        }

        .migration-stats {
          margin-bottom: 16px;
        }

        .stats-breakdown {
          display: flex;
          gap: 20px;
          margin-top: 8px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 12px;
          opacity: 0.7;
        }

        .stat-value {
          font-weight: bold;
          font-size: 16px;
        }

        .migration-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .migration-info {
          font-size: 14px;
          opacity: 0.8;
        }

        .migration-results {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          padding: 16px;
          margin-top: 16px;
        }

        .result-summary {
          display: flex;
          gap: 20px;
          margin-bottom: 12px;
        }

        .result-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .result-label {
          font-size: 12px;
          opacity: 0.7;
        }

        .result-value {
          font-weight: bold;
        }

        .result-value.success {
          color: var(--color-success);
        }

        .result-value.error {
          color: var(--color-error);
        }

        .migration-errors {
          margin-top: 12px;
        }

        .error-details {
          background: var(--color-error-bg);
          border: 1px solid var(--color-error);
          border-radius: 4px;
          padding: 12px;
          margin-top: 8px;
        }

        .error-item {
          margin-bottom: 8px;
          font-size: 12px;
        }

        .error-item:last-child {
          margin-bottom: 0;
        }

        .loading {
          padding: 20px;
          text-align: center;
          opacity: 0.7;
        }

        .info-text {
          margin: 0;
        }

        .success-text {
          margin: 0;
          font-weight: 500;
        }

        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          border: 1px solid;
          background: transparent;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: var(--text-color);
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-dark);
        }

        .btn-secondary {
          border-color: var(--color-border);
          color: var(--color-text);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--color-bg-secondary);
        }

        .btn-outline {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .btn-outline:hover:not(:disabled) {
          background: var(--color-primary-light);
        }

        .btn-text {
          border: none;
          color: var(--color-primary);
          padding: 4px 8px;
        }

        .btn-text:hover:not(:disabled) {
          background: var(--color-primary-light);
        }
      `}</style>
    </div>
  );
};

export default GameSchemaMigration;
