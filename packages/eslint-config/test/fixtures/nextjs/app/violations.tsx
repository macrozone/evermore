function useCount(): number {
  return 1;
}

export function Avatar({ count }: { count: number }) {
  if (count > 1) {
    useCount();
  }
  return count ? <img src="/avatar.png" alt="" /> : null;
}
