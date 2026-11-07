export function rewardModes(values: Record<string, string | undefined>) {
  const enabled = values.tab_rewards_visible !== 'false';
  return {
    wheel: enabled && values.tab_wheel_visible !== 'false',
    tasks: enabled && values.tab_tasks_visible !== 'false',
  };
}

export function reusableReply(reply: { pinned: boolean; uses: number }) {
  return reply.pinned || reply.uses >= 2;
}