import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SyncProvider } from './contexts/SyncContext';
import PublicLayout from './components/layout/PublicLayout';
import TodayWorkout from './components/public/TodayWorkout';
import Login from './components/admin/Login';
import WorkoutEntry from './components/admin/WorkoutEntry';
import ProtectedRoute from './components/shared/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<TodayWorkout />} />
              <Route path="/history" element={<div>History - Coming Soon</div>} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin/login" element={<Login />} />
            <Route
              path="/admin/workout"
              element={
                <ProtectedRoute>
                  <WorkoutEntry />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SyncProvider>
    </AuthProvider>
  );
}

export default App;
