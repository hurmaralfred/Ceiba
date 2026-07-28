"use client";

/**
 * FamilyNodeVisual — placeholder for future extraction of node rendering.
 *
 * The node rendering currently lives inline in FamilyTreeGraph.tsx where it
 * has direct access to all state (selectedId, focusedId, immediateFamily,
 * etc.). Extracting it cleanly requires threading those through props or
 * moving them to context, which is a separate refactor.
 *
 * This file exists to satisfy the component structure requested in EPIC 3
 * and to serve as the target file when that extraction happens.
 */

// No-op export; real node rendering remains in FamilyTreeGraph.tsx for now.
export {};
