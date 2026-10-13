#!/usr/bin/env python3
"""Go and find ADPCM SWFs, then settle the 4095-vs-4096 packet length with them.

`tools/adpcm_probe.py` can answer the question the moment it is handed a suitable file. The hard
part is *getting* one: ADPCM was Flash authoring's default for short effect sounds in the Flash
4-8 era, and it has almost vanished from the developer test suites that are easy to reach (a scan
of 5,656 SWFs across ruffle, shumway and JPEXS turned up exactly zero). It survives in shipped
content.

So this tool does the looking. It searches GitHub and npm for repositories and packages that
vendor Flash content, streams each archive, keeps only the `.swf` members, scans them for ADPCM,
and runs the probe on whatever it finds. Archives are discarded as it goes; only SWFs that
actually contain ADPCM are kept, so a long hunt costs little disk.

    python3 tools/adpcm_hunt.py                          # default hunt, a few hundred repos
    python3 tools/adpcm_hunt.py --max-sources 500        # go wider
    python3 tools/adpcm_hunt.py --repo user/name ...     # hunt specific repositories
    python3 tools/adpcm_hunt.py --report evidence.json   # machine-readable result

Resumable: every source visited is recorded in `--state`, and re-running skips them. Interrupt it
with Ctrl-C at any point and the report is still written.

GitHub's search API allows 10 requests/minute unauthenticated and 30 authenticated. Set
`GITHUB_TOKEN`, or have `gh` logged in, and the hunt goes considerably faster and further.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict
from typing import Iterable, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from adpcm_probe import (  # noqa: E402
    FORMAT_ADPCM,
    SOUND_FORMATS,
    TAG_DEFINE_SOUND,
    TAG_SOUND_STREAM_HEAD,
    TAG_SOUND_STREAM_HEAD2,
    MalformedSwf,
    Observation,
    corpus_verdict,
    decompress_swf,
    iter_tags,
    observations_for_file,
    tally,
)

USER_AGENT = "swf-forge-adpcm-hunt/1.0 (+https://github.com/discorddioxin/swf-forge)"

# Flash-era content, not Flash *tooling*: player and decompiler repositories are full of SWFs that
# test AVM behaviour and carry no audio worth the name. Games, ads, demos and archives are where
# ADPCM lives.
DEFAULT_QUERIES = [
    "flash games archive swf",
    "flash game collection swf",
    "swf flash content archive",
    "flashpoint flash games",
    "actionscript 2 game source",
    "flash cartoon animation swf",
    "newgrounds flash archive",
    "flash banner ads swf",
    "flash tutorial examples swf",
    "swf test files samples",
    "flash assets swf sounds",
    "topic:flash-games",
    "topic:swf",
    "topic:flash",
]

# Repositories worth trying first, chosen because they vendor real published Flash content rather
# than hand-built conformance fixtures.
SEED_REPOS = [
    "cal-cs50/flash-games",
    "osflash/swfmill",
    "mitsuhiko/flash-games",
    "Herschel/swf-rs",
    "open-flash/open-flash",
    "DragonFlashPlayer/swf-samples",
    "BrianLima/FlashGames",
    "jindrapetrik/jpexs-decompiler",
    "ruffle-rs/ruffle",
]

DEFAULT_NPM_QUERIES = [
    "flash swf",
    "swf player sample",
    "flash game assets",
    "shockwave flash",
]

# Tooling repos already scanned to exhaustion; skipped by default so a re-hunt does not waste the
# bandwidth. `--no-skip-known` overrides.
ALREADY_SCANNED = {"ruffle-rs/ruffle", "mozilla/shumway", "jindrapetrik/jpexs-decompiler"}


# --------------------------------------------------------------------------------------------
# http
# --------------------------------------------------------------------------------------------


def github_token() -> Optional[str]:
    for name in ("GITHUB_TOKEN", "GH_TOKEN"):
        value = os.environ.get(name)
        if value:
            return value.strip()
    try:
        done = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, timeout=15)
        if done.returncode == 0 and done.stdout.strip():
            return done.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    return None


def request(url: str, token: Optional[str] = None, timeout: int = 60):
    headers = {"User-Agent": USER_AGENT, "Accept": "application/vnd.github+json"}
    if token and "api.github.com" in url:
        headers["Authorization"] = f"Bearer {token}"
    return urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout)


def get_json(url: str, token: Optional[str] = None, retries: int = 3) -> Optional[dict]:
    for attempt in range(retries):
        try:
            with request(url, token) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code in (403, 429):  # rate limited
                reset = error.headers.get("X-RateLimit-Reset")
                wait = 20.0
                if reset:
                    try:
                        wait = max(2.0, min(120.0, float(reset) - time.time() + 2))
                    except ValueError:
                        pass
                print(f"    rate limited, waiting {wait:.0f}s", file=sys.stderr)
                time.sleep(wait)
                continue
            if error.code == 404:
                return None
        except (urllib.error.URLError, OSError, json.JSONDecodeError):
            time.sleep(1 + attempt * 2)
    return None


# --------------------------------------------------------------------------------------------
# discovery
# --------------------------------------------------------------------------------------------


def search_github(queries: Iterable[str], limit: int, token: Optional[str]) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for query in queries:
        if len(found) >= limit:
            break
        for page in (1, 2):
            params = urllib.parse.urlencode(
                {"q": query, "sort": "stars", "order": "desc", "per_page": 50, "page": page}
            )
            payload = get_json(f"https://api.github.com/search/repositories?{params}", token)
            if not payload or "items" not in payload:
                break
            for item in payload["items"]:
                name = item.get("full_name")
                if name and name not in seen:
                    seen.add(name)
                    found.append(name)
            if len(payload["items"]) < 50:
                break
        if not token:
            time.sleep(6.5)  # unauthenticated search allows 10/min
    return found[:limit]


def search_npm(queries: Iterable[str], limit: int) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for query in queries:
        if len(found) >= limit:
            break
        params = urllib.parse.urlencode({"text": query, "size": 100})
        payload = get_json(f"https://registry.npmjs.org/-/v1/search?{params}")
        for item in (payload or {}).get("objects", []):
            name = item.get("package", {}).get("name")
            if name and name not in seen:
                seen.add(name)
                found.append(name)
    return found[:limit]


def npm_tarball(name: str) -> Optional[str]:
    payload = get_json(f"https://registry.npmjs.org/{urllib.parse.quote(name, safe='@')}")
    if not payload:
        return None
    latest = payload.get("dist-tags", {}).get("latest")
    version = payload.get("versions", {}).get(latest) if latest else None
    return (version or {}).get("dist", {}).get("tarball")


# --------------------------------------------------------------------------------------------
# harvesting
# --------------------------------------------------------------------------------------------


def safe_name(archive_member: str) -> str:
    """Flatten an archive member name into a single safe filename.

    Archive members are attacker-controlled in the sense that they come off the internet, so the
    result must contain no separators and no traversal sequence, whatever went in.
    """
    flat = re.sub(r"[^A-Za-z0-9._-]+", "_", archive_member.strip("/"))
    flat = re.sub(r"\.{2,}", ".", flat).lstrip(".-")
    return flat[-150:] or "unnamed.swf"


class BudgetExceeded(Exception):
    pass


class BudgetedReader:
    """A read-only stream that gives up after a byte budget or a wall-clock deadline.

    Without this the harvester can stall indefinitely: the socket timeout only fires when *no*
    data arrives, so a multi-gigabyte repository that happens to contain three SWFs will trickle
    through to the end. The caps that matter are on what is *downloaded*, not on what is kept.
    """

    def __init__(self, stream, max_bytes: int, deadline: float) -> None:
        self.stream = stream
        self.max_bytes = max_bytes
        self.deadline = deadline
        self.read_bytes = 0

    def read(self, size: int = -1) -> bytes:
        if self.read_bytes > self.max_bytes:
            raise BudgetExceeded("download budget exhausted")
        if time.time() > self.deadline:
            raise BudgetExceeded("time budget exhausted")
        chunk = self.stream.read(size)
        self.read_bytes += len(chunk)
        return chunk

    def close(self) -> None:
        try:
            self.stream.close()
        except OSError:
            pass


def harvest(
    url: str,
    destination: str,
    max_bytes: int,
    max_files: int,
    timeout: int,
    max_download: int = 0,
) -> tuple[list[str], str]:
    """Stream a .tar.gz, writing out only its .swf members. Returns (paths, status)."""
    paths: list[str] = []
    total = 0
    budget = max_download or max(max_bytes * 8, 512 << 20)
    try:
        with request(url, timeout=timeout) as response:
            reader = BudgetedReader(response, budget, time.time() + timeout)
            with tarfile.open(fileobj=reader, mode="r|gz") as archive:  # streaming, no seeking
                for member in archive:
                    if not member.isfile() or not member.name.lower().endswith(".swf"):
                        continue
                    if member.size <= 0 or member.size > max_bytes:
                        continue
                    if total + member.size > max_bytes or len(paths) >= max_files:
                        return paths, "capped"
                    handle = archive.extractfile(member)
                    if handle is None:
                        continue
                    data = handle.read()
                    target = os.path.join(destination, f"{len(paths):04d}_{safe_name(member.name)}")
                    with open(target, "wb") as out:
                        out.write(data)
                    paths.append(target)
                    total += len(data)
    except BudgetExceeded as error:
        return paths, f"budget: {error}"
    except tarfile.TarError as error:
        # A budget trip surfaces through tarfile as a read failure; report it as the budget.
        return paths, "budget: download truncated" if "BudgetExceeded" in repr(error) else f"archive error: {error}"
    except urllib.error.HTTPError as error:
        return paths, f"http {error.code}"
    except (urllib.error.URLError, OSError, EOFError) as error:
        return paths, f"network: {error}"
    return paths, "ok"


def github_archive_urls(repo: str) -> list[str]:
    return [f"https://codeload.github.com/{repo}/tar.gz/refs/heads/{branch}" for branch in ("master", "main")]


# --------------------------------------------------------------------------------------------
# scanning
# --------------------------------------------------------------------------------------------


def sound_formats(path: str) -> tuple[set[int], bool]:
    """(sound format codes present, parsed ok)"""
    try:
        with open(path, "rb") as handle:
            body, _version, _compression = decompress_swf(handle.read())
    except (OSError, MalformedSwf):
        return set(), False
    formats: set[int] = set()
    for code, payload in iter_tags(body):
        if code == TAG_DEFINE_SOUND and len(payload) >= 7:
            formats.add(payload[2] >> 4)
        elif code in (TAG_SOUND_STREAM_HEAD, TAG_SOUND_STREAM_HEAD2) and len(payload) >= 4:
            formats.add(payload[1] >> 4)
    return formats, True


class Hunt:
    def __init__(self, keep_dir: str) -> None:
        self.keep_dir = keep_dir
        self.observations: list[Observation] = []
        self.format_counts: dict[str, int] = {}
        self.files_scanned = 0
        self.files_parsed = 0
        self.adpcm_files: list[str] = []
        self.digests: set[str] = set()
        self.sources: list[dict] = []

    def scan(self, paths: list[str], origin: str) -> int:
        """Scan harvested files; keep the ones with ADPCM. Returns the ADPCM file count."""
        hits = 0
        for path in paths:
            self.files_scanned += 1
            try:
                with open(path, "rb") as handle:
                    digest = hashlib.sha256(handle.read()).hexdigest()
            except OSError:
                continue
            if digest in self.digests:
                continue  # the same SWF is vendored in many repositories
            self.digests.add(digest)

            formats, parsed = sound_formats(path)
            if not parsed:
                continue
            self.files_parsed += 1
            for code in formats:
                label = SOUND_FORMATS.get(code, f"unknown ({code})")
                self.format_counts[label] = self.format_counts.get(label, 0) + 1
            if FORMAT_ADPCM not in formats:
                continue

            kept = os.path.join(self.keep_dir, f"{digest[:12]}_{os.path.basename(path)}")
            shutil.copyfile(path, kept)
            found, error = observations_for_file(kept)
            if error:
                continue
            hits += 1
            self.adpcm_files.append(kept)
            for item in found:
                item.source = f"{origin}:{os.path.basename(path)}"
            self.observations.extend(found)
        return hits

    def verdict(self) -> tuple[dict[str, int], str]:
        counts = tally(self.observations)
        return counts, corpus_verdict(counts)


# --------------------------------------------------------------------------------------------
# orchestration
# --------------------------------------------------------------------------------------------


def load_state(path: str) -> set[str]:
    try:
        with open(path) as handle:
            return set(json.load(handle).get("visited", []))
    except (OSError, json.JSONDecodeError):
        return set()


def save_state(path: str, visited: set[str]) -> None:
    try:
        with open(path, "w") as handle:
            json.dump({"visited": sorted(visited)}, handle, indent=1)
    except OSError:
        pass


def write_report(path: str, hunt: Hunt, elapsed: float) -> None:
    counts, verdict = hunt.verdict()
    report = {
        "tool": "adpcm_hunt",
        "question": "ADPCM packet length: 4096 output samples (reading A) or 4095 (reading B)?",
        "elapsedSeconds": round(elapsed, 1),
        "sourcesVisited": len(hunt.sources),
        "filesScanned": hunt.files_scanned,
        "filesParsed": hunt.files_parsed,
        "uniqueFiles": len(hunt.digests),
        "soundFormatsSeen": dict(sorted(hunt.format_counts.items(), key=lambda kv: -kv[1])),
        "filesWithAdpcm": len(hunt.adpcm_files),
        "adpcmFiles": hunt.adpcm_files,
        "counts": counts,
        "verdict": verdict,
        "observations": [asdict(item) for item in hunt.observations],
        "sources": hunt.sources,
    }
    with open(path, "w") as handle:
        json.dump(report, handle, indent=2)


def report_to_stdout(hunt: Hunt, elapsed: float, report_path: str) -> None:
    counts, verdict = hunt.verdict()
    print("\n" + "=" * 78)
    print(f"sources visited      : {len(hunt.sources)}")
    print(f"SWFs scanned         : {hunt.files_scanned}  ({len(hunt.digests)} unique, {hunt.files_parsed} parsed)")
    if hunt.format_counts:
        print("sound formats seen   :")
        for label, count in sorted(hunt.format_counts.items(), key=lambda kv: -kv[1]):
            print(f"  {count:>6} file(s)  {label}")
    print(f"files with ADPCM     : {len(hunt.adpcm_files)}")
    print(f"ADPCM observations   : {len(hunt.observations)}")
    print(f"  proving reading A  : {counts['A']}")
    print(f"  proving reading B  : {counts['B']}")
    print(f"  inconclusive       : {counts['inconclusive']}")
    print(f"  fits neither       : {counts['neither']}")
    print(f"elapsed              : {elapsed:.0f}s")
    print(f"\nVERDICT: {verdict}")
    print(f"\nreport written to {report_path}")
    if hunt.adpcm_files:
        print(f"ADPCM files kept in {os.path.dirname(hunt.adpcm_files[0])}")
        print("Re-run `python3 tools/adpcm_probe.py <that directory>` for the per-asset detail.")
    else:
        print(
            "\nNo ADPCM found yet. Widen with --max-sources, add --repo owner/name for a corpus you\n"
            "know of, or point adpcm_probe.py at Flash content you have locally."
        )


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--repo", action="append", default=[], help="a specific owner/name to hunt (repeatable)")
    parser.add_argument("--npm", action="append", default=[], help="a specific npm package to hunt (repeatable)")
    parser.add_argument("--query", action="append", default=[], help="extra GitHub search query (repeatable)")
    parser.add_argument("--max-sources", type=int, default=120, help="repositories/packages to try (default 120)")
    parser.add_argument("--max-mb-per-source", type=int, default=120, help="SWF bytes to take per source")
    parser.add_argument("--max-files-per-source", type=int, default=400, help="SWFs to take per source")
    parser.add_argument("--timeout", type=int, default=120, help="per-archive wall-clock budget in seconds")
    parser.add_argument("--max-download-mb", type=int, default=400, help="bytes to pull per archive before giving up")
    parser.add_argument("--out", default="/tmp/adpcm-hunt", help="where to keep ADPCM-bearing SWFs")
    parser.add_argument("--report", default="", help="JSON report path (default <out>/report.json)")
    parser.add_argument("--state", default="", help="resume state path (default <out>/state.json)")
    parser.add_argument("--no-skip-known", action="store_true", help="also re-scan already-exhausted corpora")
    parser.add_argument("--no-search", action="store_true", help="only use --repo/--npm/seeds, no searching")
    parser.add_argument("--stop-on-hit", action="store_true", help="stop as soon as a verdict is reached")
    args = parser.parse_args(argv)

    os.makedirs(args.out, exist_ok=True)
    report_path = args.report or os.path.join(args.out, "report.json")
    state_path = args.state or os.path.join(args.out, "state.json")
    visited = load_state(state_path)

    token = github_token()
    print(f"GitHub auth: {'token found' if token else 'anonymous (slower; set GITHUB_TOKEN)'}")

    repos: list[str] = list(args.repo)
    packages: list[str] = list(args.npm)
    if not args.no_search:
        repos.extend(name for name in SEED_REPOS if name not in repos)
        print("searching GitHub...")
        repos.extend(search_github(args.query + DEFAULT_QUERIES, args.max_sources, token))
        print("searching npm...")
        packages.extend(search_npm(DEFAULT_NPM_QUERIES, max(20, args.max_sources // 4)))

    skip = set() if args.no_skip_known else ALREADY_SCANNED
    ordered = [("github", name) for name in dict.fromkeys(repos) if name not in skip]
    ordered += [("npm", name) for name in dict.fromkeys(packages)]
    ordered = [entry for entry in ordered if f"{entry[0]}:{entry[1]}" not in visited][: args.max_sources]

    print(f"{len(ordered)} source(s) to try (skipping {len(visited)} already visited)\n")

    hunt = Hunt(args.out)
    cap = args.max_mb_per_source * 1024 * 1024
    started = time.time()

    try:
        for index, (kind, name) in enumerate(ordered, start=1):
            key = f"{kind}:{name}"
            urls = github_archive_urls(name) if kind == "github" else [npm_tarball(name) or ""]
            with tempfile.TemporaryDirectory(prefix="adpcm-hunt-") as scratch:
                paths: list[str] = []
                status = "no archive"
                for url in urls:
                    if not url:
                        continue
                    paths, status = harvest(
                        url, scratch, cap, args.max_files_per_source, args.timeout, args.max_download_mb * 1024 * 1024
                    )
                    if paths or status == "ok":
                        break
                hits = hunt.scan(paths, key) if paths else 0

            visited.add(key)
            hunt.sources.append({"source": key, "swfs": len(paths), "adpcmFiles": hits, "status": status})
            flag = f"  <-- {hits} ADPCM file(s)" if hits else ""
            print(f"[{index:>4}/{len(ordered)}] {key:<52} {len(paths):>5} swf  {status}{flag}")

            if index % 10 == 0:
                save_state(state_path, visited)
                write_report(report_path, hunt, time.time() - started)
            if args.stop_on_hit and hunt.verdict()[1][0] in "AB":
                print("\nverdict reached; stopping early")
                break
    except KeyboardInterrupt:
        print("\ninterrupted — writing what we have")

    save_state(state_path, visited)
    write_report(report_path, hunt, time.time() - started)
    report_to_stdout(hunt, time.time() - started, report_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
