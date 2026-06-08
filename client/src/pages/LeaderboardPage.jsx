import { CalendarOutlined, CrownOutlined, ReloadOutlined, StarFilled, TrophyOutlined } from '@ant-design/icons';
import { Button, Card, Table } from 'antd';
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import RankingBadge from '../components/RankingBadge.jsx';
import ResponsiveTableWrapper from '../components/ResponsiveTableWrapper.jsx';
import { EmptyCard, ErrorCard, LoadingCard } from '../components/StateCard.jsx';
import { api } from '../lib/apiClient.js';
import { formatDate } from '../utils/formatters.js';

export default function LeaderboardPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadLeaderboard() {
    setLoading(true);
    setError(null);
    try {
      setRows(await api.getLeaderboard());
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, []);

  if (loading) return <LoadingCard message="Loading leaderboard..." />;
  if (error) return <ErrorCard error={error} onRetry={loadLeaderboard} />;

  const rankedRows = rows.map((row, index) => ({ ...row, rank: index + 1 }));
  const topPlayers = [rankedRows[0] || null, rankedRows[1] || null, rankedRows[2] || null];

  return (
    <div className="bbx-leaderboard-page">
      <PageHeader
        title="Leaderboard"
        description="Verified tournament records only. Rankings are ordered by backend-calculated points and tiebreakers."
        action={
          <Button className="bbx-outline-button" icon={<ReloadOutlined />} onClick={loadLeaderboard}>
            Refresh
          </Button>
        }
      />

      <section className="bbx-podium-grid mb-5">
        <PodiumCard player={topPlayers[1]} rank={2} />
        <PodiumCard player={topPlayers[0]} rank={1} featured />
        <PodiumCard player={topPlayers[2]} rank={3} />
      </section>

      {rows.length === 0 ? (
        <EmptyCard description="No verified tournament results are on the board yet." />
      ) : (
        <Card className="bbx-card bbx-leaderboard-table-card">
          <ResponsiveTableWrapper>
            <Table
              rowKey="user_id"
              dataSource={rankedRows}
              scroll={{ x: 980 }}
              pagination={rankedRows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
              columns={[
                {
                  title: 'Rank',
                  dataIndex: 'rank',
                  width: 100,
                  render: (rank) => <RankingBadge rank={rank} />
                },
                {
                  title: 'Player',
                  dataIndex: 'display_name',
                  sorter: (a, b) => a.display_name.localeCompare(b.display_name),
                  render: (value) => <PlayerCell name={value} />
                },
                {
                  title: 'Points',
                  dataIndex: 'total_points',
                  sorter: (a, b) => a.total_points - b.total_points,
                  render: (value) => <strong className="text-xl text-bbx-red">{value}</strong>
                },
                { title: 'Champion', dataIndex: 'champion_count' },
                { title: 'Swiss King', dataIndex: 'swiss_king_count' },
                { title: 'Match Wins', dataIndex: 'total_valid_wins' },
                { title: 'Verified Events', dataIndex: 'approved_tournament_count' },
                {
                  title: 'Most Recent',
                  dataIndex: 'most_recent_approved_tournament_date',
                  render: formatDate
                }
              ]}
            />
          </ResponsiveTableWrapper>
        </Card>
      )}
    </div>
  );
}

function PodiumCard({ player, rank, featured = false }) {
  return (
    <Card className={`bbx-card bbx-podium-card ${featured ? 'is-featured' : 'is-empty'}`}>
      <div className={`bbx-podium-ribbon rank-${rank}`}>{rank}</div>
      {player ? (
        <>
          <div className="bbx-podium-logo-wrap">
            {featured ? <CrownOutlined className="bbx-podium-crown" /> : null}
            <span className={`bbx-podium-laurel rank-${rank}`} aria-hidden="true" />
            <img src="/brand/zamboanga-pincers-logo.jpg" alt="" className="bbx-podium-logo" />
          </div>
          <div className="mt-3 text-center">
            <div className="bbx-podium-player-name text-2xl font-black leading-tight text-bbx-ink">
              {player.display_name}
            </div>
            <div className="stat-number mt-2 text-4xl font-black leading-none text-bbx-red">{player.total_points || 0}</div>
            <div className="text-xs font-black uppercase text-bbx-red">points</div>
            <div className="mt-1 text-sm font-semibold text-bbx-muted">
              {player.approved_tournament_count || 0} verified event{player.approved_tournament_count === 1 ? '' : 's'}
            </div>
          </div>
        </>
      ) : (
        <div className="bbx-podium-empty">
          <div className="bbx-podium-empty-icon">
            <CrownOutlined />
          </div>
          <div className="font-black text-bbx-muted">No player yet</div>
        </div>
      )}

      <div className="bbx-podium-metrics">
        <MiniMetric icon={<TrophyOutlined />} label="Champion" value={player?.champion_count ?? '-'} />
        <MiniMetric icon={<CrownOutlined />} label="Swiss King" value={player?.swiss_king_count ?? '-'} />
        <MiniMetric icon={<StarFilled />} label="Match Wins" value={player?.total_valid_wins ?? '-'} />
        <MiniMetric icon={<CalendarOutlined />} label="Verified Events" value={player?.approved_tournament_count ?? '-'} />
      </div>
    </Card>
  );
}

function MiniMetric({ icon, label, value }) {
  return (
    <div className="text-center">
      <div className="font-black text-bbx-red">
        <span className="mr-1">{icon}</span>
        {value}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-bbx-ink">{label}</div>
    </div>
  );
}

function PlayerCell({ name }) {
  return (
    <div className="flex items-center gap-3">
      <img src="/brand/zamboanga-pincers-logo.jpg" alt="" className="h-9 w-9 rounded object-contain" />
      <span className="font-black text-bbx-ink">{name}</span>
    </div>
  );
}
