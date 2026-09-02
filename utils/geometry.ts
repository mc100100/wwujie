import { Position, Viewport } from '../types';

/**
 * Converts screen coordinates (clientX, clientY) to world coordinates (canvas space).
 */
export const screenToWorld = (screenPos: Position, viewport: Viewport): Position => {
  return {
    x: (screenPos.x - viewport.x) / viewport.scale,
    y: (screenPos.y - viewport.y) / viewport.scale,
  };
};

/**
 * Calculates the distance between two points.
 */
export const getDistance = (p1: Position, p2: Position): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

/**
 * Calculates the midpoint between two points.
 */
export const getMidpoint = (p1: Position, p2: Position): Position => {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
};
