import { useState, useCallback, useRef } from 'react';

/**
 * Optimized state hook that prevents unnecessary re-renders
 * by comparing the new value with the current value before updating
 */
export function useOptimizedState<T>(initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue);
  const previousValueRef = useRef<T>(initialValue);

  const setOptimizedState = useCallback((value: T | ((prev: T) => T)) => {
    setState((prevState) => {
      const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prevState) : value;
      
      // Only update if the value actually changed
      if (previousValueRef.current !== newValue) {
        previousValueRef.current = newValue;
        return newValue;
      }
      
      return prevState;
    });
  }, []);

  return [state, setOptimizedState];
}