export const CATEGORIES = [
  { value: 'Meme', color: 'from-pink-500 to-rose-500', bgColor: 'bg-gradient-to-r from-pink-500/20 to-rose-500/20', textColor: 'text-pink-300', emoji: '😂' },
  { value: 'Gaming', color: 'from-violet-500 to-purple-500', bgColor: 'bg-gradient-to-r from-violet-500/20 to-purple-500/20', textColor: 'text-violet-300', emoji: '🎮' },
  { value: 'DeFi', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20', textColor: 'text-blue-300', emoji: '💰' },
  { value: 'Utility', color: 'from-green-500 to-emerald-500', bgColor: 'bg-gradient-to-r from-green-500/20 to-emerald-500/20', textColor: 'text-green-300', emoji: '🔧' },
  { value: 'Community', color: 'from-orange-500 to-amber-500', bgColor: 'bg-gradient-to-r from-orange-500/20 to-amber-500/20', textColor: 'text-orange-300', emoji: '👥' },
  { value: 'NFT', color: 'from-indigo-500 to-blue-500', bgColor: 'bg-gradient-to-r from-indigo-500/20 to-blue-500/20', textColor: 'text-indigo-300', emoji: '🎨' },
  { value: 'AI', color: 'from-teal-500 to-cyan-500', bgColor: 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20', textColor: 'text-teal-300', emoji: '🤖' },
  { value: 'Other', color: 'from-gray-500 to-slate-500', bgColor: 'bg-gradient-to-r from-gray-500/20 to-slate-500/20', textColor: 'text-gray-300', emoji: '📦' },
];

export const getCategoryConfig = (category) => {
  const config = CATEGORIES.find(c => c.value === category);
  return config || CATEGORIES[CATEGORIES.length - 1];
};

export const CategoryBadge = ({ category, size = 'sm' }) => {
  const config = getCategoryConfig(category);

  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.textColor} ${sizeClasses[size]}`}>
      <span>{config.emoji}</span>
      <span>{config.value}</span>
    </span>
  );
};

export const calculateDaysOnMarket = (createdAt) => {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  const now = new Date();
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};
