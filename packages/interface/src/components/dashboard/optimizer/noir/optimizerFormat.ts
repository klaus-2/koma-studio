export const savingsColor = (percentage: number): string => {
  if (percentage >= 60) return 'var(--color-mint)';
  if (percentage >= 30) return 'var(--color-azure)';
  if (percentage > 0) return 'var(--color-gold)';

  return 'rgb(242 237 227 / 0.42)';
};

export const formatDelta = (percentage: number): string => {
  if (percentage >= 0) return `-${percentage}%`;
  return `+${Math.abs(percentage)}%`;
};
