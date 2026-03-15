/**
 * Core Story Editor Hook
 *
 * Manages the Story state, wraps all editor operations with state updates,
 * provides undo/redo via a history stack, and validation results.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { Story, Choice, Effect, CharacterCreationSchema, RegionComment } from '@engine/types/index.js';
import {
  addNode,
  updateNode,
  deleteNode,
  duplicateNode,
  addChoice,
  updateChoice,
  removeChoice,
  reorderChoices,
  addEntity,
  updateEntity,
  removeEntity,
  renameNodeId,
  renameEntityId,
  updateManifest,
  updateCharacterCreation,
  setStartNode,
  addRegionComment,
  updateRegionComment,
  removeRegionComment,
  type EntityType,
  type EntityTypeMap,
  type EditorResult,
  type AddNodeInput,
} from '@engine/engine/editor.js';
import { validateStory, type ValidationResult } from '@engine/engine/validation.js';

const MAX_HISTORY = 50;

export interface StoryEditorState {
  story: Story;
  selectedNodeId: string | null;
  isDirty: boolean;
  validation: ValidationResult;
}

export function useStoryEditor(initialStory: Story) {
  const [story, setStory] = useState<Story>(initialStory);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // History for undo/redo
  const historyRef = useRef<Story[]>([]);
  const futureRef = useRef<Story[]>([]);

  // Validation (memoized on story changes)
  const validation = useMemo(() => validateStory(story), [story]);

  /**
   * Apply a story update with undo history tracking.
   */
  const applyUpdate = useCallback((result: EditorResult) => {
    if (!result.success) return result;

    setStory((prev) => {
      historyRef.current = [...historyRef.current.slice(-MAX_HISTORY + 1), prev];
      futureRef.current = [];
      return result.story;
    });
    setIsDirty(true);
    return result;
  }, []);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setStory((current) => {
      futureRef.current.push(current);
      return prev;
    });
    setIsDirty(true);
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    setStory((current) => {
      historyRef.current.push(current);
      return next;
    });
    setIsDirty(true);
  }, []);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // ========== NODE OPERATIONS ==========

  const doAddNode = useCallback((node: AddNodeInput) => {
    return applyUpdate(addNode(story, node));
  }, [story, applyUpdate]);

  const doUpdateNode = useCallback((nodeId: string, updates: Record<string, unknown>) => {
    return applyUpdate(updateNode(story, nodeId, updates));
  }, [story, applyUpdate]);

  const doDeleteNode = useCallback((nodeId: string, cascade?: boolean) => {
    const result = applyUpdate(deleteNode(story, nodeId, { cascade }));
    if (result.success && selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    return result;
  }, [story, applyUpdate, selectedNodeId]);

  const doDuplicateNode = useCallback((nodeId: string) => {
    return applyUpdate(duplicateNode(story, nodeId));
  }, [story, applyUpdate]);

  // ========== CHOICE OPERATIONS ==========

  const doAddChoice = useCallback((nodeId: string, choice: Choice) => {
    return applyUpdate(addChoice(story, nodeId, choice));
  }, [story, applyUpdate]);

  const doUpdateChoice = useCallback((nodeId: string, choiceIndex: number, updates: Partial<Choice>) => {
    return applyUpdate(updateChoice(story, nodeId, choiceIndex, updates));
  }, [story, applyUpdate]);

  const doRemoveChoice = useCallback((nodeId: string, choiceIndex: number) => {
    return applyUpdate(removeChoice(story, nodeId, choiceIndex));
  }, [story, applyUpdate]);

  const doReorderChoices = useCallback((nodeId: string, newOrder: number[]) => {
    return applyUpdate(reorderChoices(story, nodeId, newOrder));
  }, [story, applyUpdate]);

  // ========== ENTITY OPERATIONS ==========

  const doAddEntity = useCallback(<K extends EntityType>(
    entityType: K,
    entity: Omit<EntityTypeMap[K], 'id'> & { id?: string }
  ) => {
    return applyUpdate(addEntity(story, entityType, entity));
  }, [story, applyUpdate]);

  const doUpdateEntity = useCallback(<K extends EntityType>(
    entityType: K,
    entityId: string,
    updates: Partial<Omit<EntityTypeMap[K], 'id'>>
  ) => {
    return applyUpdate(updateEntity(story, entityType, entityId, updates));
  }, [story, applyUpdate]);

  const doRemoveEntity = useCallback(<K extends EntityType>(
    entityType: K,
    entityId: string,
    cascade?: boolean
  ) => {
    return applyUpdate(removeEntity(story, entityType, entityId, { cascade }));
  }, [story, applyUpdate]);

  // ========== REFACTORING ==========

  const doRenameNodeId = useCallback((oldId: string, newId: string) => {
    const result = applyUpdate(renameNodeId(story, oldId, newId));
    if (result.success && selectedNodeId === oldId) {
      setSelectedNodeId(newId);
    }
    return result;
  }, [story, applyUpdate, selectedNodeId]);

  const doRenameEntityId = useCallback(<K extends EntityType>(
    entityType: K,
    oldId: string,
    newId: string
  ) => {
    return applyUpdate(renameEntityId(story, entityType, oldId, newId));
  }, [story, applyUpdate]);

  // ========== MANIFEST ==========

  const doUpdateManifest = useCallback((updates: Partial<Omit<Story['manifest'], 'id'>>) => {
    return applyUpdate(updateManifest(story, updates));
  }, [story, applyUpdate]);

  const doUpdateCharacterCreation = useCallback((updates: Partial<CharacterCreationSchema> | undefined) => {
    return applyUpdate(updateCharacterCreation(story, updates));
  }, [story, applyUpdate]);

  const doSetStartNode = useCallback((nodeId: string) => {
    return applyUpdate(setStartNode(story, nodeId));
  }, [story, applyUpdate]);

  // ========== REGION COMMENTS ==========

  const doAddRegionComment = useCallback((comment: Omit<RegionComment, 'id'> & { id?: string }) => {
    return applyUpdate(addRegionComment(story, comment));
  }, [story, applyUpdate]);

  const doUpdateRegionComment = useCallback((commentId: string, updates: Partial<Omit<RegionComment, 'id'>>) => {
    return applyUpdate(updateRegionComment(story, commentId, updates));
  }, [story, applyUpdate]);

  const doRemoveRegionComment = useCallback((commentId: string) => {
    return applyUpdate(removeRegionComment(story, commentId));
  }, [story, applyUpdate]);

  // ========== META ==========

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  const loadStory = useCallback((newStory: Story) => {
    historyRef.current = [];
    futureRef.current = [];
    setStory(newStory);
    setSelectedNodeId(null);
    setIsDirty(false);
  }, []);

  return {
    // State
    story,
    selectedNodeId,
    isDirty,
    validation,
    canUndo,
    canRedo,

    // Selection
    selectNode: setSelectedNodeId,

    // Node operations
    addNode: doAddNode,
    updateNode: doUpdateNode,
    deleteNode: doDeleteNode,
    duplicateNode: doDuplicateNode,

    // Choice operations
    addChoice: doAddChoice,
    updateChoice: doUpdateChoice,
    removeChoice: doRemoveChoice,
    reorderChoices: doReorderChoices,

    // Entity operations
    addEntity: doAddEntity,
    updateEntity: doUpdateEntity,
    removeEntity: doRemoveEntity,

    // Refactoring
    renameNodeId: doRenameNodeId,
    renameEntityId: doRenameEntityId,

    // Manifest
    updateManifest: doUpdateManifest,
    updateCharacterCreation: doUpdateCharacterCreation,
    setStartNode: doSetStartNode,

    // Region comments
    addRegionComment: doAddRegionComment,
    updateRegionComment: doUpdateRegionComment,
    removeRegionComment: doRemoveRegionComment,

    // Meta
    undo,
    redo,
    markClean,
    loadStory,
  };
}
