from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import requests.exceptions
from nba_api.stats.endpoints import leaguedashplayerstats, playerindex


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'web' / 'data' / 'players.json'

NBA_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Host': 'stats.nba.com',
    'Origin': 'https://www.nba.com',
    'Referer': 'https://www.nba.com/',
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/131.0.0.0 Safari/537.36'
    ),
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
}

_TIMEOUT = 60
_MAX_RETRIES = 3
_RETRY_DELAY = 10


_RETRYABLE = (
    requests.exceptions.Timeout,
    requests.exceptions.ConnectionError,
    requests.exceptions.ReadTimeout,
)


def _fetch_with_retry(endpoint_cls, **kwargs):
    last_exc: Exception | None = None
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            return endpoint_cls(headers=NBA_HEADERS, timeout=_TIMEOUT, **kwargs)
        except _RETRYABLE as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                print(f'Attempt {attempt} failed ({exc}); retrying in {_RETRY_DELAY}s…')
                time.sleep(_RETRY_DELAY)
            else:
                print(f'All {_MAX_RETRIES} attempts failed.')
    if last_exc is None:
        raise RuntimeError('_fetch_with_retry: no attempts were made')
    raise last_exc

CONTINENT_MAP = {
    'USA': 'North America', 'Canada': 'North America', 'Mexico': 'North America', 'Puerto Rico': 'North America',
    'Dominican Republic': 'North America', 'Jamaica': 'North America', 'Cuba': 'North America', 'Trinidad and Tobago': 'North America',
    'Bahamas': 'North America', 'Haiti': 'North America', 'France': 'Europe', 'Germany': 'Europe', 'Spain': 'Europe', 'Serbia': 'Europe',
    'Croatia': 'Europe', 'Slovenia': 'Europe', 'Greece': 'Europe', 'Italy': 'Europe', 'Latvia': 'Europe', 'Lithuania': 'Europe',
    'Montenegro': 'Europe', 'Bosnia and Herzegovina': 'Europe', 'Macedonia': 'Europe', 'North Macedonia': 'Europe', 'Czech Republic': 'Europe',
    'Slovakia': 'Europe', 'Poland': 'Europe', 'Turkey': 'Europe', 'Russia': 'Europe', 'Ukraine': 'Europe', 'Belarus': 'Europe',
    'Georgia': 'Europe', 'Albania': 'Europe', 'Sweden': 'Europe', 'Norway': 'Europe', 'Denmark': 'Europe', 'Finland': 'Europe',
    'Netherlands': 'Europe', 'Belgium': 'Europe', 'Switzerland': 'Europe', 'Austria': 'Europe', 'Portugal': 'Europe', 'Hungary': 'Europe',
    'Romania': 'Europe', 'Bulgaria': 'Europe', 'Kosovo': 'Europe', 'Bosnia': 'Europe', 'Nigeria': 'Africa', 'Congo': 'Africa',
    'Cameroon': 'Africa', 'South Sudan': 'Africa', 'Sudan': 'Africa', 'Senegal': 'Africa', 'Mali': 'Africa', 'Ivory Coast': 'Africa',
    'Ghana': 'Africa', 'Egypt': 'Africa', 'Morocco': 'Africa', 'Angola': 'Africa', 'Tunisia': 'Africa', 'Somalia': 'Africa',
    'Ethiopia': 'Africa', 'Brazil': 'South America', 'Argentina': 'South America', 'Venezuela': 'South America', 'Colombia': 'South America',
    'Bolivia': 'South America', 'Chile': 'South America', 'Peru': 'South America', 'Uruguay': 'South America', 'Paraguay': 'South America',
    'Ecuador': 'South America', 'China': 'Asia', 'Japan': 'Asia', 'South Korea': 'Asia', 'Philippines': 'Asia', 'Israel': 'Asia',
    'Lebanon': 'Asia', 'Iran': 'Asia', 'Australia': 'Oceania', 'New Zealand': 'Oceania',
}

CONFERENCE_MAP = {
    'ATL': 'East', 'BOS': 'East', 'BKN': 'East', 'CHA': 'East', 'CHI': 'East', 'CLE': 'East', 'DET': 'East', 'IND': 'East',
    'MIA': 'East', 'MIL': 'East', 'NYK': 'East', 'ORL': 'East', 'PHI': 'East', 'TOR': 'East', 'WAS': 'East',
    'DAL': 'West', 'DEN': 'West', 'GSW': 'West', 'HOU': 'West', 'LAC': 'West', 'LAL': 'West', 'MEM': 'West', 'MIN': 'West',
    'NOP': 'West', 'OKC': 'West', 'PHX': 'West', 'POR': 'West', 'SAC': 'West', 'SAS': 'West', 'UTA': 'West',
}


def parse_height(value: str) -> int | None:
    if not value or '-' not in value:
        return None
    feet, inches = value.split('-', 1)
    try:
        return int(feet) * 12 + int(inches)
    except ValueError:
        return None


def to_percent(value) -> float | None:
    try:
        return round(float(value) * 100, 1)
    except (TypeError, ValueError):
        return None


def per_game(total, games_played) -> float:
    try:
        gp = float(games_played or 0)
        if gp <= 0:
            return 0.0
        return round(float(total or 0) / gp, 1)
    except (TypeError, ValueError):
        return 0.0


def main() -> None:
    index_response = _fetch_with_retry(playerindex.PlayerIndex)
    index_dict = index_response.player_index.get_dict()
    index_headers = index_dict['headers']
    index_rows = [dict(zip(index_headers, row)) for row in index_dict['data']]

    time.sleep(2)

    stats_response = _fetch_with_retry(leaguedashplayerstats.LeagueDashPlayerStats)
    stats_dict = stats_response.league_dash_player_stats.get_dict()
    stats_headers = stats_dict['headers']
    stats_rows = [dict(zip(stats_headers, row)) for row in stats_dict['data']]
    stats_by_id = {int(row['PLAYER_ID']): row for row in stats_rows}

    players = []
    for row in index_rows:
        if row.get('IS_DEFUNCT'):
            continue
        if not row.get('ROSTER_STATUS'):
            continue

        player_id = int(row['PERSON_ID'])
        stats = stats_by_id.get(player_id, {})
        name = f"{row['PLAYER_FIRST_NAME']} {row['PLAYER_LAST_NAME']}".strip()
        team = row.get('TEAM_ABBREVIATION') or ''
        country = row.get('COUNTRY') or ''
        draft_year = str(row.get('DRAFT_YEAR') or '').strip()

        players.append({
            'player_id': player_id,
            'name': name,
            'team': team,
            'conference': CONFERENCE_MAP.get(team, 'Unknown'),
            'position': (row.get('POSITION') or '').replace(' ', ''),
            'height_display': row.get('HEIGHT') or '',
            'height_inches': parse_height(row.get('HEIGHT') or ''),
            'age': int(round(float(stats['AGE']))) if stats.get('AGE') is not None else None,
            'jersey_number': str(row.get('JERSEY_NUMBER') or '').strip(),
            'draft_year': draft_year if draft_year and draft_year != 'Undrafted' else 'N/A',
            'country': country,
            'continent': CONTINENT_MAP.get(country, 'Other'),
            'headshot_url': f'https://cdn.nba.com/headshots/nba/latest/260x190/{player_id}.png',
            'stats': {
                'ppg': per_game(stats.get('PTS'), stats.get('GP')),
                'rpg': per_game(stats.get('REB'), stats.get('GP')),
                'apg': per_game(stats.get('AST'), stats.get('GP')),
                'fg_pct': to_percent(stats.get('FG_PCT')),
                'fg3_pct': to_percent(stats.get('FG3_PCT')),
                'spg': per_game(stats.get('STL'), stats.get('GP')),
                'gp': int(float(stats.get('GP', 0) or 0)),
            },
        })

    players.sort(key=lambda player: player['name'])

    payload = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'player_count': len(players),
        'players': players,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(players)} players to {OUTPUT}')


if __name__ == '__main__':
    main()
