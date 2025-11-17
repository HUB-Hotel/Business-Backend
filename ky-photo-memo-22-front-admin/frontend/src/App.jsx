import "./App.scss";
import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AuthPanel from "./components/AuthPanel";
import Landing from "./pages/Landing";
import Header from "./components/Header";
import ProtectRoute from "./components/ProtectRoute";
import UserDashboard from "./pages/user/userDashboard";
import AdminDashboard from "./pages/admin/adminDashboard";
import { PostProvider } from "./context/PostProvider";
import AdminPosts from "./pages/admin/AdminPosts";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminLayout from "./components/admin/AdminLayout";
import {
  fetchMe as apiFetchMe,
  logout as apiLogout,
  saveAuthToStorage,
  clearAuthStorage,
} from "./api/client";
function App() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  const location = useLocation();

  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [me, setMe] = useState(null);
  const isAuthed = !!token;

  const hideOn = new Set(["/", "/admin/login"]);
  const showHeader = isAuthed && !hideOn.has(location.pathname);

  const handleAuthed = async ({ user, token }) => {
    try {
      setUser(user);
      setToken(token ?? null);
      saveAuthToStorage({ user, token });
      handleFetchMe();
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch (error) {
    } finally {
      setUser(null);
      setToken(null);
      setMe(null);
      clearAuthStorage();
    }
  };

  const handleFetchMe = async () => {
    try {
      const { user } = await apiFetchMe();
      setMe(user);
    } catch (error) {
      setMe({ error: "내 정보 조회 실패" });
      console.error(error);
    }
  };

  useEffect(() => {
    if (isAuthed) handleFetchMe();
  }, [isAuthed]);

  return (
    <PostProvider>
      <div className="page">
        {showHeader && (
          <Header isAuthed={isAuthed} user={user} onLogout={handleLogout} />
        )}

        <Routes>
          <Route path="/" element={<Landing />} />
          {/* 로그인 회원가입 */}
          <Route
            path="/admin/login"
            element={
              <AuthPanel
                isAuthed={isAuthed}
                user={user}
                me={me}
                onFetchMe={handleFetchMe}
                onLogout={handleLogout}
                onAuthed={handleAuthed}
                requiredRole="admin"
              />
            }
          />
          {/* 사용자 보호구역 */}
          <Route
            path="/user"
            element={
              <ProtectRoute user={user} isAuthed={isAuthed} redirect="/" />
            }
          >
            <Route index element={<Navigate to="/user/dashboard" replace />} />
            <Route path="dashboard" element={<UserDashboard />} />
          </Route>
          {/* 관리자 보호구역 */}
          <Route
            path="/admin"
            element={
              <ProtectRoute
                isAuthed={isAuthed}
                user={user}
                requiredRole="admin"
              />
            }
          >
            <Route element={<AdminLayout />}>
              <Route
                index
                element={<Navigate to="/admin/dashboard" replace />}
              />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="posts" element={<AdminPosts />} />
              <Route path="users" element={<AdminUsers />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </PostProvider>
  );
}

export default App;