#!/usr/bin/env bash
# Rebuilds the engine snapshot from the latest IDFM GTFS, on the VM, from the repository root.
# The feed covers about 30 days: run it every day, for instance from cron at 18:30 (after the 17 h update):
#   30 18 * * * cd /opt/onyva && scripts/engine/refresh-snapshot.sh >> /var/log/onyva-refresh.log 2>&1
# Nothing changes when the feed is the same. The service keeps its snapshot if any step fails.
set -euo pipefail

GTFS_URL="https://www.data.gouv.fr/api/1/datasets/r/413988ed-d340-467b-8be2-7b999fcd207a"
WORK="${ONYVA_GTFS_DIR:-data/gtfs-idfm}"
OUT="${ENGINE_SNAPSHOT_DIR:-data/engine}"
KEEP=2

mkdir -p "$WORK" "$OUT"
curl --fail --location --silent --show-error --max-time 600 --output "$WORK/IDFM-gtfs.zip.new" "$GTFS_URL"
if [ -f "$WORK/IDFM-gtfs.zip" ] && cmp -s "$WORK/IDFM-gtfs.zip" "$WORK/IDFM-gtfs.zip.new"; then
  rm "$WORK/IDFM-gtfs.zip.new"
  echo "$(date -Is) flux inchangé"
  exit 0
fi
mv "$WORK/IDFM-gtfs.zip.new" "$WORK/IDFM-gtfs.zip"
rm -rf "$WORK/raw" && mkdir -p "$WORK/raw"
# shapes.txt and object_codes_extension.txt are not needed by the engine.
unzip -q -o "$WORK/IDFM-gtfs.zip" stops.txt routes.txt trips.txt stop_times.txt calendar.txt calendar_dates.txt transfers.txt -d "$WORK/raw"
pnpm -s engine:build-network "$WORK/raw" "$OUT"
# Keep the newest snapshots only: the service loads the most recent one on SIGHUP.
ls -1t "$OUT"/snapshot-*.bin | tail -n +$((KEEP + 1)) | while read -r old; do rm -f "$old" "${old%.bin}.json"; done
docker compose -f apps/engine/compose.yaml kill -s SIGHUP engine
echo "$(date -Is) instantané reconstruit et rechargé"
