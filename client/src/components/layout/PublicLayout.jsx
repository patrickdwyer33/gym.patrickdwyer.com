import { Outlet, Link } from 'react-router-dom';
import { useSync } from '../../contexts/SyncContext';

export default function PublicLayout() {
  const { syncNow, syncing } = useSync();

  return (
    <div className="app-container">
      <header>
        <div className="header-content">
          <h1>Patrick's Gym Tracker</h1>
          <button
            onClick={syncNow}
            className="sync-btn sync-btn-header"
            disabled={syncing}
            title="Sync with server"
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
        <nav>
          <Link to="/">Today</Link>
          <Link to="/history">History</Link>
          <Link to="/admin/login">Admin</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer>
        <p>&copy; 2025 Patrick's Gym Tracker</p>
      </footer>
    </div>
  );
}
