export default function LoadingSpinner({ size = 'md', color = 'cyan' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  const colors = { cyan: 'border-cyan-400', purple: 'border-purple-500', white: 'border-white' };
  return (
    <div
      className={`animate-spin rounded-full border-2 border-t-transparent ${sizes[size]} ${colors[color]}`}
    />
  );
}
