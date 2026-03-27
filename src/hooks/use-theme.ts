// Re-export useTheme from theme/hooks to maintain backward compatibility
// This breaks the require cycle: primitives -> use-theme -> theme/index -> primitives
export { useTheme } from '@/theme/hooks';
