// In-memory store for keeping track of live job matches without altering the DB schema
let totalLiveMatches = 0;

export function addLiveMatchesCount(count) {
    totalLiveMatches += (count || 0);
}

export function getTotalLiveMatchesCount() {
    return totalLiveMatches;
}