export default function GlassCard({ children, className = '', ...props }) {
  return (
    <div className={`glass-panel p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}
