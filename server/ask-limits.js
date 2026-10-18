const descriptions={
  user_minute:'your AI generation limit (3 per minute)',
  user_daily:'your AI generation limit (25 per UTC day)',
  deployment_daily:'the deployment AI generation limit (200 per UTC day)',
  user_hourly_reads:'your authenticated request limit (300 per hour)',
  in_progress:'the in-progress request limit for this question'
};

// Public metadata only: never include owner hashes, Redis keys, tokens or questions.
export function askLimitResponse(rateLimit){
  const labels=rateLimit.limits.map(l=>descriptions[l.code]);
  if(labels.some(l=>!l))throw Error('Unknown rate limit.');
  const inProgress=rateLimit.limits.every(l=>l.code==='in_progress');
  const retryAfterSeconds=Math.max(0,Math.ceil((Date.parse(rateLimit.retryAt)-Date.parse(rateLimit.serverTime))/1000));
  return {
    error:`Ask your ledger: ${labels.join(' and ')} ${labels.length===1?'was':'were'} reached. ${inProgress?'An answer is already being prepared.':'These limits are shared with AI summary.'} Retry at ${rateLimit.retryAt} (UTC).`,
    code:'ask_rate_limited',...rateLimit,retryAfterSeconds
  };
}
