/** Journey durations are shown in whole minutes, rounded up: never promise a shorter trip. */
export function minutes(seconds: number) { return Math.ceil(seconds / 60); }
