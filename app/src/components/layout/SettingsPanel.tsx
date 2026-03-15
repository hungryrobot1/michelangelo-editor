/**
 * SettingsPanel — Game manifest and starting configuration editor.
 *
 * Provides editable fields for title, author, description, version,
 * status, and starting inventory/abilities/traits/companions.
 */

import type { Story, ProjectStatus } from '@engine/types/index.js';

interface SettingsPanelProps {
  story: Story;
  onUpdateManifest: (updates: Partial<Omit<Story['manifest'], 'id'>>) => void;
}

export function SettingsPanel({ story, onUpdateManifest }: SettingsPanelProps) {
  const manifest = story.manifest;

  return (
    <div className="sidebar-content">
      <div className="settings-section">
        <div className="story-stats-title">Project</div>

        <div className="field">
          <label className="field-label">Title</label>
          <input
            className="field-input"
            value={manifest.title}
            onChange={(e) => onUpdateManifest({ title: e.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label">Author</label>
          <input
            className="field-input"
            value={manifest.author ?? ''}
            onChange={(e) => onUpdateManifest({ author: e.target.value || undefined })}
            placeholder="Author name"
          />
        </div>

        <div className="field">
          <label className="field-label">Description</label>
          <textarea
            className="field-textarea"
            value={manifest.description ?? ''}
            onChange={(e) => onUpdateManifest({ description: e.target.value || undefined })}
            placeholder="A brief description..."
            rows={3}
          />
        </div>

        <div className="field">
          <label className="field-label">Version</label>
          <input
            className="field-input"
            value={manifest.version ?? ''}
            onChange={(e) => onUpdateManifest({ version: e.target.value || undefined })}
            placeholder="1.0.0"
          />
        </div>

        <div className="field">
          <label className="field-label">Status</label>
          <select
            className="field-select"
            value={manifest.status ?? 'draft'}
            onChange={(e) => onUpdateManifest({ status: e.target.value as ProjectStatus })}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {/* Starting Configuration */}
      <div className="settings-section">
        <div className="story-stats-title">Starting Configuration</div>

        {/* Starting Items */}
        {story.items && Object.keys(story.items).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="field-label">Starting Items</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.values(story.items).map((item) => {
                const isStarting = manifest.startingItems?.some((si) => si.itemId === item.id);
                return (
                  <button
                    key={item.id}
                    className={`settings-tag ${isStarting ? 'active' : ''}`}
                    onClick={() => {
                      const current = manifest.startingItems ?? [];
                      if (isStarting) {
                        onUpdateManifest({
                          startingItems: current.filter((si) => si.itemId !== item.id),
                        });
                      } else {
                        onUpdateManifest({
                          startingItems: [...current, { itemId: item.id, quantity: 1 }],
                        });
                      }
                    }}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Starting Abilities */}
        {story.abilities && Object.keys(story.abilities).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="field-label">Starting Abilities</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.values(story.abilities).map((ability) => {
                const isStarting = manifest.startingAbilities?.includes(ability.id);
                return (
                  <button
                    key={ability.id}
                    className={`settings-tag ${isStarting ? 'active' : ''}`}
                    onClick={() => {
                      const current = manifest.startingAbilities ?? [];
                      if (isStarting) {
                        onUpdateManifest({
                          startingAbilities: current.filter((id) => id !== ability.id),
                        });
                      } else {
                        onUpdateManifest({
                          startingAbilities: [...current, ability.id],
                        });
                      }
                    }}
                  >
                    {ability.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Starting Traits */}
        {story.traits && Object.keys(story.traits).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="field-label">Starting Traits</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.values(story.traits).map((trait) => {
                const isStarting = manifest.startingTraits?.includes(trait.id);
                return (
                  <button
                    key={trait.id}
                    className={`settings-tag ${isStarting ? 'active' : ''}`}
                    onClick={() => {
                      const current = manifest.startingTraits ?? [];
                      if (isStarting) {
                        onUpdateManifest({
                          startingTraits: current.filter((id) => id !== trait.id),
                        });
                      } else {
                        onUpdateManifest({
                          startingTraits: [...current, trait.id],
                        });
                      }
                    }}
                  >
                    {trait.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Starting Companions */}
        {story.companions && Object.keys(story.companions).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="field-label">Starting Companions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.values(story.companions).map((comp) => {
                const isStarting = manifest.startingCompanions?.includes(comp.id);
                return (
                  <button
                    key={comp.id}
                    className={`settings-tag ${isStarting ? 'active' : ''}`}
                    onClick={() => {
                      const current = manifest.startingCompanions ?? [];
                      if (isStarting) {
                        onUpdateManifest({
                          startingCompanions: current.filter((id) => id !== comp.id),
                        });
                      } else {
                        onUpdateManifest({
                          startingCompanions: [...current, comp.id],
                        });
                      }
                    }}
                  >
                    {comp.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
