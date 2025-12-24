import { Outlet, Link } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="app-container">
      <header>
        <h1>Patrick's Gym Tracker</h1>
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
